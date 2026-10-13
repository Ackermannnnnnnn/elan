"use client";

import { useTranslations } from "next-intl";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { deleteMeasurementAction, deleteWeightAction } from "./actions";

/** Suppression d'une pesée ou d'une mensuration, avec confirmation sur place. */
export function DeleteEntryButton({
  kind,
  id,
  label,
}: {
  kind: "weight" | "measurement";
  id: string;
  label: string;
}) {
  const t = useTranslations("Common");
  return (
    <ConfirmButton
      iconOnly
      label={label}
      confirmLabel={t("confirmDelete")}
      cancelLabel={t("cancel")}
      pendingLabel={t("deleting")}
      action={() => (kind === "weight" ? deleteWeightAction(id) : deleteMeasurementAction(id))}
    />
  );
}
