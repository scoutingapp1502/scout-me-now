import { useLanguage } from "@/i18n/LanguageContext";
import scoutsRoom from "@/assets/scouts-room.jpg";

const TopScoutsSection = () => {
  const { t } = useLanguage();

  const sportTabs = [
    { key: "football", label: t.topScouts.sports.football, active: true },
    { key: "basketball", label: t.topScouts.sports.basketball },
    { key: "boxing", label: t.topScouts.sports.boxing },
    { key: "volleyball", label: t.topScouts.sports.volleyball },
    { key: "other", label: t.topScouts.sports.other },
  ];

  return (
    <section className="py-12 sm:py-20 bg-pitch/95">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-primary-foreground text-center mb-10">
          {t.topScouts.title} <span className="text-electric">{t.topScouts.titleHighlight}</span>
        </h2>

        {/* Scouts room image */}
        <div className="relative rounded-2xl overflow-hidden mb-10 max-w-5xl mx-auto">
          <img src={scoutsRoom} alt="Scouts analyzing players" className="w-full h-48 sm:h-72 md:h-96 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-pitch via-pitch/40 to-transparent" />
          <div className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8">
            <p className="font-display text-3xl sm:text-5xl text-electric">+150</p>
            <p className="text-primary-foreground/80 text-sm sm:text-base font-body max-w-xs">
              {t.topScouts.subtitle}
            </p>
          </div>
        </div>

        {/* Sport tabs */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {sportTabs.map((tab) => (
            <button
              key={tab.key}
              className={`px-4 sm:px-6 py-2 rounded-full font-body text-sm sm:text-base transition-all ${
                tab.active
                  ? "bg-electric text-pitch font-semibold"
                  : "border border-electric/30 text-primary-foreground/70 hover:border-electric/60 hover:text-electric"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TopScoutsSection;
