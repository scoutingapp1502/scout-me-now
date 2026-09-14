import { Eye, MessageCircle, ListChecks, Users2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const BenefitsSection = () => {
  const { t } = useLanguage();

  const items = [
    { icon: Eye, title: t.benefits.visibility, desc: t.benefits.visibilityDesc },
    { icon: MessageCircle, title: t.benefits.contact, desc: t.benefits.contactDesc },
    { icon: ListChecks, title: t.benefits.palmares, desc: t.benefits.palmaresDesc },
    { icon: Users2, title: t.benefits.network, desc: t.benefits.networkDesc },
  ];

  return (
    <section id="profile-content" className="py-12 sm:py-20 bg-gray-50 border-t border-gray-100 scroll-mt-16">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-gray-900 text-center mb-3">
          {t.benefits.title} <span className="text-orange-500">{t.benefits.titleHighlight}</span>
        </h2>
        <p className="text-gray-500 font-body text-center mb-10 sm:mb-14 max-w-xl mx-auto text-sm sm:text-base">
          {t.benefits.subtitle}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {items.map((item) => (
            <div
              key={item.title}
              className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm hover:border-orange-300 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="font-display text-lg text-gray-900 mb-1.5">{item.title}</h3>
              <p className="text-gray-500 text-sm font-body">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
