# PROJET : APPLICATION IA DE SUIVI FITNESS, NUTRITION ET PERTE DE POIDS

## 1. TON RÔLE

Agis comme une équipe complète composée de :
- Un développeur full-stack senior spécialisé en React, TypeScript et architecture web.
- Un ingénieur spécialisé dans les API d'intelligence artificielle.
- Un expert UX/UI spécialisé dans les applications mobiles de fitness.
- Un expert en nutrition sportive et en programmation d'entraînement.
- Un spécialiste de la sécurité, des bases de données et de la protection des données personnelles.

Ta mission est de concevoir et développer une application complète, moderne, professionnelle et évolutive de suivi de perte de poids, de nutrition et de sport, utilisant l'intelligence artificielle pour personnaliser l'expérience de chaque utilisateur.

Ne te contente pas de générer une maquette ou un dashboard statique. Je veux une application fonctionnelle, avec une vraie base de données, une authentification, des calculs fiables, des formulaires, des graphiques, des interactions réelles et une intégration IA.

Tu dois travailler progressivement, en conservant une architecture propre et un code maintenable.

## 2. CONCEPT DE L'APPLICATION

L'application doit fonctionner comme un coach personnel intelligent.

Elle doit permettre à un utilisateur de :
- Suivre son poids et son évolution physique.
- Définir un objectif de perte de poids, de maintien ou de prise de masse.
- Calculer ses besoins caloriques et ses objectifs de macronutriments.
- Créer un programme alimentaire adapté à son budget, ses goûts et ses contraintes.
- Générer des recettes saines et riches en protéines.
- Photographier un repas pour obtenir une estimation de ses calories et de ses macros.
- Créer et suivre un programme sportif personnalisé.
- Remplacer un exercice qu'il n'aime pas ou qu'il ne peut pas effectuer.
- Recevoir des conseils personnalisés générés par une IA.
- Visualiser ses progrès et adapter progressivement son programme.

L'application doit être pensée pour le marché européen, notamment la Belgique et la France, avec les unités métriques, les prix en euros et les aliments courants dans ces pays.

Langue initiale : français. Prévoir une architecture permettant d'ajouter d'autres langues ultérieurement.

## 3. TECHNOLOGIES À UTILISER

Privilégie une architecture moderne et adaptée à un développeur travaillant avec Claude Code.

Frontend :
- Next.js avec React et TypeScript.
- Tailwind CSS.
- shadcn/ui pour les composants.
- Recharts pour les graphiques.
- React Hook Form et Zod pour les formulaires et leur validation.

Backend :
- API routes ou Server Actions Next.js lorsque cela est pertinent.
- TypeScript.
- Architecture séparant clairement la logique métier, les accès aux données et les services IA.

Base de données et authentification :
- Supabase.
- PostgreSQL.
- Supabase Auth.
- Row Level Security pour isoler les données de chaque utilisateur.
- Supabase Storage pour les images des repas et autres fichiers nécessaires.

Intelligence artificielle :
- API multimodale capable d'analyser des images et du texte.
- Utiliser une API compatible avec l'analyse d'images pour la reconnaissance des repas.
- Utiliser une API LLM pour la génération de recettes, les conseils nutritionnels, les plans d'entraînement et les adaptations.
- Choisir un fournisseur configurable, par exemple Anthropic ou OpenAI.
- Ne jamais exposer les clés API dans le frontend.
- Prévoir une couche de service indépendante du fournisseur IA afin de pouvoir en changer facilement.

Données nutritionnelles :
- Prévoir l'intégration d'une base de données alimentaire fiable, par exemple Open Food Facts, ainsi que d'une source nutritionnelle adaptée aux aliments non emballés.
- Prévoir un système de cache pour limiter les appels API.
- Conserver la source des valeurs nutritionnelles et distinguer les données vérifiées des estimations de l'IA.

Déploiement :
- Application déployable sur Vercel.
- Base de données et authentification hébergées sur Supabase.
- Variables d'environnement pour toutes les clés et configurations sensibles.
- Prévoir un README complet pour l'installation, le développement et le déploiement.

Avant de choisir définitivement une bibliothèque ou une API, vérifie sa documentation actuelle et ses limites.

## 4. ONBOARDING : PROFIL ET OBJECTIFS

Lors de sa première connexion, l'utilisateur doit compléter un onboarding progressif, agréable et visuel.

