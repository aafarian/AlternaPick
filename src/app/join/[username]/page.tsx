import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Profile, LeaderboardEntry } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCircle } from "lucide-react";

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
    .select("total_cards, win_rate")
    .eq("user_id", referrer.id)
    .maybeSingle();

  const stats = statsData as {
    total_cards: number;
    win_rate: number;
  } | null;

  const displayName = referrer.display_name || referrer.username;
  const signupUrl = `/auth/signup?ref=${encodeURIComponent(referrer.username)}`;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-primary">Sports</span>Tower
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Predict. Compete. Dominate.
          </p>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            {/* Referrer avatar */}
            {referrer.avatar_url ? (
              <img
                src={referrer.avatar_url}
                alt={displayName}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-primary"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted ring-2 ring-primary">
                <UserCircle className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            {/* Invite message */}
            <div className="text-center">
              <h2 className="text-xl font-semibold">
                Join {displayName} on SportsTower!
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ve been invited by{" "}
                <span className="font-medium text-foreground">
                  @{referrer.username}
                </span>
              </p>
            </div>

            {/* Referrer stats */}
            {stats && stats.total_cards > 0 && (
              <div className="flex w-full justify-center gap-8 rounded-lg bg-muted/50 px-4 py-3">
                <div className="text-center">
                  <p className="text-lg font-bold">{stats.total_cards}</p>
                  <p className="text-xs text-muted-foreground">Cards</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">
                    {Math.round(stats.win_rate * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                </div>
              </div>
            )}

            {/* CTA */}
            <Button asChild className="mt-2 w-full" size="lg">
              <Link href={signupUrl}>Sign Up to Get Started</Link>
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
