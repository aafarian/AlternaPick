import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
  Preview,
  Section,
  Hr,
} from "@react-email/components";
import type { ReactElement } from "react";
import { getCardTier } from "@/lib/cards/tiers";

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
// Styles
// ---------------------------------------------------------------------------

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://alternapick.com";

const styles = {
  body: {
    backgroundColor: "#0a0a0a",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: "0" as const,
    padding: "0" as const,
  },
  container: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "40px 24px",
  },
  brand: {
    fontSize: "14px",
    fontWeight: 600 as const,
    color: "#a1a1aa",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    textAlign: "center" as const,
    margin: "0 0 32px 0",
  },
  headline: {
    fontSize: "32px",
    fontWeight: 700 as const,
    color: "#ffffff",
    textAlign: "center" as const,
    margin: "0 0 8px 0",
    lineHeight: "1.2",
  },
  scoreLine: {
    fontSize: "20px",
    color: "#e4e4e7",
    textAlign: "center" as const,
    margin: "0 0 4px 0",
  },
  subtext: {
    fontSize: "16px",
    color: "#71717a",
    textAlign: "center" as const,
    margin: "0 0 32px 0",
  },
  buttonSection: {
    textAlign: "center" as const,
    margin: "0 0 32px 0",
  },
  button: {
    backgroundColor: "#ffffff",
    color: "#0a0a0a",
    fontSize: "15px",
    fontWeight: 600 as const,
    textDecoration: "none",
    borderRadius: "8px",
    padding: "12px 32px",
  },
  hr: {
    borderColor: "#27272a",
    margin: "0 0 16px 0",
  },
  footer: {
    fontSize: "12px",
    color: "#52525b",
    textAlign: "center" as const,
    margin: "0",
    lineHeight: "1.5",
  },
} as const;

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
          <Text style={styles.brand}>Sports Tower</Text>

          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.scoreLine}>
            {username}, you went {score} for {total}.
          </Text>
          <Text style={styles.subtext}>{subtext}</Text>

          <Section style={styles.buttonSection}>
            <Button style={styles.button} href={cardUrl}>
              View Card
            </Button>
          </Section>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Sports Tower &mdash; alternapick.com
          </Text>
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
  const { headline } = getCardTier(props.score, props.total);
  return {
    subject: `${headline} You went ${props.score} for ${props.total}`,
    react: <CardResolvedEmail {...props} />,
  };
}
