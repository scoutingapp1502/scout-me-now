# Prompt de implementare — conformitate legală SportRise (vârstă minimă, ștergere date, consimțământ, securitate)

Context: SportRise este un proiect personal (nu operat printr-o firmă/PFA înregistrată — clauza asta rămâne neschimbată în Termeni). Nu se face nicio schimbare legată de entitate legală/CUI/sediu în acest prompt.

Implementează, în ordine, următoarele patru module. Fiecare are propria migrare SQL (idempotentă: `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` înainte de `CREATE POLICY`), copiată și într-un fișier `APPLY_*.sql` separat, conform convenției existente în acest proiect. Verifică `npx tsc --noEmit` și `npm run build` după fiecare modul, nu doar la final.

## 1. Vârstă minimă obligatorie la înregistrare (16 ani, fără excepție)

**Problema actuală**: `src/pages/Auth.tsx` (`handleRegister`) nu colectează deloc data nașterii la signup. Câmpul `date_of_birth` există doar ca opțional, post-signup, în `PersonalProfile.tsx`, fără nicio validare de vârstă.

**De implementat**:
- Adaugă un câmp obligatoriu "Data nașterii" în formularul de înregistrare din `Auth.tsx`, alături de celelalte câmpuri obligatorii existente.
- Validare client-side: blochează submit-ul dacă vârsta calculată din data introdusă e sub 16 ani, cu un mesaj clar ("Trebuie să ai cel puțin 16 ani pentru a-ți crea un cont pe SportRise").
- **Validare server-side obligatorie** (nu te baza doar pe client): o migrare SQL care adaugă un `CHECK constraint` sau un trigger `BEFORE INSERT`/`BEFORE UPDATE` pe tabela care stochează `date_of_birth` (verifică dacă e `profiles` sau `player_profiles` — folosește-o pe cea corectă conform schemei curente), care respinge orice rând cu vârstă calculată sub 16 ani la data inserării.
- Actualizează `src/components/dashboard/PrivacyPolicySection.tsx` și `TermsSection.tsx` (secțiunile despre minori) ca să reflecte pragul de 16 ani ca prag strict, nu doar "necesită consimțământul părintelui" — elimină orice formulare ambiguă care sugerează că sub 16 ani ar fi posibil cu acordul unui părinte, dacă există.
- Nu construi niciun flux de consimțământ parental verificabil (identitate, semnătură) — a fost respins explicit ca opțiune; pragul dur de 16 ani înlocuiește nevoia lui.

## 2. Înregistrarea formală a consimțământului la Termeni și Politica de Confidențialitate

**Problema actuală**: `agreedToTerms` în `Auth.tsx` e doar `useState` local — gate-uiește butonul de submit dar nu ajunge niciodată în baza de date. Nu există nicio dovadă că un utilizator a acceptat vreodată Termenii/Confidențialitatea, la ce versiune, sau când.

**De implementat**:
- Migrare nouă: tabel `public.user_consents` cu coloane `id uuid default gen_random_uuid() primary key`, `user_id uuid references auth.users(id) on delete cascade not null`, `consent_type text not null` (ex: `'terms_of_service'`, `'privacy_policy'`), `version text not null`, `accepted_at timestamptz not null default now()`. RLS: utilizatorul poate insera/citi doar propriile rânduri (`auth.uid() = user_id`); adminii pot citi tot (folosește `has_role()` existent, la fel ca în restul schemei).
- Definește o constantă de versiune curentă pentru Termeni și pentru Privacy (ex. `TERMS_VERSION = "2.0"`, `PRIVACY_VERSION = "2.0"`, aliniat cu "Version 2.0" deja afișat în `PrivacyPolicySection.tsx`) undeva central (ex. `src/lib/legalVersions.ts`), ca să poată fi incrementată ușor când textul se schimbă.
- La signup reușit în `Auth.tsx`, după crearea contului, inserează două rânduri în `user_consents` (unul pentru `terms_of_service`, unul pentru `privacy_policy`) cu versiunea curentă.
- **Re-consimțământ la schimbare de versiune**: dacă un utilizator existent se loghează și versiunea curentă din cod e mai nouă decât ultimul consimțământ înregistrat al lui pentru acel tip, arată un dialog obligatoriu (blocking, nu poate fi închis fără acceptare) care cere re-acceptarea, înainte de a-i permite acces la restul aplicației. Poți urma tiparul din `VideoConsentDialog.tsx` ca referință de stil, dar acesta trebuie să fie blocant (nu opțional).

