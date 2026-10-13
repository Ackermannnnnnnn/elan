import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("Auth.panel");
  const points = [t("points.calories"), t("points.data"), t("points.pace")];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <main className="flex flex-col px-5 py-8 sm:px-10 lg:px-16 lg:py-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-10">
          {children}
        </div>
      </main>

      {/* Panneau de marque : décoratif pour la navigation, mais lisible. */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-16">
        <svg
          aria-hidden="true"
          viewBox="0 0 600 600"
          className="pointer-events-none absolute -right-24 -bottom-32 w-[46rem] opacity-[0.14]"
        >
          <path
            d="M40 520 L560 80"
            fill="none"
            stroke="currentColor"
            strokeWidth="150"
            strokeLinecap="round"
          />
        </svg>

        <p className="relative max-w-[18ch] font-display text-[clamp(2.5rem,4.2vw,4rem)] leading-[1.02] font-bold tracking-[-0.03em]">
          {t("headline")}
        </p>

        <div className="relative max-w-md">
          <p className="text-lg leading-relaxed opacity-90">{t("lead")}</p>
          <ul className="mt-8 flex flex-col gap-4 border-t border-current/25 pt-8 text-[0.9375rem] leading-relaxed">
            {points.map((point) => (
              <li key={point} className="opacity-90">
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
