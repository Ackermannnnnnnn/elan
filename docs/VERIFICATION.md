# Ce qui a été vérifié

Dernière mise à jour : 13 octobre 2026, phase 5 complétée (séances sur mesure, planning souple).

## Vérifications automatiques (reproductibles avec `npm run check`)

| Vérification                            | Résultat                                |
| --------------------------------------- | --------------------------------------- |
| TypeScript strict (`npm run typecheck`) | Aucune erreur                           |
| ESLint (`npm run lint`)                 | Aucune erreur, aucun avertissement      |
| Tests (`npm test`)                      | 309 tests réussis                       |
| Build de production (`npm run build`)   | Réussi, avec et sans variables Supabase |

Ce que couvrent les tests :

- **Calculs** (`src/domain`) : métabolisme, maintien, objectif calorique,
  plafonds et planchers, macros, durée estimée, garde-fous, moyenne glissante,
  tendance et stagnation, apports d'un repas, dates et fuseaux horaires. Les
  valeurs attendues ont été calculées à la main à partir des formules de
  [`CALCULS.md`](CALCULS.md).
- **Base de données** (28 tests sur les vraies migrations) : RLS sur toutes les
  tables, aucun droit pour les visiteurs, cloisonnement entre utilisateurs,
  catalogues partagés en lecture seule, stockage des photos, contraintes,
  suppression en cascade. Éprouvés par mutation : en affaiblissant
  volontairement les règles, les tests concernés échouent.
- **Formulaires et sécurité** : validation, redirections ouvertes bloquées,
  traduction des erreurs d'authentification.
- **Phase 5** : bibliothèque d'exercices (identifiants, consignes, concordance
  exacte avec la base), structures et prescriptions par objectif, durée
  estimée, programmes en salle et sans matériel, zones sensibles jamais
  enfreintes, exercices refusés écartés et appréciés favorisés, muscles à
  privilégier, remplacements (même muscle, « plus facile sans machine »,
  matériel et zones sensibles), double progression et force estimée ; côté
  base : une seule séance en cours par compte, cloisonnement.
- **Séances sur mesure et planning** : semaine datée (occurrences, séances
  déplacées, sautées, ajoutées, faites un autre jour, bornes de navigation),
  recherche dans la bibliothèque, durée estimée calculée à la main, chaque
  illustration rattachée à un exercice existant avec ses deux images ; côté
  base : une seule modification par occurrence, séance sautée à sa date,
  exercice personnel privé et non supprimable s'il est utilisé.
- **Phase 4** : classement des aliments (allergènes, régime, rayon, état cru ou
  cuit) sur plus de 60 noms réels de CIQUAL, faux amis compris ; apports d'une
  recette calculés à la main ; plan de la semaine (allergies jamais
  enfreintes sur 20 graines, journées à ±10 % de la cible sur 50 graines, pas
  deux fois le même plat dans la journée, déterminisme) ; liste de courses
  (prorata des portions, arrondis, total des seuls prix saisis) ; conversion
  d'une fiche Open Food Facts. Côté base : catalogue CIQUAL lisible mais non
  modifiable, recherche classée, copie privée unique par code-barres, chacun
  des codes CIQUAL des 22 recettes de départ, plans réalistes pour quatre
  profils (1 500 à 3 000 kcal, omnivore à végétalien).

## Parcours vérifiés dans un vrai navigateur

80 parcours joués dans Chromium, contre le build de production **et** contre
`npm run dev`, sans aucune erreur ni avertissement dans la console ni dans le
journal du serveur :

- **Authentification** (21) : inscription, confirmation, connexion, mot de passe
  oublié, déconnexion, redirections, absence d'énumération de comptes, thème,
  navigation au clavier, mobile.
- **Onboarding** (10) : champs obligatoires, consentement, refus des mineurs,
  virgule décimale, poids visé en sous-poids refusé avec le minimum sain
  proposé, niveau d'activité suggéré, retour en arrière sans perte de saisie,
  **chiffres du plan identiques au calcul fait à la main**, plancher de 1 200 kcal.
- **Phase 3** (21) : création d'aliment, ajout en grammes et en portions avec
  aperçu en direct, recherche sans accents, saisie rapide, totaux du jour,
  modification et suppression, apports figés quand un aliment change, copie
  d'un repas, eau, pas, pesées rétroactives, courbe et périodes, tendance,
  recalcul proposé après 2 kg d'écart, mensurations, objectifs manuels avec
  plancher, modification du profil, **cloisonnement entre deux comptes**,
  absence de défilement horizontal sur mobile.

- **Phase 4** (14) : recettes de départ, fiche recette (520 kcal par portion,
  conforme au calcul manuel), ajout d'une recette au journal puis modification
  des portions, création d'une recette avec recherche d'ingrédients et aperçu
  (243 kcal attendus et obtenus), plan de la semaine à ±10 % chaque jour,
  ajout d'un repas du plan au journal, échange de recette, liste de courses
  (rayons, cocher, prix, article ajouté conservé après recalcul), code-barres
  (format invalide, produit inconnu, fiche incomplète, produit trouvé avec ses
  allergènes), scan depuis l'ajout d'un repas, aliment CIQUAL trouvé par la
  recherche, et un **profil végétalien allergique au lait sur mobile : aucune
  recette interdite proposée**.

