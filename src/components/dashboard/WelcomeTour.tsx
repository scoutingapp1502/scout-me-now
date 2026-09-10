import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface WelcomeTourProps {
  role: "player" | "cauta_jucator";
  onNavigate: (sectionId: string, tabId?: string) => void;
  onFinish: () => void;
  // On mobile, nav-* targets (Messages, Notifications, Activity, Community,
  // Player Notes) live inside the collapsible sidebar Sheet, which is
  // unmounted-looking (off-screen/hidden) until opened — the tour needs to
  // open it itself before it can find and spotlight those elements.
  isMobile?: boolean;
  onSetMobileSidebarOpen?: (open: boolean) => void;
}

interface TourStep {
  sectionId?: string;
  tabId?: string;
  target?: string; // data-tour selector to spotlight; omit for a centered intro/outro step
  titleRo: string;
  titleEn: string;
  bodyRo: string;
  bodyEn: string;
}

const playerSteps: TourStep[] = [
  {
    titleRo: "Bine ai venit pe Sportrise!",
    titleEn: "Welcome to Sportrise!",
    bodyRo: "Platforma unde jucători ca tine sunt descoperiți de scouteri și cluburi din toată lumea. Te plimbăm prin aplicație, pas cu pas.",
    bodyEn: "The platform where players like you get discovered by scouts and clubs worldwide. We'll walk you through the app, step by step.",
  },
  {
    sectionId: "profile", tabId: "profile", target: "profile-edit",
    titleRo: "Editează-ți profilul",
    titleEn: "Edit your profile",
    bodyRo: "Cardul tău de jucător, poza, datele fizice și cariera — toate aici. Apasă pe creionul ✎ ca să editezi orice secțiune.",
    bodyEn: "Your player card, photo, physical data and career — all here. Tap the ✎ pencil to edit any section.",
  },
  {
    sectionId: "profile", tabId: "stats", target: "tab-stats",
    titleRo: "Tab-ul Teste",
    titleEn: "The Tests tab",
    bodyRo: "Aici sunt testele tehnice și atletice specifice sportului tău.",
    bodyEn: "This is where your sport's technical and athletic tests live.",
  },
  {
    sectionId: "profile", tabId: "stats", target: "tests-list",
    titleRo: "Teste tehnice și atletice",
    titleEn: "Technical & Athletic Tests",
    bodyRo: "Fiecare test are un exemplu video. Filmează-te făcând testul și urcă clipul ca scouterii să-ți vadă nivelul real.",
    bodyEn: "Each test has an example video. Record yourself doing the test and upload it so scouts can see your real level.",
  },
  {
    sectionId: "profile", tabId: "video", target: "tab-video",
    titleRo: "Tab-ul Video",
    titleEn: "The Video tab",
    bodyRo: "Aici adaugi cele mai bune momente din meciuri.",
    bodyEn: "This is where you add your best match moments.",
  },
  {
    sectionId: "profile", tabId: "video", target: "video-add",
    titleRo: "Video Highlights",
    titleEn: "Video Highlights",
    bodyRo: "Adaugă un link YouTube sau încarcă direct un fișier video — goluri, assist-uri, faze reușite. Un profil cu video bun atrage mult mai multă atenție.",
    bodyEn: "Add a YouTube link or upload a video file directly — goals, assists, standout plays. A profile with good video gets a lot more attention.",
  },
  {
    sectionId: "profile", tabId: "posts", target: "tab-posts",
    titleRo: "Postări",
    titleEn: "Posts",
    bodyRo: "Distribuie actualizări, rezultate sau realizări direct pe profilul tău, vizibile celor care te urmăresc.",
    bodyEn: "Share updates, results or achievements right on your profile, visible to your followers.",
  },
  {
    sectionId: "messages", target: "nav-messages",
    titleRo: "Mesaje",
    titleEn: "Messages",
    bodyRo: "Comunici direct cu scouteri, cluburi sau alți jucători. Poți crea și grupuri de discuție.",
    bodyEn: "Message scouts, clubs or other players directly. You can also start group chats.",
  },
  {
    sectionId: "notifications", target: "nav-notifications",
    titleRo: "Notificări",
    titleEn: "Notifications",
    bodyRo: "Afli imediat când cineva îți acceptă cererea de urmărire, îți apreciază conținutul sau te contactează.",
    bodyEn: "Find out instantly when someone accepts your follow request, likes your content or reaches out.",
  },
  {
    sectionId: "activity", target: "nav-activity",
    titleRo: "Activitate",
    titleEn: "Activity",
    bodyRo: "Feed-ul tău — postările celor pe care îi urmărești, actualizate live.",
    bodyEn: "Your feed — posts from the people you follow, updated live.",
  },
  {
    sectionId: "community", target: "nav-community",
    titleRo: "Comunitate",
    titleEn: "Community",
    bodyRo: "Descoperă alți jucători și scouteri, filtrează după sport, poziție, țară sau vârstă, și urmărește-i pentru a rămâne conectat.",
    bodyEn: "Discover other players and scouts, filter by sport, position, country or age, and follow them to stay connected.",
  },
  {
    sectionId: "profile", tabId: "profile",
    titleRo: "Gata de start!",
    titleEn: "Ready to start!",
    bodyRo: "Acum știi tot ce trebuie. Hai să-ți completăm profilul, ca să fii vizibil pentru scouteri!",
    bodyEn: "Now you know it all. Let's complete your profile so scouts can find you!",
  },
];

