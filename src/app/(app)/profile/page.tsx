import { Bell, Download, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { getActiveGoal, getOwnPreferences, getTargetsOn } from "@/data/plan";
import { getOwnProfile, getToday } from "@/data/profile";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { IdentityForm } from "@/features/profile/identity-form";
import { requireUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile");
  return { title: t("title") };
}

export default async function ProfilePage() {
  const today = await getToday();
  const [user, profile, goal, preferences, targets, t, tAuth, tTargets, tOptions, format] =
    await Promise.all([
      requireUser(),
      getOwnProfile(),
      getActiveGoal(),
      getOwnPreferences(),
      getTargetsOn(today),
      getTranslations("Profile"),
      getTranslations("Auth"),
      getTranslations("Targets"),
      getTranslations("Options"),
      getFormatter(),
    ]);

  const number = (value: number, digits = 0) =>
    format.number(value, { maximumFractionDigits: digits });
  const longDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  const summary = [
    goal ? [tTargets("profileCard.goal"), tOptions(`goalType.${goal.goal_type}.label`)] : null,
    goal?.target_weight_kg
      ? [tTargets("profileCard.targetWeight"), `${number(goal.target_weight_kg, 1)} kg`]
      : null,
    profile?.activity_level
      ? [
          tTargets("profileCard.activity"),
          tOptions(`activityLevel.${profile.activity_level}.label`),
        ]
      : null,
    preferences
      ? [tTargets("profileCard.diet"), tOptions(`dietType.${preferences.diet_type}`)]
      : null,
    preferences
      ? [
          tTargets("profileCard.allergies"),
          tTargets("profileCard.allergyCount", { count: preferences.allergies.length }),
        ]
      : null,
  ].filter((row): row is [string, string] => row !== null);

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("identity.title")}</CardTitle>
            <CardDescription>{t("identity.description")}</CardDescription>
          </CardHeader>
          {user.email ? (
            <dl className="mb-5">
              <dt className="text-sm font-semibold">{t("identity.email")}</dt>
              <dd className="mt-1 break-all text-muted-foreground">{user.email}</dd>
            </dl>
          ) : null}
          <IdentityForm displayName={profile?.display_name ?? ""} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tTargets("profileCard.title")}</CardTitle>
          </CardHeader>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {summary.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 border-b border-border pb-3"
              >
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <Button asChild variant="secondary" className="mt-5">
            <Link href={ROUTES.profileEdit}>{tTargets("profileCard.edit")}</Link>
          </Button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tTargets("card.title")}</CardTitle>
            <CardDescription>
              {targets
                ? tTargets(targets.source === "manual" ? "card.manual" : "card.calculated", {
                    date: longDate(targets.effective_from),
                  })
                : tTargets("card.none")}
            </CardDescription>
          </CardHeader>
          {targets ? (
            <>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-control border border-border bg-border sm:grid-cols-4">
                {[
                  [tTargets("card.kcal"), `${number(targets.target_kcal)} kcal`],
                  [tTargets("card.protein"), `${number(targets.protein_g)} g`],
                  [tTargets("card.carbs"), `${number(targets.carbs_g)} g`],
                  [tTargets("card.fat"), `${number(targets.fat_g)} g`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-surface p-3.5">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {targets.maintenance_kcal ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {tTargets("card.maintenance", { value: number(targets.maintenance_kcal) })}
                </p>
              ) : null}
            </>
          ) : null}
          <Button asChild variant="secondary" className="mt-5">
            <Link href={ROUTES.profileTargets}>{tTargets("card.adjust")}</Link>
          </Button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("appearance.title")}</CardTitle>
            <CardDescription>{t("appearance.description")}</CardDescription>
          </CardHeader>
          <ThemeSelector
            legend={t("appearance.legend")}
            labels={{
              light: t("appearance.light"),
              dark: t("appearance.dark"),
              system: t("appearance.system"),
            }}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("notifications.title")}</CardTitle>
            <CardDescription>{t("notifications.description")}</CardDescription>
          </CardHeader>
          <Button asChild variant="secondary">
            <Link href={ROUTES.notifications}>
              <Bell aria-hidden="true" />
              {t("notifications.open")}
            </Link>
          </Button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("data.title")}</CardTitle>
            <CardDescription>{t("data.description")}</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              {/* Téléchargement d'un fichier : lien classique, pas de navigation. */}
              <a href={ROUTES.dataExport} download>
                <Download aria-hidden="true" />
                {t("data.export")}
              </a>
            </Button>
            <Button asChild variant="destructive">
              <Link href={ROUTES.deleteAccount}>
                <Trash2 aria-hidden="true" />
                {t("data.delete")}
              </Link>
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("session.title")}</CardTitle>
            <CardDescription>{t("session.description")}</CardDescription>
          </CardHeader>
          <SignOutButton label={tAuth("signOut")} pendingLabel={tAuth("signingOut")} />
        </Card>
      </div>
    </>
  );
}