### Étape 1 : Informations personnelles

Demander :
- Âge.
- Taille en centimètres.
- Poids actuel en kilogrammes.
- Poids cible.
- Sexe physiologique si nécessaire au calcul des formules métaboliques, avec une option permettant de ne pas répondre et une explication de son impact.
- Niveau d'activité quotidien.
- Nombre moyen de pas par jour.
- Situation professionnelle : sédentaire, actif, travail physique, etc.
- Éventuellement, tour de taille et autres mensurations.

### Étape 2 : Objectif

Proposer plusieurs objectifs :
- Perte de graisse.
- Maintien du poids.
- Prise de masse musculaire.
- Recomposition corporelle.
- Amélioration de la condition physique.

Demander également le rythme souhaité et expliquer les compromis entre rapidité, récupération, performance et durabilité.

Ne jamais encourager les déficits caloriques extrêmes. Détecter les objectifs irréalistes et proposer une alternative plus sûre.

### Étape 3 : Activité physique

Demander :
- Nombre de séances sportives par semaine.
- Type de sport pratiqué.
- Durée moyenne des séances.
- Niveau : débutant, intermédiaire ou avancé.
- Activité quotidienne en dehors du sport.
- Accès à une salle de sport ou entraînement à domicile.
- Matériel disponible.

### Étape 4 : Préférences alimentaires

Demander :
- Budget alimentaire hebdomadaire en euros.
- Nombre de repas par jour.
- Nombre de collations souhaitées.
- Allergies alimentaires.
- Intolérances.
- Aliments appréciés.
- Aliments détestés.
- Régime alimentaire : omnivore, végétarien, végétalien, etc.
- Temps disponible pour cuisiner.
- Niveau en cuisine.
- Possibilité de préparer plusieurs repas à l'avance.
- Préférence pour des repas économiques, rapides, variés ou répétitifs.
- Éventuellement, accès à une cuisine et à du matériel de cuisson.

Les allergies doivent être traitées comme des contraintes strictes et non comme de simples préférences.

### Étape 5 : Résultat personnalisé

À la fin, afficher :
- Une estimation des besoins caloriques quotidiens.
- Une estimation du maintien calorique.
- Un objectif calorique proposé.
- Un objectif quotidien de protéines, glucides et lipides.
- Une estimation du rythme d'évolution du poids.
- Une première stratégie nutritionnelle.
- Une proposition de programme sportif.
- Un aperçu de la progression vers l'objectif.

Expliquer les hypothèses utilisées et permettre de modifier les données du profil.

## 5. CALCULATEUR CALORIQUE ET MACRONUTRIMENTS

Créer un moteur de calcul fiable et testable.

Il doit calculer :
- Le métabolisme de base à l'aide d'une formule documentée comme Mifflin-St Jeor, lorsque les informations nécessaires sont disponibles.
- Une estimation de la dépense énergétique quotidienne en tenant compte du niveau d'activité.
- Un objectif calorique adapté à l'objectif choisi.
- Les grammes de protéines, glucides et lipides par jour.
- La répartition calorique entre les macronutriments.
- Une estimation du temps nécessaire pour atteindre l'objectif.

Les calculs doivent être réalisés dans le code avec des formules explicites, et non confiés librement à l'IA.

L'IA peut expliquer les résultats et proposer des ajustements, mais elle ne doit pas inventer les calculs.

Le système doit :
- Indiquer clairement que les estimations sont approximatives.
- Permettre de modifier les objectifs manuellement.
- Réévaluer les besoins lorsque le poids évolue.
- Éviter les recommandations dangereusement basses.
- Détecter les données incohérentes.
- Afficher des avertissements appropriés lorsque l'objectif nécessite un encadrement professionnel.

## 6. DASHBOARD PRINCIPAL

Créer un dashboard professionnel, visuellement agréable et intuitif.

Il doit présenter :

### Résumé quotidien
- Calories consommées.
- Objectif calorique.
- Calories restantes.
- Protéines consommées et restantes.
- Glucides consommés.
- Lipides consommés.
- Eau consommée, si cette fonctionnalité est activée.
- Pas effectués.
- Entraînement du jour.
- Nombre de repas enregistrés.

### Visualisations
- Courbe de poids sur 7 jours, 30 jours, 90 jours et toute la période.
- Évolution vers le poids cible.
- Évolution des mensurations.
- Moyenne mobile du poids pour limiter l'effet des fluctuations quotidiennes.
- Historique des calories et des protéines.
- Régularité des entraînements.
- Progression des performances sportives.

