"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { FormProvider, useForm, type Path } from "react-hook-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  assessGoal,
  basalMetabolicRate,
  maintenanceCalories,
  MIN_ADULT_AGE,
  type BlockingIssue,
} from "@/domain/energy";
import { ageOn, todayInTimeZone } from "@/lib/dates";
import { completeOnboarding } from "./actions";
import { planFromOnboarding, type PlanPreview } from "./plan";
import {
  onboardingSchema,
  personalAndGoalSchema,
  personalSchema,
  STEP_FIELDS,
  STEPS,
  type OnboardingFormValues,
  type OnboardingValues,
  type Step,
} from "./schema";
import { ActivityStep } from "./steps/activity-step";
import { FoodStep } from "./steps/food-step";
import { GoalStep } from "./steps/goal-step";
import { PersonalStep } from "./steps/personal-step";
import { ResultStep } from "./steps/result-step";

type WizardProps = {
  mode: "create" | "edit";
  initialValues: OnboardingFormValues;
  /** Jour courant côté serveur : borne du sélecteur de date de naissance. */
  today: string;
};

export function OnboardingWizard({ mode, initialValues, today }: WizardProps) {
  const t = useTranslations("Onboarding");
  const messages = useFormMessages();

  const form = useForm<OnboardingFormValues, unknown, OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: initialValues,
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [blocking, setBlocking] = useState<BlockingIssue[]>([]);
  const [result, setResult] = useState<{
    preview: PlanPreview;
    values: OnboardingValues;
    today: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Avant le chargement du JavaScript, une saisie serait effacée au démarrage du
  // formulaire : les champs restent inactifs le temps de ce chargement.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const step: Step = STEPS[stepIndex] ?? "personal";

  // Le fuseau du navigateur détermine « aujourd'hui » pour le journal et les pesées.
  useEffect(() => {
    form.setValue("timeZone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [form]);

  const goTo = (index: number) => {
    setStepIndex(index);
    setFormError(null);
    // Le focus et le défilement suivent le changement d'étape.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      headingRef.current?.focus();
    });
  };

  const clientToday = () => todayInTimeZone(form.getValues("timeZone"));

  /** Contrôles propres à chaque étape, en plus de la validation des champs. */
  const validateStep = async (): Promise<boolean> => {
    if (step === "result") return true;
    const valid = await form.trigger(STEP_FIELDS[step] as Path<OnboardingFormValues>[], {
      shouldFocus: true,
    });
    if (!valid) return false;

    if (step === "personal") {
      const parsed = personalSchema.safeParse(form.getValues());
      if (!parsed.success) return false;
      const age = ageOn(parsed.data.birthDate, clientToday());
      if (age < MIN_ADULT_AGE) {
        form.setError("birthDate", { message: "underAge" }, { shouldFocus: true });
        return false;
      }
      if (age > 120) {
        form.setError("birthDate", { message: "dateInvalid" }, { shouldFocus: true });
        return false;
      }
    }

    if (step === "goal") {
      const parsed = personalAndGoalSchema.safeParse(form.getValues());
      if (!parsed.success) return false;
      const values = parsed.data;
      const needsTarget = values.goalType === "fat_loss" || values.goalType === "muscle_gain";
      if (needsTarget && values.targetWeightKg === null) {
        form.setError("targetWeightKg", { message: "required" }, { shouldFocus: true });
        return false;
      }
      const sex = values.sex === "unspecified" ? null : values.sex;
      const age = ageOn(values.birthDate, clientToday());
      const bmr = basalMetabolicRate({ ...values, age, sex });
      const issues = assessGoal({
        age,
        sex,
        weightKg: values.weightKg,
        heightCm: values.heightCm,
        goalType: values.goalType,
        targetWeightKg: values.targetWeightKg,
        maintenanceKcal: maintenanceCalories(bmr.kcal, form.getValues("activityLevel")),
      }).blocking;
      setBlocking(issues);
      if (issues.length > 0) return false;
    }

    if (step === "activity") {
      const sessions = Number.parseInt(form.getValues("sessionsPerWeek"), 10);
      const minutes = Number.parseInt(form.getValues("sessionMinutes"), 10);
      if (sessions > 0 && minutes < 5) {
        form.setError("sessionMinutes", { message: "sessionTooShort" }, { shouldFocus: true });
        return false;
      }
    }

    if (step === "food") {
      const parsed = onboardingSchema.safeParse(form.getValues());
      if (!parsed.success) {
        // Une valeur d'une étape précédente n'est plus valide : on y retourne.
        const field = parsed.error.issues[0]?.path[0];
        const index = STEPS.findIndex(
          (name) =>
            name !== "result" && (STEP_FIELDS[name] as readonly string[]).includes(String(field)),
        );
        await form.trigger();
        goTo(Math.max(0, index));
        return false;
      }
      const day = clientToday();
      const preview = planFromOnboarding(parsed.data, day);
      if (preview.plan.assessment.blocking.length > 0) {
        setBlocking(preview.plan.assessment.blocking);
        goTo(STEPS.indexOf("goal"));
        return false;
      }
      setResult({ preview, values: parsed.data, today: day });
    }

    return true;
  };

  const next = async () => {
    if (await validateStep()) goTo(stepIndex + 1);
  };

  const finish = () => {
    if (pending) return;
    setFormError(null);
    startTransition(async () => {
      const outcome = await completeOnboarding(form.getValues(), mode);
      // En cas de succès, l'action redirige : on n'arrive ici qu'après un échec.
      if (!outcome.ok) setFormError(outcome.formError ?? "saveFailed");
    });
  };

  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const heading = step === "result" ? t("result.title") : t(`${step}.title`);
  const lead = step === "result" ? t("result.lead") : t(`${step}.lead`);

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step === "result") finish();
          else void next();
        }}
      >
        <div className="mb-8">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <p className="font-semibold">
              {t("progress", { current: stepIndex + 1, total: STEPS.length })}
            </p>
            <p className="text-muted-foreground">{t(`stepNames.${step}`)}</p>
          </div>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-valuetext={t("progress", { current: stepIndex + 1, total: STEPS.length })}
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-chart-track"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <header className="mb-8">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-[2rem] leading-[1.1] font-bold outline-none sm:text-[2.5rem]"
          >
            {heading}
          </h1>
          <p className="mt-3 text-muted-foreground sm:text-lg">{lead}</p>
        </header>

        <fieldset disabled={!hydrated} className="contents">
          {step === "personal" ? <PersonalStep today={today} /> : null}
          {step === "goal" ? <GoalStep blocking={blocking} /> : null}
          {step === "activity" ? <ActivityStep keepActivityLevel={mode === "edit"} /> : null}
          {step === "food" ? <FoodStep /> : null}
          {step === "result" && result ? <ResultStep {...result} /> : null}
        </fieldset>

        {formError ? (
          <Alert variant="error" className="mt-6">
            {messages.error(formError)}
          </Alert>
        ) : null}

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-border pt-6">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={() => goTo(stepIndex - 1)} disabled={pending}>
              <ArrowLeft aria-hidden="true" />
              {t("back")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" aria-disabled={pending}>
            {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {step !== "result"
              ? t("next")
              : pending
                ? t("finishing")
                : mode === "edit"
                  ? t("finishEdit")
                  : t("finish")}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
