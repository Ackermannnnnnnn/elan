import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { listReminders } from "@/data/notifications";
import { InstallCard } from "@/features/notifications/install-card";
import { PushDeviceCard } from "@/features/notifications/push-device-card";
import { RemindersForm } from "@/features/notifications/reminders-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const [reminders, t, tProfile] = await Promise.all([
    listReminders(),
    getTranslations("Notifications"),
    getTranslations("Profile"),
  ]);

  return (
    <>
      <Link
        href={ROUTES.profile}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tProfile("title")}
      </Link>
      <PageHeader title={t("title")} lead={t("lead")} />

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("device.title")}</CardTitle>
            <CardDescription>{t("device.description")}</CardDescription>
          </CardHeader>
          <PushDeviceCard />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("reminders.title")}</CardTitle>
            <CardDescription>{t("reminders.description")}</CardDescription>
          </CardHeader>
          <RemindersForm reminders={reminders} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("install.title")}</CardTitle>
            <CardDescription>{t("install.description")}</CardDescription>
          </CardHeader>
          <div className="flex flex-col">
            <InstallCard />
          </div>
        </Card>
      </div>
    </>
  );
}
