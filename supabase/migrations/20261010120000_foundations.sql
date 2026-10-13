-- =============================================================================
-- 0001 · Fondations
-- Extensions, schéma privé et fonctions utilitaires partagées par les
-- migrations suivantes.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Schéma non exposé par l'API (PostgREST n'expose que `public`).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Met à jour `updated_at` à chaque modification.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Applique le modèle « chaque ligne appartient à un utilisateur » :
--   · active la Row Level Security ;
--   · crée une politique par opération, limitée au propriétaire ;
--   · accorde explicitement les droits au rôle `authenticated` (et aucun à `anon`).
-- `ops` permet de restreindre les opérations (ex. journal d'usage non modifiable).
create or replace procedure private.apply_owner_rls(
  target_table text,
  ops text[] default array['select', 'insert', 'update', 'delete'],
  owner_column text default 'user_id'
)
language plpgsql
set search_path = ''
as $$
declare
  op text;
  owner_check text := format('(select auth.uid()) = %I', owner_column);
begin
  execute format('alter table public.%I enable row level security', target_table);
  execute format('revoke all on table public.%I from anon, authenticated', target_table);
  execute format('grant all on table public.%I to service_role', target_table);

  foreach op in array ops loop
    execute format('grant %s on table public.%I to authenticated', op, target_table);

    if op = 'select' then
      execute format(
        'create policy %I on public.%I for select to authenticated using (%s)',
        target_table || '_select_own', target_table, owner_check);
    elsif op = 'insert' then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (%s)',
        target_table || '_insert_own', target_table, owner_check);
    elsif op = 'update' then
      execute format(
        'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
        target_table || '_update_own', target_table, owner_check, owner_check);
    elsif op = 'delete' then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (%s)',
        target_table || '_delete_own', target_table, owner_check);
    else
      raise exception 'Opération inconnue : %', op;
    end if;
  end loop;
end;
$$;

-- Ajoute le déclencheur `updated_at` sur une table.
create or replace procedure private.track_updated_at(target_table text)
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create trigger set_updated_at before update on public.%I
       for each row execute function private.set_updated_at()',
    target_table);
end;
$$;
