import { Text, Button } from "@react-email/components";
import type { ReactElement } from "react";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";
import { EmailLayout } from "@/lib/email/components/email-layout";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FriendRequestEmailProps {
  requesterUsername: string;
  addresseeUsername: string;
  recipientEmail?: string;
}

const friendsUrl = `${baseUrl}/friends`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FriendRequestEmail({
  requesterUsername,
  addresseeUsername,
  recipientEmail,
}: FriendRequestEmailProps): ReactElement {
  return (
    <EmailLayout
      preview={`${requesterUsername} sent you a friend request`}
      recipientEmail={recipientEmail}
    >
      <Text style={styles.subheading}>Friend Request</Text>
      <Text style={styles.heading}>
        {requesterUsername} wants to be friends
      </Text>
      <Text style={styles.text}>
        {addresseeUsername}, accept their request to start challenging each other
        and competing on the leaderboard.
      </Text>
      <Button style={styles.button} href={friendsUrl}>
        View Request
      </Button>
    </EmailLayout>
  );
}

// ---------------------------------------------------------------------------
// Helper for Resend integration
// ---------------------------------------------------------------------------

export function getFriendRequestEmailProps(
  props: FriendRequestEmailProps,
): {
  subject: string;
  react: ReactElement;
  text: string;
} {
  return {
    subject: `${props.requesterUsername} sent you a friend request`,
    react: <FriendRequestEmail {...props} />,
    text: `${props.addresseeUsername}, ${props.requesterUsername} wants to be friends. Accept their request to start challenging each other and competing on the leaderboard.\n\nView request: ${friendsUrl}`,
  };
}
