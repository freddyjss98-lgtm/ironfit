-- =============================================================================
-- Iron Fit Club — Resultados por parte del WOD (tarjeta para Instagram)
-- =============================================================================
-- Además del resultado principal (el de la pizarra), el socio puede anotar,
-- si quiere, el resultado de cada parte del WOD ("B. Fase 1 · 24:10",
-- "C. AMRAP 10' · 7 + 12"). Todo opcional: puede llenar una sola parte.
--
-- parts es una lista JSON de objetos:
--   { "label": "B. Fase 1 · 6 Rondas", "score_type": "time",
--     "time_seconds": 1450, "rounds": null, "reps": null, "load_kg": null }
-- Aditiva: las filas existentes quedan con '[]'.
-- =============================================================================

alter table public.wod_results
  add column if not exists parts jsonb not null default '[]'::jsonb;

alter table public.wod_results
  add constraint wod_results_parts_ok check (
    jsonb_typeof(parts) = 'array'
    and jsonb_array_length(parts) <= 10
    and octet_length(parts::text) <= 4000
  );
