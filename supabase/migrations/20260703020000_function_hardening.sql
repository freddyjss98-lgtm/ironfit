-- =============================================================================
-- Iron Fit Club — Endurecimiento de funciones
-- =============================================================================

-- search_path fijo (evita hijacking por search_path mutable)
alter function public.set_updated_at() set search_path = public;
alter function public.today_ec() set search_path = public;

-- handle_new_user es un trigger: nadie debe poder llamarlo por la API REST
revoke execute on function public.handle_new_user() from anon, authenticated;

-- is_admin solo tiene sentido para usuarios logueados
revoke execute on function public.is_admin() from anon;
