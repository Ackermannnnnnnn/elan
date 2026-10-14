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
import { createBarcodeReader } from "./barcode-reader";
import { type BarcodeFormValues, barcodeSchema } from "./schemas";

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
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Dernière version du formulaire, lue par la boucle de lecture sans la
  // relancer : la caméra ne doit s'ouvrir qu'une fois par scan (sinon elle
  // s'éteint et se rallume à chaque nouvel affichage).
  const latest = useRef({ form, onSubmit });
  useEffect(() => {
    latest.current = { form, onSubmit };
  });

  // Après l'hydratation (le serveur ne connaît pas le navigateur) : caméra
  // disponible ? Si l'accès a déjà été accordé, le scan démarre tout seul.
  useEffect(() => {
    const supported = Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
    const frame = requestAnimationFrame(() => setCameraSupported(supported));
    if (supported) {
      navigator.permissions
        ?.query({ name: "camera" as PermissionName })
        .then((status) => {
          if (status.state === "granted") setScanning(true);
        })
        .catch(() => {});
    }
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let detector: Awaited<ReturnType<typeof createBarcodeReader>> | null = null;

    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video || !detector) return;
      try {
        const codes = await detector.detect(video);
        const code = codes[0]?.rawValue;
        if (code) {
          latest.current.form.setValue("barcode", code);
          try {
            navigator.vibrate?.(80);
          } catch {
            // Vibration indisponible.
          }
          setScanning(false);
          void latest.current.onSubmit();
          return;
        }
      } catch {
        // Image pas encore prête : on réessaie au prochain passage.
      }
      timer = setTimeout(tick, 250);
    };

    Promise.all([
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }),
      createBarcodeReader(),
    ])
      .then(async ([media, reader]) => {
        stream = media;
        detector = reader;
        if (stopped || !videoRef.current) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = media;
        await videoRef.current.play();
        setReady(true);
        void tick();
      })
      .catch(() => {
        stream?.getTracks().forEach((track) => track.stop());
        setCameraError(true);
        setScanning(false);
      });

    return () => {
      stopped = true;
      setReady(false);
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning]);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {cameraSupported ? (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant={scanning ? "secondary" : "primary"}
              size="lg"
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
              <div className="relative w-full max-w-md overflow-hidden rounded-control bg-surface-muted">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  aria-label={t("cameraLabel")}
                  className="aspect-[4/3] w-full object-cover"
                />
                {/* Cadre de visée : placer le code-barres dans le rectangle. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[12%] top-1/2 h-1/3 -translate-y-1/2 rounded-control border-2 border-primary-foreground/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.25)]"
                />
                <p
                  role="status"
                  className="absolute inset-x-0 bottom-0 bg-surface/85 px-3 py-2 text-center text-sm font-medium"
                >
                  {ready ? t("aim") : t("preparing")}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noCamera")}</p>
        )}
        <TextField<BarcodeFormValues>
          name="barcode"
          label={t("barcode")}
          hint={t("barcodeHint")}
          placeholder="3017620422003"
          autoComplete="off"
          inputMode="numeric"
        />
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
          variant="secondary"
          className="self-start"
        >
          {t("submit")}
        </SubmitButton>
        <p className="text-sm text-muted-foreground">{t("attribution")}</p>
      </form>
    </FormProvider>
  );
}
