# Élan

Coach personnel pour la nutrition, l'entraînement et le suivi du poids.
Application web (mobile d'abord) : Next.js, TypeScript, Tailwind CSS, Supabase.

> « Élan » est un nom de travail. Il se change dans `src/config/app.ts`.

## État du projet

| Phase | Contenu                                                                                          | État     |
| ----- | ------------------------------------------------------------------------------------------------ | -------- |
| 1     | Analyse et architecture                                                                          | Terminée |
| 2     | Fondations : projet, design system, base de données + RLS, authentification, structure des pages | Terminée |
| 3     | Onboarding, calculateur calorique, dashboard, poids, journal alimentaire                         | Terminée |
| 4     | Base d'aliments (CIQUAL, Open Food Facts), recettes, plan de la semaine, courses — sans IA       | Terminée |
| 5     | Programmes, séances, remplacement d'exercices, progression, séances sur mesure — sans IA         | Terminée |
| 6     | Habitudes, rappels et notifications, application installable, export et suppression des données  | Terminée |

Ce qui fonctionne aujourd'hui :

- **Compte** : inscription, confirmation par e-mail, connexion, mot de passe
  oublié, déconnexion. Application réservée aux majeurs.
- **Onboarding** en 5 étapes, avec consentement, garde-fous sur l'objectif et
  un plan de départ dont chaque chiffre est expliqué ; modifiable ensuite depuis le profil.
- **Calculateur** : métabolisme, maintien, objectif calorique, macros, durée
  estimée. Formules et seuils dans [`docs/CALCULS.md`](docs/CALCULS.md).
- **IMC** sur l'accueil et dans Progrès (classe de l'OMS, fourchette saine, limites).
- **Accueil** : calories restantes, macros, poids sur 30 jours, eau, pas,
  calories et protéines des 14 derniers jours.
- **Journal alimentaire** : repas par jour, aliments personnels créés depuis
  l'étiquette, quantités en grammes ou en portions, saisie rapide, modification,
  suppression, copie d'un repas d'un autre jour.
- **Progrès** : pesées (y compris rétroactives), courbe avec moyenne sur
  7 jours et périodes, tendance et stagnation, mensurations, historique des objectifs.
- **Objectifs nutritionnels** : recalcul proposé quand le poids change, réglage
  manuel avec plancher de sécurité.

- **Base d'aliments** : table CIQUAL 2025 de l'ANSES (3 285 aliments) importée
  en base, recherche classée sans accents, produits emballés par code-barres
  via Open Food Facts (saisie ou caméra du téléphone), allergènes par aliment.
- **Recettes** : création à partir de la base d'aliments, apports par portion
  calculés, 22 recettes de départ à copier, ajout au journal en portions.
- **Plan de la semaine** : généré par un algorithme (sans IA) à partir des
  recettes, en respectant allergies, régime, ingrédients exclus et temps de
  cuisine ; portions ajustées pour approcher l'objectif ; repas échangeables et
  ajoutables au journal.
- **Liste de courses** : calculée depuis le plan, rangée par rayon, articles à
  cocher, prix saisis (aucun prix inventé), comparaison au budget.

- **Entraînement** : bibliothèque de 121 exercices avec consignes ; programme
  généré selon l'objectif, le niveau, le matériel, le temps disponible et les
  zones sensibles (corps entier, haut / bas, poussée / tirage / jambes) ;
  remplacement d'un exercice (même muscle, filtres « plus facile », « sans
  machine », « sans matériel ») ; séries modifiables.
