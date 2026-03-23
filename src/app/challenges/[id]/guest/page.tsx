import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyGuestToken, markTokenUsed } from "@/lib/challenges/guest-token";
import { logError, logInfo } from "@/lib/logger";
import { UNPICKABLE_CHALLENGE_STATUSES } from "@/lib/challenges/constants";
import type { Challenge, Prop, Game, StatCategory } from "@/lib/supabase/types";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import GuestBallot from "@/components/challenges/GuestBallot";

type PropWithGame = Prop & { games: Game };

interface ChallengerProfile {
  username: string;
  display_name: string | null;
}

export const metadata: Metadata = {
  title: "Make Your Picks | AlternaPick",
  description: "Pick over or under on each prop to lock in your card.",
};

export default async function GuestPickPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id: challengeId } = await params;
  const { token } = await searchParams;

  // No token provided
  if (!token) {
    return <InvalidTokenState />;
  }

  // Verify the token
  const tokenData = await verifyGuestToken(token);
  if (!tokenData) {
    return <InvalidTokenState />;
  }

  // Verify token matches this challenge
  if (tokenData.challengeId !== challengeId) {
    return <InvalidTokenState />;
  }

  const admin = createAdminClient();

  // Fetch challenge with challenger profile
  const { data: challengeData, error: challengeError } = await (
    admin.from("challenges") as any
  )
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(username, display_name)"
    )
    .eq("id", challengeId)
    .single();

  if (challengeError || !challengeData) {
    logError(
      "guest-page",
      `Challenge not found: ${challengeId}`,
      "GET /challenges/[id]/guest",
      challengeError
    );
    return <InvalidTokenState />;
  }

  const challenge = challengeData as Challenge & {
    challenger: ChallengerProfile;
  };

  // Check if challenge is in a valid state for picking
  if (UNPICKABLE_CHALLENGE_STATUSES.includes(challenge.status as typeof UNPICKABLE_CHALLENGE_STATUSES[number])) {
    return <ExpiredChallengeState />;
  }

  // If the visitor is logged in, claim the challenge and redirect to the
  // authenticated ballot page instead of the guest flow. This handles the
  // case where an existing user receives an email invite.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Challenger visiting their own invite link — redirect to challenge page
    if (user.id === challenge.challenger_id) {
      redirect(`/challenges/${challengeId}`);
    }

    // Skip if challenge already has an opponent (idempotent)
    if (!challenge.opponent_id) {
      const { error: claimError } = await (admin.from("challenges") as any)
        .update({ opponent_id: user.id })
        .eq("id", challengeId)
        .is("opponent_id", null);

      if (claimError) {
        logError("guest-page", "Failed to claim challenge for logged-in user", "GET /challenges/[id]/guest", claimError);
        // Don't burn the token or redirect — the claim failed so the user
        // won't be a participant on the ballot page. Show the guest flow instead.
        return <InvalidTokenState />;
      }
      logInfo("guest-page", `Logged-in user ${user.id} claimed challenge ${challengeId} via invite link`);
    }

    await markTokenUsed(token);
    // Mirror/random modes have a ballot page; other modes use the challenge detail page
    // which links to /props for picking.
    const hasMirrorProps = challenge.mirror_props && challenge.mirror_props.length > 0;
    redirect(
      hasMirrorProps
        ? `/challenges/${challengeId}/ballot`
        : `/challenges/${challengeId}`
    );
  }

  // Check if a guest card already exists (picks already submitted)
  const { data: existingCards } = await (admin.from("cards") as any)
    .select("id")
    .eq("challenge_id", challengeId)
    .is("user_id", null)
    .limit(1);

  if ((existingCards ?? []).length > 0) {
    return <AlreadySubmittedState />;
  }

  // For modes without pre-selected props (classic, sabotage, one_player, one_team),
  // redirect to the props browsing page where the guest picks their own props.
  const hasMirrorProps = challenge.mirror_props && challenge.mirror_props.length > 0;
  if (!hasMirrorProps) {
    redirect(`/props?challenge_id=${challengeId}&guest_token=${token}`);
  }

  const { data: propsData, error: propsError } = await (
    admin.from("props") as any
  )
    .select("*, games(*)")
    .in("id", challenge.mirror_props);

  if (propsError) {
    logError(
      "guest-page",
      "Failed to fetch props",
      "GET /challenges/[id]/guest",
      propsError
    );
    return <InvalidTokenState />;
  }

  const props = ((propsData ?? []) as PropWithGame[]).sort(
    (a, b) =>
      new Date(a.games.commence_time).getTime() -
      new Date(b.games.commence_time).getTime(),
  );

  // Serialize props for the client component
  const serializedProps = props.map((p) => ({
    id: p.id,
    player_name: p.player_name,
    player_id: p.player_id,
    player_team: p.player_team,
    player_position: p.player_position,
    stat_category: p.stat_category as StatCategory,
    line: p.line,
    commence_time: p.games.commence_time,
    sport: p.games.sport,
    home_team: p.games.home_team,
  }));

  return (
    <GuestBallot
      challengeId={challengeId}
      token={token}
      challengerName={challenge.challenger.username}
      gameMode={challenge.game_mode}
      message={challenge.message}
      props={serializedProps}
    />
  );
}

function GuestErrorState({
  title,
  description,
  ctaText = "Sign Up for AlternaPick",
  variant = "error",
}: {
  title: string;
  description: string;
  ctaText?: string;
  variant?: "error" | "info";
}) {
  const colorClass = variant === "error" ? "bg-destructive/10" : "bg-primary/10";
  const iconClass = variant === "error" ? "text-destructive" : "text-primary";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${colorClass}`}>
          <AlertCircle className={`h-8 w-8 ${iconClass}`} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Link href="/auth/signup">
          <Button size="lg" className="font-bold">
            {ctaText}
          </Button>
        </Link>
      </div>
    </div>
  );
}

function InvalidTokenState() {
  return (
    <GuestErrorState
      title="Invalid or Expired Link"
      description="This challenge link is no longer valid. It may have already been used or expired."
    />
  );
}

function ExpiredChallengeState() {
  return (
    <GuestErrorState
      title="Challenge No Longer Available"
      description="This challenge has been cancelled or already resolved."
    />
  );
}

function AlreadySubmittedState() {
  return (
    <GuestErrorState
      title="Picks Already Submitted"
      description="Your picks for this challenge have already been locked in."
      ctaText="Sign Up to Track Results"
      variant="info"
    />
  );
}
