import { Dumbbell, House, TrendingUp, UserRound, Utensils, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/routes";

export type NavKey = "home" | "nutrition" | "training" | "progress" | "profile";

export type NavItem = { key: NavKey; href: string; icon: LucideIcon };

/** Les cinq sections, dans le même ordre sur mobile et sur ordinateur. */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: ROUTES.home, icon: House },
  { key: "nutrition", href: ROUTES.nutrition, icon: Utensils },
  { key: "training", href: ROUTES.training, icon: Dumbbell },
  { key: "progress", href: ROUTES.progress, icon: TrendingUp },
  { key: "profile", href: ROUTES.profile, icon: UserRound },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === ROUTES.home) return pathname === ROUTES.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}