const scoutSteps: TourStep[] = [
  {
    titleRo: "Bine ai venit pe Sportrise!",
    titleEn: "Welcome to Sportrise!",
    bodyRo: "Aici descoperi tinere talente sportive și le urmărești evoluția. Te plimbăm prin aplicație, pas cu pas.",
    bodyEn: "Here you discover young sports talents and track their progress. We'll walk you through the app, step by step.",
  },
  {
    sectionId: "profile", target: "profile-edit",
    titleRo: "Editează-ți profilul",
    titleEn: "Edit your profile",
    bodyRo: "Titlul tău profesional, organizația, aptitudinile și experiența — toate aici. Apasă pe creionul ✎ ca să editezi orice secțiune.",
    bodyEn: "Your professional title, organization, skills and experience — all here. Tap the ✎ pencil to edit any section.",
  },
  {
    sectionId: "messages", target: "nav-messages",
    titleRo: "Mesaje",
    titleEn: "Messages",
    bodyRo: "Contactezi direct jucătorii, agenții sau alți scouteri. Poți crea și grupuri de discuție.",
    bodyEn: "Contact players, agents or other scouts directly. You can also start group chats.",
  },
  {
    sectionId: "notifications", target: "nav-notifications",
    titleRo: "Notificări",
    titleEn: "Notifications",
    bodyRo: "Afli imediat când un jucător urmărit adaugă un video nou, sau cineva îți acceptă cererea de urmărire.",
    bodyEn: "Find out instantly when a player you follow adds a new video, or someone accepts your follow request.",
  },
  {
    sectionId: "activity", target: "nav-activity",
    titleRo: "Activitate",
    titleEn: "Activity",
    bodyRo: "Feed-ul tău — postările jucătorilor și scouterilor pe care îi urmărești, actualizate live.",
    bodyEn: "Your feed — posts from the players and scouts you follow, updated live.",
  },
  {
    sectionId: "player-notes", target: "nav-player-notes",
    titleRo: "Notițe despre jucători",
    titleEn: "Player Notes",
    bodyRo: "Salvează notițe private și rapoarte despre jucătorii pe care îi urmărești — vizibile doar ție.",
    bodyEn: "Save private notes and reports about the players you're scouting — visible only to you.",
  },
  {
    sectionId: "community", target: "nav-community",
    titleRo: "Comunitate",
    titleEn: "Community",
    bodyRo: "Caută jucători după sport, poziție, vârstă sau naționalitate. Deschide profilul oricăruia ca să-i vezi testele și video-urile, apoi urmărește-l.",
    bodyEn: "Search players by sport, position, age or nationality. Open any profile to see their tests and videos, then follow them.",
  },
  {
    sectionId: "profile",
    titleRo: "Gata de start!",
    titleEn: "Ready to start!",
    bodyRo: "Acum știi tot ce trebuie. Hai să-ți completăm profilul, ca jucătorii și cluburile să te recunoască!",
    bodyEn: "Now you know it all. Let's complete your profile so players and clubs recognize you!",
  },
];

const PAD = 8;

