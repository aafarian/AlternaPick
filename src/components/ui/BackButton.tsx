"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/picks");
        }
      }}
      className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground w-fit"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
}
