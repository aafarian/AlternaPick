import { Text, Link, Hr } from "@react-email/components";
import type { ReactElement } from "react";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";

export function EmailFooter(): ReactElement {
  return (
    <>
      <Hr style={styles.hr} />
      <Text style={styles.footer}>
        AlternaPick &middot;{" "}
        <Link style={{ ...styles.footer, textDecoration: "underline" }} href={baseUrl}>
          alternapick.com
        </Link>
      </Text>
    </>
  );
}
