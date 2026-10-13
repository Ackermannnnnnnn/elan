"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEMES, type Theme } from "./theme";
import { useTheme } from "./use-theme";

const ICONS: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

type ThemeSelectorProps = {
  legend: string;
  labels: Record<Theme, string>;
};

/** Choix du thème : trois boutons radio présentés comme un sélecteur segmenté. */
export function ThemeSelector({ legend, labels }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-control bg-surface-muted p-1 sm:inline-grid sm:min-w-96">
        {THEMES.map((option) => {
          const Icon = ICONS[option];
          const checked = theme === option;
          return (
            <label
              key={option}
              className={cn(
                "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[0.5rem] px-3 text-sm font-medium transition-colors",
                "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                checked
                  ? "bg-surface font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={checked}
                onChange={() => setTheme(option)}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-4" />
              {labels[option]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
