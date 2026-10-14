-- =============================================================================
-- 0016 · Taille de l'emballage d'un aliment (canette, bouteille, paquet…)
--   Récupérée d'Open Food Facts (`product_quantity`), elle permet de choisir
--   « tout l'emballage » ou « la moitié » sans calcul.
-- =============================================================================

alter table public.foods
  add column package_size_g numeric(7, 1) check (package_size_g > 0 and package_size_g <= 10000),
  add column package_label text check (char_length(package_label) <= 60);
