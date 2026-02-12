"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Share2, Users, Gift } from "lucide-react";
import type { ReferralInfo, ReferredUser } from "@/lib/referrals/types";

interface ReferralSectionProps {
  referralInfo: ReferralInfo;
  referredUsers: ReferredUser[];
  /** The base URL for constructing the full referral link */
  baseUrl: string;
}

export default function ReferralSection({
  referralInfo,
  referredUsers,
  baseUrl,
}: ReferralSectionProps) {
  const [copied, setCopied] = useState(false);

  const fullLink = `${baseUrl}${referralInfo.referralLink}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text in a temporary input
      const input = document.createElement("input");
      input.value = fullLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join me on AlternaPick!",
          text: "Predict NBA player props and compete with friends.",
          url: fullLink,
        });
      } catch {
        // User cancelled share, fall back to copy
        handleCopy();
      }
    } else {
      handleCopy();
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">Refer Friends</h2>

      <Card className="border-border bg-card">
        <CardContent className="flex flex-col gap-5 p-6">
          {/* Referral link with copy */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Your referral link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-mono">
                {fullLink}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-neon-green" />
                    <span className="text-neon-green">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-lg font-bold tabular-nums">
                  {referralInfo.totalReferred}
                </div>
                <div className="text-xs text-muted-foreground">
                  Friends Referred
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-lg font-bold tabular-nums text-neon-green">
                  {referralInfo.rewardsEarned}
                </div>
                <div className="text-xs text-muted-foreground">
                  Streak Freezes
                </div>
              </div>
            </div>
          </div>

          {/* Share button */}
          <Button onClick={handleShare} className="w-full gap-2" size="lg">
            <Share2 className="h-4 w-4" />
            Share Referral Link
          </Button>

          {/* Referred users list */}
          {referredUsers.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                People you referred
              </p>
              <div className="flex flex-col gap-1.5">
                {referredUsers.map((user) => (
                  <div
                    key={user.username}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(
                          user.display_name ?? user.username
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">
                        {user.display_name ?? user.username}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Encouragement text */}
          <p className="text-center text-xs text-muted-foreground">
            Earn a streak freeze for every friend who signs up!
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
