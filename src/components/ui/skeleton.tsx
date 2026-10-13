import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Bloc d'attente affiché pendant le chargement d'un contenu. */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-control bg-surface-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
