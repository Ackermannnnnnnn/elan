-- =============================================================================
-- 0015 · Séance en direct souple
--   · chaque séance a son propre plan (`session_exercises`) : copié de la séance
--     type au démarrage, puis modifiable pendant la séance (exercice changé
--     parce qu'une machine est prise, ajouté, retiré, déplacé, superset, note) ;
--   · supersets dans les séances types (`workout_exercises.superset_with_next`).
-- =============================================================================

alter table public.workout_exercises
  add column superset_with_next boolean not null default false;

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  session_id uuid not null,
  exercise_id uuid not null references public.exercise_library (id) on delete restrict,
  position smallint not null default 0,
  rep_min smallint not null check (rep_min between 1 and 100),
  rep_max smallint not null check (rep_max between 1 and 100),
  rest_seconds smallint check (rest_seconds between 0 and 900),
  -- Enchaîné sans repos avec l'exercice suivant (superset).
  superset_with_next boolean not null default false,
  -- Exercice prévu à l'origine, s'il a été changé pendant la séance.
  replaced_exercise_id uuid references public.exercise_library (id) on delete set null,
  -- Note libre (réglage de machine, sensation…), rappelée à la séance suivante.
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (session_id, exercise_id),
  check (rep_max >= rep_min),
  foreign key (session_id, user_id)
    references public.workout_sessions (id, user_id) on delete cascade
);
create index session_exercises_session_idx on public.session_exercises (session_id, position);
create index session_exercises_exercise_idx on public.session_exercises (user_id, exercise_id)
  where note is not null;

call private.apply_owner_rls('session_exercises');
call private.track_updated_at('session_exercises');

-- Plan des séances existantes : leurs exercices, dans l'ordre de la séance type
-- (puis dans l'ordre de la première série), avec les objectifs de la séance type.
insert into public.session_exercises
  (user_id, session_id, exercise_id, position, rep_min, rep_max, rest_seconds)
select
  s.user_id,
  s.id,
  e.exercise_id,
  (row_number() over (
    partition by s.id order by coalesce(we.position, 1000), e.first_set
  ) - 1)::smallint,
  coalesce(we.rep_min, 8),
  greatest(coalesce(we.rep_max, 12), coalesce(we.rep_min, 8)),
  we.rest_seconds
from public.workout_sessions s
join (
  select session_id, exercise_id, min(created_at) as first_set
  from public.workout_sets
  group by session_id, exercise_id
) e on e.session_id = s.id
left join lateral (
  select position, rep_min, rep_max, rest_seconds
  from public.workout_exercises w
  where w.workout_id = s.workout_id and w.exercise_id = e.exercise_id
  order by position
  limit 1
) we on true;
