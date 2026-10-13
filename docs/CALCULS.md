# Calculs : formules, seuils et garde-fous

Tous les chiffres affichés par l'application sont calculés par le code de
`src/domain/`, avec des formules publiées. Aucun n'est produit par une IA.
Chaque formule est couverte par des tests dont les valeurs attendues ont été
calculées à la main (`src/domain/*.test.ts`).

Ce sont des **estimations** : une formule de métabolisme se trompe couramment
de 10 % d'une personne à l'autre. L'application le dit, montre ses hypothèses
et laisse ajuster les objectifs.

## Besoins énergétiques (`energy.ts`)

| Étape                     | Formule                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Métabolisme de base       | Mifflin-St Jeor : 10 × poids + 6,25 × taille − 5 × âge + s, avec s = +5 (homme), −161 (femme), −78 (non précisé : moyenne des deux)           |
| Maintien                  | Métabolisme × coefficient d'activité : 1,2 / 1,375 / 1,55 / 1,725 / 1,9                                                                       |
| Niveau d'activité suggéré | Barème de points sur le métier (0 à 3), les pas (0 à 3) et les minutes de sport par semaine (0 à 3) ; l'utilisateur peut toujours le corriger |
| Perte de poids            | Rythme en % du poids par semaine : 0,25 / 0,5 / 0,75 ; déficit = rythme × 7 700 kcal / 7                                                      |
| Prise de masse            | Rythme : 0,1 / 0,25 / 0,4 % par semaine ; surplus calculé de la même façon                                                                    |
| Recomposition             | 10 % sous le maintien                                                                                                                         |
| Maintien, forme           | Cible = maintien                                                                                                                              |

### Garde-fous

- **Déficit plafonné** à 25 % du maintien. Si le rythme demandé l'exige, le
  rythme attendu est recalculé et l'utilisateur en est informé.
- **Plancher calorique** : 1 200 kcal (femme), 1 500 kcal (homme ou non
  précisé). Une cible plus basse n'est ni proposée ni acceptée en réglage
  manuel. Si le maintien estimé est déjà sous ce plancher, aucun déficit n'est
  appliqué et un avertissement recommande un avis professionnel.
- **Surplus plafonné** à 15 % du maintien et à 500 kcal.
- **Objectifs refusés** : moins de 18 ans ; poids visé correspondant à un IMC
  inférieur à 18,5 (le minimum sain pour la taille est proposé) ; perte de poids
  avec un IMC déjà inférieur à 18,5 ; poids visé à contresens de l'objectif.
- **Avertissements** (sans blocage) : IMC ≥ 35, perte visée > 20 % du poids,
  65 ans et plus, perte avec un IMC < 20, maintien inférieur au plancher.

## Macronutriments

| Nutriment          | Règle                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Protéines          | 2,0 g/kg (perte, recomposition), 1,8 g/kg (prise de masse), 1,6 g/kg (maintien, forme), plafonnées à 35 % de l'énergie |
| Poids de référence | Poids réel ; au-delà d'un IMC de 30 : poids à IMC 25 + 40 % de l'écart                                                 |
| Lipides            | 25 % de l'énergie, avec un minimum de 0,6 g/kg                                                                         |
| Glucides           | Le reste de l'énergie (4 kcal/g pour protéines et glucides, 9 pour les lipides)                                        |
| Fibres             | 14 g pour 1 000 kcal (repère indicatif)                                                                                |

Réglage manuel : l'utilisateur fixe calories, protéines et lipides ; les
glucides sont déduits de l'énergie restante.

## Suivi du poids (`weight-trend.ts`)

- **Moyenne glissante** sur 7 jours civils (et non sur 7 mesures).
- **Tendance** : pente de la droite des moindres carrés sur la moyenne
  glissante des 28 derniers jours, exprimée en kg par semaine.
