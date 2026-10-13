import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Lien entre les écrans d'authentification.
 * Sans préchargement : ces pages redirigent dès qu'une session existe, et un
 * préchargement encore en vol au moment de la connexion échouerait pour rien.
 */
export function AuthLink({ className, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  return (
    <Link
      prefetch={false}
      className={cn("font-semibold text-primary underline-offset-4 hover:underline", className)}
      {...props}
    />
  );
}
