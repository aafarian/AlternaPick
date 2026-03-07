import {
  Html,
  Head,
  Body,
  Container,
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

export interface ChallengeResolvedEmailProps {
  username: string;
  opponentName: string;
  myScore: number;
  theirScore: number;
  isWinner: boolean;
  isTie: boolean;
  challengeId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHeadline(isWinner: boolean, isTie: boolean, margin: number): string {
  if (isTie) return "Dead Heat";
  if (isWinner) {
    if (margin >= 3) return "Dominant Win!";
    if (margin === 1) return "Clutch Win!";
    return "Victory!";
  }
  if (margin >= 3) return "Tough Loss";
  if (margin === 1) return "So Close!";
  return "Better Luck Next Time";
}

function getSubtext(
  isWinner: boolean,
  isTie: boolean,
  opponentName: string
): string {
  if (isTie) return `You and ${opponentName} are dead even. Run it back?`;
  if (isWinner) return `Nice work against ${opponentName}.`;
  return `${opponentName} got this one. Shake it off.`;
}

function getSubject(
  isWinner: boolean,
  isTie: boolean,
  myScore: number,
  theirScore: number,
  opponentName: string
): string {
  if (isTie) return `Dead Heat: ${myScore}-${theirScore} vs ${opponentName}`;
  if (isWinner) return `Victory! You beat ${opponentName} ${myScore}-${theirScore}`;
  return `You fell to ${opponentName} ${theirScore}-${myScore}`;
}

function getScoreAccent(isWinner: boolean, isTie: boolean) {
  if (isTie) return styles.accentTie;
  if (isWinner) return styles.accentWin;
  return styles.accentLoss;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChallengeResolvedEmail({
  username,
  opponentName,
  myScore,
  theirScore,
  isWinner,
  isTie,
  challengeId,
}: ChallengeResolvedEmailProps): ReactElement {
  const margin = Math.abs(myScore - theirScore);
  const headline = getHeadline(isWinner, isTie, margin);
  const subtext = getSubtext(isWinner, isTie, opponentName);
  const challengeUrl = `${baseUrl}/challenges/${challengeId}`;
  const scoreAccent = getScoreAccent(isWinner, isTie);

  return (
    <Html lang="en">
      <Head />
      <Preview>
        {`${headline} ${myScore}-${theirScore} vs ${opponentName}.`}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.heading}>{headline}</Text>
          <Text style={{ ...styles.scoreBlock, ...scoreAccent }}>
            {myScore} - {theirScore}
          </Text>
          <Text style={styles.text}>
            {username}, you went {myScore}-{theirScore} vs {opponentName}. {subtext}
          </Text>
          <Link style={styles.button} href={challengeUrl}>
            View challenge →
          </Link>

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

export function getChallengeResolvedEmailProps(
  props: ChallengeResolvedEmailProps
): {
  subject: string;
  react: ReactElement;
  text: string;
} {
  const margin = Math.abs(props.myScore - props.theirScore);
  const headline = getHeadline(props.isWinner, props.isTie, margin);
  const subtext = getSubtext(props.isWinner, props.isTie, props.opponentName);
  const challengeUrl = `${baseUrl}/challenges/${props.challengeId}`;

  const text = [
    headline,
    "",
    `${props.username}, you went ${props.myScore}-${props.theirScore} vs ${props.opponentName}. ${subtext}`,
    "",
    `View challenge: ${challengeUrl}`,
  ].join("\n");

  return {
    subject: getSubject(
      props.isWinner,
      props.isTie,
      props.myScore,
      props.theirScore,
      props.opponentName
    ),
    react: <ChallengeResolvedEmail {...props} />,
    text,
  };
}
