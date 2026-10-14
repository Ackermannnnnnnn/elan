import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { getHabitsOverview } from "@/data/habits";
import { getToday } from "@/data/profile";
import { HabitDetail } from "@/features/habits/habit-view";
import { HabitSettingsForm } from "@/features/habits/settings-form";
import { SleepForm } from "@/features/habits/sleep-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Habits");
  return { title: t("title") };
}

export default async function HabitsPage() {
  const today = await getToday();
  const [habits, t, tProgress] = await Promise.all([
    getHabitsOverview(today),
    getTranslations("Habits"),
    getTranslations("Progress"),
  ]);
  const active = habits.filter((habit) => habit.active);
  const sleep = habits.find((habit) => habit.key === "sleep");

  return (
    <>
      <Link
        href={ROUTES.progress}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tProgress("title")}
      </Link>
      <PageHeader title={t("title")} lead={t("lead")} />

      <div className="flex flex-col gap-5">
        {sleep?.active ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("sleep.title")}</CardTitle>
              <CardDescription>{t("sleep.description")}</CardDescription>
            </CardHeader>
            <SleepForm today={today} hours={sleep.values.get(today) ?? null} />
          </Card>
        ) : null}

        {active.map((habit) => (
          <Card key={habit.key}>
            <HabitDetail habit={habit} today={today} />
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>{t("settings.title")}</CardTitle>
            <CardDescription>{t("settings.description")}</CardDescription>
          </CardHeader>
          <HabitSettingsForm
            settings={habits.map(({ key, active: isActive, target, available }) => ({
              key,
              active: isActive,
              target,
              available,
            }))}
          />
        </Card>
      </div>
    </>
  );
}
