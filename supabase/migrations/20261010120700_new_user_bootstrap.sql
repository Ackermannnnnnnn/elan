-- =============================================================================
-- 0008 · Initialisation d'un nouveau compte
-- À chaque inscription (insertion dans auth.users), on crée le profil, les
-- préférences par défaut et les quatre catégories de repas.
-- =============================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(requested_name, 60))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.meal_categories (user_id, key, sort_order)
  values
    (new.id, 'breakfast', 10),
    (new.id, 'lunch', 20),
    (new.id, 'dinner', 30),
    (new.id, 'snack', 40)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
