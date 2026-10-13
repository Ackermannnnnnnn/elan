"use client";

import { ExternalLink, Pause, Play, PlayCircle, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { DemoImages } from "@/domain/exercise-demos";
import { cn } from "@/lib/utils";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

/**
 * « Voir le mouvement » : les positions de départ et d'arrivée s'enchaînent
 * (côte à côte si l'animation est désactivée sur l'appareil), avec un lien vers
 * des vidéos de démonstration. Gratuit : images locales, aucun service payant.
 */
export function MovementDemo({
  name,
  images,
  videoUrl,
  className,
}: {
  name: string;
  images: DemoImages | null;
  videoUrl: string;
  className?: string;
}) {
  const t = useTranslations("Training.demo");
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [frame, setFrame] = useState<0 | 1>(0);
  const reducedMotion = useReducedMotion();
  const playing = open && !paused && !reducedMotion && images !== null;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setFrame((current) => (current === 0 ? 1 : 0)), 1100);
    return () => window.clearInterval(timer);
  }, [playing]);

  const videoLink = (
    <Button asChild variant={images ? "ghost" : "secondary"} size="sm">
      <a href={videoUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden="true" />
        {t("video")}
        <span className="sr-only"> {t("newTab")}</span>
      </a>
    </Button>
  );

  if (!images) {
    return <div className={cn("flex flex-wrap items-center gap-2", className)}>{videoLink}</div>;
  }

  const frames = [
    { src: images.start, label: t("start") },
    { src: images.end, label: t("end") },
  ] as const;

  return (
    <div className={className}>
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((value) => !value);
          setFrame(0);
        }}
      >
        {open ? <X aria-hidden="true" /> : <PlayCircle aria-hidden="true" />}
        {open ? t("hide") : t("show")}
      </Button>

      <div id={panelId} hidden={!open} className="mt-3">
        <figure className="flex flex-col gap-2">
          {reducedMotion ? (
            <div className="grid grid-cols-2 gap-2">
              {frames.map((item) => (
                <div key={item.src} className="flex flex-col gap-1">
                  <div className="relative aspect-[3/2] overflow-hidden rounded-control bg-surface-muted">
                    <Image
                      src={item.src}
                      alt={t("alt", { name, position: item.label })}
                      fill
                      unoptimized
                      sizes="50vw"
                      className="object-contain"
                    />
                  </div>
                  <span className="text-center text-xs font-medium text-muted-foreground">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative aspect-[3/2] w-full max-w-md overflow-hidden rounded-control bg-surface-muted">
              {frames.map((item, index) => (
                <Image
                  key={item.src}
                  src={item.src}
                  alt={index === frame ? t("alt", { name, position: item.label }) : ""}
                  aria-hidden={index !== frame}
                  fill
                  unoptimized
                  sizes="(min-width: 640px) 28rem, 100vw"
                  className={cn(
                    "object-contain transition-opacity duration-300",
                    index === frame ? "opacity-100" : "opacity-0",
                  )}
                />
              ))}
              <span className="absolute bottom-2 left-2 rounded-full bg-surface/90 px-2.5 py-0.5 text-xs font-semibold">
                {frames[frame].label}
              </span>
            </div>
          )}
          <figcaption className="flex flex-wrap items-center gap-2">
            {reducedMotion ? null : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaused((value) => !value)}
                aria-pressed={paused}
              >
                {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                {paused ? t("play") : t("pause")}
              </Button>
            )}
            {videoLink}
            <span className="w-full text-xs text-muted-foreground">{t("credit")}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
