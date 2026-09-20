import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LegalDocBody from "@/components/legal/LegalDocBody";
import { PRIVACY_VERSION, legalLastUpdatedLabel } from "@/lib/legalVersions";

interface PrivacyPolicySectionProps {
  onBack: () => void;
}

export const PRIVACY_SECTIONS_RO = [
  {
    title: "1. Cine suntem",
    body: "Această Politică de Confidențialitate explică modul în care SportRise (\"noi\", \"aplicația\", \"Platforma\") colectează, folosește, stochează și protejează datele tale personale atunci când folosești Platforma. Pentru orice întrebare legată de datele tale, ne poți contacta din pagina de Contact.",
  },
  {
    title: "2. Ce date colectăm",
    body: "Colectăm: (a) date pe care ni le oferi direct — nume, prenume, data nașterii, gen, naționalitate, fotografie de profil, poziție/rol sportiv, echipă, date fizice (înălțime, greutate), videoclipuri de teste, postări, mesaje, recomandări; (b) date tehnice generate automat — tipul de dispozitiv și browser, activitatea din aplicație (aprecieri, urmăritori, ora ultimei conectări); (c) date de verificare — pentru conturile de tip Descoperitor/Agent, documentele încărcate pentru confirmarea identității și a activității profesionale.",
  },
  {
    title: "3. Temeiul legal al prelucrării",
    body: "Prelucrăm datele tale în baza: executării contractului dintre tine și SportRise, pentru a-ți putea oferi Serviciul; consimțământului tău explicit, de exemplu pentru încărcarea videoclipurilor de test; interesului nostru legitim, pentru a preveni frauda și a asigura siguranța Platformei; și a obligațiilor legale, atunci când este cazul.",
  },
  {
    title: "4. Cum folosim datele",
    body: "Datele tale sunt folosite pentru: a-ți afișa profilul altor utilizatori conform setărilor tale de confidențialitate; a-ți arăta conținut relevant în comunitate; a verifica identitatea și activitatea conturilor de tip Descoperitor/Agent; a preveni fraudele și comportamentele abuzive; a îmbunătăți funcționarea și securitatea aplicației; și a te contacta în legătură cu contul tău sau cu solicitări de suport.",
  },
  {
    title: "5. Vârsta minimă și utilizatorii minori",
    body: "SportRise poate fi folosit doar de persoane cu vârsta de cel puțin 13 ani. Data nașterii este obligatorie la înregistrare și este verificată automat; nu creăm conturi și nu colectăm cu bună știință date despre persoane sub 13 ani. Dacă aflăm că un cont aparține unei persoane sub această vârstă, îl vom închide și vom șterge datele asociate. Utilizatorii cu vârsta între 13 și 15 ani pot crea un cont doar după ce bifează, la înregistrare, o declarație prin care confirmă că un părinte sau tutore legal este la curent și de acord cu înregistrarea; este o declarație pe propria răspundere, completată de minor, fără o verificare suplimentară a identității părintelui. Utilizatorii cu vârsta între 13 și 18 ani sunt în continuare minori, iar datele lor (inclusiv fotografii și videoclipuri) sunt tratate cu un nivel sporit de protecție; videoclipurile de test necesită un consimțământ explicit separat înainte de încărcare. Părinții sau tutorii legali ai unui utilizator minor pot solicita oricând accesul, corectarea sau ștergerea datelor acestuia, contactându-ne prin pagina de Contact.",
  },
  {
    title: "6. Cu cine sunt distribuite datele",
    body: "Nu vindem și nu închiriem datele tale către terți. Informațiile din profil sunt vizibile altor utilizatori conform setărilor tale de confidențialitate. Fișierele (poze, videoclipuri, documente) sunt stocate securizat, prin intermediul unor furnizori de găzduire și infrastructură, și sunt accesibile doar persoanelor autorizate să vadă conținutul respectiv. Putem divulga date atunci când legea o impune sau pentru a proteja drepturile, siguranța ori proprietatea SportRise sau ale utilizatorilor săi.",
  },
  {
    title: "7. Transferul internațional al datelor",
    body: "Furnizorii noștri de infrastructură pot stoca sau procesa date în afara României. În aceste cazuri, ne asigurăm că transferul se realizează în condiții care oferă un nivel adecvat de protecție, conform legislației aplicabile privind protecția datelor.",
  },
  {
    title: "8. Păstrarea datelor",
    body: "Păstrăm datele tale atât timp cât contul tău este activ și cât este necesar pentru a-ți oferi Serviciul. La ștergerea contului, datele asociate sunt eliminate definitiv într-un termen rezonabil, cu excepția cazurilor în care păstrarea lor este cerută de lege sau este necesară pentru soluționarea unor dispute.",
  },
  {
    title: "9. Drepturile tale",
    body: "Ai dreptul: să accesezi datele pe care le deținem despre tine; să soliciți corectarea datelor inexacte; să soliciți ștergerea datelor tale; să restricționezi sau să te opui anumitor prelucrări; să soliciți portabilitatea datelor; să îți retragi consimțământul în orice moment; și să depui o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP) sau la autoritatea echivalentă din țara ta. Poți corecta majoritatea datelor direct din profilul tău, poți descărca oricând o copie completă a datelor tale în format JSON (Setări → Contul tău → Descarcă datele mele), iar ștergerea definitivă a contului o poți face imediat, din Setări → Contul tău. Pentru celelalte drepturi (restricționare sau opoziție), trimite-ne o cerere prin pagina de Contact sau din secțiunea Ajutor și asistență — o vom procesa manual și îți vom răspunde în cel mai scurt timp.",
  },
  {
    title: "10. Securitate",
    body: "Folosim măsuri tehnice și organizatorice — criptare, controlul accesului, autentificare securizată — pentru a proteja datele tale împotriva accesului neautorizat, pierderii, distrugerii sau utilizării abuzive. Cu toate acestea, nicio metodă de transmisie sau stocare electronică nu este 100% sigură.",
  },
  {
    title: "11. Cookies și tehnologii similare",
    body: "Folosim cookie-uri și stocare locală strict necesare funcționării aplicației. Detalii complete găsești în Politica de Cookies.",
  },
  {
    title: "12. Modificări ale acestei politici",
    body: "Putem actualiza această politică periodic. Te vom notifica despre modificările semnificative prin aplicație sau email. Continuarea folosirii aplicației după o actualizare reprezintă acceptarea noii politici.",
  },
  {
    title: "13. Contact",
    body: "Pentru întrebări legate de datele tale sau despre această politică, ne poți contacta din secțiunea Ajutor și asistență a aplicației sau din pagina de Contact.",
  },
];

