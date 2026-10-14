# Base de données

Schéma PostgreSQL versionné dans `supabase/migrations/`. 35 tables, toutes
protégées par la Row Level Security.

## Principes

1. **Chaque ligne a un propriétaire.** Les tables privées portent une colonne
   `user_id` (valeur par défaut `auth.uid()`), reliée à `auth.users` avec
   suppression en cascade. Supprimer un compte efface toutes ses données.
2. **RLS partout.** La procédure `private.apply_owner_rls('<table>')` active la
   RLS, crée une politique par opération limitée au propriétaire et accorde les
   droits au seul rôle `authenticated`. Le rôle `anon` n'a aucun droit.
3. **Tables enfants verrouillées par clé composite.** `recipe_ingredients`,
   `meal_items`, `workout_sets`, etc. référencent leur parent par
   `(parent_id, user_id)` : impossible de rattacher une ligne au parent d'un
   autre utilisateur, même en connaissant son identifiant.
4. **Validation en base.** Bornes numériques, listes de valeurs autorisées et
   cohérences sont des contraintes `CHECK` : une donnée absurde est refusée même
   si le code applicatif se trompe.
5. **Dates.** `*_on` et `entry_date` sont des jours civils dans le fuseau de
   l'utilisateur (`date`) ; `*_at` sont des instants (`timestamptz`).

## Migrations

| Fichier                                  | Contenu                                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `…120000_foundations`                    | Extensions (`pg_trgm`, `unaccent`), schéma `private`, procédures utilitaires                                                                                                                                    |
| `…120100_profiles`                       | `profiles`, `user_preferences`                                                                                                                                                                                  |
| `…120200_goals_and_tracking`             | Objectifs, cibles nutritionnelles, poids, mensurations, photos de progression, activité, eau, habitudes, rappels, badges, bilans                                                                                |
| `…120300_nutrition`                      | Aliments, catégories de repas, photos de repas, recettes, repas enregistrés, journal, plans, listes de courses                                                                                                  |
| `…120400_training`                       | Exercices, programmes, séances types, séances réalisées, séries                                                                                                                                                 |
| `…120500_ai`                             | Conversations, messages, journal d'usage                                                                                                                                                                        |
| `…120600_storage`                        | Buckets privés `meal-photos` et `progress-photos`                                                                                                                                                               |
| `…120700_new_user_bootstrap`             | Déclencheur d'initialisation d'un nouveau compte                                                                                                                                                                |
| `…090000_foods_search_trigger_definer`   | Le déclencheur de recherche des aliments ne dépend plus des droits sur le schéma `extensions`                                                                                                                   |
| `…140000_food_catalogue`                 | Copies privées Open Food Facts, rayon et régime des aliments, fonction `search_foods`, créneaux de repas des recettes, recettes de départ, portions au quart dans les plans                                     |
| `…140100_ciqual_2025`                    | Catalogue partagé : 3 285 aliments CIQUAL (fichier généré, voir le README)                                                                                                                                      |
| `…160000_training_programs`              | Exercices chronométrés, niveau et durée des programmes, thème des séances, une seule séance en cours par utilisateur, objectif d'entraînement                                                                   |
| `…160100_exercise_library`               | Bibliothèque partagée : 68 exercices (fichier généré depuis `src/domain/exercise-catalog.ts`)                                                                                                                   |
| `…090000_food_packages` (14/10)          | Taille et libellé de l'emballage d'un aliment (canette, paquet)                                                                                                                                                 |
| `…090100_exercise_library_more` (14/10)  | Bibliothèque portée à 121 exercices (fichier généré)                                                                                                                                                            |
| `…090200_start_session_function` (14/10) | Fonction `start_session` : démarre une séance (séance, plan, séries) en une transaction, droits de l'utilisateur (RLS)                                                                                          |
| `…200000_session_plan` (13/10)           | Plan propre à chaque séance (`session_exercises` : ordre, objectifs, superset, exercice remplacé, note) repris des séances existantes ; supersets des séances types                                             |
| `…120000_notifications` (14/10)          | Abonnements (`push_subscriptions`), alarme de fin de repos (`push_alarms`), rappels traités (`reminders.last_sent_on`), fonctions `private.due_*` et `push_tick`, tâches `pg_cron` (voir docs/NOTIFICATIONS.md) |
| `…120100_delete_account` (14/10)         | Fonction `delete_my_account()` : supprime le compte connecté et toutes ses données (cascade)                                                                                                                    |
| `…090000_flexible_schedule` (13/10)      | Planning souple : `workout_sessions.original_date` (occurrence déplacée, sautée ou faite un autre jour), une seule modification par occurrence, séance sautée à sa date                                         |

