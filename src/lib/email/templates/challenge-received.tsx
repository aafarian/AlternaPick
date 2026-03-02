import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
  Preview,
  Section,
  Hr,
} from "@react-email/components";
import type { ReactElement } from "react";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChallengeReceivedEmailProps {
  opponentUsername: string;
  challengerUsername: string;
  gameMode: string;
  message: string | null;
  challengeId: string;
}

// ---------------------------------------------------------------------------
// Template-specific styles
// ---------------------------------------------------------------------------

const messageStyle = {
  fontSize: "16px",
  color: "#e4e4e7",
  textAlign: "center" as const,
  fontStyle: "italic" as const,
  margin: "0 0 32px 0",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChallengeReceivedEmail({
  challengerUsername,
  gameMode,
  message,
  challengeId,
}: ChallengeReceivedEmailProps): ReactElement {
  const isClassic = gameMode === "classic";
  const modeLabel = gameMode.replace("_", " ");
  const challengeUrl = `${baseUrl}/challenges`;

  const headlineText = isClassic
    ? `${challengerUsername} challenged you!`
    : `${challengerUsername} challenged you to a ${modeLabel} match!`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{headlineText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Sports Tower</Text>

          <Text style={styles.headline}>{headlineText}</Text>
          <Text style={styles.subtext}>
            Think you can beat them? Accept the challenge and prove it.
          </Text>

          {message && (
            <Text style={messageStyle}>&ldquo;{message}&rdquo;</Text>
          )}

          <Section style={styles.buttonSection}>
            <Button style={styles.button} href={challengeUrl}>
              View Challenge
            </Button>
          </Section>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Sports Tower &mdash; alternapick.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Helper for Resend integration
// ---------------------------------------------------------------------------

export function getChallengeReceivedEmailProps(
  props: ChallengeReceivedEmailProps
): {
  subject: string;
  react: ReactElement;
} {
  const isClassic = props.gameMode === "classic";
  const modeLabel = props.gameMode.replace("_", " ");

  const subject = isClassic
    ? `${props.challengerUsername} challenged you!`
    : `${props.challengerUsername} challenged you to a ${modeLabel} match!`;

  return {
    subject,
    react: <ChallengeReceivedEmail {...props} />,
  };
}
