import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TopScoutsSection from "@/components/landing/TopScoutsSection";
import TopTalentsSection from "@/components/landing/TopTalentsSection";
import SuccessStoriesSection from "@/components/landing/SuccessStoriesSection";
import FooterSection from "@/components/landing/FooterSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-pitch">
      <Navbar />
      <HeroSection />
      <HowItWorksSection />
      <TopScoutsSection />
      <TopTalentsSection />
      <SuccessStoriesSection />
      <FooterSection />
    </div>
  );
};

export default Index;
