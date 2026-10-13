import type { ReactNode } from "react";

/** En-tête de page : un titre, une phrase d'intention, éventuellement une action. */
export function PageHeader({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 lg:mb-10">
      <div>
        <h1 className="text-[2rem] leading-[1.1] font-bold lg:text-[2.5rem]">{title}</h1>
        {lead ? <p className="mt-2 max-w-[60ch] text-muted-foreground lg:text-lg">{lead}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <div className="h-10 w-56 animate-pulse rounded-control bg-surface-muted" />
      <div className="h-5 w-80 max-w-full animate-pulse rounded-control bg-surface-muted" />
      <div className="mt-6 h-48 animate-pulse rounded-card bg-surface-muted" />
      <div className="h-32 animate-pulse rounded-card bg-surface-muted" />
    </div>
  );
}
