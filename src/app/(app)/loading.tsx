import { PageSkeleton } from "@/components/layout/page-header";

// Frontière <Suspense> propre à chaque page de l'espace privé. Lors d'une
// navigation interne, la mise en page reste montée : c'est cette frontière qui
// permet d'afficher la nouvelle page immédiatement pendant que ses données arrivent.
export default function Loading() {
  return <PageSkeleton />;
}
