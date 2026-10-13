import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/config/routes";
import { getOwnProfile } from "@/data/profile";
import { getSessionUser } from "@/lib/auth/session";

/** Pastille du compte en bas de la barre latérale : initiale, prénom, e-mail. */
export async function UserChip() {
  const user = await getSessionUser();
  if (!user) return null;

  // Un profil illisible ne doit pas casser toute la navigation.
  const profile = await getOwnProfile().catch(() => null);
  const name = profile?.display_name ?? user.email ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href={ROUTES.profile}
      className="flex items-center gap-3 rounded-control p-2 transition-colors hover:bg-surface-muted"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground"
      >
        {initial}
      </span>
      <span className="min-w-0">
        {profile?.display_name ? (
          <span className="block truncate text-sm font-semibold">{profile.display_name}</span>
        ) : null}
        {user.email ? (
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        ) : null}
      </span>
    </Link>
  );
}

export function UserChipSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2">
      <Skeleton className="size-9 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
