import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { UserCircle, Trophy, Flame, Target } from "lucide-react";

interface JoinPageProps {
  params: Promise<{ username: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { username } = await params;

  const supabase = await createClient();

  // Look up the referrer by username
  const { data: referrerData, error: profileError } = await (
    supabase.from("profiles") as any
  )
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (profileError || !referrerData) {
    // Referrer not found — redirect to home
    redirect("/");
  }

  const referrer = referrerData as Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url"
  >;

  // Fetch referrer's leaderboard stats
  const { data: statsData } = await (
    supabase.from("leaderboard_entries") as any
  )
    .select("total_cards, win_rate, current_streak")
    .eq("user_id", referrer.id)
    .maybeSingle();

  const stats = statsData as {
    total_cards: number;
    win_rate: number;
    current_streak: number;
  } | null;

  // Count total users for social proof
  const { count: totalUsers } = await (supabase.from("profiles") as any)
    .select("id", { count: "exact", head: true });

  const displayName = referrer.display_name || referrer.username;
  const signupUrl = `/auth/signup?ref=${encodeURIComponent(referrer.username)}`;
  const userCount = totalUsers ?? 0;

  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Background gradient glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-accent/6 blur-[100px]" />
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            <span className="text-primary">Alterna</span>Pick
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Predict. Compete. Dominate.
          </p>
        </div>

        {/* Referrer card */}
        <div className="w-full rounded-2xl border border-border bg-card/80 p-6 shadow-lg shadow-primary/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5">
            {/* Avatar with glow ring */}
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/40 to-accent/30 blur-md" />
              {referrer.avatar_url ? (
                <img
                  src={referrer.avatar_url}
                  alt={displayName}
                  className="relative h-24 w-24 rounded-full object-cover ring-2 ring-primary/60"
                />
              ) : (
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-muted ring-2 ring-primary/60">
                  <UserCircle className="h-14 w-14 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Invite heading */}
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                You have been invited by
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {displayName}
              </h2>
              <p className="text-sm text-primary font-medium">
                @{referrer.username}
              </p>
            </div>

            {/* Stats badges */}
            {stats && stats.total_cards > 0 && (
              <div className="grid w-full grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/50 px-3 py-3">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-lg font-bold tabular-nums">
                    {stats.total_cards}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Cards Played
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/50 px-3 py-3">
                  <Trophy className="h-4 w-4 text-neon-green" />
                  <span className="text-lg font-bold tabular-nums text-neon-green">
                    {Math.round(stats.win_rate * 100)}%
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Win Rate
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/50 px-3 py-3">
                  <Flame className="h-4 w-4 text-bold-red" />
                  <span className="text-lg font-bold tabular-nums">
                    {stats.current_streak}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Streak
                  </span>
                </div>
              </div>
            )}

            {/* Social proof */}
            {userCount > 1 && (
              <p className="text-center text-sm text-muted-foreground">
                Join{" "}
                <span className="font-semibold text-foreground">
                  {displayName}
                </span>{" "}
                and{" "}
                <span className="font-semibold text-foreground">
                  {userCount.toLocaleString()} others
                </span>{" "}
                on AlternaPick
              </p>
            )}

            {/* CTA */}
            <Button
              asChild
              className="mt-1 w-full text-base font-semibold shadow-md shadow-primary/20"
              size="lg"
            >
              <Link href={signupUrl}>Sign Up &amp; Play</Link>
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Value proposition pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {["Free to play", "NBA player props", "Compete with friends"].map(
            (text) => (
              <span
                key={text}
                className="rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {text}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
