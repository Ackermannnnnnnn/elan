"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors.page");
  const tCommon = useTranslations("Common");

  useEffect(() => {
    // Le détail reste dans la console ; l'écran n'expose aucune information technique.
    console.error("[ui] page error", { digest: error.digest ?? null });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-[2rem] leading-tight font-bold">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("body")}</p>
      <Button onClick={reset} className="mt-8 self-start">
        {tCommon("retry")}
      </Button>
    </main>
  );
}
