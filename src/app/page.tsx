import HeroSection from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <HeroSection />

      {/* Features */}
      <FeaturesSection />
    </div>
  );
}
