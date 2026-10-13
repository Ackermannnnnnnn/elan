-- =============================================================================
-- 0009 · Déclencheur de recherche des aliments : indépendant des droits de l'appelant
--
-- `private.foods_set_search_text()` appelle `extensions.unaccent()`. Exécutée
-- avec les droits de l'utilisateur connecté, elle dépendait du droit USAGE sur
-- le schéma `extensions`. Supabase l'accorde par défaut, mais la création d'un
-- aliment ne doit pas reposer sur ce réglage : la fonction s'exécute désormais
-- avec les droits de son propriétaire. Elle ne fait que calculer une colonne à
-- partir de la ligne insérée, sans lire ni écrire ailleurs.
-- =============================================================================

alter function private.foods_set_search_text() security definer;
revoke all on function private.foods_set_search_text() from public, anon, authenticated;
