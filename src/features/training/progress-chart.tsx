"use client";

import { useFormatter } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, ChartTooltip } from "@/components/charts/chart-frame";

export type ProgressPoint = { key: string; date: string; value: number };

const AXIS_TEXT = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

/** Évolution d'un exercice, séance après séance : une seule série, une seule couleur. */
export function ProgressChart({
  points,
  unit,
  labels,
  height = 220,
}: {
  points: ProgressPoint[];
  unit: string;
  labels: { series: string; description: string };
  height?: number;
}) {
  const format = useFormatter();
  const toDate = (date: string) => new Date(`${date}T12:00:00Z`);
  const shortDay = (date: string) =>
    format.dateTime(toDate(date), { day: "numeric", month: "short", timeZone: "UTC" });
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const pad = Math.max(1, (high - low) * 0.2);

  return (
    <ChartFrame description={labels.description}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="key"
            tickFormatter={(key: string) =>
              shortDay(points.find((p) => p.key === key)?.date ?? key)
            }
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.max(0, Math.floor(low - pad)), Math.ceil(high + pad)]}
            tick={AXIS_TEXT}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
            tickFormatter={(value: number) => format.number(value, { maximumFractionDigits: 0 })}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-grid)" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as ProgressPoint | undefined;
              if (!active || !point) return null;
              return (
                <ChartTooltip
                  title={shortDay(point.date)}
                  rows={[
                    {
                      label: labels.series,
                      value: `${format.number(point.value, { maximumFractionDigits: 1 })} ${unit}`,
                      kind: "line",
                      tone: "accent",
                    },
                  ]}
                />
              );
            }}
          />
          <Line
            dataKey="value"
            stroke="var(--chart-accent)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--chart-accent)", stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
