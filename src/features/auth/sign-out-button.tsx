"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { signOut } from "./actions";

export function SignOutButton({
  label,
  pendingLabel,
  variant = "secondary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "secondary" | "ghost";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        if (pending) return;
        startTransition(() => signOut());
      }}
    >
      <SubmitButton pending={pending} pendingLabel={pendingLabel} variant={variant}>
        <LogOut aria-hidden="true" />
        {label}
      </SubmitButton>
    </form>
  );
}
