import { redirect } from "next/navigation";
import { noIndexMetadata } from "@/lib/seo/metadata";

export const metadata = noIndexMetadata;

export default function ActivityPage() {
  redirect("/friends");
}
