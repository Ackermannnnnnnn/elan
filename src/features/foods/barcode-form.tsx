"use client";

import { Camera, CameraOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { FormProvider } from "react-hook-form";
import { TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { type BarcodeFormValues, barcodeSchema } from "./schemas";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

/** Lecteur de code-barres du navigateur (Chrome Android, Edge…), s'il existe. */
function getDetector(): DetectorConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { BarcodeDetector?: DetectorConstructor })
    .BarcodeDetector;
  return candidate ?? null;
}

export function BarcodeForm({
  action,
  newFoodHref,
}: {
  action: (values: BarcodeFormValues) => Promise<ActionResult<string>>;
  newFoodHref: string;
}) {
  const t = useTranslations("Foods.scan");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: barcodeSchema,
    defaultValues: { barcode: "" },
    action,
  });
  const [cameraSupported, setCameraSupported] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Détection après l'hydratation : le serveur ne connaît pas le navigateur.
  useEffect(() => {
    const supported = getDetector() !== null && Boolean(navigator.mediaDevices?.getUserMedia);
    const frame = requestAnimationFrame(() => setCameraSupported(supported));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!scanning) return;
    const Detector = getDetector();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });

    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video) return;
      try {
        const codes = await detector.detect(video);
        const code = codes[0]?.rawValue;
        if (code) {
          form.setValue("barcode", code);
          setScanning(false);
          void onSubmit();
          return;
        }
      } catch {
        // Image pas encore prête : on réessaie au prochain passage.
      }
      timer = setTimeout(tick, 250);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (media) => {
        stream = media;
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = media;
        await videoRef.current.play();
        void tick();
      })
      .catch(() => {
        setCameraError(true);
        setScanning(false);
      });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning, form, onSubmit]);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField<BarcodeFormValues>
          name="barcode"
          label={t("barcode")}
          hint={t("barcodeHint")}
          placeholder="3017620422003"
          autoComplete="off"
        />
        {cameraSupported ? (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              onClick={() => {
                setCameraError(false);
                setScanning((value) => !value);
              }}
            >
              {scanning ? <CameraOff aria-hidden="true" /> : <Camera aria-hidden="true" />}
              {scanning ? t("stopCamera") : t("useCamera")}
            </Button>
            {scanning ? (
              <video
                ref={videoRef}
                muted
                playsInline
                aria-label={t("cameraLabel")}
                className="aspect-video w-full max-w-md rounded-control bg-surface-muted object-cover"
              />
            ) : null}
          </div>
        ) : null}
        {cameraError ? <Alert variant="error">{t("cameraError")}</Alert> : null}
        {formError ? (
          <Alert variant="error">
            {messages.error(formError)}{" "}
            {formError === "offNotFound" || formError === "offIncomplete" ? (
              <a href={newFoodHref} className="underline underline-offset-4">
                {t("createInstead")}
              </a>
            ) : null}
          </Alert>
        ) : null}
        <SubmitButton
          pending={pending}
          pendingLabel={t("searching")}
          size="lg"
          className="self-start"
        >
          {t("submit")}
        </SubmitButton>
        <p className="text-sm text-muted-foreground">{t("attribution")}</p>
      </form>
    </FormProvider>
  );
}
