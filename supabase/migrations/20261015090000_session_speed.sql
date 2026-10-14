-- =============================================================================
-- Séance en direct : changer ou déplacer un exercice en un seul aller-retour.
--
-- Avant : « Choisir » un exercice de remplacement enchaînait une dizaine de
-- requêtes successives (lecture de l'exercice, de la séance, du plan, des
-- séries, puis suppression, mise à jour, insertion…), et « Monter / Descendre »
-- une requête par exercice décalé. Entre Vercel et Supabase, chaque requête
-- coûte un aller-retour réseau. Ces fonctions font tout dans une transaction.
--
-- SECURITY INVOKER : les règles RLS de l'utilisateur s'appliquent comme pour
-- une requête normale ; on filtre en plus explicitement par auth.uid().
-- Codes d'erreur : P0002 = introuvable ; P0001 + message = règle métier.
-- =============================================================================

/**
 * Change un exercice de la séance en cours (machine prise, douleur…). Mêmes
 * règles qu'avant (voir src/data/training.ts) :
 *  · séries déjà validées : elles restent sur l'exercice d'origine, le nouvel
 *    exercice est inséré juste après avec les séries restantes ;
 *  · rien de fait : l'exercice est remplacé sur place ;
 *  · objectifs conservés, sauf passage répétitions ↔ secondes : il faut alors
 *    ceux du nouvel exercice (p_rep_min…), sinon erreur « needsPrescription » ;
 *  · p_in_program : remplacé aussi dans la séance type.
 * Renvoie l'identifiant de la séance.
 */
