-- =============================================================================
-- 0004 · Nutrition : aliments, journal, recettes, plans, courses
-- =============================================================================

-- Catalogue d'aliments.
--   owner_id IS NULL  → entrée partagée, en lecture seule pour les utilisateurs.
--                       Alimentée côté serveur (cache Open Food Facts, import CIQUAL).
--   owner_id = <uid>  → aliment privé créé par l'utilisateur ou estimé par l'IA.
-- Chaque valeur garde sa source : on ne mélange jamais donnée vérifiée et estimation.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  source text not null check (source in ('ciqual', 'open_food_facts', 'user', 'ai_estimate')),
  -- Code CIQUAL ou code-barres ; NULL pour les aliments privés.
  source_ref text check (char_length(source_ref) between 1 and 64),
  data_quality text not null check (data_quality in ('verified', 'community', 'user', 'estimated')),
  name text not null check (char_length(name) between 1 and 200),
  brand text check (char_length(brand) <= 120),
  -- Les valeurs ci-dessous sont exprimées pour 100 g ou pour 100 ml.
  basis text not null default '100g' check (basis in ('100g', '100ml')),
  -- État dans lequel l'aliment est pesé : le riz cru et le riz cuit sont deux entrées.
  preparation_state text not null default 'as_sold' check (
    preparation_state in ('raw', 'cooked', 'as_sold', 'unknown')
  ),
  kcal numeric(6, 1) not null check (kcal between 0 and 900),
  protein_g numeric(5, 2) not null check (protein_g between 0 and 100),
  carbs_g numeric(5, 2) not null check (carbs_g between 0 and 100),
  fat_g numeric(5, 2) not null check (fat_g between 0 and 100),
  fiber_g numeric(5, 2) check (fiber_g between 0 and 100),
  sugars_g numeric(5, 2) check (sugars_g between 0 and 100),
  saturated_fat_g numeric(5, 2) check (saturated_fat_g between 0 and 100),
  salt_g numeric(5, 2) check (salt_g between 0 and 100),
  serving_size_g numeric(6, 1) check (serving_size_g > 0 and serving_size_g <= 5000),
  serving_label text check (char_length(serving_label) <= 60),
  allergens text[] not null default '{}' check (cardinality(allergens) <= 30),
  -- Texte normalisé (minuscules, sans accents) pour la recherche ; maintenu par déclencheur.
  search_text text not null default '',
  -- Date de récupération auprès de la source : sert d'expiration au cache.
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Le catalogue partagé ne contient que des sources externes ; le privé jamais.
  check ((owner_id is null) = (source in ('ciqual', 'open_food_facts'))),
  check (source not in ('ciqual', 'open_food_facts') or source_ref is not null)
);

create unique index foods_shared_source_ref on public.foods (source, source_ref) where owner_id is null;
create index foods_owner_idx on public.foods (owner_id) where owner_id is not null;
create index foods_search_trgm on public.foods using gin (search_text extensions.gin_trgm_ops);

create or replace function private.foods_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(extensions.unaccent(new.name || ' ' || coalesce(new.brand, '')));
  return new;
end;
$$;

create trigger foods_set_search_text
  before insert or update of name, brand on public.foods
  for each row execute function private.foods_set_search_text();

call private.track_updated_at('foods');

alter table public.foods enable row level security;
revoke all on table public.foods from anon, authenticated;
grant all on table public.foods to service_role;
grant select, insert, update, delete on table public.foods to authenticated;

create policy foods_select_shared_or_own on public.foods
  for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
-- Écriture : uniquement ses propres aliments. Le catalogue partagé n'est
-- modifiable que par le serveur (clé secrète, qui contourne la RLS).
create policy foods_insert_own on public.foods
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy foods_update_own on public.foods
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy foods_delete_own on public.foods
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Catégories de repas : 4 par défaut (créées à l'inscription) + personnalisées.
create table public.meal_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (key in ('breakfast', 'lunch', 'dinner', 'snack', 'custom')),
  -- Libellé libre pour les catégories personnalisées ; les autres sont traduites par l'interface.
  label text check (char_length(label) between 1 and 40),
  sort_order smallint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (key <> 'custom' or label is not null)
);
create unique index meal_categories_one_per_builtin_key
  on public.meal_categories (user_id, key)
  where key <> 'custom';

call private.apply_owner_rls('meal_categories');