- **Pas de conclusion hâtive** : il faut au moins 6 pesées étalées sur 21 jours.
- **Stagnation** : pente inférieure à 0,1 kg par semaine sur cette fenêtre.
  L'application propose alors de vérifier la régularité du suivi ; elle ne
  baisse jamais les calories d'elle-même.
- **Recalcul proposé** quand le poids s'écarte d'au moins 2 kg de celui ayant
  servi au calcul. Rien ne change sans clic de l'utilisateur.

## Journal alimentaire (`nutrition.ts`)

- Apports d'une quantité = valeurs pour 100 g (ou 100 ml) × quantité / 100.
- Portions converties en grammes à partir du poids de portion de l'aliment.
- Les apports sont **figés** au moment de la saisie : corriger un aliment plus
  tard ne réécrit pas l'historique.
- Une étiquette saisie à la main est contrôlée : si l'énergie s'écarte de plus
  de 25 % (ou 25 kcal) de celle recalculée depuis les macros, un avertissement
  suggère une confusion entre valeurs « pour 100 g » et « par portion ».

## Base d'aliments (`food-classification.ts`)

- **CIQUAL 2025** (ANSES), valeurs pour 100 g. Énergie : colonne « règlement UE
  1169/2011 » (à défaut, celle avec fibres). Protéines : facteur de Jones (à
  défaut N × 6,25). « traces » vaut 0 ; « < x » vaut x / 2 ; « - » est inconnu.
  Un aliment sans énergie, protéines, glucides ou lipides connus n'est pas
  importé (159 sur 3 444), ni les aliments infantiles.
- **Allergènes** : CIQUAL n'en fournit pas. Ils sont déduits du nom par des
  mots-clés (14 allergènes UE), de façon **volontairement prudente** : un faux
  positif écarte un aliment, un faux négatif mettrait quelqu'un en danger. Les
  faux amis connus sont neutralisés (« lait de coco », « beurre de cacahuète »,
  « vermicelles de riz », « haricot beurre », « sans gluten »…) et couverts par
  des tests. Pour Open Food Facts : allergènes **et traces** déclarés, plus ceux
  que révèle le nom. Pour un aliment saisi à la main : cases cochées plus ceux
  que révèle le nom.
- **Régime** : végétalien, végétarien (lait, œuf, miel), poisson, viande ou
  inconnu, d'après le groupe CIQUAL puis le nom (un plat « au lard » devient
  « viande »). Un aliment qui contient probablement du lait ou des œufs n'est
  jamais classé végétalien.
- **Rayon** de la liste de courses : d'après le groupe CIQUAL ou les catégories
  Open Food Facts.

## Recettes (`recipe.ts`)

- Apports de la recette = somme des ingrédients (quantités crues, en grammes) ;
  par portion = total ÷ nombre de portions. Les ingrédients facultatifs ne
  comptent pas.
- Allergènes de la recette = union de ceux de **tous** les ingrédients, y
  compris facultatifs. Régime = le plus restrictif des ingrédients.
- Les apports sont recalculés à chaque lecture depuis les aliments ; une
  portion ajoutée au journal est figée comme tout aliment.

## Plan de la semaine (`meal-planner.ts`)

Algorithme déterministe, sans IA :

