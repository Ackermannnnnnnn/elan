import { ArrowLeft, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { DeleteAccountForm } from "@/features/account/delete-account-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Account.delete");
  return { title: t("title") };
}

export default async function DeleteAccountPage() {
  const [t, tProfile] = await Promise.all([getTranslations("Account"), getTranslations("Profile")]);

  return (
    <>
      <Link
        href={ROUTES.profile}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tProfile("title")}
      </Link>
      <PageHeader title={t("delete.title")} lead={t("delete.lead")} />

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("delete.whatTitle")}</CardTitle>
          </CardHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem]">
            {(["what1", "what2", "what3"] as const).map((key) => (
              <li key={key}>{t(`delete.${key}`)}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">{t("delete.exportFirst")}</p>
          <Button asChild variant="secondary" className="mt-3">
            {/* Lien de téléchargement classique : pas de navigation dans l'application. */}
            <a href={ROUTES.dataExport} download>
              <Download aria-hidden="true" />
              {t("export.button")}
            </a>
          </Button>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("delete.confirmTitle")}</CardTitle>
            <CardDescription>{t("delete.confirmDescription")}</CardDescription>
          </CardHeader>
          <DeleteAccountForm />
        </Card>
      </div>
    </>
  );
}
