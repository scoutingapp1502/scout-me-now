# Prompt de implementare — moderare automată video (MVP, fără infrastructură GPU)

Context: SportRise permite upload de video (postări, teste de performanță) de maximum 60 secunde. Niciun video nu trebuie să devină public înainte de finalizarea verificării inițiale. Arhitectura este 100% serverless/pay-per-use pe infrastructura Supabase existentă — **fără server GPU, fără VPS permanent, fără Whisper/modele PyTorch self-hosted**. Costul trebuie să rămână aproape zero pentru majoritatea video-urilor; API-urile comerciale se apelează doar pentru procentul semnalat de prima trecere.

Vârsta autorului (din `player_profiles.date_of_birth` / `scout_profiles.date_of_birth`, deja implementate) **nu blochează automat publicarea** — dar coboară pragul de "incert" pentru autorii sub 18 ani, astfel încât mai multe cazuri ambigue ajung la recheck/admin pentru ei decât pentru un adult cu același scor brut.

## 0. Principiul arhitecturii (obligatoriu de respectat)

```
UPLOAD (HTTPS, storage privat, status=pending)
  → EXTRAGERE CADRE (Edge Function, ffmpeg.wasm sau serviciu ieftin)
  → PRIMA TRECERE — gratuit/aproape gratuit (OpenAI Moderation pe cadre + text OCR/caption)
  → RISK ENGINE — scoruri separate per categorie
  → LOW risk  → APPROVED → publicat
  → MEDIUM/UNCERTAIN risk → RECHECK cu serviciul comercial potrivit categoriei declanșate (doar acea categorie, doar datele strict necesare)
  → recheck confirmă "curat" → APPROVED
  → recheck confirmă/menține riscul → ADMIN REVIEW (nepublicat)
  → HIGH risk direct din prima trecere → ADMIN REVIEW direct (fără recheck, ca să nu cheltuim bani pe ceva deja clar)
  → Admin: APPROVE / REJECT
```

Separat, independent de fluxul de mai sus: **Report după publicare** — orice utilizator poate raporta un video deja publicat; raportul îl trimite înapoi în coada de admin review (nu re-declanșează automat API-urile comerciale, ca să nu poată fi folosit ca atac de tip "raportează în masă ca să scumpești adversarul").

## 1. Upload și storage (extensie a ce există deja)

Bucket-urile `player-videos` sunt deja private (din migrarea `20260926090000_private_media_buckets.sql`). Adaugă:

- Coloană `moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','flagged','rejected'))` pe fiecare tabelă care poate conține un video de utilizator: `posts` (`video_url`), `player_profiles` (fiecare coloană `*_video`/`*_video_url` de test — dacă schimbarea de schemă e prea mare, tratează testele separat prin `video_submissions`, care deja există și are propriul `status`), `video_submissions`.
- RLS: un rând cu `moderation_status != 'approved'` e vizibil DOAR autorului (cu un badge "în verificare" pe client) și adminilor. Politicile de SELECT existente pe `posts`/`video_submissions` trebuie extinse cu `AND (moderation_status = 'approved' OR user_id = auth.uid() OR has_role(auth.uid(),'admin'))`.
- Nu construi un bucket nou — cadrele extrase sunt temporare (§7) și nu ating niciodată storage-ul permanent.

## 2. Extragerea cadrelor (fără FFmpeg self-hosted, fără GPU)

Nu instala FFmpeg pe un server dedicat. Două opțiuni acceptabile pentru MVP, în ordinea preferinței:

**Opțiunea A (recomandată) — extragere în browser înainte de upload**, cu `ffmpeg.wasm` (rulează în tab-ul utilizatorului, cost zero de infrastructură):
- La selectarea fișierului video, înainte de `supabase.storage.upload`, rulează `ffmpeg.wasm` client-side pentru a extrage 6 cadre JPEG: la 0%, 20%, 40%, 60%, 80%, 100% din durată.
- Cadrele se urcă o singură dată către un Edge Function `analyze-video-frames` ca payload (base64, max ~200KB/cadru după compresie) — Edge Function-ul NU descarcă video-ul original, deci nu are nevoie de FFmpeg server-side pentru pasul inițial.
- Limitare de securitate cunoscută și acceptată: un client modificat ar putea trimite cadre "curate" diferite de video-ul real urcat. Asta e motivul pentru care §6 (recheck) și §8 (report) rămân — sistemul nu se bazează 100% pe integritatea clientului.

**Opțiunea B (fallback dacă A nu e fezabilă tehnic)** — Edge Function apelează un serviciu extern de extragere de cadre (ex. Cloudinary sau Mux au un free tier care generează thumbnail-uri la timestamp-uri date via URL, fără cod de procesare al tău). Documentează costul (de obicei gratuit sub un prag de request-uri/lună) dacă alegi asta.

