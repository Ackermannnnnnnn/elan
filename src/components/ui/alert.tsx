import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex gap-3 rounded-control px-4 py-3 text-[0.9375rem] leading-snug [&_svg]:mt-0.5 [&_svg]:size-[1.125rem] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        error: "bg-destructive-soft text-destructive",
        success: "bg-success-soft text-success",
        info: "bg-primary-soft text-primary-soft-foreground",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const ICONS = { error: CircleAlert, success: CircleCheck, info: Info } as const;

type AlertProps = ComponentProps<"div"> & VariantProps<typeof alertVariants>;

/**
 * Message contextuel. Les erreurs sont annoncées immédiatement aux lecteurs
 * d'écran (role="alert"), les autres messages poliment (role="status").
 */
function Alert({ className, variant, children, ...props }: AlertProps) {
  const resolved = variant ?? "info";
  const Icon = ICONS[resolved];
  return (
    <div
      role={resolved === "error" ? "alert" : "status"}
      className={cn(alertVariants({ variant: resolved }), className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      <div className="min-w-0 font-medium">{children}</div>
    </div>
  );
}

export { Alert };
