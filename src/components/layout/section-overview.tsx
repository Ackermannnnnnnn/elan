import { Badge } from "@/components/ui/badge";

export type SectionFeature = { title: string; body: string };

/**
 * État honnête d'une section pas encore livrée : ce qu'elle contiendra, sans
 * fausse donnée ni bouton qui ne mène nulle part.
 */
export function SectionOverview({
  features,
  comingSoonLabel,
}: {
  features: SectionFeature[];
  comingSoonLabel: string;
}) {
  return (
    <ul className="overflow-hidden rounded-card border border-border bg-surface">
      {features.map((feature) => (
        <li
          key={feature.title}
          className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 last:border-b-0 sm:px-6"
        >
          <div className="min-w-0">
            <h2 className="font-sans text-base font-semibold tracking-normal">{feature.title}</h2>
            <p className="mt-1 max-w-[58ch] text-[0.9375rem] text-muted-foreground">
              {feature.body}
            </p>
          </div>
          <Badge className="mt-0.5 shrink-0">{comingSoonLabel}</Badge>
        </li>
      ))}
    </ul>
  );
}
