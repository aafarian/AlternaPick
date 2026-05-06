import HeroSection from "@/components/landing/HeroSection";
import { SportsBar } from "@/components/landing/SportsBar";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { FlameTokensSection } from "@/components/landing/FlameTokensSection";
import { LiveScoringSection } from "@/components/landing/LiveScoringSection";
import { GameModesSection } from "@/components/landing/GameModesSection";
import { AnalyticsSection } from "@/components/landing/AnalyticsSection";
import { LeaderboardSection } from "@/components/landing/LeaderboardSection";
import { CTASection } from "@/components/landing/CTASection";
import { JsonLd } from "@/components/seo/JsonLd";
import { softwareApplicationSchema } from "@/lib/seo/structured-data";
import { canonicalUrl } from "@/lib/seo/page-metadata";

// Inherit title/description/OG from the root layout (default title);
// only override the canonical so query-string variants don't compete.
export const metadata = {
  alternates: { canonical: canonicalUrl("/") },
};

export default function Home() {
  return (
    <div className="-mx-4">
      <JsonLd data={softwareApplicationSchema} />
      <HeroSection />
      <SportsBar />
      <FeaturesSection />
      <FlameTokensSection />
      <LiveScoringSection />
      <GameModesSection />
      <AnalyticsSection />
      <LeaderboardSection />
      <CTASection />
    </div>
  );
}
