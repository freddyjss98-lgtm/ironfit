-- =============================================================================
-- Iron Fit Club — Separación de roles Admin / Coach
-- =============================================================================
-- Hasta ahora las policies "admin" comprobaban solo que el usuario tuviera fila
-- en `profiles`. Al crear logins de coach (también fila en profiles) eso les
-- daría acceso a TODO, incluidas las finanzas. Aquí:
--   • is_admin(): true solo si profiles.role = 'admin'
--   • Se bloquean a admin-only las tablas sensibles de dinero: sales, sale_items
-- El resto de tablas (members, attendances, clases, progreso, eventos) siguen
-- accesibles a cualquier staff, que es lo que el coach necesita.
-- =============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ── Ventas: solo admin (los socios conservan su lectura propia) ─────────────────
drop policy if exists sales_admin_all on public.sales;
create policy sales_admin_all on public.sales
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists sale_items_admin_all on public.sale_items;
create policy sale_items_admin_all on public.sale_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