Implementează Opțiunea A. Nu construi un worker persistent pentru asta.

## 3. Prima trecere (gratuit) — OpenAI Moderation API + text

Edge Function `analyze-video-frames`:
- **Input**: array de 6 cadre (base64), caption/descriere text a postării (dacă există), `user_id`, `content_type` ('post' | 'test_video'), `content_id`.
- Pentru fiecare cadru: apelează **OpenAI Moderation API** (`omni-moderation-latest`, gratuit, fără cheie de facturare separată — cere doar un API key OpenAI). Detectează: `sexual`, `sexual/minors`, `violence`, `violence/graphic`, `hate`, `harassment`, `self-harm`. **Nu** acoperă bine: arme (weapons) ca obiect vizual generic, droguri ca obiect vizual, "dangerous content" non-violent (ex. cascadorii periculoase). Documentează asta explicit în cod ca un comentariu — e limitarea cunoscută a acestui model.
- Pentru caption/text: același OpenAI Moderation API, pe text (endpoint identic, input text în loc de imagine).
- Rezultatul brut per cadru se agregă per categorie (`max()` peste cele 6 cadre, nu medie — un singur cadru problematic trebuie să conteze).

**Ce se întâmplă dacă OpenAI Moderation e indisponibil**: retry o dată cu backoff scurt (2s); dacă tot eșuează, marchează conținutul `flagged` (NU `approved` implicit — fail-safe, nu fail-open) și trimite direct la admin review cu motivul "prima verificare automată indisponibilă". Nu bloca upload-ul pentru utilizator — el vede "video în verificare", identic cu fluxul normal.

## 4. Risk Engine — scoruri per categorie

Tabel nou `content_moderation_results`:
```sql
CREATE TABLE public.content_moderation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scores jsonb NOT NULL,          -- {"nudity":0.05,"sexual":0.08,"violence":0.63,"gore":0.12,"weapons":0.31,"drugs":0.04,"hate":0.09,"threats":0.07,"text":0.02}
  stage text NOT NULL,            -- 'initial' | 'recheck'
  provider text NOT NULL,         -- 'openai_moderation' | 'google_video_intelligence' | 'google_vision_safesearch' | 'claude_vision'
  decision text NOT NULL,         -- 'approved' | 'recheck' | 'admin_review'
  created_at timestamptz NOT NULL DEFAULT now()
);
```
RLS: admin-only SELECT (via `has_role`); INSERT doar din Edge Functions cu service role (nicio policy pentru `authenticated`/`anon`).

Praguri configurabile într-un tabel `moderation_thresholds` (nu hardcodate), cu o coloană `category`, `low_max` (sub asta = LOW), `high_min` (peste asta = HIGH direct), restul = UNCERTAIN. Valori inițiale de pornit (le vei calibra ulterior, documentează asta explicit ca TODO în seed data):

| categorie | low_max | high_min |
|---|---|---|
| sexual/nudity | 0.15 | 0.70 |
| violence/gore | 0.20 | 0.75 |
| weapons | 0.20 | 0.70 |
| drugs | 0.20 | 0.70 |
| hate/extremism | 0.15 | 0.70 |
| threats/harassment | 0.15 | 0.70 |
| text (caption/OCR) | 0.15 | 0.70 |

**Ajustare pentru autori sub 18 ani** (din data nașterii, calculată la momentul analizei): `low_max` se înmulțește cu 0.7 pentru toate categoriile — deci un scor care ar fi LOW pentru un adult poate deveni UNCERTAIN pentru un minor, fără să existe niciun blocaj automat separat legat de vârstă. Implementează asta ca un multiplicator în funcția de decizie, nu ca un branch hardcodat, ca să rămână ușor de recalibrat.

Decizia finală = cea mai severă dintre toate categoriile (dacă o singură categorie e HIGH, tot conținutul e HIGH, indiferent cât de curate sunt celelalte).

## 5. Rutare după prima trecere

- **Toate categoriile LOW** → `moderation_status = 'approved'`. Publicat imediat.
- **Vreo categorie HIGH** (peste `high_min`) → `moderation_status = 'flagged'`, direct la admin review, **fără recheck** — nu cheltui bani pe un caz deja clar.
- **Vreo categorie UNCERTAIN** (între `low_max` și `high_min`), nicio categorie HIGH → trece la §6, recheck, doar pe categoria/categoriile UNCERTAIN.

## 6. Recheck — API-ul potrivit per categorie (apelat DOAR pe categoria declanșată)