### Actions rapides
- Ajouter un repas.
- Photographier un repas.
- Enregistrer un poids.
- Ajouter de l'eau.
- Démarrer une séance.
- Consulter les recettes.
- Demander conseil au coach IA.

Toutes les données affichées doivent provenir de la base de données et être réellement mises à jour.

## 7. JOURNAL ALIMENTAIRE

Créer un journal alimentaire organisé par journée et par repas.

Prévoir :
- Petit-déjeuner.
- Déjeuner.
- Dîner.
- Collations.
- Possibilité de personnaliser les catégories.

L'utilisateur doit pouvoir :
- Rechercher un aliment.
- Ajouter une quantité en grammes ou en portions.
- Consulter les calories et les macros.
- Modifier ou supprimer un aliment.
- Copier un repas d'un autre jour.
- Enregistrer un repas favori.
- Créer ses propres aliments et recettes.
- Consulter l'historique.
- Enregistrer un repas récurrent.

Les calculs nutritionnels doivent être effectués à partir des quantités et des données nutritionnelles enregistrées.

Pour chaque aliment, conserver autant que possible :
- Nom.
- Marque.
- Portion.
- Poids.
- Calories pour 100 g ou 100 ml.
- Protéines.
- Glucides.
- Lipides.
- Fibres lorsque disponibles.
- Source des données.

Prévoir les différences entre poids cru, poids cuit et portion consommée.

## 8. ANALYSE D'UN REPAS PAR PHOTO AVEC L'IA

C'est une fonctionnalité centrale de l'application.

L'utilisateur doit pouvoir prendre une photo avec son téléphone ou importer une image.

Le fonctionnement souhaité :

1. L'utilisateur photographie son repas.
2. L'image est envoyée de manière sécurisée à un service IA multimodal.
3. L'IA identifie les aliments visibles.
4. Elle estime les portions et les quantités.
5. Elle propose une estimation des calories, protéines, glucides et lipides.
6. Elle précise les hypothèses et le niveau d'incertitude.
7. L'utilisateur peut corriger les aliments et les quantités.
8. Après validation, le repas est enregistré dans le journal alimentaire.
9. Le dashboard est actualisé.

Exemple de résultat :
- Poulet : quantité estimée à 150 g.
- Riz cuit : quantité estimée à 200 g.
- Légumes : quantité estimée à 100 g.
- Sauce : quantité à confirmer.

Afficher ensuite les macros estimées du repas.

Points importants :
- Une photo ne permet pas de déterminer précisément le poids ou les ingrédients cachés.
- L'IA ne doit pas présenter une estimation comme une mesure exacte.
- Demander une confirmation lorsque la portion, la sauce, l'huile ou les ingrédients sont incertains.
- Permettre à l'utilisateur de renseigner le poids réel.
- Si possible, comparer les aliments identifiés à une base nutritionnelle fiable.
- Recalculer les valeurs après chaque correction.
- Enregistrer la photo uniquement selon une politique de conservation claire, avec possibilité de suppression.
- Gérer les erreurs d'API, les photos illisibles et les réponses invalides.

Ne jamais ajouter automatiquement un repas non confirmé par l'utilisateur.

## 9. GÉNÉRATEUR DE PLANS ALIMENTAIRES

Créer une section permettant de générer un programme alimentaire personnalisé sur 7 jours.

Le générateur doit utiliser :
- Les besoins caloriques calculés.
- Les objectifs de macronutriments.
- Le budget hebdomadaire.
- Les allergies.
- Les préférences alimentaires.
- Le nombre de repas par jour.
- Le temps de préparation disponible.
- Le niveau de difficulté en cuisine.
- Les ingrédients déjà disponibles.
- Les habitudes de préparation des repas.

Pour chaque journée, proposer des repas cohérents avec les objectifs.

Pour chaque repas, afficher :
- Nom du plat.
- Image illustrative si disponible.
- Ingrédients.
- Quantités exactes.
- Calories.
- Protéines.
- Glucides.
- Lipides.
- Temps de préparation.
- Étapes de la recette.
- Coût estimé.
- Possibilité de remplacer le repas.

Les recettes doivent être réalistes, réalisables et adaptées au budget.

