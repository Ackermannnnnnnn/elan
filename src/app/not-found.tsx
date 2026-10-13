import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";

export default async function NotFound() {
  const t = await getTranslations("Errors.notFound");
  const tCommon = await getTranslations("Common");

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
      <Logo />
      <h1 className="mt-10 text-[2rem] leading-tight font-bold">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("body")}</p>
      <Button asChild className="mt-8 self-start">
        <Link href={ROUTES.home}>{tCommon("backHome")}</Link>
      </Button>
    </main>
  );
}
