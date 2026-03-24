import { redirect } from "next/navigation";
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

  if (!user) {
    redirect("/auth/login");
  }

  const challenge = await getChallenge(id, user.id);

  // getChallenge returns null if not found or user is not a participant
  if (!challenge) {
    redirect("/challenges");
  }

  if (challenge.lobby_type === "group") {
    return <GroupLobbyView challenge={challenge} currentUserId={user.id} />;
  }

  return <ChallengeMatchup challenge={challenge} currentUserId={user.id} />;
}