Ne pas inventer des valeurs nutritionnelles précises sans base de calcul. Calculer les macros à partir des ingrédients et de leurs quantités lorsqu'une source fiable est disponible.

Prévoir :
- Des repas riches en protéines.
- Des recettes économiques.
- Des recettes faciles à préparer.
- Des options de meal prep.
- Des alternatives aux aliments indisponibles.
- Des recettes adaptées aux préférences belges et françaises.

Le plan hebdomadaire doit viser des objectifs nutritionnels réalistes, sans exiger que chaque journée soit parfaitement identique.

## 10. LISTE DE COURSES INTELLIGENTE

À partir du plan alimentaire, générer automatiquement une liste de courses.

La liste doit :
- Regrouper les ingrédients identiques.
- Additionner les quantités nécessaires.
- Distinguer les quantités théoriques et les conditionnements courants lorsque possible.
- Permettre de cocher les produits achetés.
- Permettre de retirer ou d'ajouter des produits.
- Estimer le coût total.
- Comparer le budget estimé au budget défini.
- Réutiliser les ingrédients présents dans plusieurs recettes.
- Permettre d'indiquer les ingrédients déjà disponibles à domicile.

Prévoir ultérieurement une intégration possible avec des catalogues de supermarchés, mais ne pas inventer de prix en temps réel sans source.

## 11. COACH IA NUTRITIONNEL

Créer un assistant conversationnel intégré à l'application.

L'utilisateur doit pouvoir poser des questions comme :
- « Comment atteindre 175 g de protéines sans dépasser mes calories ? »
- « Remplace mon déjeuner par quelque chose de moins cher. »
- « Je n'ai pas de poulet aujourd'hui, que puis-je manger ? »
- « Je suis invité au restaurant ce soir, comment adapter ma journée ? »
- « Pourquoi mon poids ne descend-il plus ? »
- « Propose-moi trois petits-déjeuners rapides. »

L'IA doit avoir accès uniquement aux données nécessaires de l'utilisateur connecté :
- Profil.
- Objectifs.
- Journal alimentaire.
- Historique du poids.
- Préférences et allergies.
- Entraînements lorsque cela est utile.

Elle doit donner des conseils personnalisés et expliquer ses recommandations.

Elle ne doit pas prétendre remplacer un médecin ou un diététicien. Elle doit identifier les situations nécessitant un professionnel et éviter les conseils médicaux ou les régimes extrêmes.

Prévoir un historique des conversations et un bouton permettant de supprimer une conversation.

## 12. PROGRAMME SPORTIF PERSONNALISÉ

Créer un module complet d'entraînement.

Lors de la configuration initiale, demander :
- Objectif : perte de graisse, hypertrophie, force, endurance ou remise en forme.
- Niveau sportif.
- Nombre de séances par semaine.
- Durée maximale par séance.
- Salle de sport ou domicile.
- Matériel disponible.
- Exercices appréciés.
- Exercices détestés.
- Blessures ou limitations déclarées.
- Groupes musculaires à privilégier.
- Activités complémentaires comme la marche, le vélo ou le padel.

Proposer plusieurs structures d'entraînement :
- Full body.
- Upper / Lower.
- Push / Pull / Legs.
- Programmes personnalisés.

Ne pas imposer une structure unique. Adapter le programme au temps disponible, à l'expérience et à la récupération.

Pour chaque séance, afficher :
- Nom de l'exercice.
- Groupe musculaire.
- Séries.
- Répétitions.
- Temps de repos.
- Consignes d'exécution.
- Niveau de difficulté.
- Matériel nécessaire.
- Variante de remplacement.
- Vidéo ou illustration explicative lorsque disponible.

L'utilisateur doit pouvoir :
- Démarrer une séance.
- Valider chaque série.
- Enregistrer les poids utilisés.
- Enregistrer les répétitions réellement effectuées.
- Modifier le nombre de séries.
- Mettre une séance en pause.
- Terminer la séance.
- Consulter l'historique.
- Comparer ses performances.
- Déplacer une séance dans la semaine.

Prévoir une progression progressive des charges ou des répétitions lorsque cela est pertinent.

## 13. REMPLACEMENT INTELLIGENT DES EXERCICES

C'est une fonctionnalité essentielle.

Lorsqu'un utilisateur n'aime pas un exercice, il doit pouvoir cliquer sur « Remplacer ».

