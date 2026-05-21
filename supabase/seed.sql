-- =============================================================================
-- Iron Fit Club — Seed Data
-- =============================================================================
-- Run after the initial schema migration to populate plans and a sample coach.
-- Member/membership/sale data should be entered through the admin UI.
-- =============================================================================

-- Membership plans (precios de referencia — ajustar duración según operación real)
insert into public.membership_plans (name, description, price, duration_days, sort_order)
values
  ('Iron Bimensual', 'Acceso ilimitado por 60 días', 60.00,  60,  1),
  ('Iron Trimestral','Acceso ilimitado por 90 días', 90.00,  90,  2),
  ('Iron Fit',       'Plan mensual estándar',       140.00,  30,  3),
  ('Iron',           'Plan trimestral premium',     360.00,  90,  4),
  ('Fit Friends',    'Plan grupal anual',           425.00, 365,  5)
on conflict (name) do nothing;

-- Coach placeholder (reemplazar con datos reales del dueño/coaches)
insert into public.coaches (full_name, phone, specialty, active)
values
  ('Coach principal', '+593959888060', 'Entrenamiento funcional', true)
on conflict do nothing;

-- Class schedule basado en los horarios actuales del landing
-- Lun-Vie: 05:00-10:00 AM y 16:00-21:00 PM
-- Sábado: 08:00-10:00 AM
insert into public.class_schedules (name, day_of_week, start_time, end_time, max_capacity, active)
values
  ('Funcional AM',     1, '05:00', '10:00', 20, true),
  ('Funcional PM',     1, '16:00', '21:00', 20, true),
  ('Funcional AM',     2, '05:00', '10:00', 20, true),
  ('Funcional PM',     2, '16:00', '21:00', 20, true),
  ('Funcional AM',     3, '05:00', '10:00', 20, true),
  ('Funcional PM',     3, '16:00', '21:00', 20, true),
  ('Funcional AM',     4, '05:00', '10:00', 20, true),
  ('Funcional PM',     4, '16:00', '21:00', 20, true),
  ('Funcional AM',     5, '05:00', '10:00', 20, true),
  ('Funcional PM',     5, '16:00', '21:00', 20, true),
  ('Funcional Sábado', 6, '08:00', '10:00', 20, true)
on conflict do nothing;
