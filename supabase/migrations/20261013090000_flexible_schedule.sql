-- =============================================================================
-- 0014 · Planning d'entraînement souple
--   · une séance type peut être « à la demande » (weekday NULL, déjà permis) ;
--   · une occurrence hebdomadaire peut être déplacée ou sautée UNE fois :
--       - déplacée : séance 'planned' à la nouvelle date, original_date = date prévue ;
--       - sautée   : séance 'skipped', scheduled_on = original_date = date prévue ;
--   · une séance supplémentaire se planifie à n'importe quelle date
--     ('planned', original_date NULL).
-- =============================================================================

alter table public.workout_sessions
  add column original_date date,
  add constraint workout_sessions_skipped_in_place
    check (status <> 'skipped' or (original_date is not null and scheduled_on = original_date));

-- Une occurrence (séance type + date prévue) n'est déplacée ou sautée qu'une fois.
-- (Les séances planifiées ou sautées d'une séance type supprimée sont effacées
-- par l'application avant la suppression ; l'historique, lui, est conservé.)
create unique index workout_sessions_one_override
  on public.workout_sessions (user_id, workout_id, original_date)
  where status in ('planned', 'skipped') and original_date is not null;

-- Lecture de la semaine : séances d'un utilisateur sur une plage de dates.
create index workout_sessions_original_idx
  on public.workout_sessions (user_id, original_date)
  where original_date is not null;