L'IA doit proposer des alternatives en fonction :
- Du groupe musculaire ciblé.
- De l'objectif de l'exercice.
- Du matériel disponible.
- Du niveau de l'utilisateur.
- De la difficulté.
- Du temps disponible.
- Des limitations déclarées.
- Des exercices déjà présents dans la séance.

Exemple :
Si l'utilisateur ne souhaite pas faire du développé couché avec barre, proposer des variantes adaptées comme le développé avec haltères ou une machine, si elles correspondent à son équipement et à ses contraintes.

Lorsqu'un exercice est remplacé, conserver la cohérence globale de la séance.

Ne pas proposer automatiquement un exercice susceptible d'aggraver une douleur déclarée. Pour les douleurs persistantes ou les blessures, recommander un avis professionnel plutôt que de prétendre établir un diagnostic.

L'utilisateur doit également pouvoir demander :
« Remplace cet exercice par quelque chose de plus facile, sans machine, qui cible le même muscle. »

## 14. SUIVI DU POIDS ET DES PROGRÈS

Créer une section dédiée au suivi physique.

Fonctionnalités :
- Enregistrement du poids quotidien ou ponctuel.
- Graphique historique.
- Moyenne glissante sur 7 jours.
- Comparaison avec le poids de départ.
- Distance restante jusqu'à l'objectif.
- Enregistrement des mensurations.
- Journal de photos avant/après facultatif.
- Historique des objectifs.
- Détection de tendances de stagnation.

Ne pas conclure à un plateau après une seule mesure. Tenir compte des fluctuations normales du poids.

L'application peut suggérer de réévaluer les habitudes lorsque la tendance stagne durablement, mais ne doit pas automatiquement réduire les calories à chaque fluctuation.

Permettre de masquer les fonctionnalités liées aux photos corporelles et de supprimer les images.

## 15. FONCTIONNALITÉS SUPPLÉMENTAIRES

Prévoir également les modules suivants :

### Hydratation
- Objectif personnalisé indicatif.
- Ajout rapide de boissons.
- Historique journalier.

### Pas et activité quotidienne
- Saisie manuelle du nombre de pas.
- Objectifs d'activité personnalisables.
- Préparation à une future intégration Apple Health ou Google Health Connect, selon les possibilités techniques.

### Habitudes
- Sommeil.
- Régularité alimentaire.
- Séances réalisées.
- Marche.
- Hydratation.
- Séries de jours de suivi, sans culpabilisation en cas d'interruption.

### Système de rappels
- Pesée.
- Enregistrement des repas.
- Entraînement.
- Préparation des repas.
- Notifications configurables et désactivables.

### Gestion des objectifs
- Objectif principal.
- Objectifs intermédiaires.
- Historique des changements.
- Bilan hebdomadaire généré à partir des données réellement enregistrées.

### Gamification facultative
- Badges.
- Récompenses de régularité.
- Progression visuelle.
- Aucun classement public obligatoire et aucune culpabilisation en cas d'échec.

## 16. DESIGN ET EXPÉRIENCE UTILISATEUR

Je veux une interface moderne, professionnelle, minimaliste et premium, inspirée des meilleures applications de fitness et de santé.

Direction artistique :
- Interface claire et soignée.
- Palette neutre avec une couleur d'accent distinctive.
- Typographie lisible.
- Cartes bien organisées.
- Graphiques élégants.
- Icônes cohérentes.
- Espacement généreux.
- Animations légères et utiles.
- Mode sombre et mode clair.
- Design responsive.

L'interface doit être conçue en priorité pour une utilisation sur smartphone, sans négliger les écrans d'ordinateur.

Navigation mobile recommandée :
- Accueil.
- Nutrition.
- Entraînement.
- Progrès.
- Profil.

Sur ordinateur, utiliser une sidebar avec les mêmes sections.

Prévoir :
- Un onboarding visuel.
- Des états de chargement.
- Des messages d'erreur compréhensibles.
- Des écrans vides avec des actions utiles.
- Des confirmations avant les suppressions importantes.
- Une bonne accessibilité.
- Une navigation clavier fonctionnelle.

Évite les interfaces surchargées et les tableaux trop complexes sur mobile.

Toutes les pages doivent être réellement navigables et cohérentes entre elles.

## 17. BASE DE DONNÉES

Conçois un schéma PostgreSQL propre avec des relations et des contraintes adaptées.

Prévoir au minimum les entités suivantes :

