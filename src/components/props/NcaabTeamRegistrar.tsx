"use client";

import { registerNcaabTeamIds } from "@/lib/constants";

/**
 * Client-side bridge that registers NCAAB ESPN team IDs in the client module scope.
 *
 * Because Next.js RSC and client components use separate module instances,
 * calling registerNcaabTeamIds() in a server component does NOT populate the
 * Map used by teamLogoUrl() in client components like GameCard and PropLine.
 *
 * This component receives the mapping as serialized props from the server
 * and registers it in the same module scope used by other "use client" components.
 */
export default function NcaabTeamRegistrar({
  teams,
}: {
  teams: Record<string, string>;
}) {
  // Idempotent — just sets Map entries. Safe to call during render.
  registerNcaabTeamIds(
    Object.entries(teams).map(([name, id]) => ({ name, id }))
  );
  return null;
}
