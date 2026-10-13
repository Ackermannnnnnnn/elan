"use client";

import {
  type ComponentProps,
  type ReactNode,
  useLayoutEffect,
  useState,
  useTransition,
} from "react";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { SubmitButton } from "./submit-button";
import { useFormMessages } from "./use-form-messages";

type ActionButtonProps = Omit<ComponentProps<typeof SubmitButton>, "pending" | "children"> & {
  /** Action serveur sans saisie (ses arguments sont liés avec `bind`). */
  action: () => Promise<ActionResult<string> | void>;
  children: ReactNode;
  /** Message affiché après un succès qui ne change pas de page. */
  successMessage?: string;
  formClassName?: string;
};

/**
 * Bouton qui déclenche une action serveur : un vrai <form>, donc utilisable
 * au clavier, avec état d'attente et message d'erreur traduit.
 */
export function ActionButton({
  action,
  children,
  successMessage,
  formClassName,
  ...buttonProps
}: ActionButtonProps) {
  const messages = useFormMessages();
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [pending, startTransition] = useTransition();

  // Page masquée puis restaurée : on n'affiche plus un message périmé.
  useLayoutEffect(
    () => () => {
      setError(null);
      setSucceeded(false);
    },
    [],
  );

  return (
    <form
      className={cn("flex flex-col gap-2", formClassName)}
      action={() => {
        if (pending) return;
        setError(null);
        setSucceeded(false);
        startTransition(async () => {
          const result = await action();
          if (result && !result.ok) setError(result.formError ?? "generic");
          else setSucceeded(true);
        });
      }}
    >
      <SubmitButton pending={pending} {...buttonProps}>
        {children}
      </SubmitButton>
      {error ? (
        <Alert variant="error" className="text-sm">
          {messages.error(error)}
        </Alert>
      ) : null}
      {succeeded && successMessage ? (
        <p role="status" className="text-sm text-muted-foreground">
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}
