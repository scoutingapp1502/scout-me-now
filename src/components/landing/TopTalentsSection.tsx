import { Star, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const TopTalentsSection = () => {
  const { t } = useLanguage();

  const talents = [
    {
      name: "Andrei Popescu",
      rating: 4,
      tags: ["Atacant", "Tehnician", "Romania"],
      sport: "⚽ Fotbal",
      stats: [
        { label: t.topTalents.goals, value: "18" },
        { label: t.topTalents.assists, value: "9" },
        { label: t.topTalents.speed, value: "33 km/h" },
      ],
      league: "Premier League",
    },
    {
      name: "Michael Ramirez",
      rating: 4,
      tags: ["NBA", "Guard"],
      sport: "🏀 Basketball",
      stats: [
        { label: t.topTalents.height, value: "28.2" },
        { label: t.topTalents.assists, value: "5.6" },
        { label: t.topTalents.rating, value: "6.8" },
      ],
      league: "NBA",
    },
    {
      name: "David Ionescu",
      rating: 4,
      tags: ["Mijlocaș", "Romania"],
      sport: "⚽ Fotbal",
      stats: [
        { label: t.topTalents.goals, value: "15" },
        { label: t.topTalents.matches, value: "12" },
        { label: t.topTalents.speed, value: "900" },
      ],
      league: "Serie A",
    },
  ];

  const leagueFilters = ["Premier League", "NBA", "UFC", "Serie A", "Volleyball"];

  return (
    <section className="py-12 sm:py-20 bg-pitch border-t border-electric/10">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-primary-foreground text-center mb-4">
          {t.topTalents.title} <span className="text-electric">{t.topTalents.titleHighlight}</span>
        </h2>

        {/* League filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {leagueFilters.map((league) => (
            <span key={league} className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm font-body">
              <span className="w-2 h-2 rounded-full bg-electric/60" />
              {league}
            </span>
          ))}
        </div>

        {/* Talent cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {talents.map((player) => (
            <div
              key={player.name}
              className="bg-card/5 border border-electric/20 rounded-xl p-5 hover:border-electric/50 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-10 h-10 rounded-full bg-electric/20 flex items-center justify-center text-lg">
                      👤
                    </div>
                    <div>
                      <h3 className="font-display text-lg text-primary-foreground">{player.name}</h3>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i <= player.rating ? "fill-electric text-electric" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {player.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full bg-electric/10 border border-electric/20 text-electric text-xs font-body">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Sport badge */}
              <p className="text-muted-foreground text-xs font-body mb-3">{player.sport}</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {player.stats.map((stat) => (
                  <div key={stat.label} className="text-center bg-pitch/60 rounded-lg py-2">
                    <p className="font-display text-xl text-primary-foreground">{stat.value}</p>
                    <p className="text-muted-foreground text-[10px] font-body uppercase">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* View profile */}
              <button className="w-full flex items-center justify-center gap-1 text-electric text-sm font-body hover:underline group-hover:gap-2 transition-all">
                {t.topTalents.viewProfile}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TopTalentsSection;
