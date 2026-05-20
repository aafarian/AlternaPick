import { Section, Text, Button } from "@react-email/components";
import type { ReactElement } from "react";
import type { GameMode } from "@/lib/modes/types";
import { modeLabel } from "@/lib/modes/utils";
import { emailStyles as styles } from "@/lib/email/styles";
import { EmailLayout } from "@/lib/email/components/email-layout";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChallengeInviteEmailProps {
  challengerUsername: string;
  gameMode: GameMode;
  message: string | null;
  guestPickUrl: string;
}

function getModeSuffix(gameMode: GameMode): string {
  return gameMode === "classic" ? "" : ` (${modeLabel(gameMode)})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChallengeInviteEmail({
  challengerUsername,
  gameMode,
  message,
  guestPickUrl,
}: ChallengeInviteEmailProps): ReactElement {
  const modeText = getModeSuffix(gameMode);

  return (
    <EmailLayout>
      <Text style={styles.subheading}>
        You&apos;ve Been Challenged{modeText}
      </Text>
      <Text style={styles.heading}>
        {challengerUsername} wants to take you on
      </Text>
      <Text style={styles.text}>
        No account needed - just pick your props and see if you can win.
      </Text>
      {message && (
        <Text style={styles.muted}>&ldquo;{message}&rdquo;</Text>
      )}
      <Section style={styles.buttonWrapper}>
        <Button style={styles.button} href={guestPickUrl}>
          Make Your Picks
        </Button>
      </Section>
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Helper for Resend integration
// ---------------------------------------------------------------------------

export function getChallengeInviteEmailProps(
  props: ChallengeInviteEmailProps,
): {
  subject: string;
  react: ReactElement;
  text: string;
} {
  const modeText = getModeSuffix(props.gameMode);
  const subject = `${props.challengerUsername} challenged you${modeText}`;

  const lines = [
    `${props.challengerUsername} wants to take you on.`,
    "",
    "No account needed - just pick your props and see if you can win.",
  ];
  if (props.message) {
    lines.push("", `"${props.message}"`);
  }
  lines.push("", `Make your picks: ${props.guestPickUrl}`);

  return {
    subject,
    react: <ChallengeInviteEmail {...props} />,
    text: lines.join("\n"),
  };
}
