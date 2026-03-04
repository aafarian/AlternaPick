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
import type { GameMode } from "@/lib/supabase/types";
import { modeLabel } from "@/lib/modes/utils";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChallengeReceivedEmailProps {
  challengerUsername: string;
  gameMode: GameMode;
  message: string | null;
  challengeId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHeadline(challengerUsername: string, gameMode: GameMode): string {
  if (gameMode === "classic") return `${challengerUsername} challenged you!`;
  return `${challengerUsername} challenged you to a ${modeLabel(gameMode)} match!`;
}

function getSubject(challengerUsername: string, gameMode: GameMode): string {
  return getHeadline(challengerUsername, gameMode);
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
  const headlineText = getHeadline(challengerUsername, gameMode);

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
  return {
    subject: getSubject(props.challengerUsername, props.gameMode),
    react: <ChallengeReceivedEmail {...props} />,
  };
}
