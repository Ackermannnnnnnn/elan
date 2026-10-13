"use client";

import { Check, Pause, Play, SkipForward, Timer, Volume2, VolumeX, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FormProvider } from "react-hook-form";
import { useFieldError } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { UnitInput } from "@/components/ui/unit-input";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { type SetFormValues, setSchema } from "./schemas";

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

export type AfterSetCue =
  | { kind: "rest"; seconds: number; next: string | null }
  | { kind: "chain"; next: string }
  | { kind: "none" };

type TimerState =
  | { kind: "rest"; endsAt: number; total: number; next: string | null }
  | { kind: "chain"; next: string; at: number };

type RestContext = { start: (cue: AfterSetCue) => void; stop: () => void };
const Rest = createContext<RestContext>({ start: () => {}, stop: () => {} });

/**
 * Minuteur de repos partagé par toute la séance : grande barre fixée en bas de
 * l'écran (au-dessus de la navigation), ±15 s, passer, bips 3-2-1 et vibration
 * à la fin. Il repose sur l'heure de fin, donc reste juste si l'écran s'éteint
 * ou si la page est rechargée.
 */
export function RestTimerProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const t = useTranslations("Training.session");
  const key = `elan.rest.${sessionId}`;
  const [state, setState] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(true);
  const lastCue = useRef<number | null>(null);
  const finishedRef = useRef(false);

  // Reprise après rechargement, réglage du son.
  useEffect(() => {
    const saved = storage.get(key);
    const muted = storage.get("elan.rest.muted") === "1";
    const frame = requestAnimationFrame(() => {
      setSound(!muted);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved) as TimerState;
        if (parsed.kind === "rest" && parsed.endsAt > Date.now() - 60_000) setState(parsed);
      } catch {
        storage.set(key, null);
      }
    });
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", unlock);
    };
  }, [key]);

  useEffect(() => {
    if (!state) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [state]);

  const save = useCallback(
    (next: TimerState | null) => {
      setState(next);
      setNow(Date.now());
      lastCue.current = null;
      finishedRef.current = false;
      storage.set(key, next && next.kind === "rest" ? JSON.stringify(next) : null);
    },
    [key],
  );

  const start = useCallback(
    (cue: AfterSetCue) => {
      unlockAudio();
      if (cue.kind === "rest") {
        save({
          kind: "rest",
          endsAt: Date.now() + cue.seconds * 1000,
          total: cue.seconds,
          next: cue.next,
        });
      } else if (cue.kind === "chain") {
        save({ kind: "chain", next: cue.next, at: Date.now() });
      } else {
        save(null);
      }
    },
    [save],
  );
  const stop = useCallback(() => save(null), [save]);
  const value = useMemo(() => ({ start, stop }), [start, stop]);

  const remaining = state?.kind === "rest" ? (state.endsAt - now) / 1000 : 0;
  const finished = state?.kind === "rest" && remaining <= 0;

  // Bips 3-2-1, puis bip long + vibration à la fin.
  useEffect(() => {
    if (state?.kind !== "rest") return;
    const second = Math.ceil(remaining);
    if (remaining > 0 && second <= 3 && second >= 1 && lastCue.current !== second) {
      lastCue.current = second;
      if (sound) beep(660, 0.12);
    }
    if (remaining <= 0 && !finishedRef.current) {
      finishedRef.current = true;
      if (sound) {
        beep(880, 0.35, 0.35);
        setTimeout(() => beep(880, 0.35, 0.35), 450);
      }
      vibrate([300, 150, 300]);
    }
  }, [remaining, sound, state]);

  // Repos fini depuis longtemps ou enchaînement affiché : on range la barre.
  useEffect(() => {
    if (!state) return;
    const age = state.kind === "rest" ? now - state.endsAt : now - state.at;
    const limit = state.kind === "rest" ? 45_000 : 8_000;
    if (age > limit && (state.kind === "chain" || finished)) {
      const frame = requestAnimationFrame(() => save(null));
      return () => cancelAnimationFrame(frame);
    }
  }, [finished, now, save, state]);

  // Titre de l'onglet : le décompte reste visible dans la liste des onglets.
  const label = state?.kind === "rest" && !finished ? clock(remaining) : null;
  useEffect(() => {
    if (!label) return;
    const original = document.title;
    document.title = `${label} · ${t("restShort")}`;
    return () => {
      document.title = original;
    };
  }, [label, t]);

  const adjust = (delta: number) => {
    if (state?.kind !== "rest") return;
    const endsAt = Math.max(Date.now() + 1000, state.endsAt + delta * 1000);
    save({
      ...state,
      endsAt,
      total: Math.max(state.total, Math.round((endsAt - Date.now()) / 1000)),
    });
  };
  const toggleSound = () => {
    unlockAudio();
    setSound((current) => {
      storage.set("elan.rest.muted", current ? "1" : null);
      return !current;
    });
  };

  return (
    <Rest.Provider value={value}>
      {children}
      {state ? <div aria-hidden="true" className="h-36" /> : null}
      {state ? (
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
              state.kind === "chain" || finished
                ? "bg-success text-primary-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {state.kind === "rest" && !finished ? (
              <div
                className="h-1.5 bg-white/70 transition-[width] duration-300 ease-linear"
                style={{ width: `${Math.max(0, Math.min(100, (remaining / state.total) * 100))}%` }}
              />
            ) : null}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                {state.kind === "chain" ? (
                  <>
                    <p className="text-sm font-semibold opacity-90">{t("chainNow")}</p>
                    <p className="truncate text-xl font-bold">{state.next}</p>
                  </>
                ) : finished ? (
                  <>
                    <p role="status" className="text-xl font-bold">
                      {t("restDone")}
                    </p>
                    {state.next ? (
                      <p className="truncate text-sm font-medium opacity-90">
                        {t("nextUp", { name: state.next })}
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
                    {state.next ? (
                      <p className="mt-1 truncate text-sm font-medium opacity-90">
                        {t("nextUp", { name: state.next })}
                      </p>
                    ) : null}
                  </>
                )}
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
                {state.kind === "rest" && !finished ? (
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
      ) : null}
    </Rest.Provider>
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
  done,
  initial,
  proposed,
  after,
  disabled,
  action,
}: {
  setId: string;
  setNumber: number;
  timed: boolean;
  done: boolean;
  initial: SetFormValues;
  proposed: { weightKg: string; reps: string };
  after: AfterSetCue;
  disabled: boolean;
  action: (values: SetFormValues) => Promise<ActionResult<string>>;
}) {
  const t = useTranslations("Training.session");
  const rest = useContext(Rest);
  const { form, onSubmit, pending } = useActionForm({
    schema: setSchema,
    defaultValues: initial,
    action,
    onSuccess: () => {
      if (!done) rest.start(after);
    },
  });
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
    return onSubmit(event);
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={submit}
        noValidate
        className={cn(
          "grid grid-cols-[2rem_1fr_1fr_auto] items-start gap-2 rounded-control px-2 py-2",
          done && "bg-success-soft/60",
        )}
      >
        <span className="pt-3 text-sm font-semibold text-muted-foreground tabular-nums">
          {setNumber}
        </span>
        <div>
          <label htmlFor={weightId} className="sr-only">
            {t("weightLabel", { number: setNumber })}
          </label>
          <UnitInput
            id={weightId}
            unit="kg"
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
          pending={pending}
          pendingLabel=""
          size="icon"
          variant={done ? "primary" : "secondary"}
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