- **Phase 5** (14) : configuration pré-remplie depuis l'onboarding, structure
  conseillée et structures impossibles masquées, semaine aux bons jours,
  **genou déclaré sensible : aucun squat, presse ni fente**, remplacement d'un
  exercice, filtre « plus facile, sans machine », déplacement d'une séance,
  série ajoutée au programme, séance en direct (séries validées, minuteur de
  repos, série ajoutée puis retirée, pause et reprise, séries non validées
  écartées, bilan : 800 kg de volume attendus et obtenus), seconde séance avec
  **objectif proposé de 42,5 kg × 6 et hausse de force estimée de 0,5 kg**,
  conformes au calcul manuel, historique et courbe d'un exercice, abandon
  d'une séance, mobile en thème sombre sans défilement horizontal.

**Limite.** Ces parcours tournent contre une doublure de Supabase (Auth et
API REST) adossée à un vrai PostgreSQL où les migrations du projet sont
appliquées : la RLS, les déclencheurs et les contraintes sont donc réels. La
doublure n'est pas livrée avec le projet. La phase 2 a par ailleurs été
validée sur un vrai projet Supabase (inscription, e-mail, profil, déconnexion).

## Caméra du scan (correctif du 14 octobre)

Défaut signalé par Moh : la caméra s'allumait et s'éteignait en boucle. Cause :
la lecture redémarrait à chaque nouvel affichage du formulaire. Test ajouté :
fausse caméra filmant une scène sans code-barres pendant 5 s, ouvertures de
caméra comptées — 63 avant le correctif, 1 après ; arrêt puis relance manuels
vérifiés ; le scan complet (lecture, import, portions) repasse.

## Retours de Moh du 14 octobre (30 étapes, ordinateur et mobile)

- **Objectif** « perdre du poids et prendre du muscle » choisi à l'inscription
  (poids visé obligatoire, rythme), enregistré ; IMC affiché (25,2, surpoids,
  59,0 – 78,5 kg pour 1,78 m).
- **Scan par la caméra** : Chromium reçoit une fausse caméra filmant un vrai
  code EAN-13 ; sans lecteur intégré, c'est le décodeur libre (ZXing, servi
  par l'application) qui lit le code ; produit importé d'un faux Open Food
  Facts (canette de 33 cl), boutons « Tout l'emballage (33 cl) » et « La
  moitié (165 ml) », 165 ml enregistrés, aliment « pour 100 ml ».
- **Entraînement** : repos choisi en deux gestes (séance type et en pleine
  séance, repris par le minuteur), séance déplacée depuis la semaine en deux
  gestes, recherche par autres noms (« kickback »…).
- **Rapidité** mesurée avec 90 ms de délai simulé par requête vers la base
  (application et base sur deux continents) : séance affichée 1,3 s après
  « Démarrer » ; série validée et minuteur visibles en 0,2 s.

## Séance à la salle et imprévus (12 parcours × 3)

Contre la pile Supabase locale, en production (ordinateur et mobile) et avec
`npm run dev`, sans erreur ni débordement horizontal sur mobile : superset dans
la séance type puis copié dans la séance, minuteur (position en bas d'écran,
+15 s, reprise après rechargement, passer), validation en un geste, machine
prise (séries faites conservées, série restante sur le nouvel exercice,
programme intact), enchaînement puis repos du superset, note rappelée à la
séance suivante, « faire plus tard » (superset rompu), exercice passé, exercice
tenu ajouté en pleine séance avec chrono, changement « aussi le programme »
depuis la bibliothèque, séance abandonnée puis séance libre.

Défauts trouvés et corrigés : un libellé trop long et le sélecteur « cette
séance / programme » faisaient déborder l'écran du téléphone.

## Séances sur mesure et planning souple (13 parcours × 3)

Joués contre une pile Supabase locale réelle (PostgreSQL 16, Supabase Auth,
PostgREST), en production sur ordinateur et sur mobile, puis avec
`npm run dev` ; aucune erreur dans la console ni dans le journal du serveur :
séance composée sans programme, recherche et filtres, « Voir le mouvement »
(images locales chargées, animation, pause, lien vidéo), ordre et prescription
(erreur max < min affichée), retrait, durée recalculée, semaine suivante,
déplacement puis retour à la date d'origine, saut puis rétablissement, séance
ajoutée un autre jour puis lancée et terminée, passage « à la demande »,
exercice personnel (ajout direct, suppression refusée s'il est utilisé,
modification, suppression), programme généré qui conserve les séances
composées à la main, ajout d'un exercice à une séance générée.

Défaut trouvé et corrigé : après « Effacer les filtres », le champ de
recherche gardait l'ancien texte.

## Un défaut trouvé et corrigé pendant ces vérifications

Créer un aliment échouait (« permission denied for schema extensions ») quand
le rôle de l'utilisateur n'avait pas accès au schéma `extensions`. Supabase
accorde normalement ce droit, mais la migration
`20261012090000_foods_search_trigger_definer.sql` supprime cette dépendance.
Un test de base de données reproduit le cas et échoue sans la migration.

**Open Food Facts** a été remplacé par une doublure locale qui renvoie des
fiches au format de l'API v2 (modelées sur les réponses de référence des tests
d'Open Food Facts) : l'appel réel au service n'a pas pu être fait depuis
l'environnement de développement, qui n'a pas accès à Internet.

## Un second défaut corrigé

En mode développement, le message « Ce lien n'est plus valide » n'apparaissait
pas sur la page de connexion : la double exécution des effets en mode strict
l'effaçait aussitôt. Le message est désormais lu dans l'adresse de la page.

## Non vérifié à ce stade

- Les écrans de la phase 4 sur le vrai projet Supabase (à faire après
  `npx supabase db push`), et l'appel réel à Open Food Facts.
- Le scan par la caméra : il dépend du lecteur de codes-barres du navigateur
  (Chrome sur Android notamment) ; ailleurs, le code se saisit à la main.
- Safari / iOS et Firefox, lecteurs d'écran, déploiement sur Vercel.
