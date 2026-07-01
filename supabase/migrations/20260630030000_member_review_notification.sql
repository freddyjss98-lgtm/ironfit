-- =============================================================================
-- Iron Fit Club — Notificación: nuevos socios auto-registrados
-- =============================================================================
-- Cuando un socio se registra solo desde el portal, el admin debe verlo en el
-- dashboard y marcarlo como revisado (la notificación desaparece).
--
--   • members.reviewed_at — NULL = pendiente de revisar (recién auto-registrado).
--     Default now(): las altas por admin y los socios existentes quedan revisados.
--   • handle_new_user() ahora inserta reviewed_at = NULL en el auto-registro.
-- =============================================================================

alter table public.members
  add column if not exists reviewed_at timestamptz default now();

create index if not exists members_reviewed_at_null_idx
  on public.members (created_at desc) where reviewed_at is null;

-- Reescribe el trigger: el auto-registro marca al socio como pendiente de revisar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_is_self_register boolean;
  v_is_member boolean;
begin
  v_is_admin := coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false);
  v_is_self_register := coalesce((new.raw_user_meta_data->>'is_self_register')::boolean, false);
  v_is_member := coalesce((new.raw_user_meta_data->>'is_member')::boolean, false);

  if v_is_member then
    -- Acceso creado por el admin: el socio ya existe y se vincula en la Action.
    return new;
  elsif v_is_self_register then
    -- Auto-registro desde el portal: crear socio PENDIENTE de revisar (reviewed_at = null).
    insert into public.members (full_name, phone, email, birthday, gender, user_id, reviewed_at)
    values (
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data->>'phone', ''),
      new.email,
      nullif(new.raw_user_meta_data->>'birthday', '')::date,
      nullif(new.raw_user_meta_data->>'gender', ''),
      new.id,
      null
    )
    on conflict do nothing;
  else
    -- Sign-up / invitación de staff: crear fila en profiles.
    insert into public.profiles (id, email, full_name)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
