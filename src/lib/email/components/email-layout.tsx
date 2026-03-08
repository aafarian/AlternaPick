import { Html, Head, Body, Container, Preview, Section } from "@react-email/components";
import type { ReactElement, ReactNode } from "react";
import { emailStyles as styles } from "@/lib/email/styles";
import { EmailFooter } from "./email-footer";

interface EmailLayoutProps {
  preview: string;
  children: ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps): ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.accentBar} />
          {children}
          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}
