import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Configuration" };

const STEPS = ["project", "env", "migrate", "restart"] as const;

const SNIPPETS: Partial<Record<(typeof STEPS)[number], string>> = {
  env: "cp .env.example .env.local",
  migrate: "npx supabase link --project-ref <ref-du-projet>\nnpx supabase db push",
  restart: "npm run dev",
};

/**
 * Affichée par `proxy.ts` tant que les variables Supabase sont absentes.
 * L'application ne simule jamais une base de données : elle explique quoi faire.
 */
export default async function SetupPage() {
  const t = await getTranslations("Setup");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-10 sm:py-16">
      <Logo />
      <h1 className="mt-10 text-[2rem] leading-[1.1] font-bold sm:text-[2.5rem]">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground sm:text-lg">{t("lead")}</p>

      <Alert variant="info" className="mt-8">
        <p>{t("missing")}</p>
        <p className="mt-1 font-mono text-sm font-normal break-all">
          NEXT_PUBLIC_SUPABASE_URL
          <br />
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        </p>
      </Alert>

      {/* Liste numérotée : les étapes se suivent réellement dans cet ordre. */}
      <ol className="mt-10 flex flex-col gap-8">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-4">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-base font-semibold tracking-normal">
                {t(`steps.${step}.title`)}
              </h2>
              <p className="mt-1 text-[0.9375rem] text-muted-foreground">
                {t(`steps.${step}.body`)}
              </p>
              {SNIPPETS[step] ? (
                <pre className="mt-3 overflow-x-auto rounded-control bg-surface-muted px-4 py-3 font-mono text-sm">
                  <code>{SNIPPETS[step]}</code>
                </pre>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
        {t("readme")}
      </p>
    </main>
  );
}
