import { Text, Button, Section } from "@react-email/components";
import type { ReactElement } from "react";
import { getCardTier } from "@/lib/cards/tiers";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";
import { EmailLayout } from "@/lib/email/components/email-layout";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardResolvedEmailProps {
  username: string;
  score: number;
  total: number;
  cardId: string;
  recipientEmail?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CardResolvedEmail({
  username,
  score,
  total,
  cardId,
  recipientEmail,
}: CardResolvedEmailProps): ReactElement {
  const { headline, subtext } = getCardTier(score, total);
  const cardUrl = `${baseUrl}/cards/${cardId}`;

  return (
    <EmailLayout
      preview={`Your card is in: ${score} for ${total}`}
      recipientEmail={recipientEmail}
    >
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
      <Button style={styles.button} href={cardUrl}>
        View Your Card
      </Button>
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
  const { headline, subtext } = getCardTier(props.score, props.total);
  const cardUrl = `${baseUrl}/cards/${props.cardId}`;
  return {
    subject: `Your card is in: ${props.score} for ${props.total}`,
    react: <CardResolvedEmail {...props} />,
    text: `${headline}\n\n${props.score}/${props.total} correct picks\n\n${props.username}, ${subtext.toLowerCase()}\n\nView your card: ${cardUrl}`,
  };
}
