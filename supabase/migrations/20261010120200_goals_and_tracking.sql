-- =============================================================================
-- 0003 · Objectifs, cibles nutritionnelles et suivi quotidien
-- Convention : `*_on` / `entry_date` = jour civil dans le fuseau de
-- l'utilisateur (type date) ; `*_at` = instant précis (timestamptz, UTC).
-- =============================================================================

create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null default 'primary' check (kind in ('primary', 'milestone')),
  goal_type text not null check (
    goal_type in ('fat_loss', 'maintenance', 'muscle_gain', 'recomposition', 'fitness')
  ),
  status text not null default 'active' check (
    status in ('active', 'achieved', 'abandoned', 'replaced')
  ),
  parent_goal_id uuid references public.user_goals (id) on delete set null,
  start_weight_kg numeric(5, 2) check (start_weight_kg between 30 and 300),
  target_weight_kg numeric(5, 2) check (target_weight_kg between 30 and 300),
  -- Rythme visé en kg/semaine (négatif = perte). Bornes de sécurité larges,
  -- les règles fines (% du poids, plancher calorique) sont dans le code métier.
  weekly_rate_kg numeric(3, 2) check (weekly_rate_kg between -1.5 and 1.0),
  started_on date not null default current_date,
  target_date date,
  ended_at timestamptz,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (target_date is null or target_date >= started_on)
);

-- Un seul objectif principal actif à la fois ; l'historique reste consultable.
create unique index user_goals_one_active_primary
  on public.user_goals (user_id)
  where status = 'active' and kind = 'primary';
create index user_goals_user_idx on public.user_goals (user_id, started_on desc);

call private.apply_owner_rls('user_goals');
call private.track_updated_at('user_goals');

-- Cibles caloriques et macros, historisées. Calculées par le moteur métier
-- (jamais par l'IA) ou saisies manuellement.
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid references public.user_goals (id) on delete set null,
  effective_from date not null default current_date,
  source text not null check (source in ('calculated', 'manual')),
  formula text check (char_length(formula) <= 60),
  bmr_kcal integer check (bmr_kcal between 500 and 5000),
  maintenance_kcal integer check (maintenance_kcal between 800 and 8000),
  target_kcal integer not null check (target_kcal between 800 and 8000),
  protein_g integer not null check (protein_g between 0 and 600),
  carbs_g integer not null check (carbs_g between 0 and 1500),
  fat_g integer not null check (fat_g between 0 and 500),
  fiber_g integer check (fiber_g between 0 and 150),
  -- Instantané des données d'entrée (poids, âge, activité…) pour expliquer le calcul.
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

call private.apply_owner_rls('nutrition_targets');

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 30 and 300),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Une pesée par jour : une nouvelle saisie remplace la précédente.
  unique (user_id, measured_on)
);

call private.apply_owner_rls('weight_entries');
call private.track_updated_at('weight_entries');

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  waist_cm numeric(4, 1) check (waist_cm between 30 and 250),
  hips_cm numeric(4, 1) check (hips_cm between 30 and 250),
  chest_cm numeric(4, 1) check (chest_cm between 30 and 250),
  arm_cm numeric(4, 1) check (arm_cm between 10 and 100),
  thigh_cm numeric(4, 1) check (thigh_cm between 20 and 150),
  neck_cm numeric(4, 1) check (neck_cm between 15 and 80),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on),
  check (num_nonnulls(waist_cm, hips_cm, chest_cm, arm_cm, thigh_cm, neck_cm, body_fat_pct) > 0)
);

call private.apply_owner_rls('body_measurements');
call private.track_updated_at('body_measurements');

-- Photos avant/après (facultatif, désactivé par défaut dans les préférences).
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null unique,
  taken_on date not null,
  pose text not null default 'front' check (pose in ('front', 'side', 'back', 'other')),
  created_at timestamptz not null default now()
);
create index progress_photos_user_idx on public.progress_photos (user_id, taken_on desc);

call private.apply_owner_rls('progress_photos', array['select', 'insert', 'delete']);

-- Pas quotidiens et activités. `source` prépare Apple Health / Health Connect.
create table public.activity_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  kind text not null check (kind in ('steps', 'activity')),
  steps integer check (steps between 0 and 200000),
  activity_type text check (char_length(activity_type) between 1 and 60),
  duration_minutes integer check (duration_minutes between 1 and 1440),
  distance_km numeric(6, 2) check (distance_km between 0 and 1000),
  source text not null default 'manual' check (
    source in ('manual', 'apple_health', 'health_connect')
  ),
  external_id text check (char_length(external_id) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'steps' and steps is not null)
    or (kind = 'activity' and activity_type is not null)
  )
);
-- Un seul total de pas par jour et par source.
create unique index activity_entries_steps_per_day
  on public.activity_entries (user_id, entry_date, source)
  where kind = 'steps';
create index activity_entries_user_date_idx on public.activity_entries (user_id, entry_date desc);

call private.apply_owner_rls('activity_entries');
call private.track_updated_at('activity_entries');

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  consumed_at timestamptz not null default now(),
  amount_ml integer not null check (amount_ml between 1 and 5000),
  beverage text not null default 'water' check (char_length(beverage) between 1 and 40),
  created_at timestamptz not null default now()
);
create index water_entries_user_date_idx on public.water_entries (user_id, entry_date desc);

call private.apply_owner_rls('water_entries');

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (
    key in ('sleep', 'meals_logged', 'workouts', 'walking', 'hydration', 'custom')
  ),
  name text check (char_length(name) between 1 and 60),
  target_value numeric(8, 2) check (target_value >= 0),
  unit text check (char_length(unit) <= 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (key <> 'custom' or name is not null)
);
create unique index habits_one_per_builtin_key
  on public.habits (user_id, key)
  where key <> 'custom';

call private.apply_owner_rls('habits');
call private.track_updated_at('habits');

create table public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  habit_id uuid not null,
  entry_date date not null,
  value numeric(8, 2) check (value >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, entry_date),
  -- Clé composite : l'entrée appartient forcément au propriétaire de l'habitude.
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);
create index habit_entries_user_date_idx on public.habit_entries (user_id, entry_date desc);

call private.apply_owner_rls('habit_entries');
call private.track_updated_at('habit_entries');

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('weigh_in', 'meal_log', 'workout', 'meal_prep')),
  enabled boolean not null default false,
  time_local time not null default '08:00',
  -- 1 = lundi … 7 = dimanche (ISO).
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}'
    check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

call private.apply_owner_rls('reminders');
call private.track_updated_at('reminders');

-- Badges (gamification facultative, aucun classement public).
create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 60),
  earned_at timestamptz not null default now(),
  unique (user_id, key)
);

call private.apply_owner_rls('user_achievements', array['select', 'insert', 'delete']);

-- Bilans hebdomadaires : statistiques calculées par le code + synthèse IA.
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  stats jsonb not null default '{}'::jsonb,
  summary text check (char_length(summary) <= 6000),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

call private.apply_owner_rls('weekly_reviews', array['select', 'insert', 'delete']);
