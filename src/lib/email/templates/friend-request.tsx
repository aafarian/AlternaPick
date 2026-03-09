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
    <EmailLayout
      preview={`${requesterUsername} sent you a friend request`}
    >
      <Text style={styles.heading}>Friend request</Text>
      <Text style={styles.text}>
        {addresseeUsername}, <strong>{requesterUsername}</strong> wants to add you
        as a friend. Accept their request to start challenging each other.
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
    text: `${props.addresseeUsername}, ${props.requesterUsername} wants to add you as a friend. Accept their request to start challenging each other.\n\nView request: ${friendsUrl}`,
  };
}
