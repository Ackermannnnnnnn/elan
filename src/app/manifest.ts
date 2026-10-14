import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/config/app";

/** Application installable (écran d'accueil, plein écran). Couleurs = thème clair. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f8",
    theme_color: "#f4f5f8",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ajouter un repas", url: "/nutrition/add" },
      { name: "Entraînement", url: "/training" },
      { name: "Pesée", url: "/progress#weight" },
    ],
  };
}
