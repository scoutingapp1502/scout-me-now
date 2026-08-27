import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, X, Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ProfileSection } from "@/hooks/useProfileCompletion";

interface OnboardingWizardProps {
  sections: ProfileSection[];
  percentage: number;
  role: "player" | "cauta_jucator";
  onGoToSection: (sectionKey: string) => void;
  onDismiss: () => void;
}

const OnboardingWizard = ({ sections, percentage, role, onGoToSection, onDismiss }: OnboardingWizardProps) => {
  const { lang } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const incompleteSections = sections.filter((s) => !s.completed);

  if (incompleteSections.length === 0) return null;

  const current = incompleteSections[currentStep] || incompleteSections[0];

  const sectionTips: Record<string, { ro: string; en: string }> = {
    photo: {
      ro: "Adaugă o fotografie profesională pentru a fi remarcat de scouteri și cluburi.",
      en: "Add a professional photo to stand out to scouts and clubs.",
    },
    basic: {
      ro: "Completează-ți numele, naționalitatea, data nașterii și poziția pe care joci.",
      en: "Fill in your name, nationality, date of birth and playing position.",
    },
    physical: {
      ro: "Adaugă înălțimea, greutatea și piciorul preferat.",
      en: "Add your height, weight and preferred foot.",
    },
    stats: {
      ro: "Setează-ți atributele atletice: viteză, detentă, rezistență, accelerație și apărare.",
      en: "Set your athletic attributes: speed, jumping, endurance, acceleration and defense.",
    },
    career: {
      ro: "Descrie-ți parcursul în carieră și echipa actuală.",
      en: "Describe your career journey and current team.",
    },
    video: {
      ro: "Adaugă clipuri video cu cele mai bune momente din meciuri.",
      en: "Add video highlights from your best match moments.",
    },
    social: {
      ro: "Conectează-ți conturile de social media pentru vizibilitate maximă.",
      en: "Connect your social media accounts for maximum visibility.",
    },
    bio: {
      ro: "Scrie o descriere despre tine care să te prezinte profesional.",
      en: "Write a description about yourself that presents you professionally.",
    },
    cover: {
      ro: "Adaugă o fotografie de copertă pentru a-ți personaliza profilul.",
      en: "Add a cover photo to personalize your profile.",
    },
    title: {
      ro: "Adaugă titlul tău profesional și organizația din care faci parte.",
      en: "Add your professional title and organization.",
    },
    skills: {
      ro: "Adaugă aptitudinile tale de scouting.",
      en: "Add your scouting skills.",
    },
    experience: {
      ro: "Adaugă cel puțin o experiență profesională.",
      en: "Add at least one professional experience.",
    },
    activity: {
      ro: "Publică prima ta postare pentru a-ți crește vizibilitatea.",
      en: "Publish your first post to increase your visibility.",
    },
  };

  const tip = sectionTips[current.key] || { ro: "", en: "" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-white p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-bold text-gray-900">
                {lang === "ro" ? "Construiește-ți profilul" : "Build your profile"}
              </h2>
            </div>
            <button onClick={onDismiss} className="text-gray-500 hover:text-gray-900 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Progress value={percentage} className="h-2 flex-1" indicatorClassName="bg-green-600" />
            <span className="text-sm font-bold text-orange-500">{percentage}%</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-medium text-orange-600 mb-3">
              {lang === "ro" ? `Pas ${currentStep + 1} din ${incompleteSections.length}` : `Step ${currentStep + 1} of ${incompleteSections.length}`}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {lang === "ro" ? current.labelRo : current.labelEn}
            </h3>
            <p className="text-sm text-gray-500">
              {lang === "ro" ? tip.ro : tip.en}
            </p>
          </div>

          {/* Section checklist mini */}
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {sections.map((s, i) => (
              <div
                key={s.key}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                  s.completed
                    ? "bg-green-100 text-green-600"
                    : s.key === current.key
                    ? "bg-orange-100 text-orange-600 font-semibold"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {s.completed ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                {lang === "ro" ? s.labelRo : s.labelEn}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {lang === "ro" ? "Înapoi" : "Back"}
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onDismiss} className="border-gray-300 text-gray-500 hover:text-gray-900">
              {lang === "ro" ? "Mai târziu" : "Later"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onGoToSection(current.key);
                onDismiss();
              }}
            >
              {lang === "ro" ? "Completează" : "Fill in"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
