# Sécurité et confidentialité

L'application traite des données personnelles liées à la santé (poids,
mensurations, alimentation, activité). Ce document décrit ce qui est en place
et ce qui reste à faire avant d'ouvrir l'application à de vrais utilisateurs.

## En place (phase 2)

- **Cloisonnement des données** par la Row Level Security sur toutes les tables
  et sur le stockage de fichiers ; testé automatiquement (`npm test`).
- **Défense en profondeur** : proxy → garde-fou de mise en page → couche de
  données → RLS. Chaque niveau suffit à lui seul à bloquer un accès non autorisé.
- **Secrets** : aucune clé secrète dans le code ni dans la base. Seules l'URL
  Supabase et la clé _publishable_ sont exposées au navigateur, par conception.
- **Mots de passe** : 10 à 72 caractères, sans règle de composition
  (recommandation NIST). Hachés par Supabase Auth, jamais vus par l'application.
- **Pas d'énumération de comptes** : inscription et mot de passe oublié
  répondent de la même façon que l'adresse existe ou non.
- **Redirections** : le paramètre `?next=` n'accepte que des chemins internes.
- **Entrées** : toute action serveur revalide ses données avec Zod.
- **En-têtes HTTP** : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` (caméra limitée à l'application).
- **Journaux** : uniquement des codes d'erreur, jamais d'e-mail ni de donnée de
  santé. En développement, Next.js n'affiche plus les arguments des actions
  serveur (ils contiennent mots de passe et données de santé).
- **Polices auto-hébergées** : aucune requête vers un tiers au chargement.
- **Consentement** : l'onboarding exige l'accord explicite au traitement des
  données de santé avant tout enregistrement ; la date est conservée dans
  `profiles.health_data_consent_at`. Le consentement au traitement par l'IA
  (`ai_processing_consent_at`) sera demandé avant le premier appel, si une IA est un jour activée.
- **Majeurs uniquement** : l'onboarding refuse les moins de 18 ans.
- **Allergies** : contraintes strictes appliquées par le code au plan de la
  semaine ; allergènes déduits de façon prudente (voir `docs/CALCULS.md`).
  L'interface rappelle de vérifier les étiquettes des produits.
- **Zones sensibles** : un exercice qui sollicite une zone déclarée sensible
  n'est jamais proposé (programme et remplacements) ; l'interface renvoie vers
  un professionnel de santé en cas de douleur et ne pose aucun diagnostic.
- **Garde-fous nutritionnels** : plancher calorique, déficit plafonné, objectifs
  en sous-poids refusés (détail dans `docs/CALCULS.md`).

## Données envoyées à des services externes

| Service                                                        | Données                                                                                                                       | Quand                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Supabase (région UE à choisir à la création)                   | Toutes les données du compte                                                                                                  | En permanence                      |
| Fournisseur IA                                                 | **Rien** : aucune IA n'est activée                                                                                            | —                                  |
| Open Food Facts                                                | Le code-barres scanné, depuis le serveur, sans identité ni cookie                                                             | Scan d'un produit pas encore connu |
| Service de notification du navigateur (Google, Apple, Mozilla) | Titre et texte de la notification (« Repos terminé », « Pesée »…), chiffrés de bout en bout ; aucune donnée de santé chiffrée | Rappel ou fin de repos, si activés |

## À faire avant une ouverture au public

- [x] Export des données (Profil → Mes données, fichier JSON) et suppression
      du compte (mot de passe redemandé, fonction `delete_my_account`, cascade
      vérifiée par les tests).
- [ ] Purge automatique des photos expirées (phase 6).
- [ ] Politique de confidentialité et mentions légales : responsable de
      traitement, base légale, durées de conservation, sous-traitants. À faire
      relire par un juriste : les données de santé relèvent de l'article 9 du RGPD.
- [ ] Accords de sous-traitance (DPA) avec Supabase, Vercel et le fournisseur IA.
- [ ] Content-Security-Policy stricte (avec nonce).
- [ ] Limitation de débit applicative sur les actions sensibles, en complément de celle de Supabase.
- [ ] Page intermédiaire de confirmation pour les liens e-mail : certains
      antivirus de messagerie ouvrent les liens et consomment le jeton.
- [ ] Dans Supabase : activer la protection contre les mots de passe compromis
      et configurer un service d'envoi d'e-mails (l'envoi intégré est très limité).