Edge Function separat `recheck-video-content`, apelat doar pentru conținutul ajuns la stadiul UNCERTAIN. Primește DOAR datele necesare categoriei respective — nu tot video-ul, nu toate cadrele, dacă nu e nevoie.

| Categorie declanșată | Serviciu de recheck | Ce verifică exact | Ce date primește | Cost / free tier |
|---|---|---|---|---|
| `sexual` / `nudity` | **Google Cloud Video Intelligence — Explicit Content Detection** | Probabilitate de conținut adult pe segmente temporale ale video-ului (nu doar cadre statice — analizează mișcare/tranziții) | Video-ul original (descărcat temporar din storage privat de Edge Function prin service role, trimis către API, apoi șters — vezi §9) | ~$0,10/minut video analizat; pentru clipuri de 60s = $0,10/video la acest pas (doar pentru cele UNCERTAIN, nu pentru toate) |
| `violence` / `gore` | **Google Cloud Vision — SafeSearch Detection**, aplicat pe 2-3 cadre suplimentare extrase exact din zona temporală unde cadrul inițial a dat scorul mare | `adult`, `violence`, `racy` likelihood pe cadre statice | Doar cadrele suplimentare (imagini, nu tot video-ul) | Gratuit până la 1.000 unități/lună, apoi ~$1,50/1.000 imagini |
| `weapons` | **Google Cloud Vision — Object Localization** pe aceleași cadre suplimentare | Detectează obiecte din categoria arme (etichete `Weapon`, `Firearm`, `Knife` etc.) | Cadrele suplimentare | Inclus în același free tier Vision (1.000 unități/lună gratuit) |
| `drugs` | **Google Cloud Vision — Label Detection** (etichete generice) ca prim semnal, **combinat cu Claude Vision (Haiku)** ca a doua opinie contextuală, pentru că Vision generic nu are o categorie dedicată "drugs" fiabilă | Cadrele suplimentare | Vision: gratuit în același free tier. Claude Haiku vision: ~$0,001-0,002/imagine |
| `hate` / `extremism` | **A doua trecere de text cu Claude Haiku** (nu Google — nu are un endpoint dedicat de hate speech pe text independent bun pentru română) pe caption + orice text OCR găsit în cadre | Doar textul (caption + OCR), niciodată imaginea brută | ~$0,0005/apel |
| `threats` / `harassment` | Același apel Claude Haiku de mai sus, aceleași date (se face o singură dată pentru ambele categorii de text) | idem | idem (nu se dublează costul) |
| `text` (caption general, dacă OpenAI l-a dat UNCERTAIN) | Claude Haiku, aceleași date ca mai sus | idem | idem |

**OCR pentru text-din-video**: folosește **Google Cloud Vision — Text Detection (OCR)**, aplicat pe aceleași cadre eșantionate din pasul 2 (nu cadre noi) — extrage orice text suprapus pe video (subtitrări, watermark-uri, mesaje scrise pe tablă/afiș). OCR-ul rulează o singură dată la prima trecere pe cadrele deja extrase (cost inclus în free tier-ul Vision de mai sus), nu doar la recheck — pentru că text periculos poate apărea și fără ca imaginea în sine să declanșeze nimic la OpenAI Moderation.

**Ce se întâmplă dacă serviciul de recheck e indisponibil**: retry o dată; dacă tot eșuează, conținutul NU rămâne "uncertain" la infinit — trece automat la `admin_review` cu motivul explicit "recheck indisponibil", niciodată nu se aprobă automat din lipsă de răspuns (fail-safe).

## 7. Decizie după recheck

- Recheck indică risc scăzut pe categoria verificată (sub `low_max` al acelei categorii, folosind pragurile serviciului secundar, calibrate separat) → `moderation_status = 'approved'`, publicat.
- Recheck confirmă sau nu poate infirma riscul → `moderation_status = 'flagged'`, admin review.
- Scrie rezultatul recheck-ului ca un rând nou în `content_moderation_results` cu `stage = 'recheck'`, păstrând istoricul complet al deciziei (necesar pentru §9, auditabilitate).

## 8. Admin Review

Extinde `AdminSupportTickets.tsx`-ul existent sau creează o pagină nouă `AdminContentModeration.tsx` (recomandat separat, pentru claritate — nu amesteca rapoartele de utilizatori cu coada de moderare automată):
- Listă de conținut `pending`/`flagged`, cu: preview video (semnat, folosind `getSignedMediaUrl` deja implementat), scorurile din `content_moderation_results` afișate per categorie, vârsta/vechimea autorului, istoricul de rapoarte anterioare al autorului (dacă există, din `support_tickets`).
- Acțiuni: **Approve** (→ `moderation_status = 'approved'`) / **Reject** (→ `moderation_status = 'rejected'`, video rămâne în storage 30 de zile pentru eventuale dovezi, apoi șters printr-un job — poți implementa ștergerea ca un pas manual documentat pentru MVP, nu un cron obligatoriu acum).
- La Reject, notifică autorul (toast/notificare in-app existentă) fără să expună scorurile brute (doar "conținutul tău nu respectă regulile comunității").

