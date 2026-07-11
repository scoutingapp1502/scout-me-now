import { Users, Eye, Trophy } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const HowItWorksSection = () => {
  const { t } = useLanguage();

  const steps = [
    { icon: Users, value: "+800+", label: t.howItWorks.step1, desc: t.howItWorks.step1Desc },
    { icon: Eye, value: "150+", label: t.howItWorks.step2, desc: t.howItWorks.step2Desc },
    { icon: Trophy, value: "70+", label: t.howItWorks.step3, desc: t.howItWorks.step3Desc },
  ];

  return (
    <section className="py-12 sm:py-20 bg-pitch border-t border-electric/10">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-primary-foreground text-center mb-10 sm:mb-14">
          {t.howItWorks.title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 max-w-4xl mx-auto">
          {steps.map((step) => (
            <div key={step.label} className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-electric/10 border border-electric/30 flex items-center justify-center">
                <step.icon className="h-7 w-7 text-electric" />
              </div>
              <p className="font-display text-4xl sm:text-5xl text-electric mb-2">{step.value}</p>
              <p className="font-display text-lg text-primary-foreground">{step.label}</p>
              <p className="text-muted-foreground text-sm font-body mt-1">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom stats bar */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 sm:gap-12 text-muted-foreground text-sm font-body">
          <span>👥 500 {t.howItWorks.players}</span>
          <span>🔍 150 {t.howItWorks.scouts}</span>
          <span>🏆 50 {t.howItWorks.transfers}</span>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
