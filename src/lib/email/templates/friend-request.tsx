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
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FriendRequestEmailProps {
  requesterUsername: string;
  addresseeUsername: string;
}

const friendsUrl = `${baseUrl}/friends`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FriendRequestEmail({
  requesterUsername,
  addresseeUsername,
}: FriendRequestEmailProps): ReactElement {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {`${requesterUsername} sent you a friend request`}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.heading}>Friend Request</Text>
          <Text style={styles.text}>
            {addresseeUsername}, {requesterUsername} wants to add you as a friend.
          </Text>
          <Text style={styles.text}>
            <Link style={styles.link} href={friendsUrl}>
              View request &rarr;
            </Link>
          </Text>

          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            AlternaPick &middot;{" "}
            <Link style={{ ...styles.footer, color: styles.footer.color }} href={baseUrl}>
              alternapick.com
            </Link>
          </Text>
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
  text: string;
} {
  return {
    subject: `${props.requesterUsername} sent you a friend request`,
    react: <FriendRequestEmail {...props} />,
    text: `Friend Request\n\n${props.addresseeUsername}, ${props.requesterUsername} wants to add you as a friend.\n\nView request: ${friendsUrl}`,
  };
}