-- Photos de repas envoyées à l'analyse IA. Le fichier vit dans le bucket privé
-- `meal-photos` ; `expires_at` applique la politique de conservation.
create table public.meal_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text unique,
  status text not null default 'uploaded' check (
    status in ('uploaded', 'analyzed', 'confirmed', 'discarded', 'failed')
  ),
  -- Proposition de l'IA (aliments, quantités, hypothèses, incertitude). Jamais
  -- recopiée dans le journal sans confirmation de l'utilisateur.
  analysis jsonb,
  provider text check (char_length(provider) <= 40),
  model text check (char_length(model) <= 80),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meal_photos_user_idx on public.meal_photos (user_id, created_at desc);
create index meal_photos_expiry_idx on public.meal_photos (expires_at) where storage_path is not null;

call private.apply_owner_rls('meal_photos');
call private.track_updated_at('meal_photos');

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 1000),
  origin text not null default 'user' check (origin in ('user', 'ai')),
  servings numeric(4, 1) not null default 1 check (servings > 0 and servings <= 50),
  prep_minutes smallint check (prep_minutes between 0 and 600),
  cook_minutes smallint check (cook_minutes between 0 and 600),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  -- Tableau JSON d'étapes : ["Cuire le riz…", "…"].
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  is_meal_prep boolean not null default false,
  is_favorite boolean not null default false,
  -- Valeurs par portion, calculées par le code à partir des ingrédients.
  kcal_per_serving numeric(7, 1) check (kcal_per_serving >= 0),
  protein_g_per_serving numeric(6, 1) check (protein_g_per_serving >= 0),
  carbs_g_per_serving numeric(6, 1) check (carbs_g_per_serving >= 0),
  fat_g_per_serving numeric(6, 1) check (fat_g_per_serving >= 0),
  -- false si au moins un ingrédient n'a pas de source nutritionnelle fiable.
  nutrition_is_complete boolean not null default false,
  estimated_cost_eur numeric(6, 2) check (estimated_cost_eur >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index recipes_user_idx on public.recipes (user_id, created_at desc);

call private.apply_owner_rls('recipes');
call private.track_updated_at('recipes');

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  recipe_id uuid not null,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  quantity_g numeric(7, 1) not null check (quantity_g > 0 and quantity_g <= 20000),
  -- Quantité lisible en cuisine (« 2 œufs », « 1 c. à soupe »).
  display_quantity text check (char_length(display_quantity) <= 60),
  is_optional boolean not null default false,
  position smallint not null default 0,
  foreign key (recipe_id, user_id) references public.recipes (id, user_id) on delete cascade
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_ingredients_food_idx on public.recipe_ingredients (food_id);

call private.apply_owner_rls('recipe_ingredients');

-- Repas enregistrés : favoris et repas récurrents réutilisables dans le journal.
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  default_category_id uuid references public.meal_categories (id) on delete set null,
  is_favorite boolean not null default false,
  -- Jours où le repas est proposé automatiquement (1 = lundi … 7 = dimanche).
  recurrence_weekdays smallint[] not null default '{}'
    check (recurrence_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index meals_user_idx on public.meals (user_id);

call private.apply_owner_rls('meals');
call private.track_updated_at('meals');

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  meal_id uuid not null,
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  description text not null check (char_length(description) between 1 and 200),
  quantity_g numeric(7, 1) check (quantity_g > 0 and quantity_g <= 5000),
  servings numeric(5, 2) check (servings > 0 and servings <= 50),
  position smallint not null default 0,
  foreign key (meal_id, user_id) references public.meals (id, user_id) on delete cascade,
  check (num_nonnulls(quantity_g, servings) >= 1)
);
create index meal_items_meal_idx on public.meal_items (meal_id, position);

call private.apply_owner_rls('meal_items');

-- Journal alimentaire. Les macros sont FIGÉES à l'enregistrement (calculées par
-- le code à partir de la quantité et de l'aliment) : corriger un aliment plus
-- tard ne réécrit pas l'historique.
create table public.food_diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  category_id uuid not null,
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  meal_photo_id uuid references public.meal_photos (id) on delete set null,
  description text not null check (char_length(description) between 1 and 200),
  quantity_g numeric(7, 1) check (quantity_g > 0 and quantity_g <= 5000),
  servings numeric(5, 2) check (servings > 0 and servings <= 50),
  -- La quantité saisie correspond-elle au poids cru, cuit, ou tel que consommé ?
  quantity_state text not null default 'as_consumed' check (
    quantity_state in ('as_consumed', 'raw', 'cooked')
  ),
  kcal numeric(7, 1) not null check (kcal between 0 and 20000),
  protein_g numeric(6, 1) not null check (protein_g between 0 and 2000),
  carbs_g numeric(6, 1) not null check (carbs_g between 0 and 2000),
  fat_g numeric(6, 1) not null check (fat_g between 0 and 2000),
  fiber_g numeric(6, 1) check (fiber_g between 0 and 500),
  origin text not null default 'manual' check (
    origin in ('manual', 'photo_ai', 'meal_plan', 'saved_meal', 'copy')
  ),
  -- true si au moins une valeur provient d'une estimation (IA ou aliment non vérifié).
  is_estimate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, user_id) references public.meal_categories (id, user_id),
  check (num_nonnulls(quantity_g, servings) >= 1)
);
create index food_diary_user_date_idx on public.food_diary_entries (user_id, entry_date desc);
create index food_diary_food_idx on public.food_diary_entries (food_id);
create index food_diary_recipe_idx on public.food_diary_entries (recipe_id);
create index food_diary_photo_idx on public.food_diary_entries (meal_photo_id);
create index food_diary_category_idx on public.food_diary_entries (category_id);

