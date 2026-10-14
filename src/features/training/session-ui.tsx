"use client";

import { Check, Pause, Play, SkipForward, Timer, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FormProvider } from "react-hook-form";
import { useFieldError } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import { UnitInput } from "@/components/ui/unit-input";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import type { PlanItem } from "@/domain/session-flow";
import { restAlarmEnabled, scheduleRestAlarm } from "@/features/notifications/push-client";
import {
  adjust,
  cancelSet,
  getServerSnapshot,
  getSnapshot,
  setOverride,
  setPlan,
  startAfterSet,
  stepFor,
  stop,
  subscribe,
} from "./rest-timer-store";
import { type SetFormValues, setSchema } from "./schemas";
import { sessionUrl } from "./urls";

const clock = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
};

/** Stockage du navigateur : peut être indisponible (navigation privée…). */
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

// --- Son et vibration ------------------------------------------------------------------

let audio: AudioContext | null = null;

/** Débloque le son au premier geste (exigé par les navigateurs mobiles). */
function unlockAudio() {
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    audio ??= new Context();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

function beep(frequency: number, duration: number, volume = 0.25) {
  if (!audio) return;
  try {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  } catch {
    // Pas de son disponible : la vibration et l'affichage suffisent.
  }
}

const vibrate = (pattern: number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration non prise en charge (ordinateur, iPhone).
  }
};

// --- Minuteur de repos ------------------------------------------------------------------

const useRestTimer = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

/** Pour le sélecteur de repos : le minuteur utilise aussitôt le nouveau temps. */
export const useRestOverride = () => setOverride;

/** Transmet au minuteur le plan actuel de la séance (ordre, séries faites). */
export function SessionPlanSync({ sessionId, plan }: { sessionId: string; plan: PlanItem[] }) {
  const serialized = JSON.stringify(plan);
  useEffect(() => {
    setPlan(sessionId, JSON.parse(serialized) as PlanItem[]);
  }, [sessionId, serialized]);
  return null;
}

/** Notification locale de secours (application en arrière-plan, sans notification serveur). */
async function localRestNotification(title: string, body: string, url: string) {
  try {
    if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    await registration?.showNotification(title, {
      body,
      tag: "elan-rest",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url },
    });
  } catch {
    // Notifications indisponibles : la barre, le son et la vibration restent.
  }
}

/**
 * Minuteur de repos de TOUTE l'application (monté dans la mise en page) :
 * grande barre fixée en bas de l'écran, ±15 s, passer, bips 3-2-1 et
 * vibration à la fin, même si l'on a quitté la page de la séance. Il repose
 * sur l'heure de fin, donc reste juste si l'écran s'éteint ou si la page est
 * rechargée. Fin de repos téléphone verrouillé : notification du serveur si
 * elle est activée sur l'appareil, sinon notification locale si l'application
 * est en arrière-plan.
 */
