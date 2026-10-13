import { THEME_STORAGE_KEY } from "./theme";

// Exécuté pendant l'analyse du HTML, avant le premier affichage : la page
// n'apparaît jamais dans le mauvais thème (pas de flash clair → sombre).
const script = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=t==="dark"||((t===null||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export function ThemeScript() {
  return (
    <script
      // Le navigateur exécute le script du HTML serveur ; côté client React ne
      // doit pas le rejouer (motif recommandé par la documentation Next.js).
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
