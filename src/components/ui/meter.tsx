import { cn } from "@/lib/utils";

type MeterProps = {
  /** Libellé lu par les lecteurs d'écran (ex. « Protéines »). */
  label: string;
  value: number;
  max: number;
  /** Texte lu à la place du pourcentage (ex. « 96 g sur 160 g »). */
  valueText: string;
  className?: string;
};

/**
 * Jauge d'avancement vers une cible. La piste est une teinte claire de la même
 * couleur que le remplissage ; au-delà de 100 %, la barre reste pleine et le
 * dépassement est indiqué en toutes lettres à côté, jamais par la couleur seule.
 */
function Meter({ label, value, max, valueText, className }: MeterProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={valueText}
      className={cn("h-2 overflow-hidden rounded-full bg-chart-track", className)}
    >
      <div
        className="h-full rounded-full bg-chart-accent transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export { Meter };
