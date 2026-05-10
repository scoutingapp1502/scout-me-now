

# ⚽ FootballScout - Platformă de Promovare pentru Jucători de Fotbal

## Viziune
O platformă sportivă și energică unde jucătorii de fotbal își pot crea profiluri complete pentru a fi descoperiți de scouteri, iar scouterii pot căuta și contacta talente.

---

## 🎨 Design & Stil
- **Culori**: Verde intens, galben electric, alb — inspirate din teren
- **Font-uri**: Bold și dinamice pentru titluri, clean pentru text
- **Imagini**: Fundal cu elemente de fotbal, aspect modern și energic

---

## 📄 Pagini principale

### 1. Landing Page (Pagina principală)
- Hero section cu mesaj motivant pentru jucători
- Buton **"Creează profilul gratuit"** → deschide pagina de înregistrare
- Secțiune cu beneficii (vizibilitate, contact direct cu scouteri)
- Testimoniale / statistici platformă
- Footer cu link-uri utile

### 2. Pagina de Înregistrare / Autentificare
- Formular de **înregistrare** cu selecție tip cont: Jucător sau Scouter
- Login pentru utilizatori existenți
- Autentificare cu email și parolă (prin Supabase)

### 3. Profil Jucător (după autentificare)
- **Date personale**: Nume, vârstă, înălțime, greutate, naționalitate, foto
- **Date fotbalistice**: Poziție, picior preferat, echipă curentă
- **Statistici**: Goluri, assisturi, meciuri jucate
- **Video highlights**: Link-uri YouTube/Vimeo
- **Palmares**: Trofee, realizări
- **CV descărcabil**: Upload PDF
- **Link-uri social media**: Instagram, TikTok, etc.
- **Contact agent**: Nume și date de contact

### 4. Profil Scouter (după autentificare)
- Nume, organizație/club, țară
- Posibilitatea de a salva jucători la favorite
- Trimitere mesaje/cereri de contact către jucători

### 5. Pagina de Căutare Jucători
- Filtre: poziție, vârstă, naționalitate, nivel
- Carduri cu preview profil jucător
- Accesibilă pentru scouteri (și vizitatori)

### 6. Pagina de Profil Public al Jucătorului
- Versiunea publică a profilului, vizibilă pentru scouteri și vizitatori

---

## 🔧 Backend (Lovable Cloud / Supabase)

- **Autentificare**: Email + parolă
- **Bază de date**: Tabele pentru profiluri jucători, profiluri scouteri, roluri utilizatori, favorite
- **Storage**: Pentru fotografii de profil și CV-uri PDF
- **RLS (Row Level Security)**: Fiecare utilizator își poate edita doar propriul profil

---

## 🚀 Ordinea implementării

1. **Landing page** cu design sportiv și butoanele funcționale
2. **Pagina de înregistrare** (Jucător / Scouter) + login
3. **Backend**: Autentificare + bază de date + roluri
4. **Formular creare profil jucător** complet
5. **Pagina de căutare** + profil public jucător
6. **Dashboard scouter** cu favorite și contact

