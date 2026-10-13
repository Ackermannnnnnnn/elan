import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Modèle de rendu par défaut de Next.js 16.4 : une coque statique servie
  // immédiatement, le contenu propre à l'utilisateur arrive en streaming
  // derrière des <Suspense>.
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    // En développement, Next.js affiche les arguments des actions serveur dans
    // le terminal. Ils contiennent des mots de passe et des données de santé.
    serverFunctions: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // La caméra sert à photographier les repas ; le reste est coupé.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
