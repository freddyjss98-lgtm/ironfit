# Iron Fit Club — Supabase Setup

## Estructura

```
supabase/
├── migrations/
│   └── 20260519000000_initial_schema.sql   # Schema completo (tablas + RLS + views)
├── seed.sql                                # Datos iniciales (planes, horarios)
└── README.md
```

## Tablas creadas

| Tabla | Para qué |
|-------|----------|
| `profiles` | Extiende `auth.users` con rol (owner/admin/staff). Se crea automático al signup |
| `members` | Atletas del gym (nombre, teléfono, cumpleaños, contacto emergencia) |
| `coaches` | Entrenadores (asignables a clases) |
| `membership_plans` | Tipos de planes (Iron Fit $140, Iron $360, etc.) — editable |
| `memberships` | Asignación de plan a miembro con fechas y estado |
| `class_schedules` | Horarios recurrentes por día de semana, AM/PM auto-calculado |
| `products` | Tienda (suplementos, ropa) con stock |
| `sales` | Encabezado de venta (método de pago, fecha, total) |
| `sale_items` | Líneas: una venta puede incluir 1 membresía + N productos |

## Views (para dashboard)

| View | Para |
|------|------|
| `vw_memberships_status` | Estado efectivo (calcula `expired` si end_date < hoy) |
| `vw_members_with_active_membership` | Cada miembro con su membresía vigente |
| `vw_daily_sales` | Resumen de ventas por día (con desglose por método) |
| `vw_monthly_sales` | Resumen por mes (total, count, miembros únicos) |
| `vw_expiring_soon` | Membresías que vencen en próximos 14 días (para alertas) |

## RLS (Row Level Security)

Habilitado en **todas** las tablas. Política actual:

- **`profiles`**: leer todos, escribir solo el propio
- **Resto**: full access a usuarios autenticados (el sistema entero es admin-only)

> Para tightening por rol (owner/admin/staff) se hace en iteración posterior.

## Cómo aplicar

### Opción A — Editor SQL de Supabase (más rápido para empezar)

1. Crea proyecto en https://supabase.com/dashboard
2. Una vez creado, ve a **SQL Editor** → **New query**
3. Pega el contenido completo de `migrations/20260519000000_initial_schema.sql`
4. Click **Run**. Debe terminar sin errores.
5. Crea otra query, pega `seed.sql`, **Run**.
6. Ve a **Table editor** y verifica que veas las 9 tablas.

### Opción B — Supabase CLI (recomendado a mediano plazo)

```bash
# Instalar CLI (una vez)
npm install -g supabase

# Login
supabase login

# Linkear el proyecto local con el remoto
cd ironfit
supabase link --project-ref <tu-project-ref>

# Aplicar migraciones al remoto
supabase db push

# Aplicar seed
psql "<connection-string>" -f supabase/seed.sql
```

## Después de aplicar

1. **Crea el primer usuario admin**: ve a Supabase → **Authentication** → **Users** → **Add user** → email + password. El trigger creará automáticamente su fila en `profiles` con rol `admin`. **Cambia su rol a `owner`** manualmente en la tabla `profiles`.

2. **Copia las credenciales**: Supabase → **Project Settings** → **API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Configura en Vercel**: Project Settings → Environment Variables → agrega ambas. Redeploy.

## Modificar el schema más adelante

NO edites el archivo `20260519000000_initial_schema.sql` después de aplicado. Para cambios:

```bash
# Crea una nueva migración con timestamp
supabase migration new add_<descripcion>
# Edita el archivo nuevo en supabase/migrations/
# Aplica:
supabase db push
```
