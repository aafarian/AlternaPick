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
import { getCardTier } from "@/lib/cards/tiers";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardResolvedEmailProps {
  username: string;
  score: number;
  total: number;
  cardId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCardResolvedSubject(score: number, total: number): string {
  const { headline } = getCardTier(score, total);
  return `${headline} You went ${score} for ${total}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CardResolvedEmail({
  username,
  score,
  total,
  cardId,
}: CardResolvedEmailProps): ReactElement {
  const { headline, subtext } = getCardTier(score, total);
  const cardUrl = `${baseUrl}/cards/${cardId}`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{`${headline} You went ${score} for ${total}.`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.heading}>{headline}</Text>
            <Text style={styles.scoreBlock}>
              {score} for {total}
            </Text>
            <Text style={styles.text}>
              {username}, you went {score} for {total}. {subtext}
            </Text>
            <Section style={styles.buttonWrapper}>
              <Link style={styles.button} href={cardUrl}>
                View card →
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

export function getCardResolvedEmailProps(props: CardResolvedEmailProps): {
  subject: string;
  react: ReactElement;
} {
  return {
    subject: getCardResolvedSubject(props.score, props.total),
    react: <CardResolvedEmail {...props} />,
  };
}