1. **Contraintes strictes** — une recette est écartée si elle contient un
   allergène déclaré (code UE, ou mot saisi librement retrouvé dans un nom
   d'ingrédient), un ingrédient exclu, un aliment incompatible avec le régime,
   si sa préparation + cuisson dépasse le temps disponible par repas, ou si son
   calcul est incomplet.
2. **Répartition** de la cible du jour : petit-déjeuner 25 %, déjeuner 35 %,
   dîner 30 %, collation 10 %. Un repas sans recette compatible est retiré et sa
   part répartie sur les autres.
3. **Choix** par repas : score = écart de calories relatif + 0,5 × manque de
   protéines relatif + pénalités de répétition (même recette la veille au même
   repas, usages dans la semaine, même plat déjà servi dans la journée) + une
   petite part de hasard (graine aléatoire, enregistrée avec le plan).
4. **Portions** par quarts, entre 0,5 et 2,5 ; puis **équilibrage** de la
   journée : on ajoute ou retire un quart de portion là où cela rapproche le
   plus le total de la cible.
5. **Avertissements** : journée à plus de 10 % de la cible, protéines sous
   80 % de la cible.

## Liste de courses (`shopping.ts`)

- Quantité d'un ingrédient = quantité de la recette × portions planifiées ÷
  portions de la recette, additionnée par aliment, arrondie au-dessus (au
  gramme sous 20 g, puis par 5 g).
- Aucun prix n'est estimé : le total n'additionne que les prix saisis, et
  indique combien d'articles n'en ont pas.

## Programme d'entraînement (`training-program.ts`)

- **Matériel** : en salle, tout le matériel courant ; à domicile ou dehors,
  seulement ce qui a été coché (rien = poids du corps).
- **Contraintes strictes** : un exercice n'est jamais proposé s'il exige du
  matériel absent, s'il sollicite une zone déclarée sensible, s'il a été
  refusé, ou s'il est d'un niveau supérieur à celui de la personne.
- **Structure conseillée** : 1 à 3 séances → corps entier ; 4 → haut / bas ;
  5 ou 6 → haut / bas pour un débutant, poussée / tirage / jambes sinon. Pas de
  poussée / tirage / jambes sous 3 séances. Jours répartis (ex. 4 séances :
  lundi, mardi, jeudi, vendredi).
- **Séances types** : une suite de créneaux (schéma de mouvement et muscle,
  avec une priorité). Chaque créneau reçoit le meilleur exercice compatible :
  exercice apprécié +2, du niveau de la personne +0,5, polyarticulaire sur un
  créneau principal +0,5, chargeable (haltères, barre, machine, kettlebell)
  +0,75 ou élastique +0,25, déjà utilisé dans une autre séance −0,6 par usage.
  Sans candidat, le créneau se rabat sur le même groupe musculaire (un squat
  impossible pour un genou sensible devient un exercice de fessiers).
- **Séries, répétitions, repos** selon l'objectif :

  | Objectif         | Polyarticulaire | Isolation       |
  | ---------------- | --------------- | --------------- |
  | Force            | 4 × 3–5, 180 s  | 3 × 8–12, 90 s  |
  | Prise de muscle  | 3 × 6–10, 120 s | 3 × 10–15, 75 s |
  | Perte de graisse | 3 × 8–12, 90 s  | 3 × 12–15, 60 s |
  | Endurance        | 3 × 12–15, 60 s | 2 × 15–20, 45 s |
  | Remise en forme  | 3 × 8–12, 90 s  | 2 × 10–15, 60 s |

  Débutant : 3 séries au plus. Exercices chronométrés (gainage…) : 3 × 20–30 s
  (débutant), 30–45 s, 45–60 s.

- **Durée** estimée = 5 min d'échauffement + par exercice : séries × (40 s
  d'effort, ou la durée tenue, + repos) + 60 s de mise en place. Trop long :
  on retire les exercices de priorité 3, puis 2 (jamais sous 3 exercices),
  puis une série par exercice (jamais sous 2).

## Remplacement d'un exercice (`exercise-replacement.ts`)

Même muscle principal, mêmes contraintes strictes, absent de la séance.
Classement : même schéma de mouvement +3, même type (poly/isolation) +1,
même mode (répétitions/durée) +0,5, même difficulté +0,5, apprécié +1. Filtres :
« plus facile » (difficulté inférieure, ou moins de matériel pour un exercice
débutant), « sans machine », « sans matériel ». Séries et repos sont conservés.

## Progression (`progression.ts`)

- **Double progression** : même charge et une répétition de plus que la moins
  bonne série, jusqu'au haut de la fourchette sur toutes les séries ; alors
  +2,5 kg (+5 kg pour squat, soulevé de terre, hip thrust…) et retour au bas
  de la fourchette. Sous la fourchette : même charge, viser le minimum.
- Sans charge : une répétition (ou 5 s) de plus, puis une variante plus difficile.
- **Force estimée** (Epley) : charge × (1 + répétitions / 30), seulement
  jusqu'à 12 répétitions. Sert à comparer deux séances d'un même exercice.

## Planning de la semaine (`training-schedule.ts`)

- Une séance type a un **jour habituel** (lundi … dimanche) ou aucun (« à la
  demande »). Chaque semaine, elle crée une **occurrence** à ce jour, à partir
  de la date de création du programme.
- Une occurrence (séance type W, date D) disparaît de D dès qu'une séance la
  remplace : même W avec `original_date` = D (déplacée, sautée, ou faite un
  autre jour), ou même W faite, en cours ou planifiée le jour D.
- **Déplacer** : séance `planned` à la nouvelle date, `original_date` = D.
  **Sauter** : séance `skipped` à D (rétablissable). Une seule modification
  par occurrence (contrainte en base). Les dates restent à moins d'un an.
- **Ajouter** une séance un jour quelconque : `planned` sans `original_date`.
- Une occurrence passée non faite est « non faite » ; on peut la faire
  maintenant (la séance est datée d'aujourd'hui, `original_date` = D).
- Ordre dans une journée : faite, en cours, planifiée, prévue, sautée.

## Séances composées à la main

- Un exercice ajouté reçoit la prescription de l'objectif et du niveau (voir
  « Séries, répétitions, repos »), modifiable ensuite (1–12 séries, 1–100
  répétitions ou secondes, repos 0–900 s, max ≥ min).
