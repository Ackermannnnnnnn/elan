"use client";

import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { deleteRecipeAction } from "./actions";

export function DeleteRecipeButton({ id, label }: { id: string; label: string }) {
  const t = useTranslations("Common");
  return (
    <ConfirmButton
      label={label}
      confirmLabel={t("confirmDelete")}
      cancelLabel={t("cancel")}
      pendingLabel={t("deleting")}
      action={() => deleteRecipeAction(id)}
    />
  );
}
