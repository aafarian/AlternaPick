import { Text, Button } from "@react-email/components";
import type { ReactElement } from "react";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";
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

function getSummary(
  isWinner: boolean,
  isTie: boolean,
  opponentName: string,
): string {
  if (isTie) return `You and ${opponentName} finished even.`;
  if (isWinner) return `You came out on top against ${opponentName}!`;
  return `${opponentName} took this one. Better luck next time.`;
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
  const challengeUrl = `${baseUrl}/challenges/${challengeId}`;
  const summary = getSummary(isWinner, isTie, opponentName);
  const scoreAccent = getScoreAccent(isWinner, isTie);

  return (
    <EmailLayout preview={getSubject(isWinner, isTie, myScore, theirScore, opponentName)}>
      <Text style={styles.heading}>Challenge complete</Text>
      <Text style={{ ...styles.scoreBlock, ...scoreAccent }}>
        {myScore} &ndash; {theirScore}
      </Text>
      <Text style={styles.text}>
        {username}, {summary.toLowerCase()}
      </Text>
      <Button style={styles.button} href={challengeUrl}>
        View Details
      </Button>
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
  const summary = getSummary(props.isWinner, props.isTie, props.opponentName);
  const challengeUrl = `${baseUrl}/challenges/${props.challengeId}`;

  return {
    subject,
    react: <ChallengeResolvedEmail {...props} />,
    text: `${props.myScore}-${props.theirScore}\n\n${props.username}, ${summary.toLowerCase()}\n\nView details: ${challengeUrl}`,
  };
}
