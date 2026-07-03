-- =============================================================================
-- Iron Fit Club — Optimización RLS (auth_rls_initplan)
-- =============================================================================
-- auth.uid() dentro de una política se evaluaba por CADA fila escaneada.
-- Envuelto en (SELECT auth.uid()), Postgres lo evalúa una sola vez por
-- consulta (InitPlan). Reescribe las ~40 políticas afectadas leyendo sus
-- expresiones del catálogo, para no transcribirlas a mano.
-- Ref: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
-- =============================================================================

do $$
declare r record; stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and ((qual like '%auth.uid()%' and qual not like '%SELECT auth.uid()%')
        or (with_check like '%auth.uid()%' and with_check not like '%SELECT auth.uid()%'))
  loop
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then
      stmt := stmt || format(' using (%s)', replace(r.qual, 'auth.uid()', '(SELECT auth.uid())'));
    end if;
    if r.with_check is not null then
      stmt := stmt || format(' with check (%s)', replace(r.with_check, 'auth.uid()', '(SELECT auth.uid())'));
    end if;
    execute stmt;
  end loop;
end $$;
