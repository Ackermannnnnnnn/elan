import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

type FieldProps = {
  /** Identifiant du champ : relie le libellé, l'aide et l'erreur au contrôle. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Élément affiché à droite du libellé (ex. lien « Mot de passe oublié ? »). */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
};

export const fieldHintId = (id: string) => `${id}-hint`;
export const fieldErrorId = (id: string) => `${id}-error`;

/**
 * `aria-describedby` à poser sur le contrôle. L'erreur remplace l'aide, comme
 * à l'écran : on ne référence jamais un élément absent du document.
 */
export function fieldDescribedBy(id: string, { hint, error }: { hint?: string; error?: string }) {
  if (error) return fieldErrorId(id);
  if (hint) return fieldHintId(id);
  return undefined;
}

/** Enveloppe d'un champ de formulaire : libellé, aide, message d'erreur. */
function Field({ id, label, hint, error, labelAction, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children}
      {hint && !error ? (
        <p id={fieldHintId(id)} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={fieldErrorId(id)} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Field };