## 3. Export de date (dreptul la portabilitate, GDPR Art. 20)

**Problema actuală**: nu există niciun mecanism self-service; Politica de Confidențialitate promite doar "procesare manuală" via formularul de contact.

**De implementat**:
- O nouă acțiune în Setări (lângă "Șterge cont" din `SettingsSection.tsx`) — "Descarcă datele mele" / "Download my data".
- Un nou Edge Function (ex. `supabase/functions/export-my-data/index.ts`) care: validează JWT-ul apelantului la fel ca `ban-user`/`submit-scout-document` (derivă `user_id` din `adminClient.auth.getUser()`, niciodată din body), interoghează toate tabelele relevante unde apare `user_id`-ul lui (profil, postări, mesaje trimise, rapoarte făcute — NU date despre alți utilizatori, ex. nu include mesajele primite de la alții în formă brută dacă asta ar expune conținutul altcuiva fără consimțământul lor — verifică ce e rezonabil de inclus), și returnează un JSON structurat.
- Client-side: la primirea răspunsului, generează un fișier `.json` descărcabil direct în browser (`Blob` + link temporar), fără să treacă prin server extern.
- Nu construi un sistem de cozi/job-uri asincrone pentru asta — volumul de date per utilizator e mic, un răspuns sincron e suficient.

## 4. Ștergere de date — completarea limitării cunoscute

**Problema actuală**: `delete_my_account()` (RPC existent) șterge corect toate datele din schema `public`, dar **nu poate șterge rândul din `auth.users`** (necesită service-role, nu e expus către clienți autentificați) — identitatea auth rămâne orfană la infinit.

**De implementat**:
- Un nou Edge Function (ex. `supabase/functions/delete-auth-user/index.ts`) care, după ce clientul apelează deja `delete_my_account()` RPC-ul existent cu succes, e apelat separat pentru a finaliza ștergerea: validează JWT-ul apelantului (`adminClient.auth.getUser()`), extrage `caller.id` din token (NICIODATĂ din body — urmează exact tiparul de securitate din `ban-user`), apoi cheamă `adminClient.auth.admin.deleteUser(caller.id)` cu service-role key.
- Actualizează `handleDeleteAccount` în `SettingsSection.tsx` să apeleze RPC-ul existent ȘI apoi acest nou Edge Function, în această ordine, înainte de sign-out și redirect. Dacă Edge Function-ul eșuează după ce RPC-ul a reușit deja (datele publice sunt deja șterse), afișează totuși succes către utilizator (din perspectiva lui, contul e șters) dar loghează eroarea undeva vizibil pentru tine (`console.error` e suficient, nu construi infrastructură de alerting nouă).
- Actualizează comentariul din migrarea `20260811099000_delete_my_account_rpc.sql` care documentează limitarea, ca să reflecte că acum e rezolvată prin acest Edge Function suplimentar (nu modifica RPC-ul SQL însuși, doar comentariul/documentația).

## Verificare finală

După toate cele patru module: rulează `npx tsc --noEmit` și `npm run build`. Nu deploya niciun Edge Function nou automat — listează la final exact ce fișiere `APPLY_*.sql` trebuie rulate manual în Supabase SQL Editor și ce comenzi `supabase functions deploy <nume>` trebuie rulate manual, în ordinea corectă.

## Ce NU intră în acest prompt (decizii excluse explicit)

- Nicio înregistrare de firmă/PFA, CUI, sediu — rămâne "proiect personal" conform clauzei actuale din Terms.
- Niciun flux de consimțământ parental pentru minori sub 16 ani — pragul dur de 16 ani înlocuiește complet nevoia asta.
- Niciun cookie-consent banner — nu există momentan tracking/analytics care să-l necesite (confirmat: zero scripturi de analytics în cod).
