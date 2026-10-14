import { getFormatter, getTranslations } from "next-intl/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { bmi, bmiCategory, healthyWeightRange } from "@/domain/energy";
import { cn } from "@/lib/utils";

/** Bornes de l'échelle affichée (IMC 15 à 40). */
const SCALE = { min: 15, max: 40 };
const BANDS = [
  { from: 15, to: 18.5 },
  { from: 18.5, to: 25 },
  { from: 25, to: 30 },
  { from: 30, to: 40 },
] as const;
const position = (value: number) =>
  ((Math.min(SCALE.max, Math.max(SCALE.min, value)) - SCALE.min) / (SCALE.max - SCALE.min)) * 100;

/**
 * Indice de masse corporelle (poids / taille²), classe de l'OMS et fourchette
 * de poids correspondant à un IMC de 18,5 à 24,9, avec ses limites.
 */
export async function BmiCard({
  weightKg,
  heightCm,
  compact = false,
}: {
  weightKg: number;
  heightCm: number;
  compact?: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations("Bmi"), getFormatter()]);
  const value = bmi(weightKg, heightCm);
  const category = bmiCategory(value);
  const range = healthyWeightRange(heightCm);
  const number = (input: number) =>
    format.number(input, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <Card>
      <CardHeader className="mb-3">
        <CardTitle className={compact ? "text-base" : undefined}>{t("title")}</CardTitle>
      </CardHeader>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold tabular-nums">{number(value)}</span>
        <span className="font-semibold">{t(`category.${category}`)}</span>
      </p>
      <div className="relative mt-4 mb-1" aria-hidden="true">
        <div className="flex h-2.5 overflow-hidden rounded-full">
          {BANDS.map((band, index) => (
            <span
              key={band.from}
              className={cn(
                "h-full",
                index === 1 ? "bg-success" : index === 0 ? "bg-chart-context" : "bg-warning",
                index === 3 && "opacity-70",
              )}
              style={{ width: `${position(band.to) - position(band.from)}%` }}
            />
          ))}
        </div>
        <span
          className="absolute -top-1 h-4.5 w-1 -translate-x-1/2 rounded-full bg-foreground ring-2 ring-surface"
          style={{ left: `${position(value)}%` }}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>18,5</span>
          <span>25</span>
          <span>30</span>
        </div>
      </div>
      <p className="mt-3 text-[0.9375rem]">
        {t("range", { min: number(range.minKg), max: number(range.maxKg) })}
      </p>
      {compact ? null : <p className="mt-2 text-sm text-muted-foreground">{t("limits")}</p>}
    </Card>
  );
}
