"use client";

import { useFormatter } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/chart-frame";

export type IntakePoint = { date: string; value: number | null };

type IntakeChartProps = {
  points: IntakePoint[];
  target: number | null;
  unit: string;
  labels: { series: string; target: string; description: string };
  height?: number;
};

const AXIS_TEXT = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

/**
 * Apports jour par jour, face à l'objectif. Une seule série, donc une seule
 * couleur ; un jour sans saisie reste vide plutôt que d'afficher un zéro trompeur.
 */
export function IntakeChart({ points, target, unit, labels, height = 200 }: IntakeChartProps) {
  const format = useFormatter();
  const toDate = (date: string) => new Date(`${date}T12:00:00Z`);
  const shortDay = (date: string) =>
    format.dateTime(toDate(date), { day: "numeric", timeZone: "UTC" });
  const longDay = (date: string) =>
    format.dateTime(toDate(date), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  const highest = Math.max(target ?? 0, ...points.map((point) => point.value ?? 0));
  const yMax = Math.ceil((highest * 1.15) / 100) * 100 || 100;

  return (
    <ChartFrame description={labels.description}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={points}
          margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            interval={1}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            tickMargin={8}
          />
          <YAxis
            domain={[0, yMax]}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(value: number) => format.number(value, { notation: "compact" })}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as IntakePoint | undefined;
              if (!active || !point || point.value === null) return null;
              return (
                <ChartTooltip
                  title={longDay(point.date)}
                  rows={[
                    {
                      label: labels.series,
                      value: `${format.number(point.value)} ${unit}`,
                      kind: "bar",
                      tone: "accent",
                    },
                  ]}
                />
              );
            }}
          />
          {target !== null ? (
            <ReferenceLine
              y={target}
              stroke="var(--chart-context)"
              strokeWidth={1}
              label={{ value: labels.target, position: "insideTopLeft", ...AXIS_TEXT }}
            />
          ) : null}
          <Bar
            dataKey="value"
            fill="var(--chart-accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
