import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LegalDocBody from "@/components/legal/LegalDocBody";
import { TERMS_VERSION, legalLastUpdatedLabel } from "@/lib/legalVersions";

interface TermsSectionProps {
  onBack: () => void;
}

export const TERMS_SECTIONS_RO = [
  {
    title: "1. Acceptarea termenilor",
    body: "Acești Termeni și Condiții (\"Termenii\") guvernează accesul și folosirea platformei SportRise — site-ul web, aplicația mobilă (atunci când va fi disponibilă) și toate serviciile asociate, denumite împreună \"Platforma\". Prin crearea unui cont, prin accesarea sau prin folosirea Platformei în orice mod, confirmi că ai citit, ai înțeles și ești de acord să respecți acești Termeni, precum și Politica de Confidențialitate și Politica de Cookies, care fac parte integrantă din acest acord. Dacă nu ești de acord cu oricare dintre prevederile de mai jos, te rugăm să nu creezi un cont și să nu folosești Platforma.",
  },
  {
    title: "2. Statutul proiectului",
    body: "SportRise este, în acest moment, un proiect aflat într-o fază incipientă, de testare (\"beta\"), dezvoltat pentru a valida o idee, și nu este operat printr-o entitate juridică înregistrată (societate comercială). Ne rezervăm dreptul de a modifica, suspenda temporar sau întrerupe definitiv Serviciul, integral sau parțial, în orice moment și fără preaviz, în special pe durata acestei faze de testare. Dacă vom decide să continuăm dezvoltarea Platformei pe termen lung, te vom informa despre eventuala înființare a unei entități juridice care va prelua operarea Serviciului, printr-o actualizare a acestor Termeni.",
  },
  {
    title: "3. Definiții",
    body: "\"Platformă\" sau \"Serviciu\" înseamnă site-ul web SportRise, aplicația mobilă și toate funcționalitățile asociate. \"Utilizator\" înseamnă orice persoană care creează un cont sau accesează Platforma, indiferent de rol (Jucător, Descoperitor/Scouter, Agent, Reprezentant de club). \"Conținut\" înseamnă orice text, imagine, videoclip, statistică, mesaj sau alt material încărcat, postat sau transmis prin intermediul Platformei. \"Cont\" înseamnă profilul individual creat de un Utilizator pentru a accesa Serviciul.",
  },
  {
    title: "4. Cine poate folosi SportRise",
    body: "SportRise este o platformă de scouting sportiv destinată sportivilor, scouterilor, agenților și reprezentanților de cluburi. Platforma poate fi folosită exclusiv de persoane care au împlinit vârsta de 16 ani: data nașterii este obligatorie la crearea contului și este verificată automat, iar conturile care nu îndeplinesc această condiție nu pot fi create. Dacă ai între 16 și 18 ani, îți recomandăm să folosești Platforma cu știrea unui părinte sau tutore legal. Pentru a crea un cont trebuie să furnizezi informații corecte, complete și actualizate despre identitatea, vârsta și rolul tău; declararea unei vârste false constituie o încălcare a acestor Termeni și duce la închiderea contului. Rolurile de Descoperitor, Agent și Reprezentant de club pot fi supuse unui proces de verificare a identității și a activității profesionale, iar SportRise își rezervă dreptul de a refuza sau revoca accesul acestor roluri dacă documentele furnizate nu sunt considerate satisfăcătoare.",
  },
  {
    title: "5. Contul tău și securitatea acestuia",
    body: "Ești singurul responsabil pentru păstrarea confidențialității parolei și a datelor de autentificare, precum și pentru toate activitățile derulate din contul tău. Te rugăm să ne notifici imediat, prin pagina de Contact, dacă suspectezi o utilizare neautorizată a contului tău. Nu ai voie să creezi mai multe conturi cu scopul de a induce în eroare alți utilizatori sau de a ocoli o suspendare ori o restricție aplicată de noi. Poți solicita oricând ștergerea contului tău și a datelor asociate, conform Politicii de Confidențialitate.",
  },
  {
    title: "6. Conținutul tău și licența acordată către SportRise",
    body: "Rămâi proprietarul întregului conținut pe care îl postezi pe Platformă (postări, fotografii, videoclipuri de teste, statistici, mesaje). Prin publicarea conținutului, ne acorzi o licență neexclusivă, revocabilă, valabilă la nivel global, fără redevențe, de a găzdui, stoca, reproduce și afișa acest conținut în cadrul Platformei, exclusiv persoanelor autorizate să îl vadă conform setărilor tale de confidențialitate. Această licență încetează atunci când ștergi conținutul respectiv sau contul tău, cu excepția cazurilor în care păstrarea sa este necesară din motive legale. Nu posta conținut ilegal, ofensator, discriminatoriu, înșelător, care încalcă drepturile de autor sau alte drepturi ale unor terți, sau care conține date personale ale altor persoane fără acordul acestora.",
  },
  {
    title: "7. Proprietatea intelectuală a SportRise",
    body: "Numele \"SportRise\", logo-ul, designul, interfața și codul sursă al Platformei sunt proprietatea SportRise sau a licențiatorilor săi și sunt protejate de legile privind proprietatea intelectuală. Nu ai voie să copiezi, modifici, distribui sau creezi lucrări derivate pe baza Platformei fără acordul nostru scris prealabil.",
  },
  {
    title: "8. Comportament interzis",
    body: "Este strict interzis: să hărțuiești, intimidezi sau discriminezi alți utilizatori; să trimiți mesaje nesolicitate în masă; să impersonezi o altă persoană sau entitate; să publici informații false despre identitatea, vârsta sau performanțele tale sportive; să folosești Platforma pentru activități frauduloase sau ilegale; să încerci să ocolești măsurile de securitate, confidențialitate sau moderare ale Platformei; sau să extragi date de pe Platformă prin mijloace automatizate fără acordul nostru.",
  },
  {
    title: "9. Siguranța ta și comunicarea prin mesaje",
    body: "Multe conturi de pe SportRise aparțin unor sportivi minori. SportRise nu solicită niciodată plăți prin mesaje și nu organizează întâlniri neanunțate oficial prin platformă. Nu trimite bani altor utilizatori și nu accepta întâlniri private stabilite doar prin chat. Orice cerere de plată, orice propunere de întâlnire în afara canalelor oficiale ale platformei, sau orice comportament care pare o încercare de a atrage un minor într-o situație nedorită trebuie raportat imediat, din secțiunea Ajutor și asistență sau prin pagina de Contact. Ne rezervăm dreptul de a suspenda imediat, fără notificare prealabilă, orice cont implicat în astfel de comportamente.",
  },
  {
    title: "10. Video și teste de performanță",
    body: "Videoclipurile trimise pentru teste atletice și tehnice sunt revizuite pentru verificarea autenticității. Ne rezervăm dreptul de a respinge sau elimina conținut care nu respectă regulile testului sau pare fraudulos.",
  },
  {
    title: "11. Suspendare și încetare",
    body: "Ne rezervăm dreptul de a suspenda temporar sau de a închide definitiv contul tău, cu sau fără notificare prealabilă, în cazul în care încalci acești Termeni, în special în cazuri grave precum fraudă, hărțuire, conținut ilegal sau comportamente care pun în pericol siguranța altor utilizatori, în special a minorilor. Poți, de asemenea, să îți închizi contul oricând, din secțiunea Setări.",
  },
  {
    title: "12. Declinarea garanțiilor",
    body: "Platforma este oferită \"ca atare\" și \"conform disponibilității\", fără garanții de niciun fel, exprese sau implicite. Nu garantăm că Serviciul va funcționa neîntrerupt, fără erori sau că va îndeplini toate așteptările tale.",
  },
  {
    title: "13. Limitarea răspunderii",
    body: "SportRise este un instrument de conectare între sportivi și profesioniști din domeniul sportiv; nu suntem parte în nicio negociere, contract sau tranzacție dintre utilizatori și nu garantăm rezultate (transferuri, contracte, oferte, angajări) în urma folosirii Platformei. În limita maximă permisă de lege, SportRise nu va fi răspunzător pentru daune indirecte, incidentale sau pe cale de consecință rezultate din folosirea sau imposibilitatea folosirii Serviciului.",
  },
  {
    title: "14. Linkuri către terți",
    body: "Platforma poate conține linkuri către site-uri sau servicii ale unor terți. Nu controlăm și nu ne asumăm răspunderea pentru conținutul, politicile de confidențialitate sau practicile acestor terți.",
  },
  {
    title: "15. Modificări ale Termenilor",
    body: "Putem actualiza acești Termeni periodic, pentru a reflecta schimbări legale, tehnice sau operaționale. Te vom notifica despre modificările semnificative prin aplicație sau prin email. Continuarea folosirii Platformei după o astfel de actualizare reprezintă acceptarea noilor Termeni.",
  },
  {
    title: "16. Legea aplicabilă",
    body: "Acești Termeni sunt guvernați de legislația din România. Orice litigiu care nu poate fi soluționat pe cale amiabilă va fi supus instanțelor competente din România.",
  },
  {
    title: "17. Contact",
    body: "Pentru întrebări legate de acești Termeni, ne poți contacta din secțiunea Ajutor și asistență a aplicației sau din pagina de Contact.",
  },
];

