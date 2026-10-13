import Link from "next/link";
import { cn } from "@/lib/utils";

type SegmentedLinksProps = {
  label: string;
  items: { href: string; label: string; current: boolean }[];
  className?: string;
  /** Occupe toute la largeur, options de même taille (libellés sur deux lignes si besoin). */
  fill?: boolean;
};

/**
 * Sélecteur segmenté dont chaque option est un lien : le choix vit dans l'URL
 * (partageable, conservé au rechargement) et fonctionne sans JavaScript.
 */
function SegmentedLinks({ label, items, className, fill = false }: SegmentedLinksProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul
        className={cn(
          "gap-1 rounded-control bg-surface-muted p-1",
          fill ? "flex w-full max-w-md" : "inline-flex",
        )}
      >
        {items.map((item) => (
          <li key={item.href} className={fill ? "flex-1" : undefined}>
            <Link
              href={item.href}
              scroll={false}
              aria-current={item.current ? "true" : undefined}
              className={cn(
                "flex items-center rounded-[0.5rem] px-3 text-sm font-medium transition-colors",
                fill ? "min-h-9 justify-center py-1.5 text-center" : "h-9 whitespace-nowrap",
                item.current
                  ? "bg-surface font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { SegmentedLinks };
