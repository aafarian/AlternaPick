import { Html, Head, Body, Container, Preview, Hr, Text, Link, Section } from "@react-email/components";
import type { ReactElement, ReactNode } from "react";
import { emailStyles as styles } from "@/lib/email/styles";
import { getUnsubscribeUrl } from "@/lib/email/unsubscribe-token";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
  /** When provided, generates and renders the unsubscribe footer link. */
  recipientEmail?: string;
}

export function EmailLayout({ preview, children, recipientEmail }: EmailLayoutProps): ReactElement {
  const unsubscribeUrl = recipientEmail ? getUnsubscribeUrl(recipientEmail) : undefined;

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.headerText}>AlternaPick</Text>
          </Section>
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
