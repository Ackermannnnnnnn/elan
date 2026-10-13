import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type UnitInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Unité affichée à droite du champ (kg, cm, kcal…). */
  unit: string;
  /** `decimal` accepte la virgule ; `numeric` n'affiche que les chiffres sur mobile. */
  mode?: "decimal" | "numeric";
};

/**
 * Champ numérique avec unité. C'est un champ texte (et non type="number") :
 * il accepte « 72,5 » comme « 72.5 » et ne change pas de valeur à la molette.
 */
function UnitInput({ unit, mode = "decimal", className, ...props }: UnitInputProps) {
  return (
    <div className="relative">
      <Input
        type="text"
        inputMode={mode}
        autoComplete="off"
        className={cn("pr-14", className)}
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted-foreground"
      >
        {unit}
      </span>
    </div>
  );
}

export { UnitInput };
