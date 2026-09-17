import { useLanguage } from "@/i18n/LanguageContext";
import LegalDocPage from "@/components/legal/LegalDocPage";

const SECTIONS_RO = [
  {
    title: "1. Ce sunt cookie-urile și stocarea locală",
    body: "Cookie-urile și stocarea locală (localStorage) sunt fișiere mici salvate în browserul tău, folosite pentru a reține informații despre sesiunea sau preferințele tale de utilizare a aplicației.",
  },
  {
    title: "2. Ce folosim noi",
    body: "Folosim exclusiv cookie-uri și stocare locală strict necesare funcționării aplicației: menținerea sesiunii tale de autentificare, reținerea limbii preferate și a stării interfeței (de exemplu, dacă meniul lateral este extins sau restrâns). Fără acestea, anumite funcții de bază ale aplicației nu ar funcționa corect.",
  },
  {
    title: "3. Ce nu folosim",
    body: "Nu folosim cookie-uri de analiză, publicitate sau urmărire (tracking) de la terți. Nu vindem și nu distribuim date de navigare către rețele de publicitate.",
  },
  {
    title: "4. Controlul tău",
    body: "Poți șterge sau bloca cookie-urile din setările browserului tău în orice moment. Dacă faci asta, e posibil ca unele funcționalități ale aplicației — cum ar fi rămânerea autentificat — să nu mai funcționeze corect.",
  },
  {
    title: "5. Modificări ale acestei politici",
    body: "Dacă vom introduce vreodată cookie-uri de analiză sau marketing, vom actualiza această pagină și îți vom cere consimțământul explicit înainte de a le activa.",
  },
];

const SECTIONS_EN = [
  {
    title: "1. What cookies and local storage are",
    body: "Cookies and local storage (localStorage) are small files saved in your browser, used to remember information about your session or how you use the app.",
  },
  {
    title: "2. What we use",
    body: "We only use cookies and local storage strictly necessary for the app to work: keeping you signed in, remembering your preferred language, and interface state (for example, whether the sidebar is expanded or collapsed). Without these, some core features wouldn't work correctly.",
  },
  {
    title: "3. What we don't use",
    body: "We don't use analytics, advertising, or third-party tracking cookies. We don't sell or share browsing data with advertising networks.",
  },
  {
    title: "4. Your control",
    body: "You can delete or block cookies from your browser settings at any time. If you do, some app features — such as staying signed in — may stop working correctly.",
  },
  {
    title: "5. Changes to this policy",
    body: "If we ever introduce analytics or marketing cookies, we'll update this page and ask for your explicit consent before enabling them.",
  },
];

const PublicCookies = () => {
  const { lang } = useLanguage();
  const sections = lang === "ro" ? SECTIONS_RO : SECTIONS_EN;

  return (
    <LegalDocPage
      eyebrow="LEGAL"
      title={lang === "ro" ? "Politica de Cookies" : "Cookie Policy"}
      lastUpdated={lang === "ro" ? "Ultima actualizare: 17 septembrie 2026 · Versiunea 1.0" : "Last updated: September 17, 2026 · Version 1.0"}
      tocLabel={lang === "ro" ? "Cuprins" : "Table of Contents"}
      sections={sections}
      backLabel={lang === "ro" ? "Înapoi" : "Back"}
    />
  );
};

export default PublicCookies;
