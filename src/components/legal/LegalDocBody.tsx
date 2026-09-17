interface LegalSection {
  title: string;
  body: string;
}

interface LegalDocBodyProps {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  tocLabel: string;
  sections: LegalSection[];
  compact?: boolean;
}

const slugify = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const LegalDocBody = ({ eyebrow, title, lastUpdated, tocLabel, sections, compact = false }: LegalDocBodyProps) => {
  return (
    <div className={compact ? "max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10" : "max-w-3xl mx-auto px-4 py-10 sm:py-14"}>
      <span className="text-orange-500 text-xs font-body font-bold tracking-widest uppercase">// {eyebrow}</span>
      <h1 className={compact ? "font-display text-2xl sm:text-4xl text-gray-900 mt-2 mb-3" : "font-display text-3xl sm:text-5xl text-gray-900 mt-2 mb-3"}>
        {title}
      </h1>
      <p className="text-gray-400 text-sm font-body mb-6 sm:mb-8">{lastUpdated}</p>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6 mb-8 sm:mb-10">
        <p className="text-gray-500 text-xs font-body font-semibold uppercase tracking-wide mb-3">{tocLabel}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {sections.map((s) => (
            <a
              key={s.title}
              href={`#${slugify(s.title)}`}
              className="text-sm text-gray-700 hover:text-orange-600 font-body transition-colors"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-7 sm:space-y-8">
        {sections.map((s) => (
          <div key={s.title} id={slugify(s.title)} className="scroll-mt-4">
            <h2 className={compact ? "font-display text-lg sm:text-xl text-gray-900 mb-1.5" : "font-display text-xl text-gray-900 mb-2"}>
              {s.title}
            </h2>
            <p className="text-gray-500 font-body leading-relaxed text-sm sm:text-base">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LegalDocBody;