- Durée estimée recalculée à chaque modification : 5 min d'échauffement +
  Σ séries × (40 s, ou durée moyenne de tenue, + repos) + 60 s par exercice ;
  bornée à 5–300 min.
- Le choix est libre : un exercice qui sollicite une zone sensible, dépasse le
  niveau ou demande du matériel non déclaré est **signalé**, pas masqué. Le
  générateur et les remplacements, eux, n'utilisent que la bibliothèque de
  référence et restent stricts.
- Au plus 20 exercices par séance (pas deux fois le même), 14 séances types.
- Recherche : sans accents ni casse, tous les mots doivent figurer dans le nom.

## Hydratation

Repère indicatif : 33 ml par kg (règle pratique courante de 30 à 35 ml/kg), arrondi à 100 ml, borné entre 1,5 et 3,5 L. Pour comparaison, l'EFSA retient 2,0 L par jour pour une femme et 2,5 L pour un homme, toutes sources d'eau comprises.

## Sources

- Mifflin MD, St Jeor ST et al. _A new predictive equation for resting energy
  expenditure in healthy individuals_. Am J Clin Nutr, 1990.
- FAO/OMS/UNU, _Human energy requirements_, 2004 (niveaux d'activité physique).
- Jäger R et al. _ISSN Position Stand: protein and exercise_, 2017 ;
  Morton RW et al., Br J Sports Med, 2018 (apports en protéines).
- OMS : classification de l'IMC.
- Institute of Medicine / _Dietary Guidelines for Americans_ : 14 g de fibres pour 1 000 kcal.
- EFSA, _Scientific Opinion on Dietary Reference Values for water_, 2010.
- ANSES, _Table de composition nutritionnelle des aliments Ciqual_, 2025
  (Licence Ouverte Etalab).
- Open Food Facts, base collaborative de produits (licence ODbL).
- Schoenfeld BJ et al., _Loading recommendations for muscle strength,
  hypertrophy, and local endurance_, Sports, 2021 (fourchettes de répétitions).
- ACSM, _Progression models in resistance training for healthy adults_, 2009.
- Epley B., _Poundage chart_, 1985 (estimation de la charge maximale).
- Règlement (UE) n° 1169/2011, annexe II : les 14 allergènes à déclaration obligatoire.
