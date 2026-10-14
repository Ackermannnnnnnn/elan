-- =============================================================================
-- Phase 6 · Notifications : abonnements push, alarme de fin de repos, rappels.
--
-- Fonctionnement (100 % gratuit) :
--   1. le téléphone s'abonne aux notifications (Web Push) → push_subscriptions ;
--   2. pg_cron (inclus dans Supabase) appelle private.push_tick() :
--      toutes les 5 secondes pour les fins de repos, chaque minute pour les rappels ;
--   3. push_tick() rassemble ce qui est dû et l'envoie, via pg_net, à la route
--      /api/push de l'application (Vercel), qui signe et expédie les notifications.
--
-- Tant que les deux secrets du coffre (vault) ne sont pas créés, rien n'est
-- envoyé : voir docs/NOTIFICATIONS.md.
-- =============================================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 10 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  -- Mis à jour à chaque ouverture de l'application : un abonnement oublié
  -- (téléphone changé, application désinstallée) cesse d'être utilisé.
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

call private.apply_owner_rls('push_subscriptions');

-- Une alarme par utilisateur et par type : relancer un repos remplace la précédente.
create table public.push_alarms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('rest')),
  fire_at timestamptz not null,
  detail text check (char_length(detail) <= 120),
  url text check (url like '/%' and char_length(url) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);
create index push_alarms_fire_idx on public.push_alarms (fire_at);

call private.apply_owner_rls('push_alarms');

-- Jour (local) du dernier rappel traité : un rappel par jour au plus.
alter table public.reminders add column last_sent_on date;
create index reminders_enabled_idx on public.reminders (user_id) where enabled;

-- --- Ce qui est dû ------------------------------------------------------------------

/**
 * Fins de repos arrivées à échéance. Les alarmes sont supprimées en les lisant
 * (envoyées une seule fois) ; une alarme en retard de plus de 2 minutes
 * (service interrompu) est supprimée sans être envoyée.
 */
create function private.due_rest_alarms(p_now timestamptz default now())
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with due as (
    delete from public.push_alarms
    where fire_at <= p_now
    returning user_id, kind, detail, url, fire_at
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'kind', d.kind, 'detail', d.detail, 'url', d.url
    )),
    '[]'::jsonb
  )
  from due d
  join public.push_subscriptions s on s.user_id = d.user_id
  where d.fire_at > p_now - interval '2 minutes'
    and s.last_seen_at > p_now - interval '60 days'
$$;

/**
 * Rappels dont l'heure (dans le fuseau de l'utilisateur) vient de passer :
 * fenêtre de 15 minutes, un envoi par jour au plus. Un rappel devenu inutile
 * (pesée déjà faite, repas déjà notés, séance déjà faite) est marqué traité
 * sans être envoyé.
 */
create function private.due_reminders(p_now timestamptz default now())
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select
      r.id,
      r.user_id,
      r.kind,
      r.time_local,
      r.weekdays,
      r.last_sent_on,
      (p_now at time zone tz.name) as local_ts,
      (p_now at time zone tz.name)::date as local_date
    from public.reminders r
    join public.profiles p on p.id = r.user_id
    cross join lateral (
      select case
        when p.timezone in (select n.name from pg_catalog.pg_timezone_names n) then p.timezone
        else 'Europe/Brussels'
      end as name
    ) tz
    where r.enabled
  ),
  due as (
    select
      c.id,
      c.user_id,
      c.kind,
      c.local_date,
      case c.kind
        when 'weigh_in' then exists (
          select 1 from public.weight_entries w
          where w.user_id = c.user_id and w.measured_on = c.local_date
        )
        when 'meal_log' then (
          select count(distinct e.category_id) from public.food_diary_entries e
          where e.user_id = c.user_id and e.entry_date = c.local_date
        ) >= coalesce(
          (select up.meals_per_day from public.user_preferences up where up.user_id = c.user_id),
          3
        )
        when 'workout' then exists (
          select 1 from public.workout_sessions ws
          where ws.user_id = c.user_id and ws.scheduled_on = c.local_date
            and ws.status in ('in_progress', 'paused', 'completed')
        )
        else false
      end as already_done
    from candidates c
    where extract(isodow from c.local_ts)::smallint = any (c.weekdays)
      and c.local_ts >= c.local_date + c.time_local
      and c.local_ts < c.local_date + c.time_local + interval '15 minutes'
      and (c.last_sent_on is null or c.last_sent_on < c.local_date)
  ),
  -- Exécuté même sans être lu (CTE de modification) : marque les rappels traités.
  marked as (
    update public.reminders r
    set last_sent_on = d.local_date
    from due d
    where r.id = d.id
    returning r.id
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth,
      'kind', d.kind, 'detail', null, 'url', null
    )),
    '[]'::jsonb
  )
  from due d
  join public.push_subscriptions s on s.user_id = d.user_id
  where not d.already_done
    and s.last_seen_at > p_now - interval '60 days'
$$;

/**
 * Appelée par pg_cron. Sans les secrets du coffre, ne fait rien (et ne
 * consomme pas les alarmes). L'appel HTTP est asynchrone (pg_net).
 */
create function private.push_tick(p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  secret text;
  messages jsonb;
begin
  select decrypted_secret into app_url from vault.decrypted_secrets where name = 'elan_app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'elan_push_secret';
  if app_url is null or secret is null then
    return;
  end if;

  messages := case p_kind
    when 'rest' then private.due_rest_alarms()
    else private.due_reminders()
  end;
  if jsonb_array_length(messages) = 0 then
    return;
  end if;

  perform net.http_post(
    url := rtrim(app_url, '/') || '/api/push',
    body := jsonb_build_object('messages', messages),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function private.due_rest_alarms(timestamptz) from public;
revoke all on function private.due_reminders(timestamptz) from public;
revoke all on function private.push_tick(text) from public;

-- --- Planification ----------------------------------------------------------------
-- pg_cron et pg_net existent sur Supabase (gratuits). Ailleurs (tests), on saute.
-- En cas d'échec, la migration passe quand même : il suffira d'activer les deux
-- extensions dans le tableau de bord puis d'exécuter `select private.schedule_push_jobs();`
-- (voir docs/NOTIFICATIONS.md).

create function private.schedule_push_jobs()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform cron.schedule('elan-rest-alarms', '5 seconds', $job$select private.push_tick('rest')$job$);
  perform cron.schedule('elan-reminders', '* * * * *', $job$select private.push_tick('reminders')$job$);
  -- pg_cron garde une trace de chaque exécution : on ne garde que 2 jours.
  perform cron.schedule(
    'elan-cron-cleanup',
    '17 3 * * *',
    $job$delete from cron.job_run_details where end_time < now() - interval '2 days'$job$
  );
end;
$$;

revoke all on function private.schedule_push_jobs() from public;

do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_net') then
    begin
      create extension if not exists pg_net with schema extensions;
      create extension if not exists pg_cron with schema pg_catalog;
      perform private.schedule_push_jobs();
    exception when others then
      raise warning 'Notifications : planification non installée (%). Voir docs/NOTIFICATIONS.md.', sqlerrm;
    end;
  end if;
end;
$$;
