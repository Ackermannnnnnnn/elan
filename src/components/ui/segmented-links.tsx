import Link from "next/link";
import { cn } from "@/lib/utils";

type SegmentedLinksProps = {
  label: string;
  items: { href: string; label: string; current: boolean }[];
  className?: string;
};

/**
 * Sélecteur segmenté dont chaque option est un lien : le choix vit dans l'URL
 * (partageable, conservé au rechargement) et fonctionne sans JavaScript.
 */
function SegmentedLinks({ label, items, className }: SegmentedLinksProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="inline-flex gap-1 rounded-control bg-surface-muted p-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              scroll={false}
              aria-current={item.current ? "true" : undefined}
              className={cn(
                "flex h-9 items-center rounded-[0.5rem] px-3 text-sm font-medium whitespace-nowrap transition-colors",
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
