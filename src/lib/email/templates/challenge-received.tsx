import { Text, Link } from "@react-email/components";
import type { ReactElement } from "react";
import type { GameMode } from "@/lib/supabase/types";
import { modeLabel } from "@/lib/modes/utils";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";
import { EmailLayout } from "@/lib/email/components/email-layout";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChallengeReceivedEmailProps {
  challengerUsername: string;
  gameMode: GameMode;
  message: string | null;
  challengeId: string;
}

function getModeSuffix(gameMode: GameMode): string {
  return gameMode === "classic" ? "" : ` (${modeLabel(gameMode)})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChallengeReceivedEmail({
  challengerUsername,
  gameMode,
  message,
  challengeId,
}: ChallengeReceivedEmailProps): ReactElement {
  const challengeUrl = `${baseUrl}/challenges/${challengeId}`;
  const modeText = getModeSuffix(gameMode);

  return (
    <EmailLayout
      preview={`${challengerUsername} sent you a challenge${modeText}`}
    >
      <Text style={styles.heading}>
        {challengerUsername} challenged you{modeText}
      </Text>
      {message && (
        <Text style={styles.muted}>&ldquo;{message}&rdquo;</Text>
      )}
      <Text style={{ ...styles.text, textAlign: "center" as const }}>
        <Link style={styles.link} href={challengeUrl}>
          View challenge →
        </Link>
      </Text>
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Helper for Resend integration
// ---------------------------------------------------------------------------

export function getChallengeReceivedEmailProps(
  props: ChallengeReceivedEmailProps,
): {
  subject: string;
  react: ReactElement;
  text: string;
} {
  const modeText = getModeSuffix(props.gameMode);
  const subject = `${props.challengerUsername} sent you a challenge${modeText}`;
  const challengeUrl = `${baseUrl}/challenges/${props.challengeId}`;

  const lines = [subject];
  if (props.message) {
    lines.push("", `"${props.message}"`);
  }
  lines.push("", `View challenge: ${challengeUrl}`);

  return {
    subject,
    react: <ChallengeReceivedEmail {...props} />,
    text: lines.join("\n"),
  };
}
