import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import BenefitsSection from "@/components/landing/BenefitsSection";
import TopScoutsSection from "@/components/landing/TopScoutsSection";
import CompareSection from "@/components/landing/CompareSection";
import FinalCtaSection from "@/components/landing/FinalCtaSection";
import FooterSection from "@/components/landing/FooterSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <HowItWorksSection />
      <BenefitsSection />
      <TopScoutsSection />
      <CompareSection />
      <FinalCtaSection />
      <FooterSection />
    </div>
  );
};

export default Index;
