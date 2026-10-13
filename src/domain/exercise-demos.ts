/**
 * Illustrations des mouvements (« Voir le mouvement ») : deux photos par exercice,
 * position de départ et position d'arrivée.
 *
 * Source : Free Exercise DB (https://github.com/yuhonas/free-exercise-db),
 * domaine public (licence Unlicense) — gratuit, sans attribution obligatoire.
 * Les images sont copiées dans public/exercises/ par
 * `node scripts/fetch-exercise-demos.ts` : l'application ne contacte aucun service tiers.
 *
 * Clé : slug de src/domain/exercise-catalog.ts ; valeur : identifiant dans la source.
 * Un exercice absent de cette liste n'a pas d'illustration (le lien vidéo reste proposé).
 */
export const EXERCISE_DEMOS: Readonly<Record<string, string>> = {
  "developpe-couche-barre": "Barbell_Bench_Press_-_Medium_Grip",
  "developpe-couche-halteres": "Dumbbell_Bench_Press",
  "developpe-incline-halteres": "Incline_Dumbbell_Press",
  pompes: "Pushups",
  "presse-pectoraux-machine": "Machine_Bench_Press",
  "ecarte-halteres": "Dumbbell_Flyes",
  "ecarte-poulie": "Cable_Crossover",
  dips: "Dips_-_Chest_Version",
  tractions: "Pullups",
  "tractions-assistees-elastique": "Band_Assisted_Pull-Up",
  "tirage-vertical": "Wide-Grip_Lat_Pulldown",
  "rowing-barre": "Bent_Over_Barbell_Row",
  "rowing-haltere-un-bras": "One-Arm_Dumbbell_Row",
  "tirage-horizontal": "Seated_Cable_Rows",
  "rowing-inverse": "Inverted_Row",
  "face-pull": "Face_Pull",
  "developpe-militaire-barre": "Standing_Military_Press",
  "developpe-epaules-halteres": "Dumbbell_Shoulder_Press",
  "developpe-epaules-machine": "Machine_Shoulder_Military_Press",
  "developpe-epaules-elastique": "Shoulder_Press_-_With_Bands",
  "elevations-laterales": "Side_Lateral_Raise",
  "elevations-laterales-elastique": "Lateral_Raise_-_With_Bands",
  "oiseau-halteres": "Seated_Bent-Over_Rear_Delt_Raise",
  "curl-halteres": "Dumbbell_Bicep_Curl",
  "curl-barre": "Barbell_Curl",
  "curl-marteau": "Hammer_Curls",
  "curl-poulie": "Standing_Biceps_Cable_Curl",
  "extension-triceps-poulie": "Triceps_Pushdown",
  "extension-triceps-haltere": "Standing_Dumbbell_Triceps_Extension",
  "dips-banc": "Bench_Dips",
  "pompes-serrees": "Push-Ups_-_Close_Triceps_Position",
  "squat-barre": "Barbell_Squat",
  "goblet-squat": "Goblet_Squat",
  "goblet-squat-kettlebell": "Goblet_Squat",
  "squat-poids-du-corps": "Bodyweight_Squat",
  "presse-cuisses": "Leg_Press",
  "squat-bulgare": "Split_Squat_with_Dumbbells",
  "fentes-arriere": "Dumbbell_Rear_Lunge",
  "fentes-marchees-halteres": "Dumbbell_Lunges",
  "leg-extension": "Leg_Extensions",
  "montees-sur-banc": "Dumbbell_Step_Ups",
  "souleve-de-terre-roumain": "Romanian_Deadlift",
  "souleve-de-terre-roumain-halteres": "Stiff-Legged_Dumbbell_Deadlift",
  "souleve-de-terre": "Barbell_Deadlift",
  "swing-kettlebell": "One-Arm_Kettlebell_Swings",
  "hip-thrust-barre": "Barbell_Hip_Thrust",
  "pont-fessier": "Butt_Lift_Bridge",
  "pont-fessier-une-jambe": "Single_Leg_Glute_Bridge",
  "leg-curl": "Lying_Leg_Curls",
  "leg-curl-elastique": "Seated_Band_Hamstring_Curl",
  "mollets-debout": "Standing_Dumbbell_Calf_Raise",
  "mollets-machine": "Standing_Calf_Raises",
  "gainage-planche": "Plank",
  "gainage-lateral": "Side_Bridge",
  "dead-bug": "Dead_Bug",
  "releves-genoux-suspendu": "Hanging_Leg_Raise",
  "mountain-climbers": "Mountain_Climbers",
  "marche-du-fermier": "Farmers_Walk",
};

export type DemoImages = { start: string; end: string };

/** Chemins publics des deux images d'un exercice, ou null s'il n'y en a pas. */
export function demoImages(slug: string | null): DemoImages | null {
  if (!slug || !Object.hasOwn(EXERCISE_DEMOS, slug)) return null;
  return { start: `/exercises/${slug}-1.webp`, end: `/exercises/${slug}-2.webp` };
}

/** Recherche de vidéos de démonstration (YouTube, sans clé ni compte). */
export function videoSearchUrl(name: string): string {
  const query = new URLSearchParams({ search_query: `${name} exercice technique` });
  return `https://www.youtube.com/results?${query.toString()}`;
}
