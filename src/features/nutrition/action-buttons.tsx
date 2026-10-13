"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { copyMealAction, deleteDiaryEntryAction, deleteFoodAction } from "./actions";
import type { Slot } from "./schemas";

export function DeleteDiaryEntryButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("Common");
  return (
    <ConfirmButton
      label={label}
      confirmLabel={t("confirmDelete")}
      cancelLabel={t("cancel")}
      pendingLabel={t("deleting")}
      action={() => deleteDiaryEntryAction(id)}
    />
  );
}

export function DeleteFoodButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("Common");
  return (
    <ConfirmButton
      label={label}
      confirmLabel={t("confirmDelete")}
      cancelLabel={t("cancel")}
      pendingLabel={t("deleting")}
      action={() => deleteFoodAction(id)}
    />
  );
}

export function CopyMealButton({
  slot,
  fromDate,
  label,
  pendingLabel,
}: {
  slot: Slot;
  fromDate: string;
  label: string;
  pendingLabel: string;
}) {
  const messages = useFormMessages();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={() => {
        if (pending) return;
        startTransition(async () => {
          const result = await copyMealAction(slot, fromDate);
          if (!result.ok) setError(result.formError ?? "generic");
        });
      }}
    >
      {error ? <Alert variant="error">{messages.error(error)}</Alert> : null}
      <SubmitButton pending={pending} pendingLabel={pendingLabel} size="lg" className="self-start">
        {label}
      </SubmitButton>
    </form>
  );
}
