import HeroSection from "@/components/landing/HeroSection";
import { SportsBar } from "@/components/landing/SportsBar";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { GameModesSection } from "@/components/landing/GameModesSection";
import { AnalyticsSection } from "@/components/landing/AnalyticsSection";
import { LeaderboardSection } from "@/components/landing/LeaderboardSection";
import { CTASection } from "@/components/landing/CTASection";

export default function Home() {
  return (
    <div className="w-screen ml-[calc(50%-50vw)]">
      <HeroSection />
      <SportsBar />
      <FeaturesSection />
      <GameModesSection />
      <AnalyticsSection />
      <LeaderboardSection />
      <CTASection />
    </div>
  );
}
