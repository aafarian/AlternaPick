import { Text, Link } from "@react-email/components";
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
      <Text style={styles.heading}>Friend Request</Text>
      <Text style={styles.text}>
        {addresseeUsername}, {requesterUsername} wants to add you as a friend.
      </Text>
      <Text style={{ ...styles.text, textAlign: "center" as const }}>
        <Link style={styles.link} href={friendsUrl}>
          View request →
        </Link>
      </Text>
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
    text: `Friend Request\n\n${props.addresseeUsername}, ${props.requesterUsername} wants to add you as a friend.\n\nView request: ${friendsUrl}`,
  };
}