- **Séances sur mesure** : bibliothèque consultable (recherche sans accents,
  filtre par muscle et par matériel), séances composées à la main (ajout,
  ordre, séries / répétitions / repos), exercices personnels, et bouton
  **« Voir le mouvement »** (photos de départ et d'arrivée, lien vers des vidéos).
- **Planning souple** : semaine datée et navigable ; une séance se déplace ou
  se saute pour une seule date, se rattrape un autre jour, change de jour
  habituel ou devient « à la demande » ; on peut ajouter une séance à
  n'importe quel jour.
- **Séance en direct** : charges et répétitions par série (validation en un
  geste avec les valeurs proposées), grand minuteur de repos en bas de l'écran
  (±15 s, passer, bips et vibration, écran maintenu allumé), pause, fin de
  séance avec ressenti, objectif proposé d'une séance à l'autre (double
  progression), historique et courbe de force estimée par exercice.
- **Rapidité** : démarrer une séance se fait en un seul échange avec la base
  (fonction `start_session`) ; une série validée passe au vert et lance le
  repos immédiatement ; temps de repos réglable en deux gestes ; séance
  déplaçable depuis la semaine en deux gestes.
- **Imprévus en séance** : changer un exercice (machine prise) pour la séance
  ou aussi dans le programme, faire un exercice plus tard, réordonner, ajouter
  ou passer un exercice, supersets (dans la séance type ou en direct), notes
  rappelées la fois suivante, chrono pour les exercices tenus, séance libre.

- **Habitudes** : repas notés, hydratation, marche, sommeil, séances par
  semaine — calculées depuis ce qui est déjà enregistré (seul le sommeil se
  note à part) ; séries et régularité sur 7 et 28 jours, sans culpabilisation.
- **Rappels et notifications** : pesée, journal des repas, entraînement,
  préparation des repas (heure et jours au choix) et **fin de repos même écran
  verrouillé**. Gratuit ; mise en service unique décrite dans
  [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md).
- **Application installable** sur l'écran d'accueil (Android, iPhone, ordinateur),
  page « hors connexion ».
- **Mes données** : export complet en un fichier (JSON) et suppression
  définitive du compte, protégée par le mot de passe.

**Pas d'IA, pas de frais.** La photo de repas et les coachs IA demandent un
service payant : ils ne sont pas activés et l'application l'indique clairement.

Le détail de ce qui a été vérifié, et comment, est dans [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Prérequis

- Node.js 22.18 ou plus récent (`node -v`)
- Un compte [Supabase](https://supabase.com) (l'offre gratuite suffit pour démarrer)

## Installation

```bash
npm install
cp .env.example .env.local
```

Tant que `.env.local` n'est pas rempli, l'application affiche une page
« Configuration » qui explique quoi faire. Rien n'est simulé.

### 1. Créer le projet Supabase

Sur [supabase.com](https://supabase.com), créer un projet dans une région
européenne (les données de santé restent dans l'UE). Dans
**Project Settings → API Keys**, copier l'URL du projet et la clé
_publishable_ dans `.env.local`.

### 2. Créer les tables

Les migrations SQL sont dans `supabase/migrations/`. Avec la CLI Supabase :

```bash
npx supabase init          # une seule fois : crée supabase/config.toml
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
```

La référence du projet est la partie de l'URL avant `.supabase.co`.
`db push` applique les migrations dans l'ordre et retient celles déjà passées.

### 3. Régler l'authentification

Dans **Authentication → URL Configuration** :

- **Site URL** : `http://localhost:3000` (puis l'adresse de production)
- **Redirect URLs** : ajouter `http://localhost:3000/auth/confirm`

Les modèles d'e-mail par défaut fonctionnent. Pour que les liens marchent
aussi quand l'e-mail est ouvert sur un autre appareil que celui de
l'inscription, remplacer le lien dans **Authentication → Email Templates** :

- _Confirm signup_ : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- _Reset password_ : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

### 4. Lancer

```bash
npm run dev
```

Ouvrir <http://localhost:3000>. Après une modification de `.env.local`, arrêter
puis relancer le serveur.

## Commandes

| Commande                             | Rôle                                                   |
| ------------------------------------ | ------------------------------------------------------ |
| `npm run dev`                        | Serveur de développement                               |
| `npm run build` puis `npm run start` | Version de production en local                         |
| `npm run typecheck`                  | Types des routes + vérification TypeScript             |
| `npm run lint`                       | ESLint                                                 |
| `npm test`                           | Tests unitaires et tests des politiques RLS            |
| `npm run check`                      | Tout ce qui précède, plus le build                     |
| `npm run db:types`                   | Régénère `src/types/database.ts` depuis les migrations |
| `npm run format`                     | Met en forme le code avec Prettier                     |

Les tests RLS appliquent les vraies migrations dans un PostgreSQL en mémoire
(PGlite) : ni Docker ni projet Supabase ne sont nécessaires pour les lancer.

## Organisation du code

```
src/
  app/(auth)/        connexion, inscription, mot de passe oublié / nouveau
  app/(app)/         espace privé : accueil, nutrition, training, progress, profile
  app/auth/confirm/  destination des liens reçus par e-mail
  app/setup/         page affichée tant que Supabase n'est pas configuré
  components/ui/     design system (bouton, champ, carte, alerte…)
  components/layout/ barre latérale, barre d'onglets mobile, en-tête de page
  features/          une fonctionnalité = schémas Zod + actions serveur + composants
  domain/            calculs purs : énergie, macros, poids, recettes, plan, courses
  data/              accès aux données (seul endroit qui interroge Supabase)
  lib/               clients Supabase, session, variables d'environnement
  config/            nom de l'application, routes
  i18n/              configuration des langues
messages/            textes de l'interface (fr.json)
supabase/migrations/ schéma SQL versionné et politiques RLS
tests/db/            tests des politiques RLS
docs/                architecture, calculs, base de données, sécurité, vérification
```

À lire ensuite : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/CALCULS.md`](docs/CALCULS.md),
[`docs/DATABASE.md`](docs/DATABASE.md),
[`docs/SECURITY.md`](docs/SECURITY.md).

## Mettre à jour une installation existante

Après avoir récupéré une nouvelle version du code :

```bash
npm install
npx supabase db push      # applique les nouvelles migrations, s'il y en a
npm run dev
```

## Mettre à jour la table CIQUAL

La migration `…140100_ciqual_2025.sql` est générée à partir du fichier CSV
français publié par l'ANSES :

```bash
node scripts/build-ciqual-migration.ts CIQUAL2025_FR.csv supabase/migrations/<horodatage>_ciqual.sql
```

L'import met à jour les aliments existants (même code CIQUAL) sans toucher aux
journaux ni aux recettes.

## Modifier la bibliothèque d'exercices

Les exercices de référence sont définis dans `src/domain/exercise-catalog.ts`.
Leurs illustrations (« Voir le mouvement ») viennent de
[Free Exercise DB](https://github.com/yuhonas/free-exercise-db), domaine public :
la correspondance est dans `src/domain/exercise-demos.ts` et les images sont
copiées dans `public/exercises/` par `node scripts/fetch-exercise-demos.ts`
(à relancer seulement après avoir modifié cette correspondance).
Après une modification, régénérer une **nouvelle** migration :

```bash
node scripts/build-exercise-migration.ts supabase/migrations/<horodatage>_exercises.sql
```

Un test vérifie que la base et le catalogue concordent.

## Modifier la base de données

1. Ajouter un fichier dans `supabase/migrations/` (ne jamais modifier une
   migration déjà appliquée en production).
2. `npm run db:types` pour régénérer les types TypeScript.
3. `npm test` : un test échoue si une table est créée sans RLS, sans politique,
   ou avec un droit accordé aux visiteurs non connectés.
4. `npx supabase db push` pour l'appliquer au projet.

## Déploiement (Vercel)

1. Importer le dépôt dans Vercel.
2. Renseigner les variables de `.env.example` dans **Settings → Environment
   Variables**, avec `NEXT_PUBLIC_SITE_URL` égal au domaine de production.
3. Ajouter `https://<domaine>/auth/confirm` aux Redirect URLs de Supabase.

Utiliser un projet Supabase distinct pour la production et pour le développement.

Notifications (facultatif, gratuit) : voir [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md).