export function RestTimerHost() {
  const t = useTranslations("Training.session");
  const tPush = useTranslations("Push.rest");
  const pathname = usePathname();
  const state = useRestTimer();
  const active = state.active;
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(true);
  const lastCue = useRef<number | null>(null);
  const finishedRef = useRef<string | null>(null);
  const alarm = useRef<string | null>(null);

  // Réglage du son ; le son se débloque au premier geste (exigé par les mobiles).
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSound(storage.get("elan.rest.muted") !== "1"));
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [active]);

  const step = active && active.kind !== "finished" ? stepFor(state, active.from) : null;
  const next = step && step.kind !== "finished" ? step.next : null;
  const nextLabel = next ? t("nextSet", { name: next.name, number: next.setNumber }) : null;
  const sessionHref = active ? sessionUrl(active.sessionId) : null;
  const onSessionPage = sessionHref !== null && pathname === sessionHref;

  // Un repos = une alarme serveur (si activée sur l'appareil), annulée si on passe le repos.
  const restKey = active?.kind === "rest" ? `${active.sessionId}:${active.endsAt}` : null;
  useEffect(() => {
    if (active?.kind === "rest" && restKey) {
      if (alarm.current === restKey || !restAlarmEnabled()) return;
      const seconds = Math.round((active.endsAt - Date.now()) / 1000);
      if (seconds < 1) return;
      alarm.current = restKey;
      scheduleRestAlarm({ seconds, detail: nextLabel, sessionId: active.sessionId });
    } else if (alarm.current) {
      const previous = alarm.current;
      alarm.current = null;
      // Repos terminé normalement : l'alarme est partie d'elle-même.
      if (finishedRef.current !== previous) scheduleRestAlarm(null);
    }
    // nextLabel : seulement le texte de l'alarme au moment du départ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restKey]);

  // `now` peut dater d'avant le départ du repos (jusqu'au prochain tic) : jamais plus que le total.
  const remaining =
    active?.kind === "rest" ? Math.min(active.total, (active.endsAt - now) / 1000) : 0;
  const finished = active?.kind === "rest" && remaining <= 0;

  // Bips 3-2-1, puis bip long + vibration (et notification de secours) à la fin.
  useEffect(() => {
    if (active?.kind !== "rest" || !restKey) return;
    const second = Math.ceil(remaining);
    if (remaining > 0 && second <= 3 && second >= 1 && lastCue.current !== second) {
      lastCue.current = second;
      if (sound) beep(660, 0.12);
    }
    if (remaining <= 0 && finishedRef.current !== restKey) {
      finishedRef.current = restKey;
      lastCue.current = null;
      if (sound) {
        beep(880, 0.35, 0.35);
        setTimeout(() => beep(880, 0.35, 0.35), 450);
      }
      vibrate([300, 150, 300]);
      // Sans notification serveur : notification locale si l'application est en arrière-plan.
      if (document.visibilityState === "hidden" && alarm.current !== restKey) {
        void localRestNotification(
          tPush("title"),
          nextLabel ? tPush("bodyWithDetail", { detail: nextLabel }) : tPush("body"),
          sessionUrl(active.sessionId),
        );
      }
    }
  }, [active, nextLabel, remaining, restKey, sound, tPush]);

  // Repos fini depuis longtemps, enchaînement ou fin affichés : on range la barre.
  useEffect(() => {
    if (!active) return;
    const age = active.kind === "rest" ? now - active.endsAt : now - active.at;
    const limit = active.kind === "rest" ? 45_000 : active.kind === "chain" ? 8_000 : 60_000;
    if (age > limit && (active.kind !== "rest" || finished)) {
      const frame = requestAnimationFrame(() => stop());
      return () => cancelAnimationFrame(frame);
    }
  }, [active, finished, now]);

  // Titre de l'onglet : le décompte reste visible dans la liste des onglets.
  const label = active?.kind === "rest" && !finished ? clock(remaining) : null;
  useEffect(() => {
    if (!label) return;
    const original = document.title;
    document.title = `${label} · ${t("restShort")}`;
    return () => {
      document.title = original;
    };
  }, [label, t]);

  const toggleSound = () => {
    unlockAudio();
    setSound((current) => {
      storage.set("elan.rest.muted", current ? "1" : null);
      return !current;
    });
  };

  if (!active) return null;
  const success = active.kind !== "rest" || finished;

  return (
    <>
      <div aria-hidden="true" className="h-36" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2",
          "lg:inset-x-auto lg:right-8 lg:bottom-6 lg:w-[26rem] lg:px-0 lg:pb-0",
        )}
      >
        <section
          aria-label={t("restTimer")}
          className={cn(
            "overflow-hidden rounded-card shadow-lg ring-1 ring-black/5",
            success ? "bg-success text-primary-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {active.kind === "rest" && !finished ? (
            <div
              className="h-1.5 bg-white/70 transition-[width] duration-300 ease-linear"
              style={{ width: `${Math.max(0, Math.min(100, (remaining / active.total) * 100))}%` }}
            />
          ) : null}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              {active.kind === "finished" ? (
                <>
                  <p role="status" className="text-xl font-bold">
                    {t("allDone")}
                  </p>
                  <p className="text-sm font-medium opacity-90">{t("allDoneHint")}</p>
                </>
              ) : active.kind === "chain" ? (
                <>
                  <p className="text-sm font-semibold opacity-90">{t("chainNow")}</p>
                  <p className="truncate text-xl font-bold">{nextLabel}</p>
                </>
              ) : finished ? (
                <>
                  <p role="status" className="text-xl font-bold">
                    {t("restDone")}
                  </p>
                  {nextLabel ? (
                    <p className="truncate text-sm font-medium opacity-90">
                      {t("nextUp", { name: nextLabel })}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 text-sm font-semibold opacity-90">
                    <Timer aria-hidden="true" className="size-4" />
                    {t("restShort")}
                  </p>
                  <p
                    className="text-5xl leading-none font-bold tabular-nums"
                    role="timer"
                    aria-label={t("rest", { time: clock(remaining) })}
                  >
                    {clock(remaining)}
                  </p>
                  {nextLabel ? (
                    <p className="mt-1 truncate text-sm font-medium opacity-90">
                      {t("nextUp", { name: nextLabel })}
                    </p>
                  ) : null}
                </>
              )}
              {!onSessionPage && sessionHref ? (
                <Link
                  href={sessionHref}
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"
                >
                  {t("backToSession")}
                </Link>
              ) : active.kind === "finished" && sessionHref ? (
                <a
                  href="#finish"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4"
                >
                  {t("goFinish")}
                </a>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={toggleSound}
                  aria-pressed={sound}
                  aria-label={sound ? t("soundOff") : t("soundOn")}
                  className="size-9 text-inherit hover:bg-black/10"
                >
                  {sound ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={stop}
                  aria-label={t("restClose")}
                  className="size-9 text-inherit hover:bg-black/10"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              {active.kind === "rest" && !finished ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => adjust(-15)}
                    aria-label={t("restLess")}
                    className="bg-black/10 px-2.5 text-inherit tabular-nums hover:bg-black/20"
                  >
                    −15
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => adjust(15)}
                    aria-label={t("restMore")}
                    className="bg-black/10 px-2.5 text-inherit tabular-nums hover:bg-black/20"
                  >
                    +15
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={stop}
                    aria-label={t("restSkip")}
                    className="bg-black/10 px-2.5 text-inherit hover:bg-black/20"
                  >
                    <SkipForward aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/** Garde l'écran allumé pendant la séance (si l'appareil le permet). */
export function KeepScreenOn({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
        if (cancelled) await lock.release();
      } catch {
        // Refusé (batterie faible, onglet masqué…) : sans conséquence.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
  return null;
}

// --- Durée de la séance -----------------------------------------------------------------

/** Temps écoulé, pauses déduites ; figé pendant une pause. */
export function ElapsedTime({
  startedAt,
  pausedSeconds,
  pausedAt,
}: {
  startedAt: string;
  pausedSeconds: number;
  pausedAt: string | null;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const frame = requestAnimationFrame(tick);
    if (pausedAt) return () => cancelAnimationFrame(frame);
    const timer = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, [pausedAt]);
  if (now === null) return <span className="tabular-nums">–:––</span>;
  const end = pausedAt ? new Date(pausedAt).getTime() : now;
  const seconds = (end - new Date(startedAt).getTime()) / 1000 - pausedSeconds;
  return <span className="tabular-nums">{clock(seconds)}</span>;
}

// --- Une série ------------------------------------------------------------------------

/**
 * Une série : charge et répétitions (ou secondes). Les valeurs proposées
 * (dernière série validée, sinon l'objectif) s'affichent en gris ; valider
 * avec les champs vides les reprend telles quelles, en un seul geste.
 */
export function SetRow({
  setId,
  setNumber,
  timed,
  perHand = false,
  done,
  initial,
  proposed,
  sessionId,
  itemId,
  disabled,
  action,
}: {
  setId: string;
  setNumber: number;
  timed: boolean;
  /** Charge d'un haltère (« kg / bras »). */
  perHand?: boolean;
  done: boolean;
  initial: SetFormValues;
  proposed: { weightKg: string; reps: string };
  sessionId: string;
  itemId: string;
  disabled: boolean;
  action: (values: SetFormValues) => Promise<ActionResult<string>>;
}) {
  const t = useTranslations("Training.session");
  const messages = useFormMessages();
  // Affichage immédiat : la série passe au vert et le repos démarre sans
  // attendre le serveur ; en cas d'échec, on revient en arrière.
  const [optimistic, setOptimistic] = useState(false);
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: setSchema,
    defaultValues: initial,
    action: async (values) => {
      const result = await action(values);
      if (!result.ok) {
        setOptimistic(false);
        if (!done) cancelSet(sessionId, { itemId, setNumber });
      }
      return result;
    },
  });
  const shownDone = done || optimistic;

  // Une série encore en cours d'enregistrement : prévenir avant de quitter la page.
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  const weightId = `weight-${setId}`;
  const repsId = `reps-${setId}`;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    unlockAudio();
    // Champs vides : on valide les valeurs proposées.
    if (form.getValues("weightKg") === "" && proposed.weightKg !== "") {
      form.setValue("weightKg", proposed.weightKg);
    }
    if (form.getValues("reps") === "" && proposed.reps !== "") {
      form.setValue("reps", proposed.reps);
    }
    const parsed = setSchema.safeParse(form.getValues());
    if (parsed.success && !done && !pending) {
      setOptimistic(true);
      startAfterSet(sessionId, { itemId, setNumber });
    }
    return onSubmit(event);
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={submit}
        noValidate
        className={cn(
          "grid grid-cols-[2rem_1fr_1fr_auto] items-start gap-2 rounded-control px-2 py-2",
          shownDone && "bg-success-soft/60",
        )}
      >
        <span className="pt-3 text-sm font-semibold text-muted-foreground tabular-nums">
          {setNumber}
        </span>
        <div>
          <label htmlFor={weightId} className="sr-only">
            {perHand
              ? t("weightLabelPerHand", { number: setNumber })
              : t("weightLabel", { number: setNumber })}
          </label>
          <UnitInput
            id={weightId}
            unit={perHand ? t("kgPerHand") : "kg"}
            placeholder={proposed.weightKg}
            disabled={disabled}
            {...form.register("weightKg")}
          />
          <FieldError name="weightKg" />
        </div>
        <div>
          <label htmlFor={repsId} className="sr-only">
            {timed
              ? t("secondsLabel", { number: setNumber })
              : t("repsLabel", { number: setNumber })}
          </label>
          <UnitInput
            id={repsId}
            unit={timed ? "s" : t("repsUnit")}
            mode="numeric"
            placeholder={proposed.reps}
            disabled={disabled}
            {...form.register("reps")}
          />
          {timed && !done ? (
            <HoldStopwatch
              disabled={disabled}
              onStop={(seconds) => form.setValue("reps", String(seconds), { shouldDirty: true })}
            />
          ) : null}
          <FieldError name="reps" />
        </div>
        <SubmitButton
          pending={pending && !optimistic}
          pendingLabel=""
          size="icon"
          variant={shownDone ? "primary" : "secondary"}
          disabled={disabled}
          aria-label={
            done ? t("updateSet", { number: setNumber }) : t("validateSet", { number: setNumber })
          }
          title={
            done ? t("updateSet", { number: setNumber }) : t("validateSet", { number: setNumber })
          }
        >
          <Check aria-hidden="true" />
        </SubmitButton>
        {formError ? (
          <p role="alert" className="col-span-4 text-sm font-medium text-destructive">
            {messages.error(formError)}
          </p>
        ) : null}
      </form>
    </FormProvider>
  );
}

/** Chronomètre pour les exercices tenus (gainage…) : remplit la durée à l'arrêt. */
function HoldStopwatch({
  disabled,
  onStop,
}: {
  disabled: boolean;
  onStop: (seconds: number) => void;
}) {
  const t = useTranslations("Training.session");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [startedAt]);
  const seconds = startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <Button
      type="button"
      size="sm"
      variant={startedAt === null ? "ghost" : "primary"}
      disabled={disabled}
      className="mt-1 h-8 w-full px-2 tabular-nums"
      onClick={() => {
        if (startedAt === null) {
          unlockAudio();
          setNow(Date.now());
          setStartedAt(Date.now());
        } else {
          onStop(seconds);
          setStartedAt(null);
          vibrate([120]);
        }
      }}
    >
      {startedAt === null ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      {startedAt === null ? t("holdStart") : t("holdStop", { seconds })}
    </Button>
  );
}

function FieldError({ name }: { name: "weightKg" | "reps" }) {
  const error = useFieldError<SetFormValues>(name);
  return error ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p> : null;
}
