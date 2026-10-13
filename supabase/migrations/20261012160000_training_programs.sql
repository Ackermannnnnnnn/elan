-- =============================================================================
-- 0012 · Entraînement (phase 5)
--   · exercices chronométrés (gainage…) : répétitions exprimées en secondes ;
--   · programmes générés par le code, avec niveau et durée de séance ;
--   · une seule séance en cours (ou en pause) à la fois par utilisateur.
-- =============================================================================

alter table public.exercise_library
  add column is_timed boolean not null default false;

alter table public.training_programs drop constraint training_programs_origin_check;
alter table public.training_programs add constraint training_programs_origin_check
  check (origin in ('ai', 'manual', 'generated'));
alter table public.training_programs alter column origin set default 'generated';

alter table public.training_programs
  add column level text not null default 'beginner' check (
    level in ('beginner', 'intermediate', 'advanced')
  ),
  add column minutes_per_session smallint check (minutes_per_session between 10 and 240);

-- Thème de la séance type (« haut du corps », « jambes »…), pour l'affichage.
alter table public.workouts
  add column focus text check (
    focus in ('full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'custom')
  );

create unique index workout_sessions_one_active
  on public.workout_sessions (user_id)
  where status in ('in_progress', 'paused');

-- Objectif d'entraînement préféré (repris à la génération du programme).
alter table public.user_preferences
  add column training_goal text check (
    training_goal in ('fat_loss', 'hypertrophy', 'strength', 'endurance', 'general_fitness')
  );
