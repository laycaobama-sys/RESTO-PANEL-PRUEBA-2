# RestoPanel · Guía de despliegue con Supabase

SaaS multi-tenant de gestión de restaurantes. Cada empresa tiene su propia cuenta y sus datos están aislados en Supabase mediante Row Level Security (RLS).

## Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind + shadcn/ui
- **Backend**: Next.js API Routes + NextAuth (JWT, 30 días de sesión)
- **Base de datos**: Supabase (PostgreSQL) con RLS habilitado en todas las tablas
- **Auth**: NextAuth con Credentials provider + bcrypt. La sesión incluye `organizationId`.

## Configuración local

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. Anota la URL del proyecto y las dos API keys (anon y service_role).

### 2. Ejecutar la migración SQL

Abre el SQL Editor de Supabase y pega el contenido de `supabase/migrations/0001_init.sql`. Ejecútalo. Esto crea:

- 10 tablas con `organization_id` en cada una
- Triggers `updated_at` automáticos
- **Row Level Security** en todas las tablas con políticas que filtran por `organization_id`
- Índices para consultas rápidas por tenant

### 3. Configurar `.env.local`

Copia `.env.example` a `.env.local` y rellena con tus valores:

```bash
# Browser-facing (safe — RLS-protected)
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # clave publica anon

# Server-only (NUNCA la expongas al navegador)
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # clave service_role

# NextAuth
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
```

### 4. Arrancar

```bash
bun install
bun run dev                # http://localhost:3000
curl -X POST http://localhost:3000/api/seed -H "Content-Type: application/json" -d '{"force":true}'
```

## Cuentas demo

Tras ejecutar el seed:

| Restaurante | Email | Contraseña |
|---|---|---|
| La Zamorana | `demo@lazamorana.es` | `demo1234` |
| Bistró del Puerto | `demo@bistrodelpuerto.es` | `demo1234` |

Los dos restaurantes están en la misma BD pero **no pueden verse entre sí** (RLS lo impide).

## Arquitectura multi-tenant

### Capa de datos (Supabase + RLS)

Cada tabla tiene `organization_id`. RLS está habilitado con políticas que solo permiten leer/escribir filas cuyo `organization_id` coincida con el del JWT del usuario. Incluso si la `anon key` se filtra, un atacante no podría leer datos de otro tenant sin un JWT válido.

### Capa de aplicación (API routes)

Todas las API routes derivan `organizationId` de la sesión NextAuth (no del cliente) y lo usan como filtro en cada consulta. El cliente admin de Supabase (`src/lib/supabase/admin.ts`) se usa solo en servidor y **bypassa RLS**, por lo que la validación de tenancy ocurre en la propia aplicación. RLS es defensa en profundidad.

### Clientes Supabase

| Archivo | Uso | Env vars |
|---|---|---|
| `src/lib/supabase/client.ts` | Browser (anon key, sujeto a RLS) | `NEXT_PUBLIC_SUPABASE_*` |
| `src/lib/supabase/admin.ts` | Server only (service_role, bypassa RLS) | `SUPABASE_*` (sin NEXT_PUBLIC) |

**Regla de oro**: el cliente admin NUNCA se importa en un componente cliente (`"use client"`). Si lo haces, Next.js fallará al compilar porque las variables `SUPABASE_SERVICE_ROLE_KEY` no están disponibles en el bundle del navegador.

## Despliegue en producción (Vercel)

1. Sube el repo a GitHub.
2. Importa el proyecto en [vercel.com](https://vercel.com).
3. Configura las variables de entorno en Vercel (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ marca "Sensitive" para que no se muestre en logs
   - `NEXTAUTH_SECRET` (genera uno nuevo, 32 bytes)
   - `NEXTAUTH_URL=https://tu-dominio.com`
4. Deploy. Vercel detecta Next.js automáticamente.

**Importante**: en producción, cambia `NODE_ENV=production` y rota `NEXTAUTH_SECRET` regularmente.

## Flujo completo de un cliente nuevo

1. El cliente llega a `/landing` (SEO-optimizada).
2. Hace clic en "Crear cuenta gratis" → va a `/` (pantalla de auth).
3. Rellena el form de registro (nombre, restaurante, email, password, teléfono, ciudad, país).
4. Se crea la `organization` (tenant) y el primer `user` con rol `ADMIN`.
5. El usuario entra al dashboard con sesión JWT válida 30 días.
6. Configura su carta, mesas, reservas, horarios desde el panel.
7. Los cambios se reflejan al instante en `/api/public/{slug}` (carta pública).
8. Puede cerrar sesión y volver días después — los datos siguen ahí.

## Seguridad

- **Contraseñas**: bcrypt con salt de 10 rondas. Nunca se almacenan en claro.
- **Sesiones**: JWT firmado con `NEXTAUTH_SECRET`. Cookies `httpOnly` + `secure` en producción.
- **Aislamiento**: doble capa. (1) App filtra por `organizationId` en cada query. (2) RLS en Supabase lo impide a nivel de BD aunque la app falle.
- **Service role key**: solo en servidor, nunca en el bundle del navegador.
- **Tokens de verificación/reset**: caducan a las 24h (verify email) y 1h (reset password).
