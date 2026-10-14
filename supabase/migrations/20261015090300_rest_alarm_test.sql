-- =============================================================================
-- Notifications : alarme d'essai de fin de repos.
-- « Tester la fin de repos » (Profil → Rappels et notifications) programme une
-- vraie alarme dans 10 secondes : elle passe par tout le circuit (pg_cron →
-- pg_net → /api/push → téléphone) et permet de vérifier la mise en service.
-- =============================================================================

alter table public.push_alarms drop constraint push_alarms_kind_check;
alter table public.push_alarms
  add constraint push_alarms_kind_check check (kind in ('rest', 'rest_test'));
