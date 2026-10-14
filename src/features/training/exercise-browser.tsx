import { Check, ChevronRight, Plus, Search, TriangleAlert } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { type Exercise, type TrainingSettings, toLibraryExercise } from "@/data/training";
import { type Equipment, MUSCLES, type Muscle } from "@/domain/exercise-catalog";
import { aliasesFor } from "@/domain/exercise-aliases";
import { filterExercises } from "@/domain/exercise-search";
import { availableEquipment, suitsLevel } from "@/domain/training-program";
import {
  addSessionExerciseAction,
  addWorkoutExerciseAction,
  swapSessionExerciseAction,
} from "./actions";
import { demoFor } from "./demo";
import { MovementDemo } from "./movement-demo";
import { exerciseUrl } from "./urls";

export type BrowserSearch = { q: string; muscle: Muscle | null; mine: boolean };

/** Lit les filtres de l'URL (?q=…&muscle=…&materiel=1) sans faire confiance à leur contenu. */
export function readBrowserSearch(
  search: Record<string, string | string[] | undefined>,
): BrowserSearch {
  const q = typeof search.q === "string" ? search.q.slice(0, 80) : "";
  const muscle = MUSCLES.find((value) => value === search.muscle) ?? null;
  return { q, muscle, mine: search.materiel === "1" };
}

/**
 * Bibliothèque d'exercices filtrable. Avec `addTo`, chaque exercice peut être
 * ajouté à la séance indiquée ; sinon il mène à sa fiche.
 * Les exercices sont affichés tels quels, avec un avertissement (zone sensible,
 * niveau, matériel) plutôt qu'un filtrage : c'est l'utilisateur qui compose.
 */