## Tables par domaine

**Compte** — `profiles` (1 par compte), `user_preferences` (1 par compte :
alimentation, sport, réglages), `reminders`, `push_subscriptions` (un par
appareil), `push_alarms`, `user_achievements`.

**Objectifs et suivi** — `user_goals` (un seul objectif principal actif, les
anciens restent en historique), `nutrition_targets` (cibles datées, avec la
formule et les données d'entrée du calcul), `weight_entries` (une pesée par
jour), `body_measurements`, `progress_photos`, `activity_entries`,
`water_entries`, `habits` → `habit_entries`, `weekly_reviews`.

**Nutrition** — `foods`, `meal_categories`, `food_diary_entries`, `meal_photos`,
`recipes` → `recipe_ingredients`, `meals` → `meal_items`, `meal_plans` →
`meal_plan_items`, `shopping_lists` → `shopping_list_items`.

**Entraînement** — `exercise_library`, `training_programs` → `workouts` →
`workout_exercises`, `workout_sessions` → `workout_sets`.

**IA** — `ai_conversations` → `ai_messages`, `ai_usage_log`.

## Choix à connaître

- **Catalogues partagés.** Dans `foods` et `exercise_library`, `owner_id NULL`
  désigne une entrée de référence, lisible par tous les utilisateurs connectés
  et modifiable uniquement par le serveur. Les entrées personnelles
  (`owner_id = utilisateur`) restent privées.
- **Source des valeurs nutritionnelles.** `foods.source` (`ciqual`,
  `open_food_facts`, `user`, `ai_estimate`) et `foods.data_quality`
  (`verified`, `community`, `user`, `estimated`) distinguent les données
  vérifiées des estimations. `food_diary_entries.is_estimate` le reporte dans le journal.
- **Historique figé.** `food_diary_entries` stocke les calories et macros
  calculées au moment de la saisie. Corriger un aliment ne réécrit pas le passé.
- **Cru, cuit, tel que vendu.** `foods.preparation_state` : le riz cru et le riz
  cuit sont deux aliments distincts. `food_diary_entries.quantity_state`
  précise à quoi correspond la quantité saisie.
- **Régime alimentaire.** Pas de catégorie religieuse : les exclusions se
  déclarent dans `user_preferences.excluded_ingredients` sans justification.
- **Allergies.** `user_preferences.allergies` est une contrainte stricte,
  appliquée par le code et non laissée à l'appréciation de l'IA.
- **Prix.** `shopping_list_items.estimated_price_eur` ne peut pas être rempli
  sans `price_source` : aucun prix inventé.
- **Journal d'usage IA.** L'utilisateur peut lire et ajouter des lignes dans
  `ai_usage_log`, pas les modifier ni les supprimer : un quota ne se contourne
  pas en effaçant son historique. Ce journal ne contient ni question ni réponse.
- **Photos.** `meal_photos.expires_at` et
  `user_preferences.meal_photo_retention_days` portent la durée de conservation.
  Aucune photo n'est stockée tant que l'analyse de repas (payante) reste désactivée.
- **Habitudes.** `habits` ne contient que les réglages (suivie ou non, objectif
  s'il diffère de celui du profil) ; les valeurs viennent des tables existantes
  (journal, eau, pas, séances). Seul le sommeil est saisi dans `habit_entries`.

## Types TypeScript

`src/types/database.ts` est généré par `npm run db:types` à partir des
migrations. Les colonnes limitées par un `CHECK … IN (…)` deviennent des unions
littérales (`"draft" | "active" | "archived"`).

La CLI Supabase propose aussi sa propre génération de types (`supabase gen types`),
relations comprises ; elle pourra remplacer ce script une fois le projet relié.

## Tests

`tests/db/rls.test.ts` applique les migrations dans un PostgreSQL en mémoire et
vérifie notamment : RLS active et politiques présentes sur toutes les tables,
aucun droit pour `anon`, cloisonnement en lecture / modification / suppression,
refus d'écrire au nom d'un autre, catalogues partagés en lecture seule,
cloisonnement des fichiers par dossier utilisateur, suppression en cascade.

`tests/db/supabase-shim.sql` reproduit le strict minimum de l'environnement
Supabase (rôles, `auth.users`, `auth.uid()`, schéma `storage`) pour ces tests.
