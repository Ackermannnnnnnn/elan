"use client";

import { Droplet, Undo2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { addWaterAction, undoWaterAction } from "./actions";
import { WATER_AMOUNTS } from "./schemas";

/** Eau du jour : total, repère indicatif, ajout en un geste, annulation du dernier ajout. */
export function WaterCard({ totalMl, goalMl }: { totalMl: number; goalMl: number | null }) {
  const t = useTranslations("Home.water");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();

  const liters = (ml: number) =>
    format.number(ml / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  const summary = goalMl
    ? t("total", { value: liters(totalMl), target: liters(goalMl) })
    : t("totalNoGoal", { value: liters(totalMl) });

  const run = (action: () => Promise<unknown>) => {
    if (pending) return;
    startTransition(async () => void (await action()));
  };

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle>{t("title")}</CardTitle>
        <p className="font-semibold tabular-nums" aria-live="polite">
          {summary}
        </p>
      </div>
      {goalMl ? (
        <Meter
          label={t("title")}
          value={totalMl}
          max={goalMl}
          valueText={summary}
          className="mt-3"
        />
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {WATER_AMOUNTS.map((amount) => (
          <Button
            key={amount}
            variant="secondary"
            size="sm"
            aria-disabled={pending}
            onClick={() => run(() => addWaterAction(amount))}
          >
            <Droplet aria-hidden="true" />
            {t("add", { amount })}
          </Button>
        ))}
        {totalMl > 0 ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("undo")}
            aria-disabled={pending}
            onClick={() => run(() => undoWaterAction())}
            className="size-9 text-muted-foreground"
          >
            <Undo2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {goalMl ? <p className="mt-3 text-sm text-muted-foreground">{t("indicative")}</p> : null}
    </Card>
  );
}
