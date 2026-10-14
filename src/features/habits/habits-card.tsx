import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import type { HabitData } from "@/data/habits";
import type { IsoDate } from "@/lib/dates";
import { HabitRow } from "./habit-view";

/** Carte de l'accueil : les habitudes suivies, calculées depuis ce qui est déjà enregistré. */
export async function HabitsCard({ habits, today }: { habits: HabitData[]; today: IsoDate }) {
  const t = await getTranslations("Habits");
  const active = habits.filter((habit) => habit.active);

  return (
    <Card>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <CardTitle>{t("title")}</CardTitle>
        <Link
          href={ROUTES.habits}
          className="inline-flex items-center gap-0.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {active.length > 0 ? t("seeAll") : t("choose")}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {active.length > 0 ? (
        <ul className="divide-y divide-border">
          {active.map((habit) => (
            <HabitRow key={habit.key} habit={habit} today={today} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("none")}</p>
      )}
    </Card>
  );
}
