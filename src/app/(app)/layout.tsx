import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { BottomNav, SidebarNav } from "@/components/layout/main-nav";
import { PageSkeleton } from "@/components/layout/page-header";
import { UserChip, UserChipSkeleton } from "@/components/layout/user-chip";
import { ROUTES } from "@/config/routes";
import { getOwnProfile } from "@/data/profile";
import { requireUser } from "@/lib/auth/session";

/**
 * Garde-fou serveur : aucune page de l'espace privé n'est rendue sans session
 * vérifiée, même si `proxy.ts` était contourné ou mal configuré. Tant que
 * l'onboarding n'est pas terminé, tout mène à l'onboarding.
 */
async function AuthGate({ children }: { children: ReactNode }) {
  await requireUser();
  const profile = await getOwnProfile();
  if (!profile?.onboarding_completed_at) redirect(ROUTES.onboarding);
  return children;
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("Nav");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <a
        href="#content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-control focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:font-semibold focus-visible:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>

      {/* Barre latérale — ordinateur */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <Link href={ROUTES.home} className="mb-8 self-start rounded-control px-2">
          <Logo />
        </Link>
        <SidebarNav />
        <div className="mt-auto border-t border-border pt-4">
          <Suspense fallback={<UserChipSkeleton />}>
            <UserChip />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* En-tête — mobile */}
        <header className="flex h-14 items-center border-b border-border bg-surface px-4 lg:hidden">
          <Link href={ROUTES.home} className="rounded-control">
            <Logo />
          </Link>
        </header>

        <main
          id="content"
          className="mx-auto w-full max-w-4xl flex-1 px-4 pt-7 pb-28 sm:px-6 lg:px-12 lg:pt-12 lg:pb-16"
        >
          <Suspense fallback={<PageSkeleton />}>
            <AuthGate>{children}</AuthGate>
          </Suspense>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
