import { APP_NAME } from "@/config/app";
import { cn } from "@/lib/utils";

/** Symbole : un trait qui s'élève, comme l'accent du nom. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M9 21.5 23 10.5"
        fill="none"
        strokeWidth="4.25"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight">{APP_NAME}</span>
    </span>
  );
}

export { Logo, LogoMark };
