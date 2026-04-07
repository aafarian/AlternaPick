import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChallenge } from "@/lib/challenges/queries";
import ChallengeMatchup from "@/components/challenges/ChallengeMatchup";
import GroupLobbyView from "@/components/challenges/GroupLobbyView";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Challenges are publicly viewable. Pass null userId for anonymous viewers
  // — components handle this and hide participant-only controls.
  const viewerId = user?.id ?? null;
  const challenge = await getChallenge(id, viewerId);

  if (!challenge) {
    notFound();
  }

  // Pass empty string for viewerId so existing component comparisons against
  // participant ids return false for non-participants and anonymous viewers.
  const currentUserId = viewerId ?? "";

  if (challenge.lobby_type === "group") {
    return <GroupLobbyView challenge={challenge} currentUserId={currentUserId} />;
  }

  return <ChallengeMatchup challenge={challenge} currentUserId={currentUserId} />;
}