- profiles
- user_goals
- weight_entries
- body_measurements
- nutrition_targets
- foods
- food_diary_entries
- meals
- recipes
- recipe_ingredients
- meal_plans
- meal_plan_items
- shopping_lists
- shopping_list_items
- workouts
- workout_exercises
- exercise_library
- workout_sessions
- workout_sets
- activity_entries
- water_entries
- habits
- habit_entries
- ai_conversations
- ai_messages
- user_preferences

Tu peux adapter ou normaliser ce schéma si nécessaire.

Exigences :
- Clés étrangères et index adaptés.
- Dates et fuseaux horaires gérés correctement.
- Migrations SQL versionnées.
- Contraintes de validation.
- Row Level Security sur toutes les tables contenant des données privées.
- Politiques empêchant un utilisateur d'accéder aux données d'un autre.
- Suppression et export des données personnelles.
- Stratégie de conservation des images.
- Pas de clés API ni de secrets dans la base de données accessibles au frontend.

Documente le modèle de données et les principales relations.

## 18. ARCHITECTURE IA

Créer une couche dédiée aux appels IA, distincte du reste de l'application.

Prévoir des services séparés pour :
- L'analyse des repas à partir de photos.
- La génération de recettes.
- La création de plans alimentaires.
- Le coach nutritionnel.
- La création de programmes sportifs.
- Le remplacement d'exercices.
- Les bilans hebdomadaires.

Utiliser des schémas structurés et validés avec Zod pour les réponses IA.

Ne jamais faire confiance directement à une réponse IA pour modifier la base de données.

Le backend doit :
1. Valider la requête.
2. Vérifier l'identité et les autorisations de l'utilisateur.
3. Récupérer uniquement les données nécessaires.
4. Appeler le modèle IA.
5. Valider la réponse.
6. Vérifier les contraintes métier et de sécurité.
7. Présenter le résultat à l'utilisateur.
8. Enregistrer les données uniquement après validation lorsqu'elle est nécessaire.

Prévoir :
- Gestion des erreurs.
- Limitation du nombre d'appels.
- Limites de taille des images.
- Contrôle des coûts API.
- Protection contre les abus.
- Délais d'expiration.
- Journaux techniques sans données personnelles inutiles.
- Possibilité de changer de fournisseur IA.

Les calculs déterministes, les règles d'allergies et les contrôles de sécurité doivent rester dans le code.

## 19. SÉCURITÉ ET CONFIDENTIALITÉ

L'application traite des données personnelles sensibles au regard de la vie privée, notamment le poids, les mensurations, les habitudes alimentaires et les informations relatives à la santé.

Prendre en compte :
- Les exigences applicables du RGPD.
- Le consentement et la transparence concernant les traitements de données.
- La minimisation des données.
- L'accès et la suppression des données.
- La sécurisation des images.
- Les permissions strictes dans Supabase.
- La protection contre les accès non autorisés.
- L'utilisation de HTTPS en production.
- La séparation entre les environnements de développement et de production.

Ne jamais exposer les données d'un utilisateur à un autre.

Ne pas envoyer plus de données personnelles au fournisseur IA que nécessaire.

Documenter les données envoyées aux services externes et les options de suppression.

## 20. TESTS ET QUALITÉ

Créer de vrais tests.

Prévoir :
- Tests unitaires des calculs caloriques.
- Tests des macros des recettes.
- Tests de validation des formulaires.
- Tests des services IA avec des réponses simulées.
- Tests des substitutions d'exercices.
- Tests des autorisations et des politiques RLS.
- Tests des principaux parcours utilisateur.
- Tests des erreurs d'API.
- Vérification du responsive design.

Utiliser des données de démonstration fictives, sans données personnelles réelles.

Vérifier qu'un utilisateur ne peut pas consulter, modifier ou supprimer les données d'un autre.

Le projet doit pouvoir être lancé localement à partir des instructions du README.

## 21. MÉTHODE DE DÉVELOPPEMENT

Ne tente pas de développer toutes les fonctionnalités en une seule génération de code.

Procède par phases.

### Phase 1 : Analyse et architecture
- Examiner l'environnement de travail existant.
- Définir l'architecture.
- Identifier les dépendances nécessaires.
- Concevoir le schéma de base de données.
- Définir les principales pages.
- Créer un plan d'implémentation.
- Identifier les coûts et dépendances des API externes.