## 9. Report după publicare

Reutilizează exact tiparul din `support_tickets`/`reported_user_id` deja implementat pentru raportarea de utilizatori (din feature-ul anterior), extins cu o coloană `reported_content_id`/`reported_content_type` pentru a lega raportul de un video specific, nu doar de un cont. Un report NU re-declanșează automat OpenAI/Google/Claude (ar fi un vector de atac — raportare în masă pentru a scumpi/lovi un utilizator țintă) — trece direct la coada de Admin Review din §8, marcat cu sursa "user_report" ca să se distingă de cele venite din pipeline-ul automat.

## 10. GDPR / privacy-by-design (obligatoriu, nu opțional)

- **Minimizarea datelor trimise extern**: fiecare API extern primește STRICT ce e necesar pentru categoria lui (§6) — niciodată tot video-ul dacă doar cadrele sunt suficiente; niciodată imaginea dacă doar textul e verificat.
- **Cadrele temporare** (extrase în §2, folosite în §3/§6) nu se scriu niciodată în storage permanent — trec prin memorie în Edge Function (base64 în request/response) și nu ajung pe disk decât efemer în timpul execuției funcției (Deno runtime-ul Edge Function le eliberează la finalul execuției; nu le persista tu explicit).
- **Video-ul original descărcat temporar pentru Google Video Intelligence** (§6, singurul pas care are nevoie de tot fișierul): descarcă din storage privat direct în memoria Edge Function-ului, trimite la API, șterge referința imediat după primirea răspunsului — nu scrie pe disk local, nu păstra o copie secundară.
- **Retenție**: rândurile din `content_moderation_results` se păstrează 90 de zile (job de curățare — poate fi manual pentru MVP, documentat ca TODO pentru un cron ulterior), suficient pentru audit/contestații, nu la infinit.
- **Fără recunoaștere facială, fără identificare de persoane** — niciunul dintre API-urile alese (OpenAI Moderation, Google Vision SafeSearch/Label/Text/Object, Google Video Intelligence Explicit Content, Claude Haiku) nu face recunoaștere facială; nu adăuga acest tip de request la niciunul dintre ele.
- **Criptare**: bucket-urile sunt deja private (TLS în tranzit by default prin Supabase Storage; encryption-at-rest e gestionat de infrastructura Supabase/S3-compatible, nu necesită cod suplimentar).
- **Politica de confidențialitate**: adaugă o mențiune în `PrivacyPolicySection.tsx` (secțiunea deja existentă despre date colectate) că video-urile trec printr-un sistem automat de verificare a conținutului, inclusiv, pentru un procent redus de cazuri, prin servicii externe (numește-le generic: "furnizori specializați în detectarea conținutului nepotrivit"), fără a se folosi recunoaștere facială.

## 11. Ce NU trebuie construit în acest MVP (excluderi explicite)

- Niciun server GPU, VPS permanent, sau container cu FFmpeg/Whisper/PyTorch rulând continuu.
- Niciun speech-to-text pe pista audio (Whisper local sau altfel) — dacă vrei asta ulterior, e o extensie separată, nu face parte din acest prompt.
- Nicio verificare video completă minut-cu-minut prin Google Video Intelligence pentru toate cele 3 categorii deodată — se apelează doar pe categoria declanșată (§6), niciodată "ca să fim siguri" pe toate.
- Niciun blocaj automat bazat doar pe vârsta autorului — vârsta ajustează doar pragul de sensibilitate (§4), nu forțează admin review de una singură.
- Niciun cron/job persistent obligatoriu pentru MVP — curățarea `content_moderation_results` și ștergerea video-urilor respinse după 30 de zile pot rămâne manuale, documentate ca TODO.

## 12. Verificare finală

După implementare: `npx tsc --noEmit` și `npm run build`. Listează la final: variabilele de mediu noi necesare (chei API OpenAI, Google Cloud, Anthropic — toate ca secrete Supabase, niciodată în cod), Edge Functions noi de deployat (`analyze-video-frames`, `recheck-video-content`), migrarea SQL nouă + `APPLY_*.sql` corespunzător, și pașii manuali (obținerea cheilor API, activarea Video Intelligence API și Vision API în Google Cloud Console, setarea pragurilor inițiale în `moderation_thresholds`).
