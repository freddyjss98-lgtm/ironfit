-- =============================================================================
-- Iron Fit Club — V3.4 Migration: Productos Unificados
-- =============================================================================
-- Adds:
--   • membership_plans.image_url  — foto del plan
--   • membership_plans.iva_rate   — tasa IVA (SRI)
--   • products.image_url          — foto del producto
--   • products.iva_rate           — tasa IVA (SRI)
--   • Storage bucket 'productos'  — imágenes públicas
-- =============================================================================

-- 1. Membership plans: nuevas columnas
alter table public.membership_plans
  add column if not exists image_url text,
  add column if not exists iva_rate  numeric(5,2) not null default 15.0;

-- 2. Products: nuevas columnas
alter table public.products
  add column if not exists image_url text,
  add column if not exists iva_rate  numeric(5,2) not null default 15.0;

-- 3. Storage bucket para imágenes de productos (público)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'productos',
  'productos',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- 4. RLS: permitir subida a usuarios autenticados
--    (drop first so re-running the migration is idempotent)
do $$
begin
  -- insert
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'productos_insert'
  ) then
    execute $p$
      create policy "productos_insert" on storage.objects
        for insert to authenticated
        with check (bucket_id = 'productos')
    $p$;
  end if;

  -- select (public)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'productos_select'
  ) then
    execute $p$
      create policy "productos_select" on storage.objects
        for select to public
        using (bucket_id = 'productos')
    $p$;
  end if;

  -- delete
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'productos_delete'
  ) then
    execute $p$
      create policy "productos_delete" on storage.objects
        for delete to authenticated
        using (bucket_id = 'productos')
    $p$;
  end if;
end;
$$;
