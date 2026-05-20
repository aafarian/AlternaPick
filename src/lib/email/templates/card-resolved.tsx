import { Section, Text, Button } from "@react-email/components";
import type { ReactElement } from "react";
import { getCardTier } from "@/lib/cards/tiers";
import { baseUrl } from "@/lib/email/config";
import { emailStyles as styles } from "@/lib/email/styles";
import { EmailLayout } from "@/lib/email/components/email-layout";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardResolvedEmailProps {
  username: string;
  score: number;
  total: number;
  cardId: string;
  /** Flame Token wager amount (only for wagered cards). */
  wager?: number;
  /** Flame Token payout (only for wagered cards). */
  payout?: number;
  unsubscribeUrl?: string;
}

// ---------------------------------------------------------------------------
// Wager outcome helpers
// ---------------------------------------------------------------------------

type WagerOutcome = "profit" | "breakeven" | "partial" | "bust" | "refund";

function getWagerOutcome(wager: number, payout: number, score: number): WagerOutcome {
  if (payout === wager && score === 0) return "refund";
  if (payout === wager) return "breakeven";
  if (payout > wager) return "profit";
  if (payout > 0) return "partial";
  return "bust";
}

function getWagerHeadline(outcome: WagerOutcome, payout: number): string {
  switch (outcome) {
    case "profit":
      return `You won ${payout} coins!`;
    case "breakeven":
      return "You broke even";
    case "partial":
      return "Close call";
    case "bust":
      return "Tough break";
    case "refund":
      return "Wager refunded";
  }
}

function getWagerSubtext(outcome: WagerOutcome): string {
  switch (outcome) {
    case "profit":
      return "Your picks paid off.";
    case "breakeven":
      return "You got your wager back - one more pick and you would have profited.";
    case "partial":
      return "You recouped some coins, but not enough to profit.";
    case "bust":
      return "Your picks didn't hit this time.";
    case "refund":
      return "Too many DNPs on this card, so your wager was returned in full.";
  }
}

function getWagerSubject(
  outcome: WagerOutcome,
  payout: number,
): string {
  switch (outcome) {
    case "profit":
      return `Your card won ${payout} Flame Coins`;
    case "breakeven":
      return "Your card results - you broke even";
    case "partial":
      return `Your card results - you recouped ${payout} coins`;
    case "bust":
      return "Your card results";
    case "refund":
      return "Your card results - wager refunded";
  }
}

function getWagerAccent(outcome: WagerOutcome) {
  switch (outcome) {
    case "profit":
      return styles.accentProfit;
    case "breakeven":
    case "partial":
      return styles.accentPartial;
    case "bust":
      return styles.accentBust;
    case "refund":
      return {};
  }
}

function getWagerScoreCardBg(outcome: WagerOutcome) {
  switch (outcome) {
    case "profit":
      return styles.scoreCardProfit;
    case "breakeven":
    case "partial":
      return styles.scoreCardPartial;
    case "bust":
      return styles.scoreCardBust;
    case "refund":
      return {};
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CardResolvedEmail({
  username,
  score,
  total,
  cardId,
  wager,
  payout,
  unsubscribeUrl,
}: CardResolvedEmailProps): ReactElement {
  const cardUrl = `${baseUrl}/cards/${cardId}`;
  const isWagered = wager != null && payout != null;

  // Wagered card
  if (isWagered) {
    const outcome = getWagerOutcome(wager, payout, score);
    const headline = getWagerHeadline(outcome, payout);
    const subtext = getWagerSubtext(outcome);
    const accent = getWagerAccent(outcome);
    const scoreCardBg = getWagerScoreCardBg(outcome);

    const scoreBlockText =
      outcome === "profit" ? `${payout}` :
      outcome === "bust" ? `-${wager}` :
      outcome === "refund" || outcome === "breakeven" ? `${wager}` :
      `${payout}`;

    const scoreLabelText =
      outcome === "profit" ? "coins won" :
      outcome === "bust" ? "coins lost" :
      outcome === "refund" ? "coins returned" :
      outcome === "breakeven" ? "coins returned" :
      "coins recouped";

    return (
      <EmailLayout unsubscribeUrl={unsubscribeUrl}>
        <Text style={styles.subheading}>Card Results</Text>
        <Text style={styles.heading}>{headline}</Text>
        <Section style={{ ...styles.scoreCard, ...scoreCardBg }}>
          <Text style={{ ...styles.scoreBlock, ...accent }}>
            {scoreBlockText}
          </Text>
          <Text style={styles.scoreLabel}>
            {scoreLabelText}
          </Text>
          <Text style={styles.scoreCardMeta}>
            Wager: {wager} · Score: {score}/{total}
          </Text>
        </Section>
        <Text style={styles.text}>
          {username}, {subtext.toLowerCase()}
        </Text>
        <Section style={styles.buttonWrapper}>
          <Button style={styles.button} href={cardUrl}>
            View Your Card
          </Button>
        </Section>
      </EmailLayout>
    );
  }

  // Non-wagered card (existing behavior)
  const { headline, subtext } = getCardTier(score, total);

  return (
    <EmailLayout unsubscribeUrl={unsubscribeUrl}>
      <Text style={styles.subheading}>Card Results</Text>
      <Text style={styles.heading}>{headline}</Text>
      <Section style={styles.scoreCard}>
        <Text style={styles.scoreBlock}>
          {score}/{total}
        </Text>
        <Text style={styles.scoreLabel}>correct picks</Text>
      </Section>
      <Text style={styles.text}>
        {username}, {subtext.toLowerCase()}
      </Text>
      <Section style={styles.buttonWrapper}>
        <Button style={styles.button} href={cardUrl}>
          View Your Card
        </Button>
      </Section>
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Helper for Resend integration
// ---------------------------------------------------------------------------

export function getCardResolvedEmailProps(
  props: CardResolvedEmailProps,
): {
  subject: string;
  react: ReactElement;
  text: string;
} {
  const cardUrl = `${baseUrl}/cards/${props.cardId}`;
  const isWagered = props.wager != null && props.payout != null;

  if (isWagered) {
    const outcome = getWagerOutcome(props.wager!, props.payout!, props.score);
    const subject = getWagerSubject(outcome, props.payout!);
    const subtext = getWagerSubtext(outcome);

    const coinsSummary =
      outcome === "profit" ? `${props.payout} coins won` :
      outcome === "bust" ? `-${props.wager} coins lost` :
      outcome === "refund" || outcome === "breakeven" ? `${props.wager} coins returned` :
      `${props.payout} coins recouped`;

    return {
      subject,
      react: <CardResolvedEmail {...props} />,
      text: `${getWagerHeadline(outcome, props.payout!)}\n\n${coinsSummary}\nWager: ${props.wager} · Score: ${props.score}/${props.total}\n\n${props.username}, ${subtext.toLowerCase()}\n\nView your card: ${cardUrl}`,
    };
  }

  const { headline, subtext } = getCardTier(props.score, props.total);
  return {
    subject: `Your card is in: ${props.score} for ${props.total}`,
    react: <CardResolvedEmail {...props} />,
    text: `${headline}\n\n${props.score}/${props.total} correct picks\n\n${props.username}, ${subtext.toLowerCase()}\n\nView your card: ${cardUrl}`,
  };
}
