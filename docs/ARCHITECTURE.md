# Architecture

## Vue d'ensemble

```
Navigateur ──► proxy.ts ──► Pages (Server Components) ──► data/ ──► Supabase (PostgreSQL + RLS)
                  │              │
                  │              └─► Server Actions (features/*/actions.ts) ──► data/
                  └─ rafraîchit la session, redirige les visiteurs non connectés
```

- **Next.js 16.4, App Router.** `src/proxy.ts` remplace l'ancien `middleware.ts`.
- **Cache Components** (réglage par défaut de Next.js 16.4) : la coque de chaque
  page (navigation, titres) est pré-rendue et servie immédiatement ; tout ce qui
  dépend de l'utilisateur arrive en streaming derrière un `<Suspense>`.
- **Supabase** fournit l'authentification, PostgreSQL et le stockage de fichiers.
  L'application parle à Supabase avec la clé _publishable_ et la session de
  l'utilisateur : toutes les requêtes passent par la Row Level Security.

## Les couches et leurs règles

| Dossier                  | Rôle                                                          | Règle                                                                                                      |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/app`                | Routes, mises en page, assemblage                             | Pas de logique métier, pas de requête Supabase directe                                                     |
| `src/features/<nom>`     | Schémas Zod, actions serveur, composants d'une fonctionnalité | Une action revalide toujours ses entrées avec Zod                                                          |
| `src/data`               | Lecture et écriture en base                                   | Seul endroit qui appelle `supabase.from(...)` ; l'identité vient de `requireUser()`, jamais d'un paramètre |
| `src/domain` _(phase 3)_ | Calculs purs : métabolisme, macros, tendances                 | Aucune dépendance à Next.js, Supabase ou l'IA ; 100 % testable                                             |
| `src/ai` _(phase 4)_     | Interface fournisseur + un service par usage                  | Réponses validées par Zod ; jamais d'écriture en base sans validation de l'utilisateur                     |
| `src/components/ui`      | Design system                                                 | Aucune donnée, aucun texte en dur                                                                          |
| `src/lib`                | Clients Supabase, session, environnement                      | —                                                                                                          |

## Authentification

1. `proxy.ts` s'exécute avant chaque page : il rafraîchit la session Supabase
   (cookies) et redirige les visiteurs non connectés vers `/login`.
2. `(app)/layout.tsx` contient un garde-fou serveur (`AuthGate`) qui appelle
   `requireUser()` : même si le proxy était contourné, aucune page privée ne
   serait rendue.
3. Chaque fonction de `src/data` passe par `getDb()`, qui appelle `requireUser()` avant d'interroger la base.
4. En base, la RLS refuse tout ce qui n'appartient pas à l'utilisateur.

Tant que l'onboarding n'est pas terminé, `proxy.ts` renvoie vers `/onboarding`.
Il le vérifie en base une seule fois par navigateur, puis le mémorise dans le
cookie `elan_onboarded` (effacé à la déconnexion). Ce cookie n'est qu'un
raccourci de navigation : `AuthGate` revérifie côté serveur et la RLS protège
les données quoi qu'il arrive.

La session est vérifiée avec `supabase.auth.getClaims()` (signature du jeton
contrôlée). `getSession()` n'est jamais utilisé côté serveur : il lit le cookie
sans le vérifier.

`createClient()` côté serveur appelle `connection()` : la validité d'une session
dépend de l'heure, ce code doit donc s'exécuter à chaque requête et jamais dans
un rendu anticipé.

## Formulaires

Chaque formulaire suit le même schéma (`components/forms/use-action-form.ts`) :

1. un **schéma Zod** unique (`schemas.ts`), dont les messages sont des clés de traduction ;
2. le composant client valide avec ce schéma (React Hook Form) : confort pour l'utilisateur ;
3. l'**action serveur** revalide avec le même schéma : c'est la vraie barrière ;
4. l'action renvoie un `ActionResult` (`lib/action-result.ts`) : des clés
   d'erreur par champ ou globales, traduites par `useFormMessages()`.

Les champs numériques sont des champs texte qui acceptent la virgule décimale
(`lib/form-fields.ts`) : « 72,5 » vaut 72.5.

### Pages conservées entre deux navigations

Avec Cache Components, Next.js garde en mémoire (masquées) les dernières pages
quittées et les restaure telles quelles. Un brouillon de saisie survit donc à
un aller-retour, ce qui est voulu. En revanche, un message « Enregistré. » ou
une erreur ne doivent pas réapparaître : les formulaires les effacent quand la
page est masquée (`useLayoutEffect` avec fonction de nettoyage).

Chaque dossier de page de `app/(app)` a son `loading.tsx` : sans cette frontière
`<Suspense>` propre à la page, une navigation interne attendrait le serveur
avant d'afficher quoi que ce soit (`next dev` le signale).

Les messages bruts de Supabase ne sont jamais affichés : `features/auth/errors.ts`
les convertit en clés connues.

## Internationalisation

- Textes dans `messages/fr.json`, lus avec next-intl. Les clés sont typées :
  une clé inexistante est une erreur de compilation (`src/types/i18n.d.ts`).
- Les URL restent en anglais (`/nutrition`, `/training`) ; seuls les libellés sont traduits.
- Ajouter une langue : créer `messages/<code>.json`, l'ajouter dans
  `src/i18n/config.ts`, puis choisir la locale dans `src/i18n/request.ts`
  (profil de l'utilisateur ou cookie).
- Typographie française : espace insécable avant `:` et espace fine insécable avant `?` `!` `;`.

## Design system

Jetons définis dans `src/app/globals.css` : une palette neutre légèrement
froide, un seul accent (bleu outremer), deux rayons (contrôles, cartes).
Les composants n'utilisent que des rôles (`bg-surface`, `text-muted-foreground`,
`bg-primary`…), jamais une couleur en dur : le mode sombre en découle.

- Titres : Bricolage Grotesque. Texte et chiffres : Hanken Grotesk.
  Les deux polices sont servies par l'application (aucun appel à un service tiers).
- Thème clair / sombre / automatique, appliqué avant le premier affichage par un
  script en ligne (`components/theme/theme-script.tsx`) : pas de flash.
- Cibles tactiles d'au moins 44 px, focus clavier visible, lien d'évitement,
  `prefers-reduced-motion` respecté.

Les composants de `components/ui` suivent les conventions de shadcn/ui
(variantes `cva`, `cn()`, primitives Radix). Ils ont été écrits à la main car
le registre shadcn n'était pas joignable depuis l'environnement de
développement initial ; `npx shadcn@latest init` puis `add` pourront en ajouter
d'autres, à condition de les aligner sur les jetons ci-dessus.

## Graphiques

Recharts, avec une règle simple : une couleur pour la donnée qui compte (la
tendance, les apports), du gris pour le contexte (pesées brutes, objectif).
Couleurs validées contre les fonds clair et sombre (luminosité, contraste
≥ 3:1), jetons `--chart-*` dans `globals.css`. Chaque graphique est accompagné
d'un tableau des valeurs, pour ne jamais dépendre de la couleur ou du survol.

## Services externes et coûts

| Service         | Usage                           | Coût                                                                                                                        |
| --------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Supabase        | Auth, base, fichiers            | Gratuit pour démarrer (projet mis en pause après 1 semaine sans activité) ; Pro à partir de 25 $/mois                       |
| Vercel          | Hébergement                     | Hobby gratuit, usage non commercial uniquement ; Pro 20 $/mois                                                              |
| Fournisseur IA  | Photo de repas, coach           | **Non utilisé** : rien n'est activé, l'interface l'indique                                                                  |
| Open Food Facts | Produits emballés (code-barres) | Gratuit ; 15 consultations de produit par minute et par IP ; un produit scanné est copié dans les aliments de l'utilisateur |
| CIQUAL (ANSES)  | Aliments courants               | Gratuit (Licence Ouverte) ; importé une fois en base par migration                                                          |

Tarifs relevés le 10 octobre 2026 : à revérifier avant tout engagement.
