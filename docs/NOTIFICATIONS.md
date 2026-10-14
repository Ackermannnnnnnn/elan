# Notifications : rappels et fin de repos

Tout est **gratuit** : notifications web standard (Web Push), planification
par Supabase (`pg_cron` + `pg_net`, inclus dans l'offre gratuite) et envoi par
l'application sur Vercel. Aucun service tiers payant.

## Comment ça marche

```
Téléphone ──(1) s'abonne──▶ table push_subscriptions
Séance : repos lancé ──(2)──▶ table push_alarms (heure de fin)
Supabase pg_cron, toutes les 5 s / chaque minute
   └─ private.push_tick() : rassemble ce qui est dû
        └─ pg_net ──(3) POST /api/push + secret──▶ Vercel
                                   └─ web-push ──▶ service de notification du téléphone
```

1. **Abonnement** — Profil → Rappels et notifications → « Activer les
   notifications ». Un abonnement par appareil.
2. **Fin de repos** — quand le minuteur de repos démarre, l'application
   enregistre son heure de fin (`/api/rest-alarm`) ; « Passer » l'annule, ±15 s
   la décale. Si l'application est à l'écran au moment voulu, la notification
   n'est pas affichée (le minuteur sonne déjà).
3. **Rappels** — pesée, journal des repas, entraînement, préparation des repas :
   heure et jours au choix, dans le fuseau du profil. Un rappel devenu inutile
   n'est pas envoyé (pesée déjà faite, repas du jour notés, séance du jour faite
   ou commencée). Un rappel par jour au plus.

Délai : la fin de repos arrive en général **0 à 7 secondes** après l'heure prévue
(tâche toutes les 5 s + acheminement). Le minuteur à l'écran reste la référence.

Le minuteur suit l'utilisateur dans **toute l'application** : en consultant
l'historique d'un exercice ou le journal pendant le repos, la barre reste en
bas de l'écran, bipe et vibre à la fin. Sans notifications serveur mais avec
l'autorisation du navigateur, une notification locale part si l'application
est en arrière-plan (pas si le téléphone a coupé la page). Jamais deux
notifications pour la même fin de repos (même étiquette, et la locale n'est
utilisée que sans la serveur).

## Limites à connaître

- **iPhone** : les notifications web n'existent que pour l'application
  **installée** (Safari → Partager → « Sur l'écran d'accueil », iOS 16.4 ou
  plus), puis activées depuis l'icône.
- **Android** : fonctionne dans Chrome, installée ou non. Le mode économie
  d'énergie peut retarder une notification.
- Un abonnement inutilisé depuis 60 jours (téléphone changé) n'est plus servi.
- Régénérer les clés (`npm run push:setup`) oblige à réactiver les
  notifications sur chaque appareil.

## Mise en service (une seule fois)

1. Appliquer les migrations : `npx supabase db push`. La migration
   `…120000_notifications` active `pg_cron` et `pg_net` et planifie les tâches.
   Si elle affiche un avertissement « planification non installée » : Supabase →
   **Database → Extensions** → activer `pg_cron` et `pg_net`, puis dans le
   **SQL Editor** : `select private.schedule_push_jobs();`
2. Générer les clés, sur l'ordinateur, dans le dossier du projet :

   ```
   npm run push:setup -- https://adresse-de-ton-app.vercel.app
   ```

   Le script affiche quatre variables à ajouter dans **Vercel → Settings →
   Environment Variables**, et un bloc SQL à exécuter dans le **SQL Editor** de
   Supabase (il range l'adresse et le secret dans le coffre chiffré `vault`).
   Ces valeurs sont secrètes : ne les colle nulle part ailleurs.

3. Vercel → Deployments → Redeploy.
4. Sur le téléphone : Profil → Rappels et notifications → Activer, puis
   « Envoyer un essai » (vérifie les clés) et **« Tester la fin de repos »** :
   une vraie alarme dans 10 secondes, qui passe par `pg_cron` et `pg_net`.
   Verrouiller le téléphone aussitôt : si rien n'arrive, la planification
   Supabase n'est pas en service (voir ci-dessous).

Tant que l'étape 2 n'est pas faite, l'application affiche « notifications pas
encore activées sur le serveur » et la base n'envoie rien.

## Vérifier que la planification tourne

Dans le SQL Editor de Supabase :

```sql
select jobname, schedule, active from cron.job where jobname like 'elan-%';
select status, return_message, start_time from cron.job_run_details
  order by start_time desc limit 10;
select status_code, created from net._http_response order by created desc limit 10;
```

## Variables

| Variable                       | Où             | Rôle                                               |
| ------------------------------ | -------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel         | Clé publique d'abonnement (non secrète)            |
| `VAPID_PRIVATE_KEY`            | Vercel         | Signature des notifications (secrète)              |
| `VAPID_SUBJECT`                | Vercel         | Contact de l'expéditeur (adresse de l'application) |
| `PUSH_SECRET`                  | Vercel + vault | Seul Supabase peut appeler `/api/push`             |
| `elan_app_url` (vault)         | Supabase       | Adresse de l'application à appeler                 |
