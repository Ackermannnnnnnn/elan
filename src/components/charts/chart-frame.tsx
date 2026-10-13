import type { ReactNode } from "react";

export type LegendItem = {
  label: string;
  kind: "line" | "dot" | "bar" | "rule";
  tone: "accent" | "context";
};

const TONE = { accent: "var(--chart-accent)", context: "var(--chart-context)" } as const;

/** Clé de légende qui reprend la forme de la marque : trait pour une ligne, point pour une mesure. */
function LegendKey({ kind, tone }: Pick<LegendItem, "kind" | "tone">) {
  const color = TONE[tone];
  if (kind === "dot") {
    return (
      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />
    );
  }
  if (kind === "bar") {
    return (
      <span
        aria-hidden="true"
        className="h-3 w-2.5 rounded-t-[3px]"
        style={{ background: color }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="w-4 rounded-full"
      style={{ background: color, height: kind === "rule" ? 1 : 2 }}
    />
  );
}

/**
 * Cadre commun des graphiques : légende en HTML (lisible, traduisible) et
 * description pour les lecteurs d'écran. Les valeurs elles-mêmes restent
 * accessibles dans le tableau qui accompagne chaque graphique.
 */
export function ChartFrame({
  description,
  legend,
  children,
}: {
  description: string;
  legend?: LegendItem[];
  children: ReactNode;
}) {
  return (
    <figure className="min-w-0">
      {legend && legend.length > 1 ? (
        <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <LegendKey kind={item.kind} tone={item.tone} />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div role="img" aria-label={description}>
        {children}
      </div>
    </figure>
  );
}

/** Infobulle des graphiques : la valeur d'abord, en fort ; le libellé ensuite. */
export function ChartTooltip({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; kind: LegendItem["kind"]; tone: LegendItem["tone"] }[];
}) {
  return (
    <div className="rounded-control border border-border bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-xs text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <LegendKey kind={row.kind === "bar" ? "line" : row.kind} tone={row.tone} />
            <span className="font-semibold tabular-nums">{row.value}</span>
            <span className="text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