const WelcomeTour = ({ role, onNavigate, onFinish, isMobile, onSetMobileSidebarOpen }: WelcomeTourProps) => {
  const { lang } = useLanguage();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [searching, setSearching] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);

  const steps = role === "cauta_jucator" ? scoutSteps : playerSteps;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  // Drive real navigation + locate the target element for this step.
  useEffect(() => {
    setRect(null);
    setCardPos(null);
    if (current.sectionId) onNavigate(current.sectionId, current.tabId);

    // nav-* targets (Messages, Notifications, Activity, Community, Player
    // Notes) live inside the mobile sidebar Sheet — closed by default, so
    // the element sits off-screen until opened. Open it for these steps,
    // close it for every other step (including the centered intro/outro
    // ones with no target at all).
    const isNavTarget = !!current.target?.startsWith("nav-");
    if (isMobile && onSetMobileSidebarOpen) onSetMobileSidebarOpen(isNavTarget);

    if (!current.target) return;

    setSearching(true);
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // ~6s at 150ms
    // The Sheet slides in over ~200-300ms — give it a head start on the
    // first poll so getBoundingClientRect() isn't read mid-animation.
    const initialDelay = isMobile && isNavTarget ? 350 : 0;

    const poll = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          if (cancelled) return;
          setRect(el.getBoundingClientRect());
          setSearching(false);
        }, 380);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) { setSearching(false); return; }
      setTimeout(poll, 150);
    };
    setTimeout(poll, initialDelay);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Keep the spotlight glued to the target on scroll/resize.
  useEffect(() => {
    if (!current.target) return;
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${current.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rect === null]);

  // Position the tooltip card near the spotlighted rect, clamped to viewport.
  useLayoutEffect(() => {
    if (!rect) { setCardPos(null); return; }
    const cardEl = cardRef.current;
    const cardW = cardEl?.offsetWidth ?? 340;
    const cardH = cardEl?.offsetHeight ?? 180;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = rect.bottom + PAD + 10;
    if (top + cardH > vh - PAD) top = rect.top - cardH - PAD - 10;
    if (top < PAD) top = Math.min(Math.max(rect.top, PAD), vh - cardH - PAD);

    let left = rect.left;
    if (left + cardW > vw - PAD) left = vw - cardW - PAD;
    if (left < PAD) left = PAD;

    setCardPos({ top, left });
  }, [rect]);

  // Whenever the tour unmounts (finished, skipped, or closed via X), make
  // sure the mobile sidebar Sheet doesn't stay stuck open just because the
  // last-visited step happened to need it.
  useEffect(() => {
    return () => { if (isMobile && onSetMobileSidebarOpen) onSetMobileSidebarOpen(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = () => (isLast ? onFinish() : setStep((s) => s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const centered = !current.target || (!rect && !searching);

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Dimmed backdrop with a cutout around the spotlighted element */}
      {rect ? (
        <>
          <div className="fixed bg-black/70 transition-all duration-200" style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PAD) }} />
          <div className="fixed bg-black/70 transition-all duration-200" style={{ top: rect.bottom + PAD, left: 0, right: 0, bottom: 0 }} />
          <div className="fixed bg-black/70 transition-all duration-200" style={{ top: rect.top - PAD, left: 0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }} />
          <div className="fixed bg-black/70 transition-all duration-200" style={{ top: rect.top - PAD, left: rect.right + PAD, right: 0, height: rect.height + PAD * 2 }} />
          <div
            className="fixed rounded-lg ring-2 ring-orange-500 pointer-events-none transition-all duration-200"
            style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 4px rgba(249,115,22,0.25)" }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      )}

      <div
        ref={cardRef}
        className={`w-[340px] max-w-[calc(100vw-16px)] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden ${centered ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" : "fixed"}`}
        style={!centered && cardPos ? { top: cardPos.top, left: cardPos.left } : undefined}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-orange-500" : i < step ? "w-1.5 bg-orange-300" : "w-1.5 bg-gray-200"}`}
              />
            ))}
          </div>
          <button onClick={onFinish} className="text-gray-400 hover:text-gray-900 transition-colors" aria-label={lang === "ro" ? "Închide" : "Close"}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-5 pb-6">
          {!current.target && (
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
          )}
          <h2 className="text-lg font-bold text-gray-900 mb-1.5">
            {lang === "ro" ? current.titleRo : current.titleEn}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {lang === "ro" ? current.bodyRo : current.bodyEn}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 p-4">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={step === 0} className="text-gray-500">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {lang === "ro" ? "Înapoi" : "Back"}
          </Button>

          <div className="flex items-center gap-3">
            {!isLast && (
              <button onClick={onFinish} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                {lang === "ro" ? "Sari peste tot" : "Skip all"}
              </button>
            )}
            <Button
              size="sm"
              onClick={goNext}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold"
            >
              {isLast ? (lang === "ro" ? "Începe" : "Get Started") : (lang === "ro" ? "Continuă" : "Next")}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeTour;
