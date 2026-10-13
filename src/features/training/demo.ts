import { demoImages, videoSearchUrl } from "@/domain/exercise-demos";

/** Données de « Voir le mouvement » pour un exercice de la bibliothèque. */
export function demoFor(exercise: { name: string; slug: string | null; owner_id: string | null }) {
  return {
    name: exercise.name,
    // Les exercices personnels n'ont pas d'illustration (seulement le lien vidéo).
    images: exercise.owner_id === null ? demoImages(exercise.slug) : null,
    videoUrl: videoSearchUrl(exercise.name),
  };
}
