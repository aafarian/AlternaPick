import HeroSection from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { CTASection } from "@/components/landing/CTASection";

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <HeroSection />

      {/* Features */}
      <FeaturesSection />

      {/* CTA — final conversion touchpoint */}
      <CTASection />
    </div>
  );
}