export const TERMS_SECTIONS_EN = [
  {
    title: "1. Acceptance of terms",
    body: "These Terms and Conditions (the \"Terms\") govern access to and use of the SportRise platform — the website, the mobile app (once available), and all associated services, together the \"Platform\". By creating an account, accessing, or using the Platform in any way, you confirm that you have read, understood, and agree to comply with these Terms, as well as our Privacy Policy and Cookie Policy, which form an integral part of this agreement. If you don't agree with any of the provisions below, please don't create an account or use the Platform.",
  },
  {
    title: "2. Project status",
    body: "SportRise is currently an early-stage, \"beta\" testing project, built to validate an idea, and is not operated through a registered legal entity (company). We reserve the right to modify, temporarily suspend, or permanently discontinue the Service, in whole or in part, at any time and without prior notice, particularly during this testing phase. If we decide to continue developing the Platform long-term, we will inform you of any legal entity formed to take over operation of the Service, through an update to these Terms.",
  },
  {
    title: "3. Definitions",
    body: "\"Platform\" or \"Service\" means the SportRise website, the mobile app, and all associated features. \"User\" means any person who creates an account or accesses the Platform, regardless of role (Player, Scout, Agent, Club Representative). \"Content\" means any text, image, video, statistic, message, or other material uploaded, posted, or transmitted through the Platform. \"Account\" means the individual profile created by a User to access the Service.",
  },
  {
    title: "4. Who can use SportRise",
    body: "SportRise is a sports scouting platform for athletes, scouts, agents, and club representatives. The Platform may only be used by people who are at least 16 years old: your date of birth is required when creating an account and is checked automatically, and accounts that don't meet this condition cannot be created. If you're between 16 and 18, we recommend using the Platform with the knowledge of a parent or legal guardian. To create an account, you must provide accurate, complete, and up-to-date information about your identity, age, and role; declaring a false age is a breach of these Terms and results in account closure. Scout, Agent, and Club Representative roles may be subject to an identity and professional activity verification process, and SportRise reserves the right to refuse or revoke access to these roles if the documents provided are not deemed satisfactory.",
  },
  {
    title: "5. Your account and its security",
    body: "You are solely responsible for keeping your password and login credentials confidential, and for all activity under your account. Please notify us immediately, through the Contact page, if you suspect unauthorized use of your account. You may not create multiple accounts with the intent to mislead other users or to bypass a suspension or restriction we've applied. You can request the deletion of your account and associated data at any time, in accordance with our Privacy Policy.",
  },
  {
    title: "6. Your content and the license you grant SportRise",
    body: "You retain ownership of all content you post on the Platform (posts, photos, test videos, statistics, messages). By publishing content, you grant us a non-exclusive, revocable, worldwide, royalty-free license to host, store, reproduce, and display that content on the Platform, exclusively to people authorized to see it according to your privacy settings. This license ends when you delete that content or your account, except where retention is legally required. Don't post illegal, offensive, discriminatory, or misleading content, content that infringes copyright or other third-party rights, or content containing other people's personal data without their consent.",
  },
  {
    title: "7. SportRise's intellectual property",
    body: "The \"SportRise\" name, logo, design, interface, and source code of the Platform are the property of SportRise or its licensors and are protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works based on the Platform without our prior written consent.",
  },
  {
    title: "8. Prohibited conduct",
    body: "It is strictly prohibited to: harass, intimidate, or discriminate against other users; send unsolicited bulk messages; impersonate another person or entity; publish false information about your identity, age, or athletic performance; use the Platform for fraudulent or illegal activities; attempt to bypass the Platform's security, privacy, or moderation measures; or scrape data from the Platform through automated means without our consent.",
  },
  {
    title: "9. Your safety and communication through messages",
    body: "Many SportRise accounts belong to minor athletes. SportRise never asks for payments through messages and never arranges unannounced in-person meetings through the platform. Don't send money to other users and don't accept private meetups arranged only through chat. Any request for payment, any proposal to meet outside the platform's official channels, or any behavior that looks like an attempt to lure a minor into an unwanted situation must be reported immediately, from the Help and support section or through the Contact page. We reserve the right to immediately suspend, without prior notice, any account involved in such behavior.",
  },
  {
    title: "10. Video and performance tests",
    body: "Videos submitted for athletic and technical tests are reviewed to verify authenticity. We reserve the right to reject or remove content that doesn't follow the test rules or appears fraudulent.",
  },
  {
    title: "11. Suspension and termination",
    body: "We reserve the right to temporarily suspend or permanently close your account, with or without prior notice, if you violate these Terms — particularly in serious cases such as fraud, harassment, illegal content, or behavior that endangers the safety of other users, especially minors. You may also close your account at any time from the Settings section.",
  },
  {
    title: "12. Disclaimer of warranties",
    body: "The Platform is provided \"as is\" and \"as available\", without warranties of any kind, express or implied. We don't guarantee that the Service will run uninterrupted, error-free, or that it will meet all of your expectations.",
  },
  {
    title: "13. Limitation of liability",
    body: "SportRise is a tool that connects athletes with sports industry professionals; we're not a party to any negotiation, contract, or transaction between users, and we don't guarantee outcomes (transfers, contracts, offers, hires) from using the Platform. To the maximum extent permitted by law, SportRise will not be liable for indirect, incidental, or consequential damages arising from the use or inability to use the Service.",
  },
  {
    title: "14. Third-party links",
    body: "The Platform may contain links to third-party websites or services. We don't control and aren't responsible for the content, privacy policies, or practices of these third parties.",
  },
  {
    title: "15. Changes to these Terms",
    body: "We may update these Terms periodically to reflect legal, technical, or operational changes. We'll notify you of significant changes through the app or by email. Continuing to use the Platform after such an update means you accept the new Terms.",
  },
  {
    title: "16. Governing law",
    body: "These Terms are governed by the laws of Romania. Any dispute that cannot be resolved amicably will be subject to the competent courts of Romania.",
  },
  {
    title: "17. Contact",
    body: "For questions about these Terms, you can reach us from the Help and support section of the app or the Contact page.",
  },
];

export default function TermsSection({ onBack }: TermsSectionProps) {
  const { lang } = useLanguage();
  const sections = lang === "ro" ? TERMS_SECTIONS_RO : TERMS_SECTIONS_EN;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="relative flex items-center px-4 py-3 border-b border-gray-200 shrink-0">
        <button onClick={onBack} className="p-1 text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-gray-900 whitespace-nowrap">
          {lang === "ro" ? "Termeni de utilizare" : "Terms of Use"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <LegalDocBody
          eyebrow="LEGAL"
          title={lang === "ro" ? "Termeni și Condiții" : "Terms and Conditions"}
          lastUpdated={legalLastUpdatedLabel(lang, TERMS_VERSION)}
          tocLabel={lang === "ro" ? "Cuprins" : "Table of Contents"}
          sections={sections}
          compact
        />
      </div>
    </div>
  );
}
