import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Grille de chiffres clés, séparés par de fins filets plutôt que par des cartes distinctes. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
}

/** Un chiffre clé : libellé, valeur, précision facultative. */
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl leading-tight font-semibold">{value}</dd>
      {detail ? <dd className="mt-1 text-sm text-muted-foreground">{detail}</dd> : null}
    </div>
  );
}