Présente brièvement le plan avant de commencer l'implémentation.

### Phase 2 : Fondations
- Initialiser le projet.
- Configurer TypeScript et Tailwind.
- Créer le design system.
- Configurer Supabase.
- Créer l'authentification.
- Créer les migrations et les politiques RLS.
- Créer la structure des pages.

### Phase 3 : Fonctionnalités essentielles
- Onboarding.
- Profil utilisateur.
- Calculateur calorique.
- Dashboard.
- Suivi du poids.
- Journal alimentaire.
- Objectifs nutritionnels.

### Phase 4 : Nutrition intelligente
- Base alimentaire.
- Calcul des macros.
- Générateur de recettes.
- Plans alimentaires.
- Liste de courses.
- Analyse des repas par photo.
- Coach nutritionnel.

### Phase 5 : Sport
- Bibliothèque d'exercices.
- Programmes d'entraînement.
- Séances et séries.
- Historique des performances.
- Remplacement intelligent des exercices.
- Coach sportif IA.

### Phase 6 : Finalisation
- Suivi des habitudes.
- Notifications si configurées.
- Optimisation mobile.
- Tests.
- Sécurité.
- Gestion des erreurs.
- Documentation.
- Préparation au déploiement.

À la fin de chaque phase, exécute les vérifications et tests pertinents avant de passer à la suivante.

## 22. RÈGLES DE TRAVAIL AVEC CLAUDE CODE

- Commence par examiner les fichiers existants avant toute modification.
- Ne supprime jamais arbitrairement du code déjà présent.
- N'écrase pas des configurations sans comprendre leur rôle.
- Utilise des composants réutilisables.
- Évite les fichiers monolithiques.
- Sépare les composants visuels, les services, les types et la logique métier.
- Utilise TypeScript strict.
- Évite les données fictives dans les fonctionnalités présentées comme terminées.
- Si une API n'est pas configurée, affiche un état explicite plutôt que de simuler une réussite.
- Fournis un fichier .env.example sans secrets réels.
- Fournis des migrations SQL versionnées.
- Documente les commandes de lancement et de test.
- Après chaque fonctionnalité, vérifie que l'application compile.
- Corrige les erreurs de lint, de typage et les tests en échec.
- Ne prétends jamais qu'une fonctionnalité est terminée si elle n'est pas implémentée et vérifiée.
- Demande mon intervention uniquement lorsqu'une décision ou un secret est réellement nécessaire.
- Pour les choix techniques courants, prends une décision raisonnable, documente-la et avance.

## 23. CRITÈRES DE RÉUSSITE

L'application sera considérée comme fonctionnelle lorsque l'utilisateur pourra réellement :

1. Créer un compte et se connecter.
2. Compléter son profil et définir un objectif.
3. Obtenir une estimation calorique calculée par le moteur métier.
4. Consulter son dashboard personnel.
5. Enregistrer son poids et visualiser son évolution.
6. Ajouter des aliments et calculer ses macros.
7. Photographier un repas, corriger l'estimation IA et valider son enregistrement.
8. Générer un plan alimentaire respectant ses contraintes.
9. Générer une liste de courses.
10. Créer et suivre un programme sportif.
11. Remplacer un exercice par une alternative cohérente.
12. Consulter ses performances et ses progrès.
13. Utiliser le coach IA avec son contexte personnel pertinent.
14. Retrouver ses données après déconnexion et reconnexion.
15. Utiliser l'application sur mobile et ordinateur.
16. Garantir que ses données restent privées.
17. Exporter et supprimer ses données personnelles.

## 24. PREMIÈRE ACTION

Commence maintenant par analyser l'environnement de travail.

Si le projet est vide, initialise l'application avec la stack choisie. S'il existe déjà, examine son architecture avant de la modifier.

Présente ensuite :
1. L'architecture proposée.
2. La structure des dossiers.
3. Le schéma initial de la base de données.
4. Les API externes nécessaires.
5. Les éventuels coûts récurrents.
6. Le plan de développement par étapes.

Puis commence immédiatement la Phase 2, sans attendre une nouvelle validation pour les choix techniques courants.

Priorité absolue : construire des fondations solides et une première version réellement utilisable, puis ajouter progressivement les fonctionnalités avancées. Le résultat final doit être une application cohérente, sécurisée, évolutive et prête à être testée par de vrais utilisateurs.