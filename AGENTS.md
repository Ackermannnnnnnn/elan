# Élan — repères pour les agents de code

Application Next.js 16 + Supabase de suivi nutrition / entraînement / poids.
Langue de l'interface, des commentaires et de la documentation : français.
Cahier des charges complet : `docs/CAHIER-DES-CHARGES.md`. État d'avancement : `README.md`.

## Commandes

- `npm run check` — typecheck + lint + tests + build. À lancer avant de déclarer un travail terminé.
- `npm test` — tests unitaires et tests RLS (PostgreSQL en mémoire, sans Docker).
- `npm run db:types` — à relancer après toute modification de `supabase/migrations/`.

## Règles du projet

- **Couches** : `app` assemble, `features/<nom>` porte schémas Zod + actions + composants,
  `data` est le seul endroit qui appelle Supabase, `domain` (calculs purs) ne dépend de rien.
  Détails dans `docs/ARCHITECTURE.md`.
- **Identité** : toujours `requireUser()` (`src/lib/auth/session.ts`), jamais un identifiant reçu du client.
- **Nouvelle table** : `user_id` + `call private.apply_owner_rls('<table>')` dans la migration,
  puis un test dans `tests/db/rls.test.ts`. Ne jamais modifier une migration existante.
- **Textes** : aucune chaîne en dur dans les composants, tout passe par `messages/fr.json`.
  Les erreurs circulent sous forme de clés (`Errors.*`, `Validation.*`).
- **Calculs** (calories, macros, tendances) : dans `src/domain`, avec formules explicites et tests
  aux valeurs calculées à la main. Jamais par l'IA. Toute règle modifiée se documente dans `docs/CALCULS.md`.
- **IA** : réponses validées par Zod, jamais d'écriture en base sans confirmation de l'utilisateur,
  allergies appliquées par le code.
- **Honnêteté de l'interface** : pas de donnée fictive ; une fonction non livrée s'affiche comme « Bientôt »,
  un service non configuré comme un état explicite.
- **Cache Components** : tout ce qui lit la session doit être sous un `<Suspense>`.
  Chaque dossier de page de `app/(app)` a son `loading.tsx` : en créer un pour toute nouvelle page,
  sinon `next dev` signale une navigation bloquante.
- **Pages conservées** : Next.js garde les pages quittées (masquées). Un formulaire efface ses messages
  d'état quand il est masqué (voir `use-action-form.ts`) ; dans les tests de navigateur, ne cibler que
  les éléments visibles.
- **Formulaires** : `useActionForm` + un schéma Zod partagé navigateur / serveur + `runAction` côté serveur.
- **Styles** : uniquement les jetons de `src/app/globals.css` (`bg-surface`, `text-muted-foreground`…),
  pas de couleur en dur.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
