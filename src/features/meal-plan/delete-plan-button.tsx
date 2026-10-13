"use client";

import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { deletePlanAction } from "./actions";

export function DeletePlanButton({ week, label }: { week: string; label: string }) {
  const t = useTranslations("Common");
  return (
    <ConfirmButton
      label={label}
      confirmLabel={t("confirmDelete")}
      cancelLabel={t("cancel")}
      pendingLabel={t("deleting")}
      action={() => deletePlanAction(week)}
    />
  );
}
