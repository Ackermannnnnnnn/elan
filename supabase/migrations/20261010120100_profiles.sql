-- =============================================================================
-- 0002 · Profil et préférences
-- =============================================================================

-- Une ligne par compte. `id` = identifiant Supabase Auth.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  birth_date date check (birth_date >= date '1900-01-01'),
  -- Utilisé uniquement par les formules métaboliques. NULL = non précisé.
  sex text check (sex in ('female', 'male')),
  height_cm numeric(4, 1) check (height_cm between 100 and 250),
  activity_level text check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),
  occupation_type text check (
    occupation_type in ('sedentary', 'standing', 'active', 'physical')
  ),
  avg_daily_steps integer check (avg_daily_steps between 0 and 100000),
  training_level text check (training_level in ('beginner', 'intermediate', 'advanced')),
  locale text not null default 'fr' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  -- Fuseau IANA : sert à déterminer « aujourd'hui » pour le journal.
  timezone text not null default 'Europe/Brussels' check (char_length(timezone) between 1 and 64),
  country text check (country ~ '^[A-Z]{2}$'),
  onboarding_completed_at timestamptz,
  -- Traçabilité du consentement (RGPD) : NULL = non donné.
  health_data_consent_at timestamptz,
  ai_processing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil de l''utilisateur (données personnelles, une ligne par compte).';

call private.apply_owner_rls('profiles', array['select', 'insert', 'update'], 'id');
call private.track_updated_at('profiles');

-- Préférences alimentaires, sportives et réglages de l'application.
create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Alimentation
  weekly_food_budget_eur numeric(6, 2) check (weekly_food_budget_eur between 0 and 2000),
  meals_per_day smallint check (meals_per_day between 1 and 8),
  snacks_per_day smallint check (snacks_per_day between 0 and 6),
  diet_type text not null default 'omnivore' check (
    diet_type in ('omnivore', 'flexitarian', 'pescatarian', 'vegetarian', 'vegan')
  ),
  -- Contraintes STRICTES : codes des 14 allergènes UE + saisies libres.
  allergies text[] not null default '{}' check (cardinality(allergies) <= 40),
  intolerances text[] not null default '{}' check (cardinality(intolerances) <= 40),
  -- Ingrédients exclus sans justification demandée (ex. porc, alcool).
  excluded_ingredients text[] not null default '{}' check (cardinality(excluded_ingredients) <= 60),
  liked_foods text[] not null default '{}' check (cardinality(liked_foods) <= 100),
  disliked_foods text[] not null default '{}' check (cardinality(disliked_foods) <= 100),
  cooking_time_minutes smallint check (cooking_time_minutes between 0 and 240),
  cooking_skill text check (cooking_skill in ('beginner', 'intermediate', 'advanced')),
  meal_prep boolean not null default false,
  meal_style text[] not null default '{}' check (
    meal_style <@ array['budget', 'quick', 'varied', 'repetitive']
  ),
  kitchen_equipment text[] not null default '{}' check (cardinality(kitchen_equipment) <= 40),

  -- Sport
  sessions_per_week smallint check (sessions_per_week between 0 and 14),
  session_duration_minutes smallint check (session_duration_minutes between 5 and 300),
  training_location text check (training_location in ('gym', 'home', 'both', 'outdoor')),
  equipment text[] not null default '{}' check (cardinality(equipment) <= 60),
  sports text[] not null default '{}' check (cardinality(sports) <= 30),
  liked_exercises text[] not null default '{}' check (cardinality(liked_exercises) <= 60),
  disliked_exercises text[] not null default '{}' check (cardinality(disliked_exercises) <= 60),
  -- Zones du corps déclarées sensibles (déclaratif, jamais un diagnostic).
  limitations text[] not null default '{}' check (cardinality(limitations) <= 20),
  priority_muscles text[] not null default '{}' check (cardinality(priority_muscles) <= 20),

  -- Objectifs quotidiens indicatifs
  daily_steps_goal integer check (daily_steps_goal between 0 and 100000),
  daily_water_goal_ml integer check (daily_water_goal_ml between 0 and 10000),

  -- Fonctionnalités optionnelles
  water_tracking_enabled boolean not null default true,
  body_photos_enabled boolean not null default false,
  gamification_enabled boolean not null default false,

  -- Conservation des photos de repas (jours). 0 = suppression après analyse.
  meal_photo_retention_days smallint not null default 30
    check (meal_photo_retention_days between 0 and 365),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is 'Préférences et contraintes de l''utilisateur. Les allergies sont des contraintes strictes appliquées dans le code.';

call private.apply_owner_rls('user_preferences', array['select', 'insert', 'update']);
call private.track_updated_at('user_preferences');
