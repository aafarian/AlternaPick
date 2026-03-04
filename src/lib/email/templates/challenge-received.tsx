import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Preview,
  Hr,
} from "@react-email/components";
import type { ReactElement } from "react";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChallengeReceivedEmailProps {
  challengerUsername: string;
  gameMode: string;
  message: string | null;
  challengeId: string;
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
  const isClassic = gameMode === "classic";
  const modeLabel = gameMode.replace("_", " ");
  const challengeUrl = `${baseUrl}/challenges/${challengeId}`;

  const headlineText = isClassic
    ? `${challengerUsername} challenged you!`
    : `${challengerUsername} challenged you to a ${modeLabel} match!`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{headlineText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.heading}>{headlineText}</Text>
            <Text style={styles.text}>
              Think you can beat them? Accept the challenge and prove it.
            </Text>
            {message && (
              <Text style={{ ...styles.text, fontStyle: "italic" as const }}>
                &ldquo;{message}&rdquo;
              </Text>
            )}
            <Section style={styles.buttonWrapper}>
              <Link style={styles.button} href={challengeUrl}>
                View challenge →
              </Link>
            </Section>
          </Section>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>alternapick.com</Text>
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
