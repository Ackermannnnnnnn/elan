/**
 * Listes de choix de l'onboarding. Ce sont des CODES stables enregistrés en
 * base ; leurs libellés sont dans messages/fr.json (namespace `Options`).
 */

export const SEX_OPTIONS = ["female", "male", "unspecified"] as const;

export const OCCUPATION_TYPES = ["sedentary", "standing", "active", "physical"] as const;

export const TRAINING_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export const TRAINING_LOCATIONS = ["gym", "home", "both", "outdoor"] as const;

export const TRAINING_EQUIPMENT = [
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

export const DIET_TYPES = [
  "omnivore",
  "flexitarian",
  "pescatarian",
  "vegetarian",
  "vegan",
] as const;

/** Les 14 allergènes à déclaration obligatoire dans l'Union européenne (règlement INCO). */
export const EU_ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

export const COOKING_SKILLS = ["beginner", "intermediate", "advanced"] as const;

export const MEAL_STYLES = ["budget", "quick", "varied", "repetitive"] as const;

export const KITCHEN_EQUIPMENT = [
  "stove",
  "oven",
  "microwave",
  "air_fryer",
  "blender",
  "rice_cooker",
  "freezer",
] as const;
