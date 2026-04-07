import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChallenge } from "@/lib/challenges/queries";
import { ChallengeModal } from "./ChallengeModal";

/**
 * Intercepting route: when the user clicks a challenge link from
 * /challenges (typically the History list), this page is rendered in the
 * @modal parallel slot. The list page stays mounted underneath, so scroll
 * position and pagination state are preserved.
 *
 * Direct navigation to /challenges/[id] (refresh, share link) still hits
 * the standalone src/app/challenges/[id]/page.tsx as a regular full page.
 */
export default async function InterceptedChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous viewers fall through to the standalone page (which redirects
  // to login) instead of showing a modal over the wrong page.
  if (!user) {
    notFound();
  }

  const challenge = await getChallenge(id, user.id);
  if (!challenge) {
    notFound();
  }

  return <ChallengeModal challenge={challenge} currentUserId={user.id} />;
}