call private.apply_owner_rls('food_diary_entries');
call private.track_updated_at('food_diary_entries');

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  origin text not null default 'ai' check (origin in ('ai', 'manual')),
  target_kcal integer check (target_kcal between 800 and 8000),
  target_protein_g integer check (target_protein_g between 0 and 600),
  budget_eur numeric(6, 2) check (budget_eur >= 0),
  -- Instantané des contraintes utilisées (allergies, régime, temps…) pour audit.
  constraints jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index meal_plans_one_active_per_week
  on public.meal_plans (user_id, week_start)
  where status = 'active';
create index meal_plans_user_idx on public.meal_plans (user_id, week_start desc);

call private.apply_owner_rls('meal_plans');
call private.track_updated_at('meal_plans');

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  meal_plan_id uuid not null,
  -- 0 = lundi … 6 = dimanche.
  day_index smallint not null check (day_index between 0 and 6),
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  position smallint not null default 0,
  recipe_id uuid references public.recipes (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  servings numeric(4, 1) not null default 1 check (servings > 0 and servings <= 20),
  kcal numeric(7, 1) check (kcal >= 0),
  protein_g numeric(6, 1) check (protein_g >= 0),
  carbs_g numeric(6, 1) check (carbs_g >= 0),
  fat_g numeric(6, 1) check (fat_g >= 0),
  logged_at timestamptz,
  foreign key (meal_plan_id, user_id) references public.meal_plans (id, user_id) on delete cascade
);
create index meal_plan_items_plan_idx on public.meal_plan_items (meal_plan_id, day_index, position);
create index meal_plan_items_recipe_idx on public.meal_plan_items (recipe_id);

call private.apply_owner_rls('meal_plan_items');

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_plan_id uuid references public.meal_plans (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  budget_eur numeric(6, 2) check (budget_eur >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index shopping_lists_user_idx on public.shopping_lists (user_id, created_at desc);
create index shopping_lists_plan_idx on public.shopping_lists (meal_plan_id);

call private.apply_owner_rls('shopping_lists');
call private.track_updated_at('shopping_lists');

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  shopping_list_id uuid not null,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  -- Quantité théorique nécessaire aux recettes…
  quantity_g numeric(8, 1) check (quantity_g > 0),
  -- …et conditionnement courant à acheter (« 1 paquet de 500 g »).
  package_label text check (char_length(package_label) <= 80),
  aisle text check (char_length(aisle) <= 40),
  -- Prix indicatif. `price_source` NULL = aucun prix connu : on n'en invente pas.
  estimated_price_eur numeric(6, 2) check (estimated_price_eur >= 0),
  price_source text check (price_source in ('user', 'reference_table')),
  is_checked boolean not null default false,
  already_owned boolean not null default false,
  added_manually boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (shopping_list_id, user_id)
    references public.shopping_lists (id, user_id) on delete cascade,
  check ((estimated_price_eur is null) = (price_source is null))
);
create index shopping_list_items_list_idx on public.shopping_list_items (shopping_list_id, position);

call private.apply_owner_rls('shopping_list_items');
call private.track_updated_at('shopping_list_items');
