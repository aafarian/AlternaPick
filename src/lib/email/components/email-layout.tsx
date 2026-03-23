import { Html, Head, Body, Container, Preview, Hr, Text, Link, Section } from "@react-email/components";
import type { ReactElement, ReactNode } from "react";
import { emailStyles as styles } from "@/lib/email/styles";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
  /** Pre-generated unsubscribe URL. Omit to render without unsubscribe link. */
  unsubscribeUrl?: string;
}

export function EmailLayout({ preview, children, unsubscribeUrl }: EmailLayoutProps): ReactElement {

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
