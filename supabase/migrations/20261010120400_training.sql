-- =============================================================================
-- 0005 · Entraînement : exercices, programmes, séances, séries
-- =============================================================================

-- Bibliothèque d'exercices. Même principe que `foods` :
--   owner_id IS NULL → exercice de référence (lecture seule) ;
--   owner_id = <uid> → exercice personnel.
-- Les attributs structurés (muscle, matériel, schéma de mouvement, zones
-- sensibles) permettent au code de filtrer les remplacements AVANT l'IA.
create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  slug text check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  primary_muscle text not null check (
    primary_muscle in (
      'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core',
      'glutes', 'quadriceps', 'hamstrings', 'calves', 'full_body', 'cardio'
    )
  ),
  secondary_muscles text[] not null default '{}' check (cardinality(secondary_muscles) <= 8),
  movement_pattern text not null check (
    movement_pattern in (
      'push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical',
      'squat', 'hinge', 'lunge', 'carry', 'core', 'isolation', 'cardio', 'mobility'
    )
  ),
  -- Matériel requis ; tableau vide = poids du corps.
  equipment text[] not null default '{}' check (cardinality(equipment) <= 8),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  is_compound boolean not null default false,
  instructions text check (char_length(instructions) <= 3000),
  -- Zones du corps pour lesquelles l'exercice n'est pas proposé automatiquement.
  caution_areas text[] not null default '{}' check (cardinality(caution_areas) <= 10),
  media_url text check (media_url ~ '^https://' and char_length(media_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id is not null or slug is not null)
);
create unique index exercise_library_shared_slug on public.exercise_library (slug) where owner_id is null;
create index exercise_library_owner_idx on public.exercise_library (owner_id) where owner_id is not null;
create index exercise_library_muscle_idx on public.exercise_library (primary_muscle, movement_pattern);

call private.track_updated_at('exercise_library');

alter table public.exercise_library enable row level security;
revoke all on table public.exercise_library from anon, authenticated;
grant all on table public.exercise_library to service_role;
grant select, insert, update, delete on table public.exercise_library to authenticated;

create policy exercise_library_select_shared_or_own on public.exercise_library
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy exercise_library_insert_own on public.exercise_library
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy exercise_library_update_own on public.exercise_library
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy exercise_library_delete_own on public.exercise_library
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  structure text not null check (
    structure in ('full_body', 'upper_lower', 'push_pull_legs', 'custom')
  ),
  goal text not null check (
    goal in ('fat_loss', 'hypertrophy', 'strength', 'endurance', 'general_fitness')
  ),
  sessions_per_week smallint not null check (sessions_per_week between 1 and 7),
  origin text not null default 'ai' check (origin in ('ai', 'manual')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index training_programs_one_active on public.training_programs (user_id) where is_active;

call private.apply_owner_rls('training_programs');
call private.track_updated_at('training_programs');

-- Une séance type du programme (« Haut du corps A »).
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  program_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  -- Jour prévu (1 = lundi … 7 = dimanche) ; modifiable pour déplacer la séance.
  weekday smallint check (weekday between 1 and 7),
  position smallint not null default 0,
  estimated_minutes smallint check (estimated_minutes between 5 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (program_id, user_id)
    references public.training_programs (id, user_id) on delete cascade
);
create index workouts_program_idx on public.workouts (program_id, position);

call private.apply_owner_rls('workouts');
call private.track_updated_at('workouts');

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  workout_id uuid not null,
  exercise_id uuid not null references public.exercise_library (id) on delete restrict,
  position smallint not null default 0,
  target_sets smallint not null check (target_sets between 1 and 12),
  rep_min smallint not null check (rep_min between 1 and 100),
  rep_max smallint not null check (rep_max between 1 and 100),
  rest_seconds smallint check (rest_seconds between 0 and 900),
  notes text check (char_length(notes) <= 500),
  -- Trace du remplacement : exercice d'origine du programme.
  replaced_exercise_id uuid references public.exercise_library (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade,
  check (rep_max >= rep_min)
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, position);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

call private.apply_owner_rls('workout_exercises');
call private.track_updated_at('workout_exercises');

-- Séance réellement effectuée (ou planifiée).
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid references public.workouts (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  scheduled_on date not null,
  status text not null default 'planned' check (
    status in ('planned', 'in_progress', 'paused', 'completed', 'skipped')
  ),
  started_at timestamptz,
  paused_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  ended_at timestamptz,
  perceived_effort smallint check (perceived_effort between 1 and 10),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, scheduled_on desc);
create index workout_sessions_workout_idx on public.workout_sessions (workout_id);

call private.apply_owner_rls('workout_sessions');
call private.track_updated_at('workout_sessions');

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  session_id uuid not null,
  exercise_id uuid not null references public.exercise_library (id) on delete restrict,
  set_number smallint not null check (set_number between 1 and 30),
  weight_kg numeric(6, 2) check (weight_kg between 0 and 1000),
  reps smallint check (reps between 0 and 500),
  duration_seconds integer check (duration_seconds between 0 and 86400),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  is_warmup boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, exercise_id, set_number),
  foreign key (session_id, user_id)
    references public.workout_sessions (id, user_id) on delete cascade
);
-- Historique des performances par exercice.
create index workout_sets_user_exercise_idx
  on public.workout_sets (user_id, exercise_id, completed_at desc);

call private.apply_owner_rls('workout_sets');
call private.track_updated_at('workout_sets');