create function public.swap_session_exercise(
  p_item_id uuid,
  p_exercise_id uuid,
  p_in_program boolean default false,
  p_rep_min smallint default null,
  p_rep_max smallint default null,
  p_rest_seconds smallint default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.session_exercises;
  v_workout uuid;
  v_current_timed boolean;
  v_new_timed boolean;
  v_rep_min smallint;
  v_rep_max smallint;
  v_rest smallint;
  v_total integer;
  v_done integer;
  v_remaining integer;
  v_new_item uuid;
  v_template public.workout_exercises;
begin
  select * into v_item
  from public.session_exercises
  where id = p_item_id and user_id = v_user
  for update;
  if not found then
    raise exception 'itemNotFound' using errcode = 'P0002';
  end if;
  -- Seule une séance en cours ou en pause se modifie.
  if not exists (
    select 1 from public.workout_sessions
    where id = v_item.session_id and user_id = v_user and status in ('in_progress', 'paused')
  ) then
    raise exception 'sessionNotOpen' using errcode = 'P0001';
  end if;
  if v_item.exercise_id = p_exercise_id then
    return v_item.session_id;
  end if;
  if exists (
    select 1 from public.session_exercises
    where session_id = v_item.session_id and user_id = v_user and exercise_id = p_exercise_id
  ) then
    raise exception 'exerciseAlreadyInSession' using errcode = 'P0001';
  end if;

  select is_timed into v_current_timed from public.exercise_library where id = v_item.exercise_id;
  -- Exercice de référence ou exercice personnel de l'utilisateur (RLS).
  select is_timed into v_new_timed from public.exercise_library where id = p_exercise_id;
  if v_new_timed is null then
    raise exception 'itemNotFound' using errcode = 'P0002';
  end if;

  if v_new_timed is distinct from v_current_timed then
    if p_rep_min is null or p_rep_max is null then
      raise exception 'needsPrescription' using errcode = 'P0001';
    end if;
    v_rep_min := p_rep_min;
    v_rep_max := p_rep_max;
    v_rest := p_rest_seconds;
  else
    v_rep_min := v_item.rep_min;
    v_rep_max := v_item.rep_max;
    v_rest := v_item.rest_seconds;
  end if;

  select count(*), count(completed_at) into v_total, v_done
  from public.workout_sets
  where session_id = v_item.session_id and user_id = v_user and exercise_id = v_item.exercise_id;
  v_remaining := greatest(1, v_total - v_done);

  delete from public.workout_sets
  where session_id = v_item.session_id and user_id = v_user
    and exercise_id = v_item.exercise_id and completed_at is null;

  if v_done = 0 then
    -- Rien de fait : remplacé sur place.
    update public.session_exercises
    set exercise_id = p_exercise_id,
        replaced_exercise_id = coalesce(v_item.replaced_exercise_id, v_item.exercise_id),
        rep_min = v_rep_min,
        rep_max = v_rep_max,
        rest_seconds = v_rest
    where id = v_item.id;
  else
    -- Des séries sont faites : elles restent, le nouvel exercice suit juste après
    -- et reprend la place de l'ancien dans un éventuel superset.
    update public.session_exercises
    set position = position + 1
    where session_id = v_item.session_id and user_id = v_user and position > v_item.position;
    insert into public.session_exercises
      (user_id, session_id, exercise_id, position, rep_min, rep_max, rest_seconds,
       superset_with_next, replaced_exercise_id)
    values
      (v_user, v_item.session_id, p_exercise_id, v_item.position + 1, v_rep_min, v_rep_max,
       v_rest, v_item.superset_with_next, v_item.exercise_id)
    returning id into v_new_item;
    update public.session_exercises set superset_with_next = false where id = v_item.id;
  end if;

  insert into public.workout_sets (user_id, session_id, exercise_id, set_number)
  select v_user, v_item.session_id, p_exercise_id, n
  from generate_series(1, v_remaining) as n
  on conflict do nothing;

  if p_in_program then
    select workout_id into v_workout
    from public.workout_sessions where id = v_item.session_id and user_id = v_user;
    if v_workout is not null then
      select * into v_template
      from public.workout_exercises
      where workout_id = v_workout and user_id = v_user and exercise_id = v_item.exercise_id;
      if found and not exists (
        select 1 from public.workout_exercises
        where workout_id = v_workout and user_id = v_user and exercise_id = p_exercise_id
      ) then
        update public.workout_exercises
        set exercise_id = p_exercise_id,
            replaced_exercise_id = coalesce(v_template.replaced_exercise_id, v_template.exercise_id),
            rep_min = v_rep_min,
            rep_max = v_rep_max
        where id = v_template.id;
      end if;
    end if;
  end if;

  return v_item.session_id;
end;
$$;

revoke all on function public.swap_session_exercise(uuid, uuid, boolean, smallint, smallint, smallint) from public, anon;
grant execute on function public.swap_session_exercise(uuid, uuid, boolean, smallint, smallint, smallint) to authenticated;

/**
 * Déplace un exercice de la séance en cours : 'up', 'down' ou 'last' (faire
 * plus tard). Bornes respectées (le premier ne monte pas, le dernier ne
 * descend pas). Un exercice déplacé sort de son superset, ainsi que ses voisins
 * d'avant et d'après le déplacement. Les séries ne sont pas touchées.
 * Renvoie l'identifiant de la séance.
 */
create function public.move_session_exercise(p_item_id uuid, p_direction text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.session_exercises;
  v_ids uuid[];
  v_from integer;
  v_to integer;
  v_count integer;
begin
  if p_direction not in ('up', 'down', 'last') then
    raise exception 'invalidDirection' using errcode = 'P0001';
  end if;
  select * into v_item
  from public.session_exercises
  where id = p_item_id and user_id = v_user
  for update;
  if not found then
    raise exception 'itemNotFound' using errcode = 'P0002';
  end if;
  -- Seule une séance en cours ou en pause se modifie.
  if not exists (
    select 1 from public.workout_sessions
    where id = v_item.session_id and user_id = v_user and status in ('in_progress', 'paused')
  ) then
    raise exception 'sessionNotOpen' using errcode = 'P0001';
  end if;

  select array_agg(id order by position, created_at) into v_ids
  from public.session_exercises
  where session_id = v_item.session_id and user_id = v_user;
  v_count := coalesce(array_length(v_ids, 1), 0);
  v_from := array_position(v_ids, v_item.id);
  v_to := case p_direction
    when 'up' then greatest(1, v_from - 1)
    when 'down' then least(v_count, v_from + 1)
    else v_count
  end;
  if v_to = v_from then
    return v_item.session_id;
  end if;

  -- Superset rompu : l'exercice déplacé, son voisin d'avant, et son futur voisin d'avant.
  update public.session_exercises
  set superset_with_next = false
  where id = any (array[
    v_item.id,
    v_ids[v_from - 1],
    case when v_to > v_from then v_ids[v_to] else v_ids[v_to - 1] end
  ]) and superset_with_next;

  v_ids := array_remove(v_ids, v_item.id);
  v_ids := v_ids[1:v_to - 1] || v_item.id || v_ids[v_to:];

  update public.session_exercises s
  set position = (o.ordinality - 1)::smallint
  from unnest(v_ids) with ordinality as o(id, ordinality)
  where s.id = o.id and s.position is distinct from (o.ordinality - 1)::smallint;

  return v_item.session_id;
end;
$$;

revoke all on function public.move_session_exercise(uuid, text) from public, anon;
grant execute on function public.move_session_exercise(uuid, text) to authenticated;