export async function ExerciseBrowser({
  exercises,
  settings,
  search,
  path,
  addTo,
  keep = {},
}: {
  exercises: readonly Exercise[];
  settings: TrainingSettings;
  search: BrowserSearch;
  /** Adresse de la page (le formulaire de filtres y renvoie). */
  path: string;
  /**
   * Choix d'un exercice : l'ajouter à une séance type (`workout`), à la séance
   * en cours (`session`), ou remplacer un exercice de la séance en cours (`swap`).
   */
  addTo?: {
    kind: "workout" | "session" | "swap";
    targetId: string;
    existing: readonly string[];
    inProgram?: boolean;
  };
  /** Paramètres d'URL à conserver quand on filtre. */
  keep?: Record<string, string>;
}) {
  const t = await getTranslations("Training");
  const tOptions = await getTranslations("Options");
  const available = availableEquipment(settings.location, settings.equipment);
  const results = filterExercises(
    exercises.map((exercise) => ({
      exercise,
      name: exercise.name,
      primary: exercise.primary_muscle as Muscle,
      equipment: exercise.equipment as Equipment[],
      aliases: aliasesFor(exercise.owner_id === null ? exercise.slug : null),
    })),
    { query: search.q, muscle: search.muscle, equipment: search.mine ? available : null },
  );
  const filtered = search.q !== "" || search.muscle !== null || search.mine;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        {/* Clé = filtres de l'URL : les champs se réinitialisent après « Effacer les filtres ». */}
        <Form
          key={`${search.q}|${search.muscle ?? ""}|${search.mine}`}
          action={path}
          className="flex flex-col gap-4"
          role="search"
        >
          {Object.entries(keep).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="exercise-q">{t("browser.search")}</Label>
              <Input
                id="exercise-q"
                name="q"
                type="search"
                defaultValue={search.q}
                placeholder={t("browser.searchPlaceholder")}
                maxLength={80}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exercise-muscle">{t("browser.muscle")}</Label>
              <Select id="exercise-muscle" name="muscle" defaultValue={search.muscle ?? ""}>
                <option value="">{t("browser.allMuscles")}</option>
                {MUSCLES.map((muscle) => (
                  <option key={muscle} value={muscle}>
                    {t(`muscle.${muscle}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[0.9375rem]">
              <input
                type="checkbox"
                name="materiel"
                value="1"
                defaultChecked={search.mine}
                className="size-5 accent-primary"
              />
              {t("browser.mine")}
            </label>
            <div className="flex flex-wrap gap-2">
              {filtered ? (
                <Button asChild variant="ghost">
                  <Link href={path}>{t("browser.reset")}</Link>
                </Button>
              ) : null}
              <Button type="submit" variant="secondary">
                <Search aria-hidden="true" />
                {t("browser.filter")}
              </Button>
            </div>
          </div>
        </Form>
      </Card>

      <p role="status" className="text-sm font-semibold text-muted-foreground">
        {t("browser.results", { count: results.length })}
      </p>

      {results.length === 0 ? (
        <p className="text-muted-foreground">{t("browser.noResults")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map(({ exercise }) => {
            const own = exercise.owner_id !== null;
            const cautions = exercise.caution_areas.filter((area) =>
              settings.limitations.includes(area as never),
            );
            const level = exercise.difficulty;
            const tooHard = !own && !suitsLevel(toLibraryExercise(exercise), settings.level);
            const missingEquipment = !exercise.equipment.every((item) =>
              available.includes(item as Equipment),
            );
            const inWorkout = addTo?.existing.includes(exercise.id) ?? false;
            return (
              <li key={exercise.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold">
                        <Link
                          href={exerciseUrl(exercise.id)}
                          className="underline-offset-4 hover:underline"
                        >
                          {exercise.name}
                        </Link>
                      </h2>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge>{t(`muscle.${exercise.primary_muscle}`)}</Badge>
                        <Badge>
                          {exercise.equipment.length === 0
                            ? t("bodyweight")
                            : exercise.equipment
                                .map((item) => tOptions(`equipment.${item}` as never))
                                .join(", ")}
                        </Badge>
                        {own ? (
                          <Badge variant="primary">{t("browser.own")}</Badge>
                        ) : (
                          <Badge>{tOptions(`trainingLevel.${level}`)}</Badge>
                        )}
                      </div>
                      {cautions.length > 0 || tooHard || missingEquipment ? (
                        <ul className="mt-2 flex flex-col gap-1 text-sm text-warning">
                          {cautions.length > 0 ? (
                            <li className="flex items-center gap-1.5">
                              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                              {t("browser.cautionWarning", {
                                areas: cautions
                                  .map((area) => t(`area.${area}` as never))
                                  .join(", "),
                              })}
                            </li>
                          ) : null}
                          {tooHard ? (
                            <li className="flex items-center gap-1.5">
                              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                              {t("browser.levelWarning", {
                                level: tOptions(`trainingLevel.${level}`).toLowerCase(),
                              })}
                            </li>
                          ) : null}
                          {missingEquipment ? (
                            <li className="flex items-center gap-1.5">
                              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                              {t("browser.equipmentWarning")}
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </div>
                    {addTo ? (
                      inWorkout ? (
                        <span className="inline-flex h-9 items-center gap-1.5 text-sm font-semibold text-primary">
                          <Check aria-hidden="true" className="size-4" />
                          {addTo.kind === "workout" ? t("browser.added") : t("browser.inSession")}
                        </span>
                      ) : (
                        <ActionButton
                          action={
                            addTo.kind === "workout"
                              ? addWorkoutExerciseAction.bind(null, addTo.targetId, exercise.id)
                              : addTo.kind === "session"
                                ? addSessionExerciseAction.bind(null, addTo.targetId, exercise.id)
                                : swapSessionExerciseAction.bind(
                                    null,
                                    addTo.targetId,
                                    exercise.id,
                                    addTo.inProgram ?? false,
                                  )
                          }
                          pendingLabel={t("browser.adding")}
                          size="sm"
                          aria-label={
                            addTo.kind === "swap"
                              ? t("browser.pickLabel", { name: exercise.name })
                              : addTo.kind === "session"
                                ? t("browser.addToSessionLabel", { name: exercise.name })
                                : t("browser.addLabel", { name: exercise.name })
                          }
                        >
                          {addTo.kind === "swap" ? null : <Plus aria-hidden="true" />}
                          {addTo.kind === "swap" ? t("browser.pick") : t("browser.add")}
                        </ActionButton>
                      )
                    ) : (
                      <Button asChild variant="ghost" size="icon">
                        <Link href={exerciseUrl(exercise.id)} aria-label={t("browser.details")}>
                          <ChevronRight aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </div>
                  <MovementDemo {...demoFor(exercise)} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
