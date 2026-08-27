import { useState } from "react";
import { ArrowLeft, ChevronRight, Check } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

interface LanguageSectionProps {
  userId: string;
  onBack: () => void;
}

interface LangOption {
  code: string;
  native: string;
  english: string;
}

const ALL_LANGUAGES: LangOption[] = [
  { code: "en", native: "English",  english: "English"  },
  { code: "ro", native: "Română",   english: "Romanian" },
  { code: "de", native: "Deutsch",  english: "German"   },
  { code: "fr", native: "Français", english: "French"   },
  { code: "es", native: "Español",  english: "Spanish"  },
  { code: "it", native: "Italiano", english: "Italian"  },
];

// ── Set Language sub-page ────────────────────────────────────────────────────
function SetLanguagePage({ lang, setLang, onBack }: { lang: Language; setLang: (l: Language) => void; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="relative flex items-center px-4 py-3 border-b border-gray-200 shrink-0">
        <button onClick={onBack} className="p-1 text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-gray-900 whitespace-nowrap">
          {lang === "ro" ? "Setează limba" : "Set language"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-y border-gray-200 divide-y divide-gray-200">
          {ALL_LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code as Language)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-semibold font-body text-gray-900">{l.native}</p>
                <p className="text-xs text-gray-500 font-body">{l.english}</p>
              </div>
              {lang === l.code && <Check className="h-5 w-5 text-orange-500 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main LanguageSection ──────────────────────────────────────────────────────
export default function LanguageSection({ onBack }: LanguageSectionProps) {
  const { lang, setLang } = useLanguage();
  const [subPage, setSubPage] = useState<"set-language" | null>(null);

  if (subPage === "set-language") {
    return <SetLanguagePage lang={lang} setLang={setLang} onBack={() => setSubPage(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="relative flex items-center px-4 py-3 border-b border-gray-200 shrink-0">
        <button onClick={onBack} className="p-1 text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-gray-900 whitespace-nowrap">
          {lang === "ro" ? "Limbă și traduceri" : "Language and translations"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="text-sm font-semibold font-body text-gray-900 px-5 pt-5 pb-2">
          {lang === "ro" ? "Limba SportRise" : "SportRise language"}
        </p>
        <div className="bg-white border-y border-gray-200">
          <button
            onClick={() => setSubPage("set-language")}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-body text-gray-900">
              {lang === "ro" ? "Setează limba" : "Set language"}
            </span>
            <ChevronRight className="h-4 w-4 text-gray-500/50 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
