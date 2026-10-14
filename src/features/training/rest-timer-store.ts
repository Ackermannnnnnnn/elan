"use client";

import { type PlanItem, type PlanStep, planAfterSet } from "@/domain/session-flow";

/**
 * Minuteur de repos, PARTAGÉ par toute l'application : il continue (barre,
 * bips, vibration, notification) quand on quitte la page de la séance pour
 * consulter un exercice, le journal ou l'accueil. Un seul repos à la fois.
 *
 * Le « prochain exercice » n'est jamais figé : il est recalculé à partir du
 * plan ACTUEL de la séance (ordre, séries faites), transmis par la page de la
 * séance à chaque affichage (`setPlan`). Les séries validées à l'instant, pas
 * encore confirmées par le serveur, comptent déjà comme faites.
 */

export type RestFrom = { itemId: string; setNumber: number };

export type ActiveTimer =
  | { sessionId: string; kind: "rest"; endsAt: number; total: number; from: RestFrom }
  | { sessionId: string; kind: "chain"; at: number; from: RestFrom }
  | { sessionId: string; kind: "finished"; at: number };

type Snapshot = {
  active: ActiveTimer | null;
  /** Plan de la séance du minuteur (dernier connu). */
  plan: readonly PlanItem[];
  /** Séries validées dans ce navigateur, en attente de confirmation (« itemId:série »). */
  pending: ReadonlySet<string>;
};

const STORAGE_KEY = "elan.rest.active";

const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      // Sans stockage, le minuteur fonctionne quand même (sans reprise après rechargement).
    }
  },
};

let snapshot: Snapshot = { active: null, plan: [], pending: new Set() };
let plans = new Map<string, readonly PlanItem[]>();
const overrides = new Map<string, number>();
const listeners = new Set<() => void>();
let restored = false;

function emit(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function persist() {
  const { active } = snapshot;
  storage.set(
    STORAGE_KEY,
    active ? JSON.stringify({ active, plan: plans.get(active.sessionId) ?? snapshot.plan }) : null,
  );
}

/** Reprise après rechargement (une fois, dans le navigateur). */
function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  const saved = storage.get(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved) as { active: ActiveTimer; plan: PlanItem[] };
    const stale =
      parsed.active.kind === "rest"
        ? parsed.active.endsAt < Date.now() - 60_000
        : parsed.active.at < Date.now() - 60_000;
    if (stale) {
      storage.set(STORAGE_KEY, null);
      return;
    }
    if (!plans.has(parsed.active.sessionId)) plans.set(parsed.active.sessionId, parsed.plan);
    snapshot = {
      ...snapshot,
      active: parsed.active,
      plan: plans.get(parsed.active.sessionId) ?? parsed.plan,
    };
  } catch {
    storage.set(STORAGE_KEY, null);
  }
}

export function subscribe(listener: () => void) {
  restore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Snapshot {
  restore();
  return snapshot;
}

const EMPTY: Snapshot = { active: null, plan: [], pending: new Set() };
export function getServerSnapshot(): Snapshot {
  return EMPTY;
}

const key = (from: RestFrom) => `${from.itemId}:${from.setNumber}`;

/** Plan avec les séries validées à l'instant comptées comme faites. */
function effectivePlan(plan: readonly PlanItem[], pending: ReadonlySet<string>): PlanItem[] {
  return plan.map((item) => ({
    ...item,
    sets: item.sets.map((set) =>
      set.done || !pending.has(`${item.id}:${set.setNumber}`) ? set : { ...set, done: true },
    ),
  }));
}

/** Étape suivante d'après le plan actuel (pour l'affichage). */
export function stepFor(state: Snapshot, from: RestFrom): PlanStep {
  return planAfterSet(effectivePlan(state.plan, state.pending), from);
}

/** La page de la séance transmet son plan à chaque affichage. */
export function setPlan(sessionId: string, plan: readonly PlanItem[]) {
  plans.set(sessionId, plan);
  // Les séries confirmées par le serveur ne sont plus « en attente ».
  const confirmed = new Set(
    plan.flatMap((item) =>
      item.sets.filter((set) => set.done).map((set) => `${item.id}:${set.setNumber}`),
    ),
  );
  const pending = new Set([...snapshot.pending].filter((entry) => !confirmed.has(entry)));
  if (snapshot.active?.sessionId === sessionId || !snapshot.active) {
    emit({ plan, pending });
    if (snapshot.active) persist();
  } else {
    emit({ pending });
  }
}

/** Repos choisi à l'instant pour un exercice (avant que la page ne soit rechargée). */
export function setOverride(itemId: string, seconds: number) {
  overrides.set(itemId, seconds);
}

/**
 * Une série vient d'être validée : repos, enchaînement de superset, ou fin de
 * séance, selon le plan actuel.
 */
export function startAfterSet(sessionId: string, from: RestFrom) {
  const pending = new Set(snapshot.pending).add(key(from));
  const plan = plans.get(sessionId) ?? [];
  const step = planAfterSet(effectivePlan(plan, pending), from);
  let active: ActiveTimer | null = null;
  if (step.kind === "rest") {
    const seconds = Math.max(
      0,
      ...step.sources.map(
        (id) => overrides.get(id) ?? plan.find((item) => item.id === id)?.restSeconds ?? 0,
      ),
    );
    if (seconds > 0) {
      active = {
        sessionId,
        kind: "rest",
        endsAt: Date.now() + seconds * 1000,
        total: seconds,
        from,
      };
    }
  } else if (step.kind === "chain") {
    active = { sessionId, kind: "chain", at: Date.now(), from };
  } else if (step.kind === "finished") {
    active = { sessionId, kind: "finished", at: Date.now() };
  }
  emit({ active, plan, pending });
  persist();
}

/** La série n'a pas pu être enregistrée : on annule. */
export function cancelSet(sessionId: string, from: RestFrom) {
  const pending = new Set(snapshot.pending);
  pending.delete(key(from));
  const active = snapshot.active;
  const sameSet =
    active &&
    active.sessionId === sessionId &&
    active.kind !== "finished" &&
    active.from.itemId === from.itemId &&
    active.from.setNumber === from.setNumber;
  emit({ pending, active: sameSet || active?.kind === "finished" ? null : active });
  persist();
}

/** Séance terminée ou abandonnée : son minuteur disparaît. */
export function stopFor(sessionId: string) {
  if (snapshot.active?.sessionId === sessionId) stop();
}

export function stop() {
  emit({ active: null });
  persist();
}

/** ±15 s pendant le repos. */
export function adjust(deltaSeconds: number) {
  const active = snapshot.active;
  if (active?.kind !== "rest") return;
  const endsAt = Math.max(Date.now() + 1000, active.endsAt + deltaSeconds * 1000);
  emit({
    active: {
      ...active,
      endsAt,
      total: Math.max(active.total, Math.round((endsAt - Date.now()) / 1000)),
    },
  });
  persist();
}

/** Pour les tests : repart d'un état vide. */
export function resetForTests() {
  snapshot = { active: null, plan: [], pending: new Set() };
  plans = new Map();
  overrides.clear();
  restored = false;
}
