import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Link,
  Preview,
} from "@react-email/components";
import type { ReactElement } from "react";
import type { GameMode } from "@/lib/supabase/types";
import { modeLabel } from "@/lib/modes/utils";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";
import { EmailFooter } from "@/lib/email/components/email-footer";

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
// Component
// ---------------------------------------------------------------------------

export function ChallengeReceivedEmail({
  challengerUsername,
  gameMode,
  message,
  challengeId,
}: ChallengeReceivedEmailProps): ReactElement {
  const challengeUrl = `${baseUrl}/challenges/${challengeId}`;
  const modeText = gameMode === "classic" ? "" : ` (${modeLabel(gameMode)})`;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        {`${challengerUsername} sent you a challenge${modeText}`}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.heading}>
            {challengerUsername} challenged you{modeText}
          </Text>
          {message && (
            <Text style={styles.muted}>
              &ldquo;{message}&rdquo;
            </Text>
          )}
          <Text style={styles.text}>
            <Link style={styles.link} href={challengeUrl}>
              View challenge &rarr;
            </Link>
          </Text>

          <EmailFooter />
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
  text: string;
} {
  const modeText =
    props.gameMode === "classic" ? "" : ` (${modeLabel(props.gameMode)})`;
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
