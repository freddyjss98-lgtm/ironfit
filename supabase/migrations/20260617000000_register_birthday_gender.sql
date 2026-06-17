-- =============================================================================
-- Iron Fit Club — Registro del portal: persistir cumpleaños y género
-- =============================================================================
-- El formulario /portal/register ahora exige fecha de nacimiento y género.
-- Se envían en user_metadata y handle_new_user los guarda en `members` al
-- crear el socio en el auto-registro. Se conserva el short-circuit is_member.
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
    -- Acceso creado por el admin: el socio ya existe y se vincula en la Action.
    return new;
  elsif v_is_self_register then
    -- Auto-registro desde el portal: crear registro de socio con todos los datos.
    insert into public.members (full_name, phone, email, birthday, gender, user_id)
    values (
      coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      coalesce(new.raw_user_meta_data->>'phone', ''),
      new.email,
      nullif(new.raw_user_meta_data->>'birthday', '')::date,
      nullif(new.raw_user_meta_data->>'gender', ''),
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
