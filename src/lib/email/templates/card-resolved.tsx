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
import { getCardTier } from "@/lib/cards/tiers";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";
import { EmailFooter } from "@/lib/email/components/email-footer";

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
      <Preview>{`Your card is in: ${score} for ${total}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.heading}>{headline}</Text>
          <Text style={styles.scoreBlock}>
            {score}/{total}
          </Text>
          <Text style={styles.text}>
            {username}, {subtext.toLowerCase()}
          </Text>
          <Text style={{ ...styles.text, textAlign: "center" }}>
            <Link style={styles.link} href={cardUrl}>
              View card &rarr;
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

export function getCardResolvedEmailProps(props: CardResolvedEmailProps): {
  subject: string;
  react: ReactElement;
  text: string;
} {
  const { headline, subtext } = getCardTier(props.score, props.total);
  const cardUrl = `${baseUrl}/cards/${props.cardId}`;
  return {
    subject: `Your card is in: ${props.score} for ${props.total}`,
    react: <CardResolvedEmail {...props} />,
    text: `${headline}\n\n${props.score}/${props.total}\n\n${props.username}, ${subtext.toLowerCase()}\n\nView card: ${cardUrl}`,
  };
}
