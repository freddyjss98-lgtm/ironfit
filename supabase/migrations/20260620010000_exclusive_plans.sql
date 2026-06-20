-- =============================================================================
-- Planes exclusivos: visibles en el portal sólo para socios seleccionados
-- -----------------------------------------------------------------------------
-- Un plan marcado is_exclusive=true NO aparece en el portal de renovación para
-- el público; sólo lo ven los socios listados en plan_member_access. El admin
-- sigue pudiendo asignarlo manualmente desde el panel.
-- =============================================================================

alter table public.membership_plans
  add column if not exists is_exclusive boolean not null default false;

create table if not exists public.plan_member_access (
  plan_id uuid not null references public.membership_plans(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, member_id)
);

create index if not exists plan_member_access_member_idx
  on public.plan_member_access(member_id);

alter table public.plan_member_access enable row level security;

-- Staff (cualquiera con fila en profiles: admin/coach) gestiona todo.
drop policy if exists plan_member_access_staff_all on public.plan_member_access;
create policy plan_member_access_staff_all on public.plan_member_access
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()));

-- Un socio puede LEER sus propias asignaciones (para que el portal filtre).
drop policy if exists plan_member_access_self_read on public.plan_member_access;
create policy plan_member_access_self_read on public.plan_member_access
  for select
  using (
    exists (
      select 1 from public.members m
      where m.id = plan_member_access.member_id and m.user_id = auth.uid()
    )
  );
