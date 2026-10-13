/**
 * Proposition d'une STRUCTURE d'entraînement à partir du nombre de séances.
 * Règle simple et explicite ; le programme détaillé relève du module Entraînement.
 */
export type ProgramStructure = "walking" | "full_body" | "upper_lower" | "push_pull_legs";

export function suggestProgramStructure(sessionsPerWeek: number): ProgramStructure {
  if (sessionsPerWeek <= 0) return "walking";
  // Jusqu'à 3 séances : chaque groupe musculaire est travaillé à chaque séance.
  if (sessionsPerWeek <= 3) return "full_body";
  // 4 séances : deux « haut » et deux « bas ».
  if (sessionsPerWeek === 4) return "upper_lower";
  // 5 séances et plus : répartition pousser / tirer / jambes.
  return "push_pull_legs";
}
