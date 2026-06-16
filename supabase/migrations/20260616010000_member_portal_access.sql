-- =============================================================================
-- Iron Fit Club — Acceso al portal creado por el admin
-- =============================================================================
-- El admin puede generar usuario + contraseña temporal al crear un socio.
-- Esos usuarios de auth NO deben convertirse en staff (no crear fila en
-- profiles). Se marcan con user_metadata.is_member = true y el linking de
-- members.user_id lo hace la Server Action con el service role.
--
-- Antes, handle_new_user metía en `profiles` a cualquier usuario sin flag, lo
-- que el portal/middleware interpretaban como admin → un socio invitado entraba
-- por error a /admin. Este short-circuit lo evita.
-- =============================================================================

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
    -- Acceso creado por el admin para un socio existente. El registro en
    -- `members` ya existe y la Server Action vincula members.user_id con el
    -- service role. No se crea perfil de staff.
    return new;
  elsif v_is_self_register then
    -- Auto-registro desde el portal: crear registro de socio.
    insert into public.members (full_name, phone, email, user_id)
    values (
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data->>'phone', ''),
      new.email,
      new.id
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
