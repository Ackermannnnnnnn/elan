import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Liste déroulante native : fiable au clavier et sur mobile (sélecteur du système). */
function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-12 w-full appearance-none rounded-control border border-border-strong bg-surface pr-10 pl-3.5 text-foreground",
          "transition-[border-color,box-shadow] duration-150",
          "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none",
          "aria-invalid:border-destructive",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { Select };
