import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-12 w-full min-w-0 rounded-control border border-border-strong bg-surface px-3.5 text-foreground",
        "placeholder:text-muted-foreground/80",
        "transition-[border-color,box-shadow] duration-150",
        "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none",
        "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
