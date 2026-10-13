/**
 * Bibliothèque d'exercices de référence. Source unique : la migration SQL qui
 * alimente `exercise_library` est générée à partir de ce fichier
 * (scripts/build-exercise-migration.ts), et un test vérifie qu'elles concordent.
 *
 * Matériel : un exercice exige TOUT le matériel listé ; liste vide = poids du corps.
 * Zones sensibles : l'exercice n'est jamais proposé automatiquement à quelqu'un
 * qui a déclaré une gêne à cet endroit (déclaratif, jamais un diagnostic).
 * Exercice « chronométré » : les répétitions sont des secondes.
 */

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "glutes",
  "quadriceps",
  "hamstrings",
  "calves",
  "full_body",
  "cardio",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const PATTERNS = [
  "push_horizontal",
  "push_vertical",
  "pull_horizontal",
  "pull_vertical",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "core",
  "isolation",
  "cardio",
  "mobility",
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const EQUIPMENT = [
  "dumbbells",
  "barbell",
  "bench",
  "pull_up_bar",
  "resistance_bands",
  "kettlebell",
  "machines",
  "cardio_machine",
  "mat",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const CAUTION_AREAS = [
  "shoulder",
  "elbow",
  "wrist",
  "lower_back",
  "hip",
  "knee",
  "ankle",
  "neck",
] as const;
export type CautionArea = (typeof CAUTION_AREAS)[number];

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export type CatalogExercise = {
  slug: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  pattern: Pattern;
  equipment: Equipment[];
  difficulty: Level;
  compound: boolean;
  timed?: boolean;
  caution: CautionArea[];
  instructions: string;
};

const ex = (exercise: CatalogExercise) => exercise;

export const EXERCISE_CATALOG: readonly CatalogExercise[] = [
  // --- Pectoraux ----------------------------------------------------------------------
  ex({
    slug: "developpe-couche-barre",
    name: "Développé couché à la barre",
    primary: "chest",
    secondary: ["triceps", "shoulders"],
    pattern: "push_horizontal",
    equipment: ["barbell", "bench"],
    difficulty: "intermediate",
    compound: true,
    caution: ["shoulder"],
    instructions:
      "Allongé, pieds au sol, omoplates serrées. Descends la barre jusqu'au bas des pectoraux en gardant les coudes à environ 45° du buste, puis pousse sans décoller les fesses du banc. Avec des charges lourdes, utilise des sécurités ou un partenaire.",
  }),
  ex({
    slug: "developpe-couche-halteres",
    name: "Développé couché aux haltères",
    primary: "chest",
    secondary: ["triceps", "shoulders"],
    pattern: "push_horizontal",
    equipment: ["dumbbells", "bench"],
    difficulty: "beginner",
    compound: true,
    caution: ["shoulder"],
    instructions:
      "Allongé sur le banc, haltères au-dessus de la poitrine. Descends en contrôlant jusqu'à sentir l'étirement des pectoraux, coudes légèrement rentrés, puis remonte en rapprochant les haltères.",
  }),
  ex({
    slug: "developpe-incline-halteres",
    name: "Développé incliné aux haltères",
    primary: "chest",
    secondary: ["shoulders", "triceps"],
    pattern: "push_horizontal",
    equipment: ["dumbbells", "bench"],
    difficulty: "intermediate",
    compound: true,
    caution: ["shoulder"],
    instructions:
      "Banc incliné à 30°. Descends les haltères vers le haut de la poitrine, puis pousse vers le haut. Garde les omoplates serrées et le bas du dos en contact avec le banc.",
  }),
  ex({
    slug: "pompes",
    name: "Pompes",
    primary: "chest",
    secondary: ["triceps", "shoulders", "core"],
    pattern: "push_horizontal",
    equipment: [],
    difficulty: "beginner",
    compound: true,
    caution: ["wrist"],
    instructions:
      "Mains un peu plus larges que les épaules, corps gainé de la tête aux talons. Descends la poitrine près du sol, coudes vers l'arrière en diagonale, puis pousse. Trop difficile : fais-les sur les genoux ou mains surélevées.",
  }),
  ex({
    slug: "pompes-genoux",
    name: "Pompes sur les genoux",
    primary: "chest",
    secondary: ["triceps", "shoulders"],
    pattern: "push_horizontal",
    equipment: [],
    difficulty: "beginner",
    compound: true,
    caution: ["wrist"],
    instructions:
      "Comme une pompe, mais en appui sur les genoux. Garde une ligne droite des genoux à la tête et descends la poitrine entre les mains.",
  }),
  ex({
    slug: "presse-pectoraux-machine",
    name: "Presse pectoraux à la machine",
    primary: "chest",
    secondary: ["triceps", "shoulders"],
    pattern: "push_horizontal",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Règle le siège pour que les poignées soient à hauteur du milieu de la poitrine. Pousse sans verrouiller brutalement les coudes et reviens lentement.",
  }),
  ex({
    slug: "ecarte-halteres",
    name: "Écarté aux haltères",
    primary: "chest",
    secondary: ["shoulders"],
    pattern: "isolation",
    equipment: ["dumbbells", "bench"],
    difficulty: "intermediate",
    compound: false,
    caution: ["shoulder"],
    instructions:
      "Allongé, bras au-dessus de la poitrine, coudes légèrement fléchis. Ouvre les bras en arc de cercle jusqu'à un étirement confortable, puis referme comme pour enlacer un arbre.",
  }),
  ex({
    slug: "ecarte-poulie",
    name: "Écarté à la poulie",
    primary: "chest",
    secondary: ["shoulders"],
    pattern: "isolation",
    equipment: ["machines"],
    difficulty: "intermediate",
    compound: false,
    caution: ["shoulder"],
    instructions:
      "Debout entre deux poulies, un pied en avant. Ramène les poignées devant toi en arc de cercle, coudes légèrement fléchis, puis reviens lentement.",
  }),
  ex({
    slug: "developpe-elastique",
    name: "Développé à l'élastique",
    primary: "chest",
    secondary: ["triceps", "shoulders"],
    pattern: "push_horizontal",
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Élastique fixé derrière toi à hauteur de poitrine. Pousse les poignées vers l'avant jusqu'à bras tendus, puis reviens en contrôlant.",
  }),
  ex({
    slug: "dips",
    name: "Dips aux barres parallèles",
    primary: "triceps",
    secondary: ["chest", "shoulders"],
    pattern: "push_vertical",
    equipment: ["machines"],
    difficulty: "advanced",
    compound: true,
    caution: ["shoulder", "elbow"],
    instructions:
      "En appui sur les barres, buste légèrement penché. Descends jusqu'à ce que les épaules soient à hauteur des coudes, pas plus bas, puis pousse.",
  }),

  // --- Dos ----------------------------------------------------------------------------
  ex({
    slug: "tractions",
    name: "Tractions",
    primary: "back",
    secondary: ["biceps", "forearms"],
    pattern: "pull_vertical",
    equipment: ["pull_up_bar"],
    difficulty: "advanced",
    compound: true,
    caution: ["shoulder", "elbow"],
    instructions:
      "Suspendu, mains un peu plus larges que les épaules. Tire en ramenant les coudes vers les hanches jusqu'à passer le menton au-dessus de la barre, puis redescends complètement.",
  }),
  ex({
    slug: "tractions-assistees-elastique",
    name: "Tractions assistées à l'élastique",
    primary: "back",
    secondary: ["biceps"],
    pattern: "pull_vertical",
    equipment: ["pull_up_bar", "resistance_bands"],
    difficulty: "intermediate",
    compound: true,
    caution: ["shoulder"],
    instructions:
      "Accroche un élastique à la barre et place un pied ou un genou dedans. Tire comme une traction : l'élastique t'aide surtout en bas du mouvement.",
  }),
  ex({
    slug: "tirage-vertical",
    name: "Tirage vertical à la poulie",
    primary: "back",
    secondary: ["biceps"],
    pattern: "pull_vertical",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Assis, cuisses calées. Tire la barre vers le haut de la poitrine en ramenant les coudes le long du corps, buste légèrement incliné, puis remonte lentement.",
  }),
  ex({
    slug: "tirage-vertical-elastique",
    name: "Tirage vertical à l'élastique",
    primary: "back",
    secondary: ["biceps"],
    pattern: "pull_vertical",
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Élastique fixé en hauteur. À genoux ou assis, tire les poignées vers le bas jusqu'aux épaules en serrant les omoplates.",
  }),
  ex({
    slug: "rowing-barre",
    name: "Rowing à la barre",
    primary: "back",
    secondary: ["biceps", "hamstrings"],
    pattern: "pull_horizontal",
    equipment: ["barbell"],
    difficulty: "intermediate",
    compound: true,
    caution: ["lower_back"],
    instructions:
      "Buste penché à environ 45°, dos plat, genoux fléchis. Tire la barre vers le nombril en serrant les omoplates, puis redescends sans arrondir le dos.",
  }),
  ex({
    slug: "rowing-haltere-un-bras",
    name: "Rowing haltère à un bras",
    primary: "back",
    secondary: ["biceps"],
    pattern: "pull_horizontal",
    equipment: ["dumbbells", "bench"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Une main et un genou sur le banc, dos plat. Tire l'haltère vers la hanche en gardant le coude près du corps, puis redescends bras tendu.",
  }),
  ex({
    slug: "tirage-horizontal",
    name: "Tirage horizontal à la poulie",
    primary: "back",
    secondary: ["biceps"],
    pattern: "pull_horizontal",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Assis, pieds calés, dos droit. Tire la poignée vers le ventre en serrant les omoplates, sans balancer le buste, puis reviens lentement.",
  }),
  ex({
    slug: "rowing-inverse",
    name: "Rowing inversé",
    primary: "back",
    secondary: ["biceps", "core"],
    pattern: "pull_horizontal",
    equipment: ["pull_up_bar"],
    difficulty: "intermediate",
    compound: true,
    caution: [],
    instructions:
      "Sous une barre basse, corps gainé, talons au sol. Tire la poitrine vers la barre, puis redescends bras tendus. Plus le corps est vertical, plus c'est facile.",
  }),
  ex({
    slug: "rowing-elastique",
    name: "Rowing à l'élastique",
    primary: "back",
    secondary: ["biceps"],
    pattern: "pull_horizontal",
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Élastique fixé devant toi à hauteur de taille. Tire les poignées vers le ventre en serrant les omoplates, puis reviens en contrôlant.",
  }),
  ex({
    slug: "face-pull",
    name: "Face pull à la poulie",
    primary: "shoulders",
    secondary: ["back"],
    pattern: "pull_horizontal",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Corde à hauteur du visage. Tire vers le front en écartant les mains et en ouvrant les coudes vers l'extérieur, puis reviens lentement.",
  }),

  // --- Épaules -------------------------------------------------------------------------
  ex({
    slug: "developpe-militaire-barre",
    name: "Développé militaire à la barre",
    primary: "shoulders",
    secondary: ["triceps", "core"],
    pattern: "push_vertical",
    equipment: ["barbell"],
    difficulty: "intermediate",
    compound: true,
    caution: ["shoulder", "lower_back"],
    instructions:
      "Debout, barre sur le haut de la poitrine, fessiers et abdominaux serrés. Pousse la barre au-dessus de la tête en passant près du visage, sans cambrer le bas du dos.",
  }),
  ex({
    slug: "developpe-epaules-halteres",
    name: "Développé épaules aux haltères",
    primary: "shoulders",
    secondary: ["triceps"],
    pattern: "push_vertical",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: true,
    caution: ["shoulder"],
    instructions:
      "Assis ou debout, haltères à hauteur des épaules. Pousse vers le haut jusqu'à bras presque tendus, puis redescends jusqu'aux oreilles.",
  }),
  ex({
    slug: "developpe-epaules-machine",
    name: "Développé épaules à la machine",
    primary: "shoulders",
    secondary: ["triceps"],
    pattern: "push_vertical",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Règle le siège pour que les poignées partent à hauteur des épaules. Pousse vers le haut et redescends lentement.",
  }),
  ex({
    slug: "developpe-epaules-elastique",
    name: "Développé épaules à l'élastique",
    primary: "shoulders",
    secondary: ["triceps"],
    pattern: "push_vertical",
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    compound: true,
    caution: [],
    instructions:
      "Debout sur l'élastique, poignées à hauteur des épaules. Pousse au-dessus de la tête, puis redescends en contrôlant.",
  }),
  ex({
    slug: "pompes-pike",
    name: "Pompes piquées (pike)",
    primary: "shoulders",
    secondary: ["triceps"],
    pattern: "push_vertical",
    equipment: [],
    difficulty: "intermediate",
    compound: true,
    caution: ["shoulder", "wrist"],
    instructions:
      "Bassin haut, corps en V inversé. Fléchis les coudes pour amener le haut de la tête vers le sol devant les mains, puis pousse.",
  }),
  ex({
    slug: "elevations-laterales",
    name: "Élévations latérales",
    primary: "shoulders",
    secondary: [],
    pattern: "isolation",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Debout, haltères le long du corps. Monte les bras sur les côtés jusqu'à hauteur des épaules, coudes légèrement fléchis, sans élan, puis redescends lentement.",
  }),
  ex({
    slug: "elevations-laterales-elastique",
    name: "Élévations latérales à l'élastique",
    primary: "shoulders",
    secondary: [],
    pattern: "isolation",
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Debout sur l'élastique. Monte les bras sur les côtés jusqu'à hauteur des épaules, puis redescends en contrôlant.",
  }),
  ex({
    slug: "oiseau-halteres",
    name: "Oiseau aux haltères",
    primary: "shoulders",
    secondary: ["back"],
    pattern: "isolation",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: false,
    caution: ["lower_back"],
    instructions:
      "Buste penché en avant, dos plat. Écarte les bras sur les côtés en serrant les omoplates, coudes légèrement fléchis, puis redescends.",
  }),

  // --- Bras ---------------------------------------------------------------------------
  ex({
    slug: "curl-halteres",
    name: "Curl aux haltères",
    primary: "biceps",
    secondary: ["forearms"],
    pattern: "isolation",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Debout, coudes collés au corps. Fléchis les bras en tournant les paumes vers le haut, puis redescends complètement sans balancer.",
  }),
  ex({
    slug: "curl-barre",
    name: "Curl à la barre",
    primary: "biceps",
    secondary: ["forearms"],
    pattern: "isolation",
    equipment: ["barbell"],
    difficulty: "beginner",
    compound: false,
    caution: ["elbow"],
    instructions:
      "Debout, prise en supination à largeur d'épaules. Monte la barre en gardant les coudes fixes, puis redescends lentement.",
  }),
  ex({
    slug: "curl-marteau",
    name: "Curl marteau",
    primary: "biceps",
    secondary: ["forearms"],
    pattern: "isolation",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Paumes face à face, comme pour tenir un marteau. Fléchis les bras sans décoller les coudes, puis redescends.",
  }),
  ex({
    slug: "curl-elastique",
    name: "Curl à l'élastique",
    primary: "biceps",
    secondary: [],
    pattern: "isolation",
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Debout sur l'élastique, coudes au corps. Fléchis les bras, puis redescends en contrôlant la tension.",
  }),
  ex({
    slug: "curl-poulie",
    name: "Curl à la poulie",
    primary: "biceps",
    secondary: [],
    pattern: "isolation",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Face à la poulie basse, coudes au corps. Fléchis les bras, marque un temps en haut, puis reviens lentement.",
  }),
  ex({
    slug: "extension-triceps-poulie",
    name: "Extension des triceps à la poulie",
    primary: "triceps",
    secondary: [],
    pattern: "isolation",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Face à la poulie haute, coudes collés au corps. Pousse la barre ou la corde vers le bas jusqu'à bras tendus, puis remonte sans bouger les coudes.",
  }),
  ex({
    slug: "extension-triceps-haltere",
    name: "Extension des triceps à l'haltère au-dessus de la tête",
    primary: "triceps",
    secondary: [],
    pattern: "isolation",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: false,
    caution: ["elbow", "shoulder"],
    instructions:
      "Assis, un haltère tenu à deux mains au-dessus de la tête. Descends-le derrière la nuque en pliant les coudes, qui restent pointés vers le haut, puis remonte.",
  }),
  ex({
    slug: "dips-banc",
    name: "Dips sur banc",
    primary: "triceps",
    secondary: ["chest"],
    pattern: "isolation",
    equipment: ["bench"],
    difficulty: "beginner",
    compound: false,
    caution: ["shoulder", "wrist"],
    instructions:
      "Mains sur le bord du banc derrière toi, jambes devant. Descends en pliant les coudes vers l'arrière jusqu'à 90°, puis pousse.",
  }),
  ex({
    slug: "extension-triceps-elastique",
    name: "Extension des triceps à l'élastique",
    primary: "triceps",
    secondary: [],
    pattern: "isolation",
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Élastique fixé en hauteur. Coudes au corps, tends les bras vers le bas, puis reviens en contrôlant.",
  }),
  ex({
    slug: "pompes-serrees",
    name: "Pompes mains serrées",
    primary: "triceps",
    secondary: ["chest"],
    pattern: "push_horizontal",
    equipment: [],
    difficulty: "intermediate",
    compound: true,
    caution: ["wrist", "elbow"],
    instructions:
      "Mains sous les épaules, coudes qui frôlent le buste. Descends la poitrine vers les mains, puis pousse.",
  }),

  // --- Cuisses : quadriceps --------------------------------------------------------------
  ex({
    slug: "squat-barre",
    name: "Squat à la barre",
    primary: "quadriceps",
    secondary: ["glutes", "core"],
    pattern: "squat",
    equipment: ["barbell"],
    difficulty: "intermediate",
    compound: true,
    caution: ["knee", "lower_back"],
    instructions:
      "Barre sur le haut du dos, pieds à largeur d'épaules. Descends en poussant les hanches en arrière et les genoux dans l'axe des pieds, dos droit, puis remonte en poussant dans le sol. Utilise des sécurités.",
  }),
  ex({
    slug: "goblet-squat",
    name: "Goblet squat",
    primary: "quadriceps",
    secondary: ["glutes", "core"],
    pattern: "squat",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: true,
    caution: ["knee"],
    instructions:
      "Un haltère tenu contre la poitrine. Descends entre tes genoux, buste droit, puis remonte en poussant dans les talons.",
  }),
  ex({
    slug: "goblet-squat-kettlebell",
    name: "Goblet squat au kettlebell",
    primary: "quadriceps",
    secondary: ["glutes", "core"],
    pattern: "squat",
    equipment: ["kettlebell"],
    difficulty: "beginner",
    compound: true,
    caution: ["knee"],
    instructions:
      "Kettlebell tenu par les anses contre la poitrine. Descends buste droit, genoux dans l'axe des pieds, puis remonte.",
  }),
  ex({
    slug: "squat-poids-du-corps",
    name: "Squat au poids du corps",
    primary: "quadriceps",
    secondary: ["glutes"],
    pattern: "squat",
    equipment: [],
    difficulty: "beginner",
    compound: true,
    caution: ["knee"],
    instructions:
      "Pieds à largeur d'épaules, bras devant. Descends comme pour t'asseoir, talons au sol, puis remonte. Tu peux t'aider d'une chaise derrière toi.",
  }),
  ex({
    slug: "presse-cuisses",
    name: "Presse à cuisses",
    primary: "quadriceps",
    secondary: ["glutes"],
    pattern: "squat",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: true,
    caution: ["knee"],
    instructions:
      "Dos bien calé, pieds à largeur d'épaules sur la plateforme. Descends jusqu'à environ 90° aux genoux sans décoller le bas du dos, puis pousse sans verrouiller les genoux.",
  }),
  ex({
    slug: "squat-bulgare",
    name: "Squat bulgare",
    primary: "quadriceps",
    secondary: ["glutes"],
    pattern: "lunge",
    equipment: ["dumbbells", "bench"],
    difficulty: "intermediate",
    compound: true,
    caution: ["knee"],
    instructions:
      "Pied arrière posé sur le banc, haltères en main. Descends le genou arrière vers le sol, buste droit, puis remonte en poussant sur la jambe avant.",
  }),
  ex({
    slug: "fentes-arriere",
    name: "Fentes arrière",
    primary: "quadriceps",
    secondary: ["glutes"],
    pattern: "lunge",
    equipment: [],
    difficulty: "beginner",
    compound: true,
    caution: ["knee"],
    instructions:
      "Fais un grand pas en arrière et descends le genou arrière près du sol, puis reviens à la position de départ. Alterne les jambes.",
  }),
  ex({
    slug: "fentes-marchees-halteres",
    name: "Fentes marchées aux haltères",
    primary: "quadriceps",
    secondary: ["glutes"],
    pattern: "lunge",
    equipment: ["dumbbells"],
    difficulty: "intermediate",
    compound: true,
    caution: ["knee"],
    instructions:
      "Haltères en main, avance en fentes : genou arrière près du sol, genou avant au-dessus de la cheville.",
  }),
  ex({
    slug: "leg-extension",
    name: "Leg extension",
    primary: "quadriceps",
    secondary: [],
    pattern: "isolation",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: false,
    caution: ["knee"],
    instructions:
      "Assis, rouleau sur le bas des tibias. Tends les jambes, marque un temps, puis redescends lentement.",
  }),
  ex({
    slug: "montees-sur-banc",
    name: "Montées sur banc",
    primary: "quadriceps",
    secondary: ["glutes"],
    pattern: "lunge",
    equipment: ["bench"],
    difficulty: "beginner",
    compound: true,
    caution: ["knee"],
    instructions:
      "Monte sur le banc en poussant sur la jambe posée dessus, sans t'aider de l'autre, puis redescends en contrôlant.",
  }),
  ex({
    slug: "chaise-murale",
    name: "Chaise contre le mur",
    primary: "quadriceps",
    secondary: ["glutes"],
    pattern: "isolation",
    equipment: [],
    difficulty: "beginner",
    compound: false,
    timed: true,
    caution: ["knee"],
    instructions:
      "Dos contre le mur, cuisses parallèles au sol, genoux au-dessus des chevilles. Tiens la position en respirant normalement.",
  }),

  // --- Ischios et fessiers --------------------------------------------------------------
  ex({
    slug: "souleve-de-terre-roumain",
    name: "Soulevé de terre roumain",
    primary: "hamstrings",
    secondary: ["glutes", "back"],
    pattern: "hinge",
    equipment: ["barbell"],
    difficulty: "intermediate",
    compound: true,
    caution: ["lower_back"],
    instructions:
      "Debout, barre contre les cuisses, genoux légèrement fléchis. Pousse les hanches en arrière en gardant le dos plat et la barre près des jambes, jusqu'à l'étirement des ischios, puis remonte.",
  }),
  ex({
    slug: "souleve-de-terre-roumain-halteres",
    name: "Soulevé de terre roumain aux haltères",
    primary: "hamstrings",
    secondary: ["glutes"],
    pattern: "hinge",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: true,
    caution: ["lower_back"],
    instructions:
      "Haltères devant les cuisses. Bascule le buste en poussant les hanches en arrière, dos plat, jusqu'à mi-tibia, puis remonte en serrant les fessiers.",
  }),
  ex({
    slug: "souleve-de-terre",
    name: "Soulevé de terre",
    primary: "hamstrings",
    secondary: ["glutes", "back", "quadriceps"],
    pattern: "hinge",
    equipment: ["barbell"],
    difficulty: "advanced",
    compound: true,
    caution: ["lower_back"],
    instructions:
      "Barre au-dessus du milieu des pieds. Saisis-la, dos plat, poitrine sortie. Pousse dans le sol pour te redresser en gardant la barre contre les jambes, puis repose-la en contrôlant.",
  }),
  ex({
    slug: "swing-kettlebell",
    name: "Swing au kettlebell",
    primary: "glutes",
    secondary: ["hamstrings", "core"],
    pattern: "hinge",
    equipment: ["kettlebell"],
    difficulty: "intermediate",
    compound: true,
    caution: ["lower_back"],
    instructions:
      "Le mouvement vient des hanches, pas des bras : bascule le kettlebell entre les jambes, dos plat, puis projette les hanches vers l'avant pour l'envoyer à hauteur de poitrine.",
  }),
  ex({
    slug: "hip-thrust-barre",
    name: "Hip thrust à la barre",
    primary: "glutes",
    secondary: ["hamstrings"],
    pattern: "hinge",
    equipment: ["barbell", "bench"],
    difficulty: "intermediate",
    compound: true,
    caution: [],
    instructions:
      "Haut du dos sur le banc, barre sur les hanches (avec une protection). Pousse les hanches vers le haut jusqu'à l'alignement épaules-genoux en serrant les fessiers, puis redescends.",
  }),
  ex({
    slug: "pont-fessier",
    name: "Pont fessier",
    primary: "glutes",
    secondary: ["hamstrings"],
    pattern: "hinge",
    equipment: [],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Allongé sur le dos, pieds à plat près des fesses. Monte le bassin en serrant les fessiers, marque un temps en haut, puis redescends.",
  }),
  ex({
    slug: "pont-fessier-une-jambe",
    name: "Pont fessier sur une jambe",
    primary: "glutes",
    secondary: ["hamstrings"],
    pattern: "hinge",
    equipment: [],
    difficulty: "intermediate",
    compound: false,
    caution: [],
    instructions:
      "Comme le pont fessier, une jambe tendue en l'air. Garde le bassin bien horizontal en montant.",
  }),
  ex({
    slug: "leg-curl",
    name: "Leg curl",
    primary: "hamstrings",
    secondary: [],
    pattern: "isolation",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Rouleau au-dessus des talons. Plie les genoux en ramenant les talons vers les fesses, puis reviens lentement.",
  }),
  ex({
    slug: "leg-curl-elastique",
    name: "Leg curl à l'élastique",
    primary: "hamstrings",
    secondary: [],
    pattern: "isolation",
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Allongé sur le ventre, élastique fixé devant et passé autour des chevilles. Ramène les talons vers les fesses, puis reviens.",
  }),

  // --- Mollets -----------------------------------------------------------------------
  ex({
    slug: "mollets-debout",
    name: "Extensions des mollets debout",
    primary: "calves",
    secondary: [],
    pattern: "isolation",
    equipment: [],
    difficulty: "beginner",
    compound: false,
    caution: ["ankle"],
    instructions:
      "Avant des pieds sur une marche, talons dans le vide. Monte sur la pointe des pieds, marque un temps, puis descends les talons sous la marche.",
  }),
  ex({
    slug: "mollets-machine",
    name: "Mollets à la machine",
    primary: "calves",
    secondary: [],
    pattern: "isolation",
    equipment: ["machines"],
    difficulty: "beginner",
    compound: false,
    caution: ["ankle"],
    instructions:
      "Avant des pieds sur la plateforme. Monte sur la pointe des pieds le plus haut possible, puis descends lentement.",
  }),

  // --- Gainage ------------------------------------------------------------------------
  ex({
    slug: "gainage-planche",
    name: "Planche (gainage)",
    primary: "core",
    secondary: ["shoulders"],
    pattern: "core",
    equipment: [],
    difficulty: "beginner",
    compound: false,
    timed: true,
    caution: [],
    instructions:
      "En appui sur les avant-bras et les pointes de pieds, corps aligné. Serre les fessiers et le ventre, sans laisser tomber le bassin.",
  }),
  ex({
    slug: "gainage-lateral",
    name: "Gainage latéral",
    primary: "core",
    secondary: ["glutes"],
    pattern: "core",
    equipment: [],
    difficulty: "beginner",
    compound: false,
    timed: true,
    caution: ["shoulder"],
    instructions:
      "Sur le côté, en appui sur un avant-bras. Monte le bassin pour aligner épaules, hanches et pieds. Change de côté à chaque série.",
  }),
  ex({
    slug: "dead-bug",
    name: "Dead bug",
    primary: "core",
    secondary: [],
    pattern: "core",
    equipment: [],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "Sur le dos, bras tendus vers le plafond, genoux à 90°. Allonge un bras et la jambe opposée sans décoller le bas du dos du sol, puis alterne.",
  }),
  ex({
    slug: "bird-dog",
    name: "Bird dog",
    primary: "core",
    secondary: ["glutes", "back"],
    pattern: "core",
    equipment: [],
    difficulty: "beginner",
    compound: false,
    caution: [],
    instructions:
      "À quatre pattes, tends un bras et la jambe opposée en gardant le dos plat et le bassin immobile, puis alterne.",
  }),
  ex({
    slug: "releves-genoux-suspendu",
    name: "Relevés de genoux suspendu",
    primary: "core",
    secondary: ["forearms"],
    pattern: "core",
    equipment: ["pull_up_bar"],
    difficulty: "intermediate",
    compound: false,
    caution: ["shoulder"],
    instructions:
      "Suspendu à la barre, ramène les genoux vers la poitrine en enroulant le bassin, sans te balancer, puis redescends lentement.",
  }),
  ex({
    slug: "mountain-climbers",
    name: "Mountain climbers",
    primary: "core",
    secondary: ["shoulders", "cardio"],
    pattern: "core",
    equipment: [],
    difficulty: "intermediate",
    compound: false,
    timed: true,
    caution: ["wrist"],
    instructions:
      "En position de pompe, ramène alternativement les genoux vers la poitrine à un rythme soutenu, bassin stable.",
  }),

  // --- Corps entier --------------------------------------------------------------------
  ex({
    slug: "marche-du-fermier",
    name: "Marche du fermier",
    primary: "full_body",
    secondary: ["forearms", "core"],
    pattern: "carry",
    equipment: ["dumbbells"],
    difficulty: "beginner",
    compound: true,
    timed: true,
    caution: [],
    instructions:
      "Un haltère lourd dans chaque main, marche à petits pas, épaules basses et buste droit.",
  }),
  ex({
    slug: "burpees",
    name: "Burpees",
    primary: "full_body",
    secondary: ["chest", "quadriceps", "cardio"],
    pattern: "cardio",
    equipment: [],
    difficulty: "intermediate",
    compound: true,
    caution: ["knee", "wrist"],
    instructions:
      "Accroupis, mains au sol, lance les pieds en arrière, ramène-les, puis saute bras en l'air. Version douce : sans pompe ni saut.",
  }),
];
