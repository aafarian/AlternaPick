import { Section, Text, Button } from "@react-email/components";
import type { ReactElement } from "react";
import type { GameMode } from "@/lib/supabase/types";
import { modeLabel } from "@/lib/modes/utils";
import { baseUrl } from "@/lib/email/config";
import { emailStyles as styles } from "@/lib/email/styles";
import { EmailLayout } from "@/lib/email/components/email-layout";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChallengeReceivedEmailProps {
  challengerUsername: string;
  gameMode: GameMode;
  message: string | null;
  challengeId: string;
  unsubscribeUrl?: string;
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
  unsubscribeUrl,
}: ChallengeReceivedEmailProps): ReactElement {
  const challengeUrl = `${baseUrl}/challenges/${challengeId}`;
  const modeText = getModeSuffix(gameMode);

  return (
    <EmailLayout unsubscribeUrl={unsubscribeUrl}>
      <Text style={styles.subheading}>New Challenge{modeText}</Text>
      <Text style={styles.heading}>
        {challengerUsername} wants to take you on
      </Text>
      <Text style={styles.text}>
        Think you can beat them? Pick your props and see who comes out on top.
      </Text>
      {message && (
        <Text style={styles.muted}>&ldquo;{message}&rdquo;</Text>
      )}
      <Section style={styles.buttonWrapper}>
        <Button style={styles.button} href={challengeUrl}>
          Accept Challenge
        </Button>
      </Section>
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

  const lines = [
    `${props.challengerUsername} wants to take you on.`,
    "",
    "Think you can beat them? Pick your props and see who comes out on top.",
  ];
  if (props.message) {
    lines.push("", `"${props.message}"`);
  }
  lines.push("", `Accept challenge: ${challengeUrl}`);

  return {
    subject,
    react: <ChallengeReceivedEmail {...props} />,
    text: lines.join("\n"),
  };
}
