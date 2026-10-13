"use client";

import { Check, Timer, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
};

// --- Minuteur de repos ------------------------------------------------------------------

type RestContext = { start: (seconds: number) => void };
const Rest = createContext<RestContext>({ start: () => {} });

/** Fournit un minuteur de repos partagé par toutes les séries de la séance. */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Training.session");
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    setNow(Date.now());
    setEndsAt(Date.now() + seconds * 1000);
  }, []);
  const value = useMemo(() => ({ start }), [start]);
  const remaining = endsAt === null ? 0 : (endsAt - now) / 1000;

  return (
    <Rest.Provider value={value}>
      {endsAt !== null ? (
        <div
          role="status"
          className={cn(
            "sticky top-2 z-20 mb-4 flex items-center justify-between gap-3 rounded-control px-4 py-3 font-semibold shadow-sm",
            remaining > 0 ? "bg-primary text-primary-foreground" : "bg-success-soft text-success",
          )}
        >
          <span className="flex items-center gap-2 tabular-nums">
            <Timer aria-hidden="true" className="size-5" />
            {remaining > 0 ? t("rest", { time: clock(remaining) }) : t("restDone")}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEndsAt(null)}
            aria-label={t("restClose")}
            className="text-inherit hover:bg-black/10"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {children}
    </Rest.Provider>
  );
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

export function SetRow({
  setId,
  setNumber,
  timed,
  done,
  initial,
  placeholder,
  restSeconds,
  disabled,
  action,
}: {
  setId: string;
  setNumber: number;
  timed: boolean;
  done: boolean;
  initial: SetFormValues;
  placeholder: { weightKg: string; reps: string };
  restSeconds: number | null;
  disabled: boolean;
  action: (values: SetFormValues) => Promise<ActionResult<string>>;
}) {
  const t = useTranslations("Training.session");
  const tCommon = useTranslations("Common");
  const rest = useContext(Rest);
  const { form, onSubmit, pending } = useActionForm({
    schema: setSchema,
    defaultValues: initial,
    action,
    onSuccess: () => {
      if (restSeconds) rest.start(restSeconds);
    },
  });
  const weightId = `weight-${setId}`;
  const repsId = `reps-${setId}`;

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
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
            placeholder={placeholder.weightKg}
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
            placeholder={placeholder.reps}
            disabled={disabled}
            {...form.register("reps")}
          />
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
          title={tCommon("save")}
        >
          <Check aria-hidden="true" />
        </SubmitButton>
      </form>
    </FormProvider>
  );
}

function FieldError({ name }: { name: "weightKg" | "reps" }) {
  const error = useFieldError<SetFormValues>(name);
  return error ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p> : null;
}
