"use client";

import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type" | "asChild"> & {
  pending: boolean;
  pendingLabel: string;
};

/** Bouton d'envoi : indique l'action en cours et bloque les doubles envois. */
export function SubmitButton({ pending, pendingLabel, children, ...props }: SubmitButtonProps) {
  return (
    <Button type="submit" aria-disabled={pending} {...props}>
      {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}
