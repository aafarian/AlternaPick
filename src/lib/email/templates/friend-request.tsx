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
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FriendRequestEmailProps {
  requesterUsername: string;
  addresseeUsername: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FriendRequestEmail({
  requesterUsername,
  addresseeUsername,
}: FriendRequestEmailProps): ReactElement {
  const friendsUrl = `${baseUrl}/friends`;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        {`${requesterUsername} sent you a friend request`}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Text style={styles.heading}>New Friend Request</Text>
            <Text style={styles.text}>
              Hey {addresseeUsername}, {requesterUsername} wants to be your friend
              on AlternaPick.
            </Text>
            <Section style={styles.buttonWrapper}>
              <Link style={styles.button} href={friendsUrl}>
                View request →
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

export function getFriendRequestEmailProps(
  props: FriendRequestEmailProps
): {
  subject: string;
  react: ReactElement;
} {
  return {
    subject: `${props.requesterUsername} sent you a friend request`,
    react: <FriendRequestEmail {...props} />,
  };
}
