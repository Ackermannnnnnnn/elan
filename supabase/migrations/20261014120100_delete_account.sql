-- =============================================================================
-- Phase 6 · Suppression du compte (RGPD, droit à l'effacement).
--
-- Supprime l'utilisateur connecté de auth.users : toutes ses données suivent
-- par les clés étrangères « on delete cascade » (vérifié par tests/db/rls.test.ts).
-- L'application ne stocke aujourd'hui aucun fichier (photos) : le jour où
-- elle le fera, ils devront être supprimés avant l'appel à cette fonction.
-- =============================================================================

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'notAuthenticated' using errcode = '42501';
  end if;

  -- Ces tables pointent vers les exercices en « restrict » : on les vide
  -- d'abord pour que la cascade ne bute pas sur les exercices personnels.
  delete from public.workout_sets where user_id = uid;
  delete from public.session_exercises where user_id = uid;
  delete from public.workout_exercises where user_id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
