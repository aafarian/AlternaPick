import { Text, Button } from "@react-email/components";
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
      <Text style={styles.heading}>New challenge{modeText}</Text>
      <Text style={styles.text}>
        <strong>{challengerUsername}</strong> wants to go head-to-head with you.
        Pick your props and see who comes out on top.
      </Text>
      {message && (
        <Text style={styles.muted}>&ldquo;{message}&rdquo;</Text>
      )}
      <Button style={styles.button} href={challengeUrl}>
        View Challenge
      </Button>
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

  const lines = [`${props.challengerUsername} wants to go head-to-head with you.`];
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
