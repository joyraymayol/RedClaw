"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function TicketBackButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push("/tickets");
        }
      }}
    >
      <ArrowLeftIcon className="size-4" />
      Back
    </Button>
  );
}
