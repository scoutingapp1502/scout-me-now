import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface TermsSectionProps {
  onBack: () => void;
}

const SECTIONS_RO = [
  {
    title: "1. Acceptarea termenilor",
    body: "Prin crearea unui cont sau folosirea SportRise ești de acord cu acești Termeni și Condiții și cu Politica de confidențialitate. Dacă nu ești de acord, te rugăm să nu folosești aplicația.",
  },
  {
    title: "2. Cine poate folosi SportRise",
    body: "SportRise este o platformă de scouting sportiv destinată sportivilor, scouterilor, agenților și reprezentanților de cluburi. Ești responsabil să oferi informații corecte despre identitatea și rolul tău la înregistrare, iar rolurile de scout/agent pot fi supuse verificării.",
  },
  {
    title: "3. Contul tău",
    body: "Ești responsabil pentru păstrarea confidențialității datelor de autentificare și pentru toate activitățile derulate din contul tău. Ne poți contacta oricând pentru a-ți șterge contul sau datele asociate.",
  },
  {
    title: "4. Conținutul generat de utilizatori",
    body: "Rămâi proprietarul conținutului pe care îl postezi (postări, videoclipuri de teste, imagini de profil), dar ne acorzi o licență neexclusivă de a-l afișa în aplicație persoanelor autorizate să îl vadă, conform setărilor tale de confidențialitate. Nu posta conținut ilegal, ofensator, înșelător sau care încalcă drepturile altor persoane.",
  },
  {
    title: "5. Comportament interzis",
    body: "Este interzisă hărțuirea altor utilizatori, spam-ul, impersonarea, publicarea de informații false despre performanțe sportive, precum și orice încercare de a ocoli măsurile de confidențialitate sau moderare ale platformei.",
  },
  {
    title: "6. Video și teste de performanță",
    body: "Videoclipurile trimise pentru teste atletice și tehnice sunt revizuite pentru verificarea autenticității. Ne rezervăm dreptul de a respinge sau elimina conținut care nu respectă regulile testului sau pare fraudulos.",
  },
  {
    title: "7. Suspendare și încetare",
    body: "Putem suspenda sau închide conturi care încalcă acești termeni, fără notificare prealabilă în cazuri grave (fraudă, hărțuire, conținut ilegal).",
  },
  {
    title: "8. Limitarea răspunderii",
    body: "SportRise este un instrument de conectare între sportivi și profesioniști din domeniu; nu garantăm rezultate (transferuri, contracte, oferte) în urma folosirii platformei.",
  },
  {
    title: "9. Modificări",
    body: "Putem actualiza acești termeni periodic. Continuarea folosirii aplicației după o actualizare reprezintă acceptarea noilor termeni.",
  },
  {
    title: "10. Contact",
    body: "Pentru întrebări legate de acești termeni, ne poți contacta din secțiunea Ajutor și asistență a aplicației.",
  },
];

const SECTIONS_EN = [
  {
    title: "1. Acceptance of terms",
    body: "By creating an account or using SportRise you agree to these Terms and Conditions and our Privacy Policy. If you don't agree, please don't use the app.",
  },
  {
    title: "2. Who can use SportRise",
    body: "SportRise is a sports scouting platform for players, scouts, agents and club representatives. You're responsible for providing accurate information about your identity and role at sign-up, and scout/agent roles may be subject to verification.",
  },
  {
    title: "3. Your account",
    body: "You're responsible for keeping your login credentials confidential and for all activity under your account. You can contact us at any time to delete your account or associated data.",
  },
  {
    title: "4. User-generated content",
    body: "You keep ownership of the content you post (posts, test videos, profile pictures), but you grant us a non-exclusive license to display it in the app to people authorized to see it, based on your privacy settings. Don't post illegal, offensive, misleading content, or content that infringes on others' rights.",
  },
  {
    title: "5. Prohibited conduct",
    body: "Harassing other users, spamming, impersonation, publishing false information about athletic performance, and any attempt to bypass the platform's privacy or moderation measures are all prohibited.",
  },
  {
    title: "6. Video and performance tests",
    body: "Videos submitted for athletic and technical tests are reviewed to verify authenticity. We reserve the right to reject or remove content that doesn't follow the test rules or appears fraudulent.",
  },
  {
    title: "7. Suspension and termination",
    body: "We may suspend or close accounts that violate these terms, without prior notice in serious cases (fraud, harassment, illegal content).",
  },
  {
    title: "8. Limitation of liability",
    body: "SportRise is a tool that connects players with industry professionals; we don't guarantee outcomes (transfers, contracts, offers) from using the platform.",
  },
  {
    title: "9. Changes",
    body: "We may update these terms periodically. Continuing to use the app after an update means you accept the new terms.",
  },
  {
    title: "10. Contact",
    body: "For questions about these terms, you can reach us from the Help and support section of the app.",
  },
];

export default function TermsSection({ onBack }: TermsSectionProps) {
  const { lang } = useLanguage();
  const sections = lang === "ro" ? SECTIONS_RO : SECTIONS_EN;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Termeni de utilizare" : "Terms of Use"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <p className="text-xs text-muted-foreground font-body">
          {lang === "ro" ? "Ultima actualizare: 24 iulie 2026" : "Last updated: July 24, 2026"}
        </p>
        {sections.map((s) => (
          <div key={s.title}>
            <p className="text-sm font-semibold font-body text-foreground mb-1">{s.title}</p>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
