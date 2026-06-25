# RestoPanel · SaaS de Gestión de Restaurantes

Panel de control multi-restaurante (multi-tenant) donde cada dueño gestiona su carta, pedidos, mesas, cocina, reservas y analíticas. Los cambios en el panel se reflejan **al instante** en la web pública del restaurante (carta digital).

## Stack tecnológico

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **UI**: Tailwind CSS 4 + shadcn/ui + Lucide icons + Framer Motion
- **State**: Zustand (UI) + TanStack Query (server state)
- **Auth**: NextAuth.js v4 (JWT sessions, Credentials provider, bcrypt)
- **DB**: Prisma ORM con SQLite (cambiable a PostgreSQL en producción)
- **Charts**: Recharts
- **Validation**: Zod

## Arranque en desarrollo

```bash
bun install
bun run db:push        # crea/migra la base de datos SQLite
bun run dev            # arranca en http://localhost:3000
```

## Cuenta demo

- **Email**: `demo@lazamorana.es`
- **Contraseña**: `demo1234`
- **Restaurante**: La Zamorana (Salamanca) — con 8 categorías, 40 platos, 10 mesas, 15 pedidos y 6 reservas de ejemplo.

Si necesitas recrear los datos demo: `curl -X POST http://localhost:3000/api/seed`.

## Estructura del proyecto

```
prisma/
  schema.prisma           # Modelo multi-tenant: Restaurant, User, Category,
                          # MenuItem, Table, Order, OrderItem, Reservation,
                          # RestaurantSetting
src/
  app/
    page.tsx              # Server component: decide AuthScreen o DashboardShell
    layout.tsx            # Layout raíz con Inter font + Providers
    api/
      auth/[...nextauth]  # NextAuth handler
      auth/register       # POST: crea restaurante + admin
      categories/[id]     # PATCH, DELETE
      categories          # GET, POST
      menu/[id]           # PATCH, DELETE
      menu                # GET, POST
      orders/[id]         # PATCH (advance/cancel), GET
      orders              # GET, POST
      tables/[id]         # PATCH, DELETE
      tables              # GET, POST
      reservations/[id]   # PATCH, DELETE
      reservations        # GET, POST
      analytics           # GET (KPIs + datasets para gráficas)
      restaurant          # GET, PATCH (ajustes del restaurante)
      public/[slug]       # GET público (sin auth) → carta digital
      upload              # POST (subida de imágenes)
      seed                # POST (datos demo)
  components/
    providers.tsx         # SessionProvider + QueryClientProvider
    auth/AuthScreen.tsx   # Pantalla de login/registro con tabs
    dashboard/
      DashboardShell.tsx  # Layout principal (sidebar + topbar + section)
      Sidebar.tsx         # Navegación lateral
      Topbar.tsx          # Barra superior con búsqueda y user menu
      MenuMobile.tsx      # Nav horizontal para móvil
      sections/
        DashboardSection.tsx     # KPIs + gráficos
        OrdersSection.tsx        # POS / Pedidos
        TablesSection.tsx        # Gestión de mesas
        KitchenSection.tsx       # KDS (Kitchen Display System)
        MenusSection.tsx         # CRUD carta (CORE)
        AnalyticsSection.tsx     # Analíticas
        ReservationsSection.tsx  # Reservas
        SettingsSection.tsx      # Ajustes del restaurante
        PublicMenuSection.tsx    # Vista previa carta pública
    shared/
      StatusBadge.tsx     # Badges de estado (PENDING, AVAILABLE, etc.)
      StatCard.tsx        # Tarjetas KPI
      SectionHeader.tsx   # Cabecera de sección reutilizable
  lib/
    db.ts                 # PrismaClient singleton
    next-auth.ts          # authOptions con Credentials + JWT callbacks
    session.ts            # Helpers getServerSession / requireAdmin
    auth.ts               # bcrypt hash/verify
    format.ts             # formatCurrency, formatDate, timeAgo, slugify
    api.ts                # fetch helper para cliente + uploadFile
    store.ts              # Zustand: sección activa del dashboard
    utils.ts              # cn() de tailwind-merge
```

## Cómo funciona la sincronización panel ↔ web pública

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Panel admin    │────▶│  API REST        │────▶│   PostgreSQL    │
│  (Next.js)      │     │  /api/menu, etc. │     │   (Prisma)      │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  GET /api/public/[slug]  ← lectura sin auth para la web pública │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                  ┌─────────────────────┐
                  │  Web del restaurante │
                  │  (esta app o externa)│
                  └─────────────────────┘
```

1. El cliente edita un plato en `Menús / Carta`.
2. Se llama a `PATCH /api/menu/[id]` → actualiza la fila en la base de datos.
3. Se invalida la query de TanStack Query (`public-menu`) en el cliente → se hace un `GET /api/public/[slug]` → la vista previa se actualiza.
4. Cualquier web externa que consuma `/api/public/[slug]` (por REST o GraphQL) verá los cambios en la próxima petición. **No hace falta tocar código ni redeploy.**

### Ejemplo de consumo desde una web externa

```ts
// En la web pública del restaurante (otra app, o un Next.js standalone)
const res = await fetch("https://panel.tu-dominio.com/api/public/la-zamorana")
const { restaurant, categories } = await res.json()

categories.forEach(c => {
  console.log(c.name)        // "Hamburguesas"
  c.menuItems.forEach(m => {
    console.log(m.name, m.price)  // "Hamburguesa Clásica", 9.5
  })
})
```

## Roles y permisos

- **ADMIN** (dueño): acceso completo (CRUD de carta, ajustes, personal).
- **STAFF**: puede gestionar pedidos, mesas y cocina, pero no tocar ajustes globales ni eliminar categorías/platos. El backend valida `user.role === 'ADMIN'` en los endpoints sensibles.

## Despliegue en producción

### Opción A: Vercel (recomendada)

1. Push del repo a GitHub.
2. Importa el repo en vercel.com.
3. Variables de entorno:
   - `DATABASE_URL` → PostgreSQL (Neon, Supabase, Vercel Postgres, etc.)
   - `NEXTAUTH_SECRET` → `openssl rand -base64 32`
   - `NEXTAUTH_URL` → `https://tu-dominio.com`
4. Cambia el `datasource` en `prisma/schema.prisma` de `sqlite` a `postgresql`.
5. `prisma db push` en el primer deploy (Vercel lo hace automático si configuras el build command).
6. (Opcional) Mueve `/uploads` a S3/Vercel Blob para almacenamiento persistente.

### Opción B: VPS / Docker

```bash
# 1. Build standalone
bun run build

# 2. Variables de entorno (.env)
DATABASE_URL="file:./prod.db"  # o postgresql://...
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://panel.tudominio.com"

# 3. Migrar DB
bun run db:push

# 4. Arrancar
bun run start
```

Para Docker, usa el output standalone:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

## Pendientes / Próximos pasos

- [ ] Recuperación de contraseña por email (estructura preparada en `authOptions.pages.signIn`).
- [ ] Confirmación de email al registrarse.
- [ ] WebSockets (socket.io) para push en tiempo real a cocina y POS — el helper ya está documentado en `examples/websocket/`.
- [ ] Integración con pasarela de pago (Stripe / Redsys) para pedidos online.
- [ ] Generación de QR codes por mesa para que los clientes pidan desde su móvil.
- [ ] Multi-idioma (next-intl ya está instalado).
- [ ] App móvil (PWA o React Native) para el personal de sala.
