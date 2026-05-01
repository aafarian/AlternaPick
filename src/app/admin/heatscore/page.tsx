import { noIndexMetadata } from "@/lib/seo/metadata";
import HeatScoreAdmin from "@/components/admin/HeatScoreAdmin";

export const metadata = {
  ...noIndexMetadata,
  title: "Admin - HeatScore",
};

export default function AdminHeatScorePage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">HeatScore</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Simulate HeatScore on resolved cards and manage rollout settings.
      </p>
      <div className="mt-6 flex flex-col gap-8">
        <HeatScoreAdmin />
      </div>
    </div>
  );
}
