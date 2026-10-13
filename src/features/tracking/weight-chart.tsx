"use client";

import { useFormatter } from "next-intl";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/chart-frame";
import { addDays, diffDays } from "@/lib/dates";

export type WeightChartPoint = { date: string; weightKg: number; averageKg: number };

type WeightChartProps = {
  points: WeightChartPoint[];
  targetKg: number | null;
  height?: number;
  labels: { weighIns: string; average: string; target: string; description: string };
};

const AXIS_TEXT = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

/**
 * Courbe de poids. Ce qui compte est la TENDANCE : la moyenne sur 7 jours est
 * tracée en couleur, les pesées brutes restent en gris à l'arrière-plan.
 */
export function WeightChart({ points, targetKg, height = 260, labels }: WeightChartProps) {
  const format = useFormatter();
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;

  // L'axe horizontal est un nombre de jours : deux pesées espacées d'une
  // semaine sont réellement espacées sur le graphique.
  const data = points.map((point) => ({ ...point, day: diffDays(first.date, point.date) }));
  const span = Math.max(1, diffDays(first.date, last.date));

  const values = points.flatMap((point) => [point.weightKg, point.averageKg]);
  if (targetKg !== null) values.push(targetKg);
  const min = Math.floor(Math.min(...values) - 0.5);
  const max = Math.ceil(Math.max(...values) + 0.5);

  const tickCount = Math.min(5, span + 1);
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    Math.round((span * index) / Math.max(1, tickCount - 1)),
  );

  const dayLabel = (day: number, long = false) =>
    format.dateTime(new Date(`${addDays(first.date, day)}T12:00:00Z`), {
      day: "numeric",
      month: long ? "long" : "short",
      timeZone: "UTC",
    });
  const kg = (value: number) =>
    format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <ChartFrame
      description={labels.description}
      legend={[
        { label: labels.average, kind: "line", tone: "accent" },
        { label: labels.weighIns, kind: "dot", tone: "context" },
      ]}
    >
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: 48, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="day"
            type="number"
            domain={[0, span]}
            ticks={[...new Set(ticks)]}
            tickFormatter={(day: number) => dayLabel(day)}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            tickMargin={8}
          />
          <YAxis
            domain={[min, max]}
            allowDecimals={false}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-context)", strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !point) return null;
              return (
                <ChartTooltip
                  title={dayLabel(point.day, true)}
                  rows={[
                    {
                      label: labels.average,
                      value: `${kg(point.averageKg)} kg`,
                      kind: "line",
                      tone: "accent",
                    },
                    {
                      label: labels.weighIns,
                      value: `${kg(point.weightKg)} kg`,
                      kind: "dot",
                      tone: "context",
                    },
                  ]}
                />
              );
            }}
          />
          {targetKg !== null ? (
            <ReferenceLine
              y={targetKg}
              stroke="var(--chart-context)"
              strokeWidth={1}
              label={{ value: labels.target, position: "insideBottomLeft", ...AXIS_TEXT }}
            />
          ) : null}
          {/* Pesées brutes : points gris, cerclés de la couleur du fond pour rester lisibles. */}
          <Line
            dataKey="weightKg"
            stroke="none"
            isAnimationActive={false}
            dot={{ r: 4, fill: "var(--chart-context)", stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{
              r: 5,
              fill: "var(--chart-context)",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
          />
          <Line
            dataKey="averageKg"
            type="monotone"
            stroke="var(--chart-accent)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            dot={false}
            activeDot={{
              r: 5,
              fill: "var(--chart-accent)",
              stroke: "var(--surface)",
              strokeWidth: 2,
            }}
            // Une seule étiquette : la dernière valeur de la tendance.
            label={(props) =>
              props.index === data.length - 1 ? (
                <text
                  x={Number(props.x) + 8}
                  y={Number(props.y)}
                  dy={4}
                  fill="var(--foreground)"
                  fontSize={12}
                  fontWeight={600}
                >
                  {kg(Number(props.value))}
                </text>
              ) : (
                <g />
              )
            }
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
