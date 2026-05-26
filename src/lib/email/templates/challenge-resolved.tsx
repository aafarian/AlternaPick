import { Text, Button, Section } from "@react-email/components";
import type { ReactElement } from "react";
import { baseUrl } from "@/lib/email/config";
import { emailStyles as styles, colors } from "@/lib/email/styles";
import { EmailLayout } from "@/lib/email/components/email-layout";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChallengeResolvedEmailProps {
  username: string;
  opponentName: string;
  myScore: number;
  theirScore: number;
  totalPicks: number;
  myHeatScore: number;
  theirHeatScore: number;
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
  totalPicks: number,
  opponentName: string,
): string {
  if (isTie) return `Challenge tied with ${opponentName}`;
  if (isWinner)
    return `Challenge result: ${myScore}/${totalPicks} correct vs ${opponentName}`;
  return `${opponentName} won your challenge`;
}

function getHeading(isWinner: boolean, isTie: boolean): string {
  if (isTie) return "It's a tie";
  if (isWinner) return "You won!";
  return "Challenge complete";
}

function getSummary(
  isWinner: boolean,
  isTie: boolean,
  opponentName: string,
  myScore: number,
  theirScore: number,
  totalPicks: number,
  myHeatScore: number,
  theirHeatScore: number,
): string {
  const scoreDesc = `You got ${myScore}/${totalPicks} picks right, ${opponentName} got ${theirScore}/${totalPicks}.`;

  if (isTie) {
    if (myHeatScore === theirHeatScore) {
      return `${scoreDesc} Dead even on HeatScore too - a true tie.`;
    }
    return `${scoreDesc} Same record, HeatScore was tied.`;
  }

  if (isWinner) {
    if (myScore === theirScore) {
      return `${scoreDesc} Same record, but your HeatScore (${myHeatScore}) beat theirs (${theirHeatScore}).`;
    }
    return `${scoreDesc}`;
  }

  // Lost
  if (myScore === theirScore) {
    return `${scoreDesc} Same record, but their HeatScore (${theirHeatScore}) edged yours (${myHeatScore}).`;
  }
  return `${scoreDesc}`;
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
  totalPicks,
  myHeatScore,
  theirHeatScore,
  isWinner,
  isTie,
  challengeId,
  unsubscribeUrl,
}: ChallengeResolvedEmailProps): ReactElement {
  const challengeUrl = `${baseUrl}/challenges/${challengeId}`;
  const summary = getSummary(isWinner, isTie, opponentName, myScore, theirScore, totalPicks, myHeatScore, theirHeatScore);
  const scoreAccent = getScoreAccent(isWinner, isTie);
  const scoreCardBg = getScoreCardBg(isWinner, isTie);

  return (
    <EmailLayout unsubscribeUrl={unsubscribeUrl}>
      <Text style={styles.subheading}>Challenge Complete</Text>
      <Text style={styles.heading}>{getHeading(isWinner, isTie)}</Text>
      <Section style={{ ...styles.scoreCard, ...scoreCardBg }}>
        <Text style={{ ...styles.scoreBlock, ...scoreAccent }}>
          {myScore}/{totalPicks}
        </Text>
        <Text style={styles.scoreLabel}>correct picks</Text>
        <Text style={styles.scoreCardMeta}>
          vs {opponentName} ({theirScore}/{totalPicks})
        </Text>
      </Section>
      {(myHeatScore > 0 || theirHeatScore > 0) && (
        <Section style={{ textAlign: "center" as const, margin: "0 0 16px 0" }}>
          <Text style={{ fontSize: "13px", color: colors.zinc500, margin: "0" }}>
            HeatScore: {myHeatScore} vs {theirHeatScore}
          </Text>
        </Section>
      )}
      <Text style={styles.text}>
        {username}, {summary.charAt(0).toLowerCase()}{summary.slice(1)}
      </Text>
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
    props.totalPicks,
    props.opponentName,
  );
  const heading = getHeading(props.isWinner, props.isTie);
  const summary = getSummary(props.isWinner, props.isTie, props.opponentName, props.myScore, props.theirScore, props.totalPicks, props.myHeatScore, props.theirHeatScore);
  const challengeUrl = `${baseUrl}/challenges/${props.challengeId}`;

  return {
    subject,
    react: <ChallengeResolvedEmail {...props} />,
    text: `${heading}\n\n${props.myScore}/${props.totalPicks} correct picks\nvs ${props.opponentName} (${props.theirScore}/${props.totalPicks})\nHeatScore: ${props.myHeatScore} vs ${props.theirHeatScore}\n\n${summary}\n\nView details: ${challengeUrl}`,
  };
}
