import { Text, Button, Section } from "@react-email/components";
import type { ReactElement } from "react";
import { baseUrl } from "@/lib/email/config";
import { emailStyles as styles } from "@/lib/email/styles";
import { EmailLayout } from "@/lib/email/components/email-layout";

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
  unsubscribeUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSubject(
  isWinner: boolean,
  isTie: boolean,
  myScore: number,
  theirScore: number,
  opponentName: string,
): string {
  if (isTie) return `Tied ${myScore}\u2013${theirScore} with ${opponentName}`;
  if (isWinner)
    return `You beat ${opponentName} ${myScore}\u2013${theirScore}`;
  return `${opponentName} won ${theirScore}\u2013${myScore}`;
}

function getHeading(isWinner: boolean, isTie: boolean): string {
  if (isTie) return "It\u2019s a tie";
  if (isWinner) return "You won!";
  return "Better luck next time";
}

function getSummary(
  isWinner: boolean,
  isTie: boolean,
  opponentName: string,
): string {
  if (isTie) return `You and ${opponentName} finished dead even. Run it back?`;
  if (isWinner) return `You came out on top against ${opponentName}.`;
  return `${opponentName} took this one. Challenge them again?`;
}

function getScoreAccent(isWinner: boolean, isTie: boolean) {
  if (isTie) return styles.accentTie;
  if (isWinner) return styles.accentWin;
  return styles.accentLoss;
}

function getScoreCardBg(isWinner: boolean, isTie: boolean) {
  if (isTie) return styles.scoreCardTie;
  if (isWinner) return styles.scoreCardWin;
  return styles.scoreCardLoss;
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
  unsubscribeUrl,
}: ChallengeResolvedEmailProps): ReactElement {
  const challengeUrl = `${baseUrl}/challenges/${challengeId}`;
  const summary = getSummary(isWinner, isTie, opponentName);
  const scoreAccent = getScoreAccent(isWinner, isTie);
  const scoreCardBg = getScoreCardBg(isWinner, isTie);

  return (
    <EmailLayout
      preview={getSubject(isWinner, isTie, myScore, theirScore, opponentName)}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={styles.subheading}>Challenge Complete</Text>
      <Text style={styles.heading}>{getHeading(isWinner, isTie)}</Text>
      <Section style={{ ...styles.scoreCard, ...scoreCardBg }}>
        <Text style={{ ...styles.scoreBlock, ...scoreAccent }}>
          {myScore} &ndash; {theirScore}
        </Text>
        <Text style={styles.scoreLabel}>
          {username} vs {opponentName}
        </Text>
      </Section>
      <Text style={styles.text}>{summary}</Text>
      <Section style={styles.buttonWrapper}>
        <Button style={styles.button} href={challengeUrl}>
          View Details
        </Button>
      </Section>
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Helper for Resend integration
// ---------------------------------------------------------------------------

export function getChallengeResolvedEmailProps(
  props: ChallengeResolvedEmailProps,
): {
  subject: string;
  react: ReactElement;
  text: string;
} {
  const subject = getSubject(
    props.isWinner,
    props.isTie,
    props.myScore,
    props.theirScore,
    props.opponentName,
  );
  const heading = getHeading(props.isWinner, props.isTie);
  const summary = getSummary(props.isWinner, props.isTie, props.opponentName);
  const challengeUrl = `${baseUrl}/challenges/${props.challengeId}`;

  return {
    subject,
    react: <ChallengeResolvedEmail {...props} />,
    text: `${heading}\n\n${props.myScore}-${props.theirScore}\n${props.username} vs ${props.opponentName}\n\n${summary}\n\nView details: ${challengeUrl}`,
  };
}
