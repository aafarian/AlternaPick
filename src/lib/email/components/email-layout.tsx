import { Html, Head, Body, Container, Preview } from "@react-email/components";
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
        </Container>
      </Body>
    </Html>
  );
}
