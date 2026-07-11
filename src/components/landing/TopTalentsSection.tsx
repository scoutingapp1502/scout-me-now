import { Star, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface TopTalentsSectionProps {
  selectedSport: string;
}

const TopTalentsSection = ({ selectedSport }: TopTalentsSectionProps) => {
  const { t } = useLanguage();

  const allTalents: Record<string, Array<{
    name: string;
    rating: number;
    tags: string[];
    sport: string;
    stats: { label: string; value: string }[];
    league: string;
  }>> = {
    football: [
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
        name: "David Ionescu",
        rating: 4,
        tags: ["Mijlocaș", "Romania"],
        sport: "⚽ Fotbal",
        stats: [
          { label: t.topTalents.goals, value: "15" },
          { label: t.topTalents.matches, value: "12" },
          { label: t.topTalents.speed, value: "31 km/h" },
        ],
        league: "Serie A",
      },
      {
        name: "Lucas Silva",
        rating: 5,
        tags: ["Fundaș", "Brazilia"],
        sport: "⚽ Fotbal",
        stats: [
          { label: t.topTalents.goals, value: "3" },
          { label: t.topTalents.matches, value: "28" },
          { label: t.topTalents.speed, value: "30 km/h" },
        ],
        league: "La Liga",
      },
    ],
    basketball: [
      {
        name: "Michael Ramirez",
        rating: 4,
        tags: ["Guard", "USA"],
        sport: "🏀 Basketball",
        stats: [
          { label: "PPG", value: "28.2" },
          { label: t.topTalents.assists, value: "5.6" },
          { label: t.topTalents.rating, value: "6.8" },
        ],
        league: "NBA",
      },
      {
        name: "Jaylen Brooks",
        rating: 5,
        tags: ["Center", "USA"],
        sport: "🏀 Basketball",
        stats: [
          { label: "PPG", value: "22.1" },
          { label: "RPG", value: "11.3" },
          { label: t.topTalents.rating, value: "7.2" },
        ],
        league: "EuroLeague",
      },
      {
        name: "Nikola Petrović",
        rating: 4,
        tags: ["Forward", "Serbia"],
        sport: "🏀 Basketball",
        stats: [
          { label: "PPG", value: "19.5" },
          { label: t.topTalents.assists, value: "4.1" },
          { label: t.topTalents.rating, value: "6.5" },
        ],
        league: "ABA Liga",
      },
    ],
    boxing: [
      {
        name: "Carlos Mendez",
        rating: 5,
        tags: ["Heavyweight", "Mexico"],
        sport: "🥊 Boxing",
        stats: [
          { label: "KO", value: "18" },
          { label: t.topTalents.matches, value: "24" },
          { label: "WIN %", value: "92%" },
        ],
        league: "WBC",
      },
      {
        name: "Amir Khan Jr.",
        rating: 4,
        tags: ["Welterweight", "UK"],
        sport: "🥊 Boxing",
        stats: [
          { label: "KO", value: "12" },
          { label: t.topTalents.matches, value: "19" },
          { label: "WIN %", value: "89%" },
        ],
        league: "WBA",
      },
      {
        name: "Dmitri Volkov",
        rating: 4,
        tags: ["Middleweight", "Russia"],
        sport: "🥊 Boxing",
        stats: [
          { label: "KO", value: "15" },
          { label: t.topTalents.matches, value: "21" },
          { label: "WIN %", value: "86%" },
        ],
        league: "IBF",
      },
    ],
    volleyball: [
      {
        name: "Marco Rossi",
        rating: 5,
        tags: ["Setter", "Italy"],
        sport: "🏐 Volleyball",
        stats: [
          { label: t.topTalents.assists, value: "842" },
          { label: t.topTalents.matches, value: "35" },
          { label: t.topTalents.rating, value: "8.9" },
        ],
        league: "SuperLega",
      },
      {
        name: "Tomasz Nowak",
        rating: 4,
        tags: ["Opposite", "Poland"],
        sport: "🏐 Volleyball",
        stats: [
          { label: "ACES", value: "67" },
          { label: t.topTalents.matches, value: "30" },
          { label: t.topTalents.rating, value: "8.1" },
        ],
        league: "PlusLiga",
      },
      {
        name: "Yuki Tanaka",
        rating: 4,
        tags: ["Libero", "Japan"],
        sport: "🏐 Volleyball",
        stats: [
          { label: "DIGS", value: "312" },
          { label: t.topTalents.matches, value: "28" },
          { label: t.topTalents.rating, value: "7.8" },
        ],
        league: "V.League",
      },
    ],
    other: [
      {
        name: "Elena Gheorghe",
        rating: 5,
        tags: ["Sprint", "Romania"],
        sport: "🏃 Atletism",
        stats: [
          { label: "100M", value: "11.2s" },
          { label: t.topTalents.matches, value: "18" },
          { label: t.topTalents.rating, value: "9.1" },
        ],
        league: "Diamond League",
      },
      {
        name: "Pierre Dupont",
        rating: 4,
        tags: ["Singles", "France"],
        sport: "🎾 Tenis",
        stats: [
          { label: "ACES", value: "320" },
          { label: t.topTalents.matches, value: "42" },
          { label: "WIN %", value: "78%" },
        ],
        league: "ATP",
      },
      {
        name: "Ana Kovacs",
        rating: 4,
        tags: ["Freestyle", "Hungary"],
        sport: "🏊 Înot",
        stats: [
          { label: "50M", value: "24.8s" },
          { label: t.topTalents.matches, value: "15" },
          { label: t.topTalents.rating, value: "8.5" },
        ],
        league: "FINA",
      },
    ],
  };

  const talents = allTalents[selectedSport] || allTalents.football;

  return (
    <section className="py-12 sm:py-20 bg-pitch border-t border-electric/10">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-primary-foreground text-center mb-4">
          {t.topTalents.title} <span className="text-electric">{t.topTalents.titleHighlight}</span>
        </h2>

        {/* Talent cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto mt-10">
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
