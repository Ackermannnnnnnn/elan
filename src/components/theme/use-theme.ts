"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isTheme, THEME_STORAGE_KEY, type Theme } from "./theme";

const CHANGE_EVENT = "elan-theme-change";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme) {
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

function subscribe(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    applyTheme(readTheme());
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onSystemChange);
  media.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onSystemChange);
    media.removeEventListener("change", onSystemChange);
  };
}

/** Thème choisi par l'utilisateur, mémorisé sur l'appareil. */
export function useTheme() {
  // Côté serveur le choix est inconnu : on rend `null` pour éviter tout écart
  // d'hydratation, puis la vraie valeur dès que le navigateur prend la main.
  const theme = useSyncExternalStore<Theme | null>(subscribe, readTheme, () => null);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée stricte) : le thème
      // s'applique quand même pour la session en cours.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { theme, setTheme };
}
