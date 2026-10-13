"use client";

import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ChoiceCardProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  type: "radio" | "checkbox";
  label: string;
  description?: string;
  icon?: ReactNode;
};

/**
 * Carte à choisir, construite sur un vrai bouton radio ou une vraie case à
 * cocher : navigation au clavier et lecteurs d'écran fonctionnent d'office.
 */
function ChoiceCard({ type, label, description, icon, className, ...props }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-control border border-border-strong bg-surface p-4 transition-colors",
        "hover:border-primary/60",
        "has-checked:border-primary has-checked:bg-primary-soft",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
        className,
      )}
    >
      <input type={type} className="peer sr-only" {...props} />
      {icon ? (
        <span className="mt-0.5 text-muted-foreground group-has-checked:text-primary-soft-foreground [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold group-has-checked:text-primary-soft-foreground">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-sm text-muted-foreground group-has-checked:text-primary-soft-foreground/85">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center border border-border-strong text-transparent",
          "group-has-checked:border-primary group-has-checked:bg-primary group-has-checked:text-primary-foreground",
          type === "radio" ? "rounded-full" : "rounded-[0.375rem]",
        )}
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    </label>
  );
}

type ChoiceChipProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  type?: "radio" | "checkbox";
  label: string;
};

/** Version compacte, pour les listes à choix multiples (allergènes, matériel…). */
function ChoiceChip({ type = "checkbox", label, className, ...props }: ChoiceChipProps) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-[0.9375rem] font-medium transition-colors",
        "hover:border-primary/60",
        "has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-soft-foreground",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
        className,
      )}
    >
      <input type={type} className="peer sr-only" {...props} />
      <Check aria-hidden="true" className="hidden size-4 peer-checked:block" strokeWidth={2.5} />
      {label}
    </label>
  );
}

/** Groupe de choix avec sa légende : indispensable pour annoncer la question posée. */
function ChoiceGroup({
  legend,
  hint,
  error,
  className,
  children,
}: {
  legend: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      <div className={cn("mt-3", className)}>{children}</div>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export { ChoiceCard, ChoiceChip, ChoiceGroup };
