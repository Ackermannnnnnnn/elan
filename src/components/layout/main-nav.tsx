"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { isActivePath, NAV_ITEMS } from "./nav-items";

// Sur une route dynamique (/nutrition/foods/[id]), l'adresse n'est connue qu'à
// la requête : la navigation est d'abord rendue sans onglet actif (coque
// statique), puis l'onglet courant est marqué dès que l'adresse est disponible.

/** Navigation latérale (ordinateur). */
export function SidebarNav() {
  return (
    <Suspense fallback={<SidebarNavList pathname={null} />}>
      <SidebarNavCurrent />
    </Suspense>
  );
}

function SidebarNavCurrent() {
  return <SidebarNavList pathname={usePathname()} />;
}

function SidebarNavList({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Nav");

  return (
    <nav aria-label={t("label")}>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = pathname !== null && isActivePath(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-control px-3 text-[0.9375rem] font-medium transition-colors",
                  active
                    ? "bg-primary-soft font-semibold text-primary-soft-foreground"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barre d'onglets fixée en bas de l'écran (mobile). */
export function BottomNav() {
  return (
    <Suspense fallback={<BottomNavList pathname={null} />}>
      <BottomNavCurrent />
    </Suspense>
  );
}

function BottomNavCurrent() {
  return <BottomNavList pathname={usePathname()} />;
}

function BottomNavList({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Nav");

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = pathname !== null && isActivePath(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                  active ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary-soft text-primary-soft-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
