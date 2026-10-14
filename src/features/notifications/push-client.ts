"use client";

import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from "@/lib/push/public-key";

/**
 * Notifications côté navigateur. Tout est protégé par try/catch : un
 * navigateur sans service worker, en navigation privée ou sur un iPhone où
 * l'application n'est pas installée doit simplement afficher l'état correspondant.
 */

const DEVICE_KEY = "elan.push";
const REST_KEY = "elan.push.rest";

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible : la notification de repos ne sera simplement pas programmée.
  }
};

export type PushSupport = "notConfigured" | "unsupported" | "iosInstall" | "supported";

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

export function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function pushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return "notConfigured";
  const capable =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // Sur iPhone, les notifications web n'existent que pour l'application installée.
  if (isIos() && !isStandalone()) return "iosInstall";
  return capable ? "supported" : "unsupported";
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/");
    return (
      existing ??
      (await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }))
    );
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await registration();
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Demande l'autorisation puis abonne l'appareil. Renvoie null si refusé. */
export async function subscribeDevice(): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const reg = await registration();
  if (!reg) return null;
  await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));
  write(DEVICE_KEY, "1");
  return subscription;
}

export async function unsubscribeDevice(): Promise<string | null> {
  write(DEVICE_KEY, null);
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    // Déjà désabonné côté navigateur.
  }
  return endpoint;
}

export function markDeviceSubscribed(subscribed: boolean) {
  write(DEVICE_KEY, subscribed ? "1" : null);
}

/** Notification de fin de repos sur cet appareil (activée par défaut avec les notifications). */
export function restAlarmEnabled(): boolean {
  return read(DEVICE_KEY) === "1" && read(REST_KEY) !== "0";
}

export function restAlarmPreference(): boolean {
  return read(REST_KEY) !== "0";
}

export function setRestAlarmPreference(enabled: boolean) {
  write(REST_KEY, enabled ? null : "0");
}

/** Programme la notification de fin de repos (ou l'annule avec `null`). Sans attendre. */
export function scheduleRestAlarm(
  input: { seconds: number; detail: string | null; sessionId: string } | null,
) {
  try {
    void fetch("/api/rest-alarm", {
      method: input ? "POST" : "DELETE",
      headers: input ? { "Content-Type": "application/json" } : undefined,
      body: input ? JSON.stringify(input) : undefined,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // Hors ligne : le minuteur à l'écran continue de fonctionner.
  }
}

// --- Installation -------------------------------------------------------------------------

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Chrome propose l'installation par un évènement émis tôt, souvent avant que
 * la carte « Installer » soit affichée : on le garde ici (module chargé par
 * le layout) jusqu'à ce qu'elle le demande.
 */
let installPrompt: InstallPromptEvent | null = null;
export const INSTALL_READY_EVENT = "elan:install-ready";

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_READY_EVENT));
  });
}

export function takeInstallPrompt(): InstallPromptEvent | null {
  return installPrompt;
}

export function clearInstallPrompt() {
  installPrompt = null;
}
