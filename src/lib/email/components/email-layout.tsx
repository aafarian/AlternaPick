import { Html, Head, Body, Container, Hr, Text, Link, Section } from "@react-email/components";
import type { ReactElement, ReactNode } from "react";
import { emailStyles as styles } from "@/lib/email/styles";

interface EmailLayoutProps {
  children: ReactNode;
  /**
   * Pre-generated unsubscribe URL. Omit to render without an unsubscribe link.
   *
   * IMPORTANT: Only pass this from marketing/digest templates. Transactional
   * templates should leave it undefined — the unsubscribe link is a strong
   * "bulk mail" signal to Gmail and pulls transactional mail into Promotions.
   */
  unsubscribeUrl?: string;
}

/**
 * Shared layout for all email templates.
 *
 * Intentionally minimal: no branded header banner, no preheader padding, no
 * images. These are all classic newsletter signals that Gmail uses to classify
 * mail into Promotions. Brand identity comes from the From name and the footer
 * line, which is enough for transactional context.
 */
export function EmailLayout({ children, unsubscribeUrl }: EmailLayoutProps): ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.content}>
            {children}
          </Section>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            AlternaPick — Predict. Compete. Dominate.
            {unsubscribeUrl && (
              <>
                <br />
                <Link href={unsubscribeUrl} style={styles.footerLink}>
                  Unsubscribe from emails
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
