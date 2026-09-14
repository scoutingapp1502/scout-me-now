import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/i18n/LanguageContext";

const TopScoutsSection = () => {
  const { t } = useLanguage();
  const [selectedSport, setSelectedSport] = useState("football");

  const sportTabs = [
    { key: "football", label: t.topScouts.sports.football, icon: "⚽" },
    { key: "basketball", label: t.topScouts.sports.basketball, icon: "🏀" },
  ];

  return (
    <section className="py-12 sm:py-20 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-gray-900 text-center mb-10">
          {t.topScouts.title} <span className="text-orange-500">{t.topScouts.titleHighlight}</span>
        </h2>

        <div className="max-w-2xl mx-auto text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-orange-100 border-2 border-orange-500 flex items-center justify-center">
            <Search className="h-7 w-7 text-orange-500" />
          </div>
          <p className="text-gray-600 text-base sm:text-lg font-body">
            {t.topScouts.subtitle}
          </p>
        </div>

        {/* Sport tabs */}
        <div className="flex flex-wrap justify-center items-center gap-2">
          <div className="inline-flex gap-1 bg-gray-100 rounded-full p-1">
            {sportTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedSport(tab.key)}
                className={`px-4 sm:px-6 py-2 rounded-full font-body text-sm sm:text-base transition-all cursor-pointer ${
                  selectedSport === tab.key
                    ? "bg-orange-500 text-white font-semibold shadow"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Teaser: more sports may be coming */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative px-4 sm:px-5 py-2 rounded-full font-body text-sm sm:text-base border border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 transition-all cursor-pointer flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                {t.topScouts.moreSports}
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500 animate-ping" />
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-500" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="text-sm font-body w-64 bg-white border-gray-200 text-gray-700 text-center">
              {t.topScouts.moreSportsHint}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </section>
  );
};

export default TopScoutsSection;
