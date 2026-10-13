"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useFormMessages } from "./use-form-messages";

type ConfirmButtonProps = {
  /** Action serveur exécutée après confirmation. */
  action: () => Promise<unknown>;
  label: string;
  confirmLabel: string;
  cancelLabel: string;
  pendingLabel: string;
  /** Affiche uniquement l'icône tant que la confirmation n'est pas demandée. */
  iconOnly?: boolean;
};

/**
 * Suppression en deux temps, sans fenêtre modale : un premier clic demande
 * confirmation sur place, un second supprime. Rien ne s'efface par mégarde.
 */
export function ConfirmButton({
  action,
  label,
  confirmLabel,
  cancelLabel,
  pendingLabel,
  iconOnly = false,
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const messages = useFormMessages();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Le focus suit l'action : il passe sur « Confirmer » dès qu'il apparaît.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    const button = (
      <Button
        variant={iconOnly ? "ghost" : "destructive"}
        size={iconOnly ? "icon" : "md"}
        onClick={() => setConfirming(true)}
        aria-label={iconOnly ? label : undefined}
        className={iconOnly ? "text-muted-foreground hover:text-destructive" : undefined}
      >
        <Trash2 aria-hidden="true" />
        {iconOnly ? null : label}
      </Button>
    );
    if (!error) return button;
    return (
      <span className="inline-flex flex-col gap-2">
        {button}
        <Alert variant="error" className="text-sm">
          {messages.error(error)}
        </Alert>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        ref={confirmRef}
        variant="destructive"
        size="sm"
        aria-disabled={pending}
        onClick={() => {
          if (pending) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            // Une action qui échoue renvoie { ok: false, formError } (voir runAction).
            if (result && typeof result === "object" && "ok" in result && result.ok === false) {
              const key = "formError" in result ? result.formError : null;
              setError(typeof key === "string" ? key : "generic");
            }
            setConfirming(false);
          });
        }}
      >
        {pending ? pendingLabel : confirmLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        {cancelLabel}
      </Button>
    </span>
  );
}
