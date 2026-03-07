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
          <Text style={styles.heading}>{headline}</Text>
          <Text style={styles.scoreBlock}>
            {score} for {total}
          </Text>
          <Text style={styles.text}>
            {username}, you went {score} for {total}. {subtext}
          </Text>
          <Link style={styles.button} href={cardUrl}>
            View card →
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

export function getCardResolvedEmailProps(props: CardResolvedEmailProps): {
  subject: string;
  react: ReactElement;
  text: string;
} {
  const { headline, subtext } = getCardTier(props.score, props.total);
  const cardUrl = `${baseUrl}/cards/${props.cardId}`;
  return {
    subject: `${headline} You went ${props.score} for ${props.total}`,
    react: <CardResolvedEmail {...props} />,
    text: `${headline}\n\n${props.username}, you went ${props.score} for ${props.total}. ${subtext}\n\nView card: ${cardUrl}`,
  };
}
