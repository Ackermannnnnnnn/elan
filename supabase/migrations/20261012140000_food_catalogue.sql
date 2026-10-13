-- =============================================================================
-- 0010 · Catalogue d'aliments, recettes et plans (phase 4)
--
--   · Les produits Open Food Facts sont enregistrés comme copies PRIVÉES de
--     l'utilisateur qui les scanne : aucune clé secrète n'est nécessaire et
--     personne ne peut altérer les données des autres.
--   · Chaque aliment porte un rayon (liste de courses) et une classe de régime
--     (végétalien, végétarien, poisson, viande) déduits par le code.
--   · Les recettes indiquent les repas auxquels elles conviennent.
--   · Les plans de repas sont générés par un algorithme, sans IA.
-- =============================================================================

-- --- Aliments ---------------------------------------------------------------------

-- Ancienne règle : « partagé ⇔ source externe ». Nouvelle règle : le catalogue
-- partagé ne contient que des sources externes, et un aliment privé peut aussi
-- venir d'Open Food Facts (copie personnelle d'un produit scanné).
alter table public.foods drop constraint foods_check;
alter table public.foods add constraint foods_owner_source_check check (
  (owner_id is null and source in ('ciqual', 'open_food_facts'))
  or (owner_id is not null and source in ('user', 'ai_estimate', 'open_food_facts'))
);

-- Un même code-barres n'est copié qu'une fois par utilisateur.
create unique index foods_private_source_ref
  on public.foods (owner_id, source, source_ref)
  where owner_id is not null and source_ref is not null;

alter table public.foods
  add column aisle text not null default 'other' check (
    aisle in ('produce', 'meat_fish', 'dairy_eggs', 'bakery', 'grocery', 'frozen', 'drinks', 'other')
  ),
  -- plant : végétalien · vegetarian : produit animal sans chair (lait, œuf, miel)
  -- fish : poisson ou fruit de mer · meat : viande · unknown : non déterminé.
  add column diet_class text not null default 'unknown' check (
    diet_class in ('plant', 'vegetarian', 'fish', 'meat', 'unknown')
  );

comment on column public.foods.allergens is
  'Codes des 14 allergènes UE. CIQUAL n''en fournit pas : ils sont déduits du nom par le code (prudence).';

-- Recherche classée parmi les aliments visibles (RLS appliquée : SECURITY INVOKER).
-- `search` doit être normalisé par l'appelant (minuscules, sans accents ni
-- ponctuation) : chaque mot doit apparaître ; les aliments personnels passent
-- en premier, puis ceux dont le nom commence par le terme, puis les plus courts.
create or replace function public.search_foods(search text, max_results integer default 30)
returns setof public.foods
language sql
stable
security invoker
set search_path = ''
as $$
  select f.*
  from public.foods f
  where search <> ''
    and not exists (
      select 1
      from unnest(string_to_array(search, ' ')) as word
      where word <> '' and position(word in f.search_text) = 0
    )
  order by
    (f.owner_id is null),
    case
      when f.search_text like search || '%' then 0
      when f.search_text like split_part(search, ' ', 1) || '%' then 1
      when f.search_text like '% ' || split_part(search, ' ', 1) || '%' then 2
      else 3
    end,
    char_length(f.name),
    f.name
  limit least(greatest(coalesce(max_results, 30), 1), 100);
$$;

revoke all on function public.search_foods(text, integer) from public, anon;
grant execute on function public.search_foods(text, integer) to authenticated;

-- --- Recettes ---------------------------------------------------------------------

alter table public.recipes drop constraint recipes_origin_check;
alter table public.recipes add constraint recipes_origin_check
  check (origin in ('user', 'ai', 'starter'));

alter table public.recipes
  add column meal_slots text[] not null default '{}' check (
    meal_slots <@ array['breakfast', 'lunch', 'dinner', 'snack']
  ),
  -- Identifiant d'une recette de départ copiée : évite de l'ajouter deux fois.
  add column starter_key text check (char_length(starter_key) between 1 and 60);

create unique index recipes_one_starter_per_user
  on public.recipes (user_id, starter_key)
  where starter_key is not null;

-- --- Plans de repas ---------------------------------------------------------------

alter table public.meal_plans drop constraint meal_plans_origin_check;
alter table public.meal_plans add constraint meal_plans_origin_check
  check (origin in ('ai', 'manual', 'generated'));
alter table public.meal_plans alter column origin set default 'generated';

-- Une seule liste de courses par plan.
create unique index shopping_lists_one_per_plan
  on public.shopping_lists (meal_plan_id)
  where meal_plan_id is not null;

alter table public.shopping_list_items
  add constraint shopping_list_items_aisle_code_check check (
    aisle is null
    or aisle in ('produce', 'meat_fish', 'dairy_eggs', 'bakery', 'grocery', 'frozen', 'drinks', 'other')
  );

-- Les portions d'un plan vont par quarts (1,25 ; 1,75) : deux décimales.
alter table public.meal_plan_items alter column servings type numeric(5, 2);
