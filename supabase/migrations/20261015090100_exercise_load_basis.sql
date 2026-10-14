-- =============================================================================
-- Charge par haltère : pour un développé incliné aux haltères, « 20 kg » veut
-- dire 20 kg DANS CHAQUE MAIN. On l'enregistre par exercice pour l'afficher
-- sans ambiguïté (« kg / bras ») partout : saisie, historique, progression.
--   total    : charge totale (barre chargée, machine, un haltère à deux mains)
--   per_hand : charge d'un haltère (un dans chaque main, ou un bras à la fois)
-- Les valeurs déjà saisies ne changent pas : c'est leur sens qui est précisé.
-- Les exercices de référence sont mis à jour par la migration suivante (générée).
-- =============================================================================

alter table public.exercise_library
  add column load_basis text not null default 'total'
    check (load_basis in ('total', 'per_hand'));
