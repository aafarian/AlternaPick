import { Text, Link, Hr } from "@react-email/components";
import type { ReactElement } from "react";
import { baseUrl, emailStyles as styles } from "@/lib/email/styles";

export function EmailFooter(): ReactElement {
  return (
    <>
      <Hr style={styles.hr} />
      <Text style={styles.footer}>
        <Link
          style={{ ...styles.footer, textDecoration: "none" }}
          href={baseUrl}
        >
          AlternaPick
        </Link>
      </Text>
    </>
  );
}