export const PRIVACY_SECTIONS_EN = [
  {
    title: "1. Who we are",
    body: "This Privacy Policy explains how SportRise (\"we\", \"the app\", \"the Platform\") collects, uses, stores, and protects your personal data when you use the Platform. For any question about your data, you can reach us from the Contact page.",
  },
  {
    title: "2. What data we collect",
    body: "We collect: (a) data you give us directly — first and last name, date of birth, gender, nationality, profile photo, sport position/role, team, physical data (height, weight), test videos, posts, messages, recommendations; (b) technical data generated automatically — device and browser type, in-app activity (likes, followers, last login time); (c) verification data — for Scout/Agent accounts, documents uploaded to confirm identity and professional activity.",
  },
  {
    title: "3. Legal basis for processing",
    body: "We process your data based on: performance of the contract between you and SportRise, so we can provide the Service; your explicit consent, for example when uploading test videos; our legitimate interest, to prevent fraud and keep the Platform safe; and legal obligations, where applicable.",
  },
  {
    title: "4. How we use your data",
    body: "Your data is used to: show your profile to other users according to your privacy settings; show you relevant content in the community; verify Scout/Agent accounts; prevent fraud and abusive behavior; improve how the app works and its security; and contact you about your account or support requests.",
  },
  {
    title: "5. Minimum age and minor users",
    body: "SportRise may only be used by people who are at least 13 years old. Your date of birth is required at registration and is checked automatically; we do not create accounts for, or knowingly collect data about, anyone under 13. If we learn that an account belongs to someone under that age, we will close it and delete the associated data. Users aged 13 to 15 can only create an account after checking a declaration, at signup, confirming that a parent or legal guardian is aware of and agrees with the registration; this is a self-declaration filled in by the minor, without any further verification of the parent's identity. Users aged 13 to 18 are still minors, and their data (including photos and videos) is handled with an elevated level of protection; test videos require a separate, explicit consent before upload. The parents or legal guardians of a minor user can request access to, correction of, or deletion of that user's data at any time by contacting us through the Contact page.",
  },
  {
    title: "6. Who we share your data with",
    body: "We don't sell or rent your data to third parties. Profile information is visible to other users according to your privacy settings. Files (photos, videos, documents) are stored securely, through hosting and infrastructure providers, and are only accessible to people authorized to see that content. We may disclose data when required by law, or to protect the rights, safety, or property of SportRise or its users.",
  },
  {
    title: "7. International data transfers",
    body: "Our infrastructure providers may store or process data outside of Romania. In such cases, we ensure the transfer takes place under conditions that provide an adequate level of protection, in accordance with applicable data protection law.",
  },
  {
    title: "8. Data retention",
    body: "We keep your data for as long as your account is active and for as long as necessary to provide the Service. When you delete your account, associated data is permanently removed within a reasonable timeframe, except where retention is required by law or necessary to resolve a dispute.",
  },
  {
    title: "9. Your rights",
    body: "You have the right to: access the data we hold about you; request correction of inaccurate data; request deletion of your data; restrict or object to certain processing; request data portability; withdraw your consent at any time; and file a complaint with the National Supervisory Authority for Personal Data Processing (ANSPDCP) or the equivalent authority in your country. You can correct most of your data directly from your profile, download a complete copy of your data in JSON format at any time (Settings → Your account → Download my data), and permanently delete your account instantly from Settings → Your account. For the other rights (restriction or objection), send us a request through the Contact page or the Help and support section — we'll process it manually and respond as soon as possible.",
  },
  {
    title: "10. Security",
    body: "We use technical and organizational measures — encryption, access control, secure authentication — to protect your data against unauthorized access, loss, destruction, or misuse. That said, no method of electronic transmission or storage is 100% secure.",
  },
  {
    title: "11. Cookies and similar technologies",
    body: "We use cookies and local storage strictly necessary for the app to function. Full details are available in our Cookie Policy.",
  },
  {
    title: "12. Changes to this policy",
    body: "We may update this policy periodically. We'll notify you of significant changes through the app or by email. Continuing to use the app after an update means you accept the new policy.",
  },
  {
    title: "13. Contact",
    body: "For questions about your data or this policy, you can reach us from the Help and support section of the app or the Contact page.",
  },
];

export default function PrivacyPolicySection({ onBack }: PrivacyPolicySectionProps) {
  const { lang } = useLanguage();
  const sections = lang === "ro" ? PRIVACY_SECTIONS_RO : PRIVACY_SECTIONS_EN;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="relative flex items-center px-4 py-3 border-b border-gray-200 shrink-0">
        <button onClick={onBack} className="p-1 text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-gray-900 whitespace-nowrap">
          {lang === "ro" ? "Politica de confidențialitate" : "Privacy Policy"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <LegalDocBody
          eyebrow="LEGAL"
          title={lang === "ro" ? "Politica de Confidențialitate" : "Privacy Policy"}
          lastUpdated={legalLastUpdatedLabel(lang, PRIVACY_VERSION, "privacy")}
          tocLabel={lang === "ro" ? "Cuprins" : "Table of Contents"}
          sections={sections}
          compact
        />
      </div>
    </div>
  );
}
