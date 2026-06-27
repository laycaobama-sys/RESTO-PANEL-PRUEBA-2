# RestoPanel · Guía completa de configuración Supabase

Esta guía te lleva paso a paso por la configuración de la base de datos Supabase para el SaaS multi-tenant de restaurantes. Puedes seguir esta guía para verificar la configuración actual o repetirla desde cero en un proyecto nuevo.

---

## Tabla de contenidos

1. [Variables de entorno](#1-variables-de-entorno)
2. [Crear el esquema en Supabase](#2-crear-el-esquema-en-supabase)
3. [Activar y verificar RLS](#3-activar-y-verificar-rls)
4. [Integración con la app](#4-integración-con-la-app)
5. [Cargar datos demo (seed)](#5-cargar-datos-demo-seed)
6. [Verificación en el panel de Supabase](#6-verificación-en-el-panel-de-supabase)
7. [Verificación con consultas SQL](#7-verificación-con-consultas-sql)
8. [Probar el flujo completo](#8-probar-el-flujo-completo)
9. [Solución de errores comunes](#9-solución-de-errores-comunes)
10. [Despliegue en producción](#10-despliegue-en-producción)

---

## 1. Variables de entorno

Copia `.env.example` a `.env.local` y rellena con los valores de tu proyecto Supabase:

```bash
# ─── Browser-facing (seguras, RLS-protected) ───────────────────
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # clave pública "anon"

# ─── Server-only (NUNCA en el navegador) ───────────────────────
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # clave "service_role"

# ─── NextAuth ─────────────────────────────────────────────────
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
```

**Dónde encontrar las claves**: Panel de Supabase → *Settings* → *API*:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_URL`
- `anon` public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`

### Reglas de seguridad

| Variable | Dónde se usa | Riesgo si se filtra |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Navegador | Bajo — sujeta a RLS, no permite leer datos de otros tenants |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | **CRÍTICO** — bypassa RLS, acceso total a la BD |
| `NEXTAUTH_SECRET` | Solo servidor | Crítico — permite firmar JWTs válidos |

**Nunca** pongas `SUPABASE_SERVICE_ROLE_KEY` con el prefijo `NEXT_PUBLIC_`. Next.js lo incluiría en el bundle del navegador y sería visible para cualquiera.

---

## 2. Crear el esquema en Supabase

### Paso a paso

1. Entra en tu proyecto Supabase: <https://app.supabase.com>
2. En el menú izquierdo, haz clic en **SQL Editor**.
3. Pulsa **New query**.
4. Pega el contenido de `supabase/migrations/0001_init.sql` (archivo completo, sin modificaciones).
5. Pulsa **Run** (Ctrl+Enter).
6. Repite los pasos 3-5 con `supabase/migrations/0002_hardened_rls.sql`.

### Qué se crea

**10 tablas** con `organization_id` en todas las de datos:

| Tabla | Propósito |
|---|---|
| `organizations` | Tenant root (un restaurante = una fila) |
| `users` | Personal del restaurante (admin + staff) |
| `verification_tokens` | Tokens de reset password / verify email |
| `categories` | Secciones de la carta (Hamburguesas, Bebidas, etc.) |
| `menu_items` | Platos y bebidas |
| `tables` | Mesas con posición en el plano (posX, posY, shape) |
| `orders` | Pedidos del POS |
| `order_items` | Líneas de cada pedido |
| `reservations` | Reservas de clientes |
| `organization_settings` | Horarios, IVA, service charge (1:1 con organization) |

**Índices** creados en todas las columnas `organization_id` y en los campos de filtro más común (`status`, `date`, `shift`).

**Triggers** `updated_at` automáticos en todas las tablas para que el campo se actualice solo.

---

## 3. Activar y verificar RLS

La migración `0001_init.sql` ya activa RLS y crea las políticas. Para verificar:

### Desde el panel de Supabase

1. Ve a **Table Editor** → cualquier tabla.
2. En la parte superior verás un badge que dice **"RLS Enabled"** o **"RLS Disabled"**.
3. Para ver las políticas: pulsa el botón **"Policies"** en la cabecera de la tabla.

### Con una consulta SQL

Ejecuta en el SQL Editor:

```sql
SELECT * FROM rls_check();
```

Deberías ver 10 filas (una por tabla) con `rls_enabled = true` y `policies_count` ≥ 2:

```
 tablename           | rls_enabled | policies_count
---------------------+-------------+----------------
 categories           | true        | 4
 menu_items           | true        | 4
 order_items          | true        | 4
 orders               | true        | 4
 organization_settings| true        | 4
 organizations        | true        | 2
 reservations         | true        | 4
 tables               | true        | 4
 users                | true        | 4
 verification_tokens  | true        | 4
```

### Qué hacen las políticas

Para cada tabla (excepto `organizations` que tiene select+update):

- **SELECT**: `using (organization_id = current_user_org_id())` — solo filas de tu tenant.
- **INSERT**: `with check (organization_id = current_user_org_id())` — no puedes insertar en otro tenant.
- **UPDATE**: `using (...) with check (...)` — solo actualizas filas de tu tenant y no puedes "mover" una fila a otro tenant.
- **DELETE**: `using (...)` — solo borras filas de tu tenant.

La función `current_user_org_id()` lee el claim `user_organization` del JWT. Si no hay JWT (caso del navegador con NextAuth), devuelve NULL y todas las políticas deniegan. El cliente admin (`service_role`) bypassa RLS, así que la app valida el tenancy en cada query.

---

## 4. Integración con la app

### Clientes Supabase

| Archivo | Uso | Env vars | RLS |
|---|---|---|---|
| `src/lib/supabase/client.ts` | Browser | `NEXT_PUBLIC_SUPABASE_*` | Sí, sujeto a políticas |
| `src/lib/supabase/admin.ts` | Server only | `SUPABASE_*` | No, bypassa RLS |

**Regla de oro**: el cliente admin **jamás** se importa en un componente con `"use client"`. Next.js fallaría al compilar porque las variables `SUPABASE_*` no están disponibles en el bundle del navegador.

### Capa de datos unificada

`src/lib/db.ts` expone un objeto `db` con métodos tipados para cada tabla:

```typescript
// Ejemplo: listar menús de la organización actual
const items = await db.menuItem.list(user.organizationId, { includeHidden: true })

// Crear una reserva con tenant scope forzado
const r = await db.reservation.create({
  customer_name: 'María',
  phone: '+34 600 000 000',
  party_size: 4,
  date: new Date().toISOString(),
  organization_id: user.organizationId,  // siempre del servidor
  // ...
})
```

Cada función:
1. Recibe `organizationId` como parámetro explícito (nunca del cliente).
2. Filtra por `organization_id` en el WHERE.
3. Stampa `organization_id` en cada INSERT.

### API routes

Las 12 API routes en `src/app/api/` siguen el mismo patrón:

```typescript
export async function GET() {
  const user = await getCurrentUser()         // del JWT de NextAuth
  if (!user) return 401
  const items = await db.menuItem.list(user.organizationId)
  return NextResponse.json(items)
}
```

El `organizationId` se obtiene SIEMPRE de la sesión, no del body ni de la URL. Esto hace imposible que un usuario pida datos de otro tenant aunque manipule el request.

---

## 5. Cargar datos demo (seed)

Para llenar la BD con 2 restaurantes de ejemplo:

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "Content-Type: application/json" \
  -d '{"force":true}'
```

Esto crea:

- **La Zamorana** (Salamanca): 8 categorías, 40 platos, 11 mesas, 15 pedidos, 8 reservas.
- **Bistró del Puerto** (Cádiz): 1 categoría, 1 plato, 1 mesa.

Credenciales demo:

| Restaurante | Email | Contraseña |
|---|---|---|
| La Zamorana | `demo@lazamorana.es` | `demo1234` |
| Bistró del Puerto | `demo@bistrodelpuerto.es` | `demo1234` |

El flag `force: true` borra todos los datos antes de re-crear. **Sin ese flag**, el seed no hace nada si ya existen datos.

---

## 6. Verificación en el panel de Supabase

### 6.1. Tablas creadas

Panel → **Table Editor**. Deberías ver las 10 tablas en el sidebar izquierdo:

```
categories
menu_items
order_items
orders
organization_settings
organizations
reservations
tables
users
verification_tokens
```

### 6.2. Relaciones (foreign keys)

Panel → **Database** → **Tables** → pulsa cualquier tabla → pestaña **"Constraints"**. Verás las FKs definidas, por ejemplo en `menu_items`:

```
menu_items.category_id → categories.id (ON DELETE CASCADE)
menu_items.organization_id → organizations.id (ON DELETE CASCADE)
```

El `CASCADE` asegura que al borrar una organización, se borran automáticamente todas sus categorías, platos, mesas, etc.

### 6.3. RLS activo

Panel → **Authentication** → **Policies**. Verás las 10 tablas con el badge "RLS Enabled" y sus políticas listadas debajo.

### 6.4. Datos visibles

Panel → **Table Editor** → `organizations`. Deberías ver 2-3 filas (La Zamorana, Bistró del Puerto, y cualquier restaurante extra que hayas registrado).

---

## 7. Verificación con consultas SQL

Pega estas consultas en el **SQL Editor** para verificar el estado de la BD.

### 7.1. Verificar RLS en todas las tablas

```sql
SELECT * FROM rls_check();
```

### 7.2. Crear una organización demo manualmente

```sql
INSERT INTO organizations (name, slug, phone, email, city, country)
VALUES ('Mi Restaurante', 'mi-restaurante', '+34 600 000 000', 'hola@mirestaurante.es', 'Valencia', 'España')
RETURNING id, slug;
```

Anota el `id` devuelto (lo necesitarás para los siguientes INSERTs).

### 7.3. Crear un usuario admin asociado

```sql
-- Reemplaza :org_id por el UUID devuelto en el paso anterior
-- y el password_hash por uno real generado con bcrypt.
INSERT INTO users (email, password_hash, name, role, organization_id)
VALUES (
  'admin@mirestaurante.es',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',  -- "demo1234"
  'Admin',
  'ADMIN',
  'PEGAR_AQUÍ_EL_ORG_ID'
)
RETURNING id, email, role;
```

### 7.4. Insertar una categoría y un plato

```sql
-- Categoría
INSERT INTO categories (name, slug, icon, sort_order, organization_id)
VALUES ('Pizzas', 'pizzas', '🍕', 1, 'PEGAR_AQUÍ_EL_ORG_ID')
RETURNING id;

-- Plato (usa el category_id devuelto)
INSERT INTO menu_items (name, description, price, category_id, organization_id)
VALUES (
  'Pizza Margherita',
  'Tomate, mozzarella y albahaca',
  9.50,
  'PEGAR_AQUÍ_EL_CATEGORY_ID',
  'PEGAR_AQUÍ_EL_ORG_ID'
);
```

### 7.5. Insertar una mesa y una reserva

```sql
-- Mesa
INSERT INTO tables (number, name, capacity, zone, shape, pos_x, pos_y, organization_id)
VALUES ('1', 'Mesa Ventana', 4, 'INTERIOR', 'ROUND', 100, 100, 'PEGAR_AQUÍ_EL_ORG_ID');

-- Reserva
INSERT INTO reservations (customer_name, phone, party_size, date, status, shift, zone, organization_id)
VALUES (
  'Juan Pérez',
  '+34 611 222 333',
  2,
  '2026-07-01 20:00:00+00',
  'CONFIRMED',
  'DINNER',
  'INTERIOR',
  'PEGAR_AQUÍ_EL_ORG_ID'
);
```

### 7.6. Verificar aislamiento multi-tenant

```sql
-- ¿Cuántos platos tiene cada organización?
SELECT o.name, COUNT(mi.id) AS platos
FROM organizations o
LEFT JOIN menu_items mi ON mi.organization_id = o.id
GROUP BY o.name
ORDER BY platos DESC;
```

Resultado esperado:

```
        name         | platos
---------------------+--------
 La Zamorana         |     41
 Bistró del Puerto   |      1
 Trattoria Bella     |      0
```

### 7.7. Simular un ataque cross-tenant (debe fallar)

Intenta leer `menu_items` con la `anon key` desde fuera:

```bash
curl -s "https://TU_PROYECTO.supabase.co/rest/v1/menu_items?select=*" \
  -H "apikey: TU_ANON_KEY"
# Respuesta: []  (array vacío — RLS lo bloquea)
```

Con la `service_role`:

```bash
curl -s "https://TU_PROYECTO.supabase.co/rest/v1/menu_items?select=*" \
  -H "apikey: TU_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer TU_SERVICE_ROLE_KEY"
# Respuesta: [ ... 41 platos ... ]  (RLS bypassed)
```

Esto confirma que la `anon key` (que sería lo que vería el navegador) no puede leer absolutamente nada sin un JWT válido con el claim `user_organization`.

---

## 8. Probar el flujo completo

### 8.1. Iniciar la app

```bash
bun install
bun run dev
```

Abre <http://localhost:3000> en el navegador.

### 8.2. Login con cuenta demo

- Email: `demo@lazamorana.es`
- Contraseña: `demo1234`

Deberías ver el dashboard de La Zamorana con:
- 41 platos en Menús / Carta
- 11 mesas en el plano
- 15 pedidos (algunos en preparación)
- 8 reservas

### 8.3. Verificar aislamiento

1. Cierra sesión (menú usuario → Cerrar sesión).
2. Vuelve a entrar con `demo@bistrodelpuerto.es` / `demo1234`.
3. Deberías ver el dashboard de Bistró del Puerto con:
   - 1 plato (Arroz con marisco)
   - 1 mesa
   - 0 pedidos
   - 0 reservas

**Bistró del Puerto NO puede ver La Zamorana, ni viceversa.**

### 8.4. Registrar una empresa nueva

1. En la pantalla de login, pulsa la pestaña **Crear cuenta**.
2. Rellena el formulario con datos de un restaurante ficticio.
3. Pulsa **Crear cuenta y empezar**.
4. Se crea automáticamente:
   - Una fila en `organizations`
   - Un usuario admin en `users` con `organization_id` apuntando a la nueva org
   - Una fila en `organization_settings` con valores por defecto
   - Un token de verificación de email en `verification_tokens`
5. Entras al dashboard con la carta vacía.

### 8.5. Crear datos y verificar persistencia

1. Crea una categoría y un plato desde el panel.
2. Cierra sesión.
3. Vuelve a entrar.
4. Los datos siguen ahí (persistencia en Supabase verificada).

---

## 9. Solución de errores comunes

### `Missing SUPABASE_URL. Add it to your .env (server-only).`

**Causa**: `.env` no tiene las variables o el dev server no las cargó.

**Solución**:
1. Verifica que `.env.local` contiene las 4 variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
2. Reinicia el dev server: `bun run dev`.

### `[next-auth][error][CLIENT_FETCH_ERROR] "Load failed"`

**Causa**: `NEXTAUTH_URL` no coincide con la URL real, o `NEXTAUTH_SECRET` cambia entre reinicios.

**Solución**:
1. Asegúrate de que `NEXTAUTH_URL=http://localhost:3000` (sin barra final).
2. Genera un `NEXTAUTH_SECRET` estable: `openssl rand -base64 32`.
3. En producción (Vercel), setea `NEXTAUTH_URL=https://tu-dominio.com`.

### `User not found` o `Invalid credentials`

**Causa**: El usuario no existe en Supabase o el password hash no coincide.

**Solución**:
1. Verifica en el panel de Supabase → Table Editor → `users` que el email existe.
2. Si necesitas regenerar el password, ejecuta el seed: `curl -X POST http://localhost:3000/api/seed -H "Content-Type: application/json" -d '{"force":true}'`.

### `permission denied for table menu_items`

**Causa**: RLS está bloqueando porque la query se hace con la `anon key` sin JWT.

**Solución**: Este error NO debería ocurrir en la app porque todas las queries del servidor usan el cliente admin (`service_role`). Si lo ves en el navegador, significa que estás importando `supabaseAdmin` en un componente cliente — arréglalo moviendo la lógica a una API route.

### `relation "organizations" does not exist`

**Causa**: La migración SQL no se ejecutó.

**Solución**: Pega y ejecuta `supabase/migrations/0001_init.sql` en el SQL Editor de Supabase.

### `column "organization_id" does not exist`

**Causa**: La tabla existe pero el esquema está incompleto (migración parcial).

**Solución**:
1. Borra todas las tablas manualmente: `DROP TABLE IF EXISTS ... CASCADE;` para cada una.
2. Vuelve a ejecutar la migración completa.

### Los datos del navegador no se actualizan tras un cambio

**Causa**: TanStack Query cachea las respuestas.

**Solución**: La app invalida el cache automáticamente tras mutations. Si aun así no se ve, pulsa F5 o revisa que la query key coincide.

---

## 10. Despliegue en producción

### 10.1. Variables en Vercel

Panel de Vercel → tu proyecto → **Settings** → **Environment Variables**. Añade las 6 variables:

| Variable | Valor | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://TU_PROYECTO.supabase.co` | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | No |
| `SUPABASE_URL` | `https://TU_PROYECTO.supabase.co` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | **Sí** |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | **Sí** |
| `NEXTAUTH_URL` | `https://tu-dominio.com` | No |

Marca "Sensitive" en las dos claves secretas para que no aparezcan en logs ni en la UI de Vercel.

### 10.2. Dominio en Supabase

Panel de Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: `https://tu-dominio.com`
- **Redirect URLs**: `https://tu-dominio.com/api/auth/callback/credentials`

### 10.3. Backup de la BD

Supabase Free hace backup diario automático. Para backups manuales:
- Panel → **Database** → **Backups** → **Create backup**.

Para entornos Pro y superiores, activa **PITR (Point-in-Time Recovery)** para restaurar a cualquier momento exacto.

### 10.4. Monitoreo

- Panel de Supabase → **Reports** para ver queries por segundo, tamaño de BD, errores.
- Configura alertas de email en **Settings** → **Notifications** para cuando la BD supere el 80% de cuota.

---

## Resumen de archivos clave

| Archivo | Propósito |
|---|---|
| `supabase/migrations/0001_init.sql` | Esquema completo + RLS (ejecutar primero) |
| `supabase/migrations/0002_hardened_rls.sql` | Refuerzo de políticas + función `rls_check()` |
| `src/lib/supabase/client.ts` | Cliente browser (anon key) |
| `src/lib/supabase/admin.ts` | Cliente servidor (service_role, bypassa RLS) |
| `src/lib/db.ts` | Capa de datos unificada (todas las operaciones CRUD) |
| `src/lib/next-auth.ts` | Configuración NextAuth con `organizationId` en el JWT |
| `src/lib/session.ts` | Helper `getCurrentUser()` para API routes |
| `src/app/api/seed/route.ts` | Seed de datos demo |
| `.env.example` | Template de variables de entorno |
| `download/GUIA-DESPLIEGUE.md` | Guía resumida de despliegue |

---

## Estado actual verificado

- ✅ Proyecto Supabase: `restopanel-prod` (región `eu-central-1`, estado `ACTIVE_HEALTHY`)
- ✅ 10 tablas creadas con `organization_id` en todas
- ✅ RLS habilitado en las 10 tablas (38 políticas en total)
- ✅ 3 tenants demo cargados (La Zamorana, Bistró del Puerto, Trattoria Bella)
- ✅ App Next.js integrada y funcionando sin errores
- ✅ Aislamiento multi-tenant verificado end-to-end
- ✅ Lint: 0 errores, 0 warnings
- ✅ 0 errores de consola en el navegador
- ✅ 0 issues en Next.js
