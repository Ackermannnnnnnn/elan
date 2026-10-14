-- =============================================================================
-- 0018 · Démarrer une séance en un seul aller-retour vers la base
--   Avant : une dizaine de requêtes successives (≈ 1 à 2 s si l'application et
--   la base sont éloignées). La fonction fait tout dans une transaction :
--   séance, plan de la séance, séries vides. SECURITY INVOKER : les règles RLS
--   de l'utilisateur s'appliquent comme pour une requête normale.
-- =============================================================================

create or replace function public.start_session(
  p_workout_id uuid,
  p_today date,
  p_occurrence date default null,
  p_planned_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session uuid;
  v_name text;
  v_weekday smallint;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Une séance est déjà en cours (ou en pause) : on la reprend.
  select id into v_session
  from public.workout_sessions
  where user_id = v_user and status in ('in_progress', 'paused')
  limit 1;
  if v_session is not null then
    return v_session;
  end if;

  -- Séance type du programme actif.
  select w.name, w.weekday into v_name, v_weekday
  from public.workouts w
  join public.training_programs p on p.id = w.program_id and p.user_id = w.user_id
  where w.id = p_workout_id and w.user_id = v_user and p.is_active;
  if not found then
    raise exception 'itemNotFound' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.workout_exercises where workout_id = p_workout_id and user_id = v_user
  ) then
    raise exception 'emptyWorkout' using errcode = 'P0001';
  end if;

  if p_planned_id is not null then
    update public.workout_sessions
    set name = v_name, scheduled_on = p_today, status = 'in_progress', started_at = now()
    where id = p_planned_id and user_id = v_user and workout_id = p_workout_id
      and status = 'planned'
    returning id into v_session;
    if v_session is null then
      raise exception 'itemNotFound' using errcode = 'P0002';
    end if;
  else
    insert into public.workout_sessions
      (user_id, workout_id, name, scheduled_on, original_date, status, started_at)
    values (
      v_user,
      p_workout_id,
      v_name,
      p_today,
      -- L'occurrence hebdomadaire faite (éventuellement un autre jour).
      case when p_occurrence is not null and v_weekday = extract(isodow from p_occurrence)
        then p_occurrence end,
      'in_progress',
      now()
    )
    returning id into v_session;
  end if;

  insert into public.session_exercises
    (user_id, session_id, exercise_id, position, rep_min, rep_max, rest_seconds, superset_with_next)
  select v_user, v_session, we.exercise_id,
         (row_number() over (order by we.position, we.created_at) - 1)::smallint,
         we.rep_min, we.rep_max, we.rest_seconds, we.superset_with_next
  from public.workout_exercises we
  where we.workout_id = p_workout_id and we.user_id = v_user
  on conflict (session_id, exercise_id) do nothing;

  insert into public.workout_sets (user_id, session_id, exercise_id, set_number)
  select v_user, v_session, we.exercise_id, n
  from public.workout_exercises we
  cross join lateral generate_series(1, we.target_sets) as n
  where we.workout_id = p_workout_id and we.user_id = v_user
  on conflict (session_id, exercise_id, set_number) do nothing;

  return v_session;
exception
  -- Double clic : une autre séance vient d'être démarrée, on la reprend.
  when unique_violation then
    select id into v_session
    from public.workout_sessions
    where user_id = v_user and status in ('in_progress', 'paused')
    limit 1;
    if v_session is null then
      raise;
    end if;
    return v_session;
end;
$$;

revoke all on function public.start_session(uuid, date, date, uuid) from public, anon;
grant execute on function public.start_session(uuid, date, date, uuid) to authenticated;
