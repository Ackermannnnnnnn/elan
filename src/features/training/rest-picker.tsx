"use client";

import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";
import { useFormMessages } from "@/components/forms/use-form-messages";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { useRestOverride } from "./session-ui";

export const REST_CHOICES = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240] as const;

export const restLabel = (seconds: number) =>
  seconds === 0
    ? "0"
    : seconds % 60 === 0
      ? `${seconds / 60} min`
      : seconds > 60
        ? `${Math.floor(seconds / 60)} min ${seconds % 60}`
        : `${seconds} s`;

/**
 * Temps de repos d'un exercice : un bouton « Repos 1 min 30 », puis des
 * choix rapides. Le nouveau temps s'affiche tout de suite (enregistrement en
 * arrière-plan).
 */
export function RestPicker({
  seconds,
  exerciseName,
  action,
  overrideKey,
}: {
  seconds: number | null;
  exerciseName: string;
  action: (seconds: number) => Promise<ActionResult<string>>;
  /** En séance : identifiant de l'exercice, pour que le minuteur suive aussitôt. */
  overrideKey?: string;
}) {
  const setOverride = useRestOverride();
  const t = useTranslations("Training.rest");
  const messages = useFormMessages();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useOptimistic(seconds ?? 0);
  const [, startTransition] = useTransition();
  const panelId = useId();

  return (
    <span className="inline-flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("change", { name: exerciseName, value: restLabel(shown) })}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-full border border-border-strong bg-surface px-3 text-sm font-medium hover:border-primary/60"
      >
        <Timer aria-hidden="true" className="size-4" />
        {t("label", { value: restLabel(shown) })}
      </button>
      {open ? (
        <span id={panelId} role="group" aria-label={t("choose")} className="flex flex-wrap gap-1.5">
          {REST_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={choice === shown}
              onClick={() => {
                setError(null);
                setOpen(false);
                if (overrideKey) setOverride(overrideKey, choice);
                startTransition(async () => {
                  setShown(choice);
                  const result = await action(choice);
                  if (!result.ok) setError(result.formError ?? "generic");
                });
              }}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm font-medium tabular-nums transition-colors",
                choice === shown
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border-strong bg-surface hover:border-primary/60",
              )}
            >
              {choice === 0 ? t("none") : restLabel(choice)}
            </button>
          ))}
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="text-sm font-medium text-destructive">
          {messages.error(error)}
        </span>
      ) : null}
    </span>
  );
}
