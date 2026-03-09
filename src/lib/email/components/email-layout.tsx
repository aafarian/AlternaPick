import { Html, Head, Body, Container, Preview, Hr, Text } from "@react-email/components";
import type { ReactElement, ReactNode } from "react";
import { emailStyles as styles } from "@/lib/email/styles";

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
          {children}
          <Hr style={styles.hr} />
          <Text style={styles.footer}>AlternaPick</Text>
        </Container>
      </Body>
    </Html>
  );
}
