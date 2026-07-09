# Worklog - RestoPanel SaaS

---
Task ID: full-build
Agent: main (Super Z)
Task: Diseñar y desarrollar un panel de control SaaS multi-restaurante con auth multi-tenant, gestión de carta, pedidos, mesas, cocina, analíticas, reservas, ajustes y web pública sincronizada en tiempo real.

Work Log:
- Analizadas 9 imágenes de referencia (dashboard estilo POS con sidebar naranja #FF6B35, KPIs, gráficas, estados color-coded).
- Definido schema Prisma multi-tenant: Restaurant, User (con roles ADMIN/STAFF), Category, MenuItem, Table, Order, OrderItem, Reservation, RestaurantSetting.
- Configurado NextAuth v4 con Credentials provider, JWT sessions, bcrypt para hashes.
- Implementadas 12 API routes: auth, register, menu (CRUD), categories (CRUD), orders (CRUD + advance/cancel), tables (CRUD), reservations (CRUD), analytics (agregaciones), restaurant (GET/PATCH), public/[slug] (sin auth, para web pública), upload (imágenes), seed (datos demo).
- Construida UI completa con tema naranja/coral (#FF6B35) siguiendo las referencias:
  - Pantalla de auth split-screen con tabs login/registro.
  - Dashboard layout: sidebar fija + topbar con búsqueda + user menu + nav móvil.
  - 9 secciones: Dashboard (KPIs + 3 gráficas), Pedidos (POS con filtros y cambio de estado), Mesas (grid con estados), Cocina (KDS con tarjetas y auto-refresh), Menús/Carta (CRUD completo con upload de imagen y toggle visible/disponible), Analytics (4 gráficas + KPIs), Reservas (tabla con estados), Ajustes (4 tabs: general, branding, horarios, módulos), Carta pública (preview con browser chrome).
- Seed de La Zamorana: 8 categorías, 41 platos, 10 mesas, 15 pedidos y 6 reservas con timestamps realistas.
- Lint limpio (0 errores, 0 warnings tras limpiar comentarios innecesarios).
- Verificado con Agent Browser:
  - Login funcional (demo@lazamorana.es / demo1234).
  - Todas las secciones cargan sin errores.
  - Logout funcional.
  - Responsive móvil (390x844) verificado.
  - Creación de plato nuevo "Hamburguesa Especial Test" → aparece automáticamente en la carta pública (sincronización en tiempo real confirmada).
  - Endpoint público /api/public/la-zamorana devuelve JSON correcto.
  - Sin errores en consola del navegador.

Stage Summary:
- Aplicación full-stack funcional lista para preview.
- Stack: Next.js 16 + React 19 + TypeScript + Tailwind 4 + shadcn/ui + Prisma + NextAuth + Recharts + Zustand + TanStack Query.
- Arquitectura multi-tenant: cada restaurante tiene sus datos aislados por restaurantId.
- Sincronización panel→web pública vía invalidación de TanStack Query + API REST pública sin auth.
- Guía de despliegue escrita en /home/z/my-project/download/GUIA-DESPLIEGUE.md (Vercel + Docker).
- Cuenta demo: demo@lazamorana.es / demo1234
- Capturas en /home/z/my-project/screenshots/ (15 imágenes cubriendo todas las secciones + móvil).

---
Task ID: audit-8
Agent: explore (audit sub-agent)
Task: Read-only audit of floor plan / interactive tables feature for 4 critical production bugs (DB-spam debounce, mobile touch conflicts, RLS / org_id, z-index of selected-table popover).

Scope inspected:
- src/components/dashboard/sections/TablesSection.tsx (908 lines) — the only file implementing the floor plan. No `InteractiveTable.tsx`, `DraggableTable.tsx` or `FloorPlanCanvas.tsx` exist; `InteractiveTable` is defined inside TablesSection.tsx (lines 537-671) but is NEVER rendered (only `ZoneTable` is). Searched `src/components/**` via Glob to confirm.
- src/app/api/tables/{route.ts,[id]/route.ts,positions/route.ts,group/route.ts,transfer/route.ts,available/route.ts}
- src/lib/db.ts (tables CRUD layer), src/lib/session.ts, src/lib/next-auth.ts, src/lib/supabase/admin.ts
- src/types/next-auth.d.ts (organizationId declaration on session.user)

Findings:

### CHECK 1 — Debounce on table drag (DB spam) — ⚠️ PARTIAL BUG (dead code + minor issues)

The component has TWO drag systems. Only the zone-based one is rendered:

A) Zone drag (ACTIVE — ZoneTable, HTML5 drag-and-drop):
   - TablesSection.tsx:246-264 — `handleZoneDrop` fires `changeZoneMut.mutate({ id: tableId, zone: zoneId })` immediately on every drop, with NO debounce.
   - TablesSection.tsx:174-184 — `changeZoneMut` PATCHes /api/tables/{id} with the new zone.
   - Each drop is a discrete event, so it is NOT a per-mouse-move DB spam, but there is:
     • No debounce / no `disabled={changeZoneMut.isPending}` guard on the draggable while a previous drop is in flight — rapid successive drops can fire multiple parallel PATCHes.
     • No optimistic update; the dragged table snaps back to the old zone until TanStack Query refetches.

B) Pixel-coordinate drag (DEAD CODE — InteractiveTable, never rendered):
   - TablesSection.tsx:201-209 — `handleDragMove` updates `pendingPositions` state on every `mousemove` (NO API call — good).
   - TablesSection.tsx:211 — `handleDragEnd` only clears `draggingId` (no API call — good).
   - TablesSection.tsx:213-216 — `savePositions` is invoked only via the "Guardar" button (line 287), which batches all pending positions in one POST.
   - BUT `InteractiveTable` (lines 537-671) is never instantiated; `pendingPositions` is always `{}`, so the Save button is permanently disabled (`disabled={... || Object.keys(pendingPositions).length === 0}`, line 287).
   - Net effect: `/api/tables/positions` (POST/PATCH) is an ORPHAN endpoint — unreachable from the UI. posX/posY can never be updated from the dashboard.

Verbatim — the only API trigger in the active path:
```ts
// TablesSection.tsx:246-264
const handleZoneDrop = (e: React.DragEvent, zoneId: string) => {
  e.preventDefault();
  const tableId = e.dataTransfer.getData("text/plain") || draggedTableId;
  if (!tableId) return;
  const table = tables.find(t => t.id === tableId);
  if (!table) return;
  if (table.zone === zoneId) { setDraggedTableId(null); setDragOverZone(null); return; }
  changeZoneMut.mutate({ id: tableId, zone: zoneId }); // ← immediate PATCH, no debounce, no in-flight guard
};
```

```ts
// TablesSection.tsx:135-140 (savePositionsMut — DEAD, only reachable via Save button which is always disabled)
const savePositionsMut = useMutation({
  mutationFn: (updates: Array<{ id: string; posX: number; posY: number }>) =>
    api("/api/tables/positions", { method: "POST", body: JSON.stringify({ updates }) }),
  onSuccess: () => { qc.invalidateQueries({ queryKey: ["tables"] }); toast.success("Posiciones guardadas ✓"); setPendingPositions({}); },
  onError: (e: any) => toast.error(e.message),
});
```

Proposed fixes:
1. Add an in-flight guard on the draggable so concurrent drops cannot stack: `draggable={editMode && !changeZoneMut.isPending}`.
2. Make `changeZoneMut` use TanStack Query's optimistic-update pattern so the table visually stays in the new zone immediately, then rolls back on error.
3. Either delete the dead InteractiveTable + savePositionsMut + handleDragStart/Move/End + `pendingPositions` state (lines 104-109, 135-140, 192-216, 266-270, 537-671) OR re-wire it as the active drag surface so users can position tables freely.
4. In `/api/tables/positions/route.ts` (lines 21-36) replace the `for...of await` loop with a single Supabase `update(...).in('id', [...])` or a Postgres function — currently each table triggers a sequential round-trip.

---

### CHECK 2 — Touch conflicts on mobile (pan vs drag) — ❌ BUG

The entire drag system relies on HTML5 drag-and-drop, which does NOT fire on touch devices. There is no pointer/touch fallback, no `touch-action` styling, and Framer Motion's `drag` is not used.

Verbatim — TablesSection.tsx:698-705 (ZoneTable):
```tsx
<motion.div
  initial={reduceMotion ? {} : { opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.2 }}
  draggable={editMode}
  onDragStart={(e: any) => { if (editMode && onDragStart) onDragStart(e, table.id); }}
  onDragEnd={() => { if (editMode && onDragEnd) onDragEnd(); }}
  onMouseEnter={() => { onHover(table.id); setShowPopover(true); }}
  onMouseLeave={() => { onHover(null); setShowPopover(false); }}
  onClick={() => onSelect(table)}
  whileHover={editMode ? {} : { scale: 1.1, zIndex: 10 }}
  whileTap={{ scale: 0.95 }}
```

Canvas container (scroll-panning surface):
```tsx
// TablesSection.tsx:356
<div className="space-y-3 max-h-[520px] overflow-y-auto rounded-xl pr-1" style={{ scrollbarWidth: "thin" }}>
```

Grep results across the file:
- `touch-action` / `touchAction` — 0 hits.
- `touch-none` Tailwind class — 0 hits.
- `dragMomentum` — 0 hits (Framer Motion `drag` prop not used at all).
- `dragConstraints` — 0 hits.
- `onTouchStart` / `onPointerDown` / `onPointerMove` / `onPointerUp` — 0 hits.

Consequences:
- On iOS Safari and Android Chrome, `draggable={true}` does nothing — admins literally cannot rearrange tables from a phone/tablet.
- The canvas scroll surface (`overflow-y-auto`) keeps `touch-action: auto`, so touch panning works, but since drag never fires there is no conflict — the feature simply does not work on touch.
- Click-to-select still works (onClick fires on tap), but `onMouseEnter`/`onMouseLeave` (line 706-707) do not fire on touch, so the CRM popover (lines 747-776) is also effectively desktop-only.

Proposed fix (recommended approach — Framer Motion pointer-based drag, which works for both mouse and touch):
```tsx
<motion.div
  drag={editMode}
  dragMomentum={false}
  dragConstraints={containerRef}
  dragElastic={0}
  onDragStart={() => setDraggingId(table.id)}
  onDragEnd={(e, info) => {
    // snap-to-zone detection: find zone panel under pointer
    handleDropByPointer(table.id, info.point);
    setDraggingId(null);
  }}
  style={{ touchAction: editMode ? "none" : "auto" }} // ← critical for mobile
  whileDrag={{ scale: 1.1, zIndex: 50 }}
>
```
Or, minimally, add `style={{ touchAction: "none" }}` and `onTouchStart`/`onTouchMove`/`onTouchEnd` handlers that mimic `handleDragStart/Move/End`.

---

### CHECK 3 — RLS / org_id sent correctly — ✅ OK

All four drag-reachable endpoints read `organizationId` from the NextAuth session (never from the request body) and filter every UPDATE by `organization_id`:

1. `/api/tables/positions/route.ts` (the orphan endpoint):
```ts
// src/app/api/tables/positions/route.ts:6-10
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  ...
  // src/app/api/tables/positions/route.ts:24-30  ← the actual UPDATE
  const { data, error } = await supabaseAdmin
    .from('tables')
    .update(patch)
    .eq('id', u.id)
    .eq('organization_id', user.organizationId)
    .select('id, pos_x, pos_y')
    .single()
```

2. `/api/tables/[id]/route.ts` (used by the active zone-drop mutation `changeZoneMut`):
```ts
// src/app/api/tables/[id]/route.ts:9-19
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  ...
  const existing = await db.table.findFirst(user.organizationId, { id }) // ← org filter
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  ...
  const updated = await db.table.update(id, user.organizationId, patch) // ← org filter again
```

3. `db.table.update` (src/lib/db.ts:474-484) — double filter (id + organization_id):
```ts
async update(id: string, organizationId: string, patch: Partial<Table>): Promise<Table> {
  const { data, error } = await supabaseAdmin
    .from("tables")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select().single();
```

4. `/api/tables/transfer/route.ts` — also filters every UPDATE by organization_id (lines 27, 39, 58, 90, 98).

Notes:
- All endpoints use `supabaseAdmin` (service_role) which BYPASSES RLS, BUT every query is explicitly filtered by `user.organizationId` from the JWT. RLS is enabled as defense-in-depth (migration 0002_hardened_rls.sql).
- `organizationId` is attached to the JWT at sign-in (src/lib/next-auth.ts:146 `token.organizationId = u.organizationId`) and surfaced on `session.user.organizationId` in the session callback (src/lib/next-auth.ts:189-200). It is NEVER read from `req.body` or query string. Type augmentation in src/types/next-auth.d.ts:15,31,45 enforces this at compile time.
- No bug here. ✅

---

### CHECK 4 — Z-index of selected table popover — ❌ BUG

The popover is a child of the table's motion.div. The parent's z-index is raised to 10 only via `whileHover` (transient, only during hover), and the popover uses `z-30` — but that `z-30` is INSIDE the parent's stacking context, so a sibling table with the same z-index 10 (or any table later in DOM order while hover transitions) can render on top of the popover.

Verbatim — ZoneTable parent motion.div (TablesSection.tsx:698-721):
```tsx
<motion.div
  ...
  whileHover={editMode ? {} : { scale: 1.1, zIndex: 10 }}    // ← zIndex 10 only while hovering
  whileTap={{ scale: 0.95 }}
  className={cn(
    "border-2 flex flex-col items-center justify-center transition-all select-none cursor-pointer relative",
    ...
    (isHovered || isSelected) && "ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#0a0a0a]", // ← NO z-index when selected
    ...
  )}
>
```

Popover (TablesSection.tsx:746-756):
```tsx
<AnimatePresence>
  {showPopover && !editMode && (
    <motion.div
      ...
      className="absolute z-30 pointer-events-none"           // ← z-30 trapped inside parent z-10
      style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "4px" }}
    >
```

Concrete failure modes:
1. Two adjacent tables in the same flex row. User hovers table A (zIndex 10, popover shown at z-30 inside A's stacking context). User moves cursor toward the popover; mid-transition the hover state on A is still active AND pointer enters table B (B also gets zIndex 10). Because B comes later in DOM and has the same z-index, B paints OVER A's popover — popover visually clipped/hidden behind B.
2. The popover is only triggered by `onMouseEnter` (line 706) — when a table is CLICKED (`isSelected`), no popover is shown at all; the user only gets the full Dialog. That part is fine. BUT the selected table itself is NOT elevated above its siblings, so its `ring-yellow-400` selection ring can be visually overlapped by neighbours.

InteractiveTable (the dead-code sibling at lines 553-588) has the same pattern but is even more explicit about the bug:
```tsx
// TablesSection.tsx:558
style={{ ..., zIndex: isDragging ? 20 : 1 }}   // ← only 20 while dragging, else 1
// TablesSection.tsx:563
whileHover={editMode ? {} : { scale: 1.12, zIndex: 10 }}
// TablesSection.tsx:618
className="absolute z-30 pointer-events-none"
```

Proposed fix — promote the parent's z-index when hovered OR selected via a stable Tailwind class (not a transient inline style), and bump the popover higher than any sibling can reach:
```tsx
<motion.div
  ...
  className={cn(
    "... relative",
    (isHovered || isSelected) && "z-50",                       // ← stable z-index elevation
  )}
  whileHover={editMode ? {} : { scale: 1.1 }}
  whileTap={{ scale: 0.95 }}
>
  ...
  <motion.div
    className="absolute z-[60] pointer-events-none"            // ← above any sibling at z-50
    style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "4px" }}
  />
```

---

### Other related issues found

1. **Dead code (~170 lines).** `InteractiveTable` (lines 537-671), `pendingPositions` state (line 104), `draggingId` state (line 105), `dragOffset` ref (line 108), `handleDragStart`/`handleDragMove`/`handleDragEnd` (lines 192-211), `savePositions` (lines 213-216), `getTablePos` (lines 266-270), `savePositionsMut` (lines 135-140), and the "Guardar" button (lines 287-289) are all unreachable. The orphan `/api/tables/positions` endpoint matches this dead UI.

2. **No in-flight guard on zone-drop.** `changeZoneMut.mutate` is fired on every `drop` event without checking `changeZoneMut.isPending`. A user who drags table 1 to TERRACE then immediately drags table 2 to BAR triggers two parallel PATCHes; TanStack Query invalidates `["tables"]` twice, causing a double refetch and a possible visual flicker. Add `draggable={editMode && !changeZoneMut.isPending}` (or use `mutateAsync` with a queue).

3. **No optimistic update on zone change.** After a successful drop the table visually snaps back to its original zone until the `["tables"]` refetch resolves (~150-400 ms). On slow networks this looks broken. Use TanStack Query's `onMutate` to write the new zone into the cache immediately and roll back on `onError`.

4. **No reservation-side sync on zone drop.** `changeZoneMut` PATCHes only the table's `zone`. If a seated reservation (`status: SEATED`) is bound to that table, the reservation's `zone` field is NOT updated until the next time `/api/tables` is hit (which fetches reservations separately). The `transfer` route DOES sync reservation.zone (src/app/api/tables/transfer/route.ts:50-58) — zone drop does not.

5. **Infinite animation cost.** Every occupied/reserved/preparing table spawns a `motion.span` with `animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}` (lines 722-730). For a restaurant with 40+ active tables this is 40 concurrent rAF loops. `useReducedMotion` (line 722) gates it for accessibility, but on a mid-tier Android tablet the LED-style boxShadow pulsing on `InteractiveTable` (dead) and the opacity pulse on `ZoneTable` (live) will burn CPU. Consider gating with `IntersectionObserver` so off-screen tables don't animate, or animate a single shared CSS keyframe.

6. **Sequential UPDATEs in `/api/tables/positions`.** src/app/api/tables/positions/route.ts:21-36 loops with `for...of` + `await`. If 20 tables are batched, that's 20 sequential network round-trips. Use a single `supabaseAdmin.from('tables').update(...).in('id', ids)` (with a CASE WHEN for per-row positions) or a Postgres function.

7. **Popover `pointer-events-none`.** TablesSection.tsx:754 (and 618 for the dead variant) sets `pointer-events-none` on the popover. This is intentional (the popover is a hover preview, click goes to the table), but it also means the popover can't contain a quick-action button. If product wants a "Traspasar" CTA in the preview, this needs revisiting.

8. **No drag preview customisation.** HTML5 dnd uses the browser's default ghost (which includes the entire table card with `opacity-40` applied via `isDragging` class, line 718). On Chromium the ghost is a screenshot, on Firefox it can lag. A custom `dragImage` via `e.dataTransfer.setDragImage` would give a cleaner UX.

9. **`onDragStart` typed as `any`** (line 704) — bypasses TS safety. Minor, but worth tightening to `React.DragEvent<HTMLDivElement>`.

10. **No `aria-grabbed` / `role="application"`** on draggable tables — screen-reader users have no way to know tables are draggable. Pair with fix for CHECK 2 (touch/pointer drag) to also add keyboard handlers (Space to grab, arrows to move, Space to drop).

Stage Summary:
- 2 of 4 checks FAIL (CHECK 2 touch, CHECK 4 z-index).
- 1 check is OK (CHECK 3 RLS — org_id is correctly enforced everywhere).
- 1 check is partially OK (CHECK 1 — no DB spam because the live path uses discrete drop events, but dead code + missing in-flight guard + missing optimistic update are real concerns).
- Bonus: ~170 lines of dead code, an orphan API endpoint, and 6 additional minor issues identified.
- This was a READ-ONLY audit. No files were modified. Implementation of fixes should be tracked in a separate task.

---
Task ID: audit-9
Agent: explore (audit sub-agent)
Task: Read-only security, authentication, and multi-tenant isolation audit of RestoPanel SaaS.

Scope inspected (62 source files):
- Auth core: src/lib/auth.ts, src/lib/session.ts, src/lib/next-auth.ts, src/lib/session-management.ts, src/lib/rate-limit.ts, src/lib/rbac.ts, src/lib/audit.ts, src/middleware.ts, src/types/next-auth.d.ts
- Auth API: src/app/api/auth/{[...nextauth],register,forgot-password,reset-password,verify-email}/route.ts
- Multi-tenant API: every route under src/app/api/{orders,reservations,tables,categories,menu,restaurant,customers,notifications,shifts,chat,search,analytics,billing,stripe,whatsapp,user,admin,public,seed,seed-customers}/...
- Config: next.config.ts, src/lib/supabase/admin.ts, src/lib/stripe.ts, src/lib/web-import.ts, scripts/setup.cjs
- Type augmentation: src/types/next-auth.d.ts

Severity tally: 6 ❌ BUG (3 CRITICAL), 14 ⚠️ WARN, ~30 ✅ OK
This was a READ-ONLY audit — no source files were modified.

================================================================
A. AUTHENTICATION
================================================================

### A1 — ❌ CRITICAL BUG · Logout does NOT invalidate the JWT server-side
File: src/components/dashboard/Topbar.tsx:107 (also src/components/admin/SuperAdminShell.tsx:128)
```ts
onClick={async () => {
  toast.success("Cerrando sesión...");
  await signOut({ redirect: false, callbackUrl: "/" });   // ← only clears the cookie
  setTimeout(() => window.location.reload(), 150);
}}
```
File: src/lib/session-management.ts:38-53
```ts
export async function isSessionValid(jti: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin.from("user_sessions")
      .select("revoked_at, expires_at").eq("token_jti", jti).maybeSingle();
    if (!data) return true;       // If session not tracked, allow (backward compat)
    if (data.revoked_at) return false;
    if (new Date(data.expires_at) < new Date()) return false;
    return true;
  } catch { return true; }       // Non-critical
}
```
Grep for `isSessionValid` returns exactly ONE hit — its own declaration. It is **never called** by any route, middleware, or the jwt callback. `revokeSession`, `revokeAllUserSessions`, `updateSessionActivity`, `getActiveSessions` are all defined but only `revokeSession`/`revokeAllUserSessions` are invoked — by `/api/user/sessions` DELETE. None of those calls has any effect because nothing checks `revoked_at`.

Consequence: after logout the browser cookie is gone, but the JWT itself is still valid for 30 days (the JWT `maxAge` in src/lib/next-auth.ts:25). Anyone who captured the JWT (XSS, shared device, browser extension, network MITM during the brief HTTP→HTTPS redirect, proxy logs, etc.) keeps full access until natural expiry. This defeats every "remote logout" / "log out other devices" feature advertised by `/api/user/sessions`.

Concrete fix:
1. In `src/lib/next-auth.ts` `jwt()` callback (or in `src/lib/session.ts` `getCurrentUser()`), add at the top:
```ts
if (token.jti) {
  const ok = await isSessionValid(token.jti)
  if (!ok) return {} as any  // returning empty object makes getServerSession return null
}
```
2. In `Topbar.tsx` / `SuperAdminShell.tsx` logout handler, fire-and-forget `fetch('/api/auth/signout', { method: 'POST' })` and add a new `/api/auth/signout` route that calls `revokeSession(user.jti)` before delegating to NextAuth's signOut.

---

### A2 — ❌ CRITICAL BUG · `/api/seed` lets ANY authenticated user wipe ALL tenant data
File: src/app/api/seed/route.ts:5-34
```ts
export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    let force = url.searchParams.get('force') === 'true'
    // …
    if (force) {
      const wipe = async (table: string) => {
        const { error } = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        // …
      }
      await wipe('order_items')
      await wipe('orders')
      await wipe('reservations')
      await wipe('tables')
      await wipe('menu_items')
      await wipe('categories')
      await wipe('organization_settings')
      await wipe('verification_tokens')
      await wipe('users')
      await wipe('organizations')          // ← cross-tenant destructive wipe
    }
```
File: src/middleware.ts:18-25
```ts
if (pathname.startsWith('/api/')) {
  const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (pathname.startsWith('/api/admin/') && !token.isSuperAdmin) { /* … */ }
  return NextResponse.next()
}
```
The route is at `/api/seed` — NOT under `/api/admin/`, so middleware only requires ANY valid JWT. A STAFF user (or even a freshly-registered trial tenant) can `POST /api/seed?force=true` and wipe every organization's data + every user account (including the super admin's) across the whole platform. The route handler itself performs NO `getCurrentUser()` / `requireAdmin()` / `isSuperAdmin` check.

Concrete fix:
1. Move the file to `src/app/api/admin/seed/route.ts` so middleware enforces SUPER_ADMIN, AND add an explicit check in the handler:
```ts
const user = await getCurrentUser()
if (!user?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
```
2. Disable the `?force=true` wipe path entirely in production (`if (process.env.NODE_ENV === 'production' && force) return 403`).
3. Delete the demo credentials block from the response (lines 332-335) — it leaks `demo@lazamorana.es / demo1234` to anyone who hits the endpoint.

---

### A3 — ❌ CRITICAL BUG · Hardcoded super-admin credentials in source + returns password in API response
File: src/app/api/admin/seed-super-admin/route.ts:20-23, 64-69
```ts
export async function POST() {
  try {
    const email = 'owner@restopanel.es'
    const password = 'owner2026'                // ← hardcoded credential
    // …
    return NextResponse.json({
      ok: true,
      message: 'SUPER_ADMIN creado correctamente',
      user: data,
      credentials: { email, password },          // ← password echoed back in the JSON body
    })
```
Also: the route is under `/api/admin/` so middleware blocks it for non-super-admins — meaning the endpoint can NEVER bootstrap the first super admin via the API. So either it's dead code (and the password leak is purely a source-code leak) OR the developer intended to disable middleware for it (in which case the password leak becomes exploitable). Either interpretation is bad.

Consequence: anyone with read access to the repo (or git history) knows the production super-admin email + password if this script was ever used. Combined with `isSessionValid` never being called (A1), a stolen super-admin JWT is immortal.

Concrete fix:
1. Read `email` and `password` from env vars (`SUPER_ADMIN_SEED_EMAIL`, `SUPER_ADMIN_SEED_PASSWORD`) — fail with 400 if not set. Never echo them back.
2. Better: delete this route and create the super admin via a CLI script (`scripts/seed-super-admin.cjs`) that uses `supabaseAdmin` directly and is run once on deploy, OR via a SQL migration.
3. Force a password rotation in any environment where this code ever ran.

---

### A4 — ⚠️ WARN · Brute-force protection is in-memory only — useless in serverless / multi-instance
File: src/lib/session-management.ts:180-225
```ts
const loginAttempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
const WINDOW_DURATION = 5 * 60 * 1000;

export function isAccountLocked(email: string): boolean { /* … */ }
export function recordFailedLogin(email: string): { locked: boolean; attemptsLeft: number } { /* … */ }
```
On Vercel / Cloudflare Workers / any multi-instance deploy, each warm instance has its own `loginAttempts` Map. An attacker rotating requests across instances effectively gets `5 × N` attempts before lockout. The platform is deployed as `output: "standalone"` (next.config.ts:4) — fine on a single VM, broken on serverless. Same applies to the in-memory limiters in `forgot-password/route.ts:12`, `public/reviews/route.ts:26`, `restaurant/import-web/route.ts:18`, and `src/lib/rate-limit.ts:24`.

Concrete fix: move the attempt counters to a `login_attempts` Supabase table keyed by `(email, ip)` with `expires_at`, or use Upstash Redis. Same for all the per-route inline limiters.

---

### A5 — ⚠️ WARN · `register` endpoint has NO rate limit and leaks the email-verification token
File: src/app/api/auth/register/route.ts:146-153
```ts
return NextResponse.json({
  ok: true,
  userId: user.id,
  restaurantId: organization.id,
  organizationId: organization.id,
  restaurantSlug: organization.slug,
  verifyToken,                                  // ← email-verification token returned to caller
})
```
Also no `checkRateLimit` / `RATE_LIMITS.register` call despite `RATE_LIMITS.register` being defined in src/lib/rate-limit.ts:73.

Consequences:
1. The verify-token is meant to prove control of the email inbox. Returning it in the response lets an attacker register with someone else's email and immediately self-verify without ever reading that inbox.
2. No rate limit → an attacker can spam-tenant creation (each call creates an `organizations` row + sends 2 emails via Resend). At best this burns the Resend quota; at worst it pollutes the tenant list and triggers AWS SES / Resend throttles.

Concrete fix:
1. Remove `verifyToken` from the response body.
2. Add `const rl = checkRateLimit(req, RATE_LIMITS.register); if (rl.limited) return 429` at the top of the handler. (Requires wiring `src/lib/rate-limit.ts` to Redis first per A4.)

---

### A6 — ⚠️ WARN · `forgot-password` returns the reset token in dev mode — and dev detection is brittle
File: src/app/api/auth/forgot-password/route.ts:75-78
```ts
const isDev = process.env.NODE_ENV !== 'production'
if (isDev) {
  return NextResponse.json({ ok: true, message: genericMessage, resetToken: token })
}
```
`NODE_ENV !== 'production'` is true for both `development` AND `test`, and it's also true if someone forgets to set NODE_ENV in staging. The reset token is single-use and expires in 1h, but if a staging environment ever exposes this endpoint to the public internet, anyone can request a reset for any email and get the token back in the response — bypassing the email channel entirely.

Concrete fix: gate this behind an explicit `process.env.RESET_TOKEN_IN_RESPONSE === 'true'` flag (default off), and log a warning when it's enabled.

---

### A7 — ⚠️ WARN · Email-verification + password-reset tokens travel in the URL query string
File: src/app/api/auth/verify-email/route.ts:4-8
```ts
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token no proporcionado' }, { status: 400 })
```
File: src/app/api/auth/forgot-password/route.ts:60
```ts
const resetUrl = `${baseUrl}/reset?token=${token}`
```
Tokens in the URL leak via: browser history, Referer header on any external link the user clicks post-redirect, web-server access logs, reverse-proxy/CDN logs, and corporate proxy caches. Referrer-Policy is set to `strict-origin-when-cross-origin` in next.config.ts:27 which strips the query string on cross-origin navigations — good defense-in-depth — but does not protect against same-origin leaks (analytics scripts, etc.) or against the logs/history vectors.

Concrete fix: switch to a fragment-based flow (`/reset#token=…`) where the token never reaches the server log, OR use an opaque `ticket` exchange where the email link hits a short-lived redirect endpoint that sets the token as an httpOnly cookie and 302s to `/reset`. The fragment approach is the simpler fix.

---

### A8 — ⚠️ WARN · Impersonation cookies missing `secure` flag (and have an 8-hour lifetime)
File: src/app/api/admin/impersonate/route.ts:70-81
```ts
res.cookies.set('impersonate_org_id', org.id, {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 8, // 8 hours max impersonation
})
res.cookies.set('impersonate_org_name', org.name, {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 8,
})
```
`secure: true` is not set. NextAuth's own session cookies do set `secure` in production (NextAuth v4 default), but these custom cookies do not, so they will be transmitted over plain HTTP if the request ever lands on a non-HTTPS URL. Combined with `sameSite: 'lax'`, a MITM on the same network could read/write the impersonation state. Also, 8 hours is a long window — a super admin who steps away from their machine leaves the impersonation channel open.

Concrete fix:
```ts
res.cookies.set('impersonate_org_id', org.id, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60, // 1 hour is enough for a support session
})
```
Also: have the jwt callback (src/lib/next-auth.ts:155-165) re-validate that the impersonated org still exists and is `ACTIVE` on every request — currently once the cookie is set, the impersonation persists even if the tenant is later suspended.

---

### A9 — ⚠️ WARN · JWT carries role for 30 days with no server-side revalidation
File: src/lib/next-auth.ts:25
```ts
session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
```
The `role`, `isSuperAdmin`, `organizationId`, and `blocked` flag are stamped onto the JWT at sign-in and never refreshed. If an admin is demoted to STAFF, blocked (`users.blocked=true`, checked in authorize() at src/lib/next-auth.ts:54-57), or the tenant is suspended (line 112), none of those changes take effect until the user's JWT naturally expires (30 days) — unless the user manually re-logs in.

Concrete fix: in the `jwt()` callback, periodically (e.g., every 5 min based on a `token.lastRefreshedAt` claim) re-fetch the user row and re-stamp `role`, `isSuper_admin`, `blocked`. If `blocked` is true, return `null` (forces sign-out). Combine with A1's `isSessionValid` check.

---

### A10 — ✅ OK · NextAuth core config
File: src/lib/next-auth.ts:16-27, 29-134
- `NEXTAUTH_SECRET` is required at module load (throws if missing) — good.
- JWT strategy with 30-day maxAge — documented.
- Credentials provider lowercases + trims email — fine.
- Suspended tenants are blocked at sign-in (line 112).
- `blocked` user flag is honored (line 54).
- `bcrypt` with cost factor 10 (src/lib/auth.ts:4) — acceptable for 2026, could be bumped to 12.
- `trustHost: true` (line 27) — required for NextAuth v4 on Vercel/standalone, safe.
- Default NextAuth cookie config (`__Secure-` prefix + `secure: true` in production, `httpOnly: true`, `sameSite: 'lax'`) is used — no custom override that would weaken it.
- NextAuth's built-in CSRF token is active on `/api/auth/*` POSTs.

### A11 — ✅ OK · Middleware blocks unauthenticated API access
File: src/middleware.ts:7-25, 40-42
Every `/api/*` path (except `/api/auth`, `/api/public`, `/api/health`) requires a valid signed JWT. `/api/admin/*` additionally requires `token.isSuperAdmin === true`. The matcher regex correctly excludes the public paths from running middleware at all, which avoids any chance of an auth check accidentally running on a webhook.

### A12 — ✅ OK · Admin / super_admin checks are server-side
Every `/api/admin/*` route I inspected (`tenants`, `tenants/[id]`, `tenants/[id]/details`, `users`, `logs`, `health`, `notifications`, `notifications/[id]`, `notifications/mark-all-read`, `reviews`, `search`, `maintenance`, `settings`, `stats`, `system-status`, `billing`, `customers`, `seed-notifications`, `impersonate`) re-asserts `if (!user?.isSuperAdmin) return 403` inside the handler — defense-in-depth on top of the middleware check.

================================================================
B. MULTI-TENANT ISOLATION
================================================================

### B1 — ❌ BUG · `/api/user/sessions` DELETE — IDOR on `jti` (and revocation is a no-op)
File: src/app/api/user/sessions/route.ts:14-34
```ts
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) { /* 401 */ }
  const { searchParams } = new URL(req.url);
  const jti = searchParams.get("jti");
  // …
  if (jti) {
    await revokeSession(jti);          // ← no user_id check
    return NextResponse.json({ ok: true, message: "Sesión cerrada" });
  }
```
File: src/lib/session-management.ts:55-62
```ts
export async function revokeSession(jti: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_jti", jti);           // ← only filtered by token_jti, NOT by user_id
  } catch {}
}
```
Any authenticated user can revoke any other user's session by passing their `jti` as a query param. The `jti` is a `randomUUID()` (not guessable in practice), but this is still a textbook IDOR — and it is also a privilege-integrity problem because the route is reachable by STAFF users against ADMIN sessions, and by tenant users against the super admin. The bug is currently masked by A1 (revocation is never checked, so it does nothing), but as soon as A1 is fixed this becomes a live attack surface.

Concrete fix:
```ts
export async function revokeSession(jti: string, userId: string): Promise<void> {
  await supabaseAdmin
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_jti", jti)
    .eq("user_id", userId);          // ← scope to the caller
}
```
And in the route: `await revokeSession(jti, user.id)`.

---

### B2 — ⚠️ WARN · `/api/customers/[id]` PATCH/DELETE — UPDATE/DELETE statements skip `organization_id` filter
File: src/app/api/customers/[id]/route.ts:91-117 (PATCH), 134-152 (DELETE)
```ts
// PATCH — verify tenancy, then update without re-filtering
const { data: existing } = await supabaseAdmin.from('customers').select('id')
  .eq('id', id).eq('organization_id', user.organizationId).maybeSingle()
if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

const patch: any = {}
// … build patch from body …

const { data, error } = await supabaseAdmin.from('customers')
  .update(patch)
  .eq('id', id)                                    // ← missing .eq('organization_id', …)
  .select().single()
```
Same pattern in DELETE (line 148-152): `delete().eq('id', id)` only.

The check-then-act pattern is *probably* safe under normal use because the previous `findFirst` already verified ownership, but it's a TOCTOU window: between the findFirst and the UPDATE, another request could theoretically change the row's `organization_id` (e.g., a future admin "move customer to another tenant" feature). Worse, this loses the defense-in-depth that every other route in this codebase has — compare with `db.category.delete` (src/lib/db.ts:351-358) which filters by both `id` AND `organization_id`.

Also the GET (line 32-37) for reservation history only filters by `customer_id`, not by `organization_id`:
```ts
const { data: reservations } = await supabaseAdmin.from('reservations')
  .select('id, date, party_size, status, shift, zone, table_id, notes, duration_minutes, channel, tables(number, name, zone)')
  .eq('customer_id', id)
  .order('date', { ascending: false })
  .limit(50)
```

Concrete fix: add `.eq('organization_id', user.organizationId)` to the UPDATE, the DELETE, AND the reservations lookup (line 32).

---

### B3 — ⚠️ WARN · `/api/chat/messages` POST does not validate `channelId` belongs to the tenant
File: src/app/api/chat/messages/route.ts:31-49
```ts
const body = await req.json()
const { channelId, content, priority } = body
if (!channelId || !content) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

const { data, error } = await supabaseAdmin
  .from('chat_messages')
  .insert({
    channel_id: channelId,                        // ← user-supplied, not validated
    user_id: user.id,
    user_name: user.name,
    user_avatar: null,
    content,
    priority: priority || 'normal',
    read_by: [user.id],
    organization_id: user.organizationId,
  })
  .select().single()
```
If the FK `(channel_id) REFERENCES chat_channels(id)` is enforced, the insert will fail when `channelId` belongs to another tenant — but that's a brittle defense. If the FK is ever dropped or the channel table is renamed, this becomes a cross-tenant message injection. The GET (line 13-19) does filter by `organization_id`, so the message wouldn't be visible to the attacker afterwards — but it would still be inserted and could surface in admin reports.

Concrete fix: before insert, fetch the channel and verify ownership:
```ts
const { data: ch } = await supabaseAdmin.from('chat_channels').select('id')
  .eq('id', channelId).eq('organization_id', user.organizationId).maybeSingle()
if (!ch) return NextResponse.json({ error: 'Canal no válido' }, { status: 400 })
```

---

### B4 — ⚠️ WARN · `/api/restaurant` PATCH — settings mass-assignment via dynamic snake_case conversion
File: src/app/api/restaurant/route.ts:72-80
```ts
if (settings) {
  const settingsPatch: any = {}
  for (const [k, v] of Object.entries(settings)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    settingsPatch[snake] = v                        // ← any key from body goes through
  }
  await db.organizationSettings.upsert(user.organizationId, settingsPatch)
}
```
A caller can send `{"settings":{"id":"<uuid>","organizationId":"<other-org-id>"}}` which becomes `settingsPatch = { id: "<uuid>", organization_id: "<other-org-id>" }`. The upsert (src/lib/db.ts:657-677) issues `update(patch).eq('organization_id', user.organizationId)` — the WHERE clause scopes the update to the caller's row, but the SET clause now includes `organization_id: <other-org-id>` and `id: <uuid>`, which PostgREST will happily apply. Result: the caller's settings row is corrupted (wrong `organization_id` FK, changed PK). Not a horizontal-privilege escalation, but a self-DoS / data-integrity bug, and the wrong-org-id FK on the settings row could lead to information leak if any later code joins settings → organizations without re-checking.

Concrete fix: whitelist allowed keys:
```ts
const ALLOWED = ['monOpen','monClose','tueOpen','tueClose', /* … */ 'taxRate','serviceCharge']
const settingsPatch: any = {}
for (const k of ALLOWED) {
  if (settings[k] !== undefined) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    settingsPatch[snake] = settings[k]
  }
}
```

---

### B5 — ⚠️ WARN · `/api/public/reviews` POST auto-approves + accepts arbitrary `organization_id` from the body
File: src/app/api/public/reviews/route.ts:130, 162-167
```ts
const organization_id = body?.organization_id && typeof body.organization_id === "string" ? body.organization_id : null;
// …
const { data, error } = await supabaseAdmin
  .from("public_reviews")
  .insert({
    // …
    organization_id: organization_id || null,
    source: "LANDING",
    status: "APPROVED",                             // ← auto-approved, appears on wall instantly
  })
```
Anyone (no auth) can post a review tagged with ANY organization's UUID, and it goes live immediately on the public wall. Combined with the 3-per-10-minutes-per-IP limiter being in-memory (so trivially bypassed by IP rotation in serverless), a competitor or a malicious bot could:
- Spam fake 1-star reviews tagged to a victim tenant.
- Spam fake 5-star reviews tagged to their own tenant to inflate rating.

The auto-approval is explicitly intended ("Reviews are auto-approved so they appear on the landing wall immediately", line 140-148) — but combined with arbitrary `organization_id`, it's a reputation-attack vector.

Concrete fix:
1. Either require moderation (`status: "PENDING"`) and let the super admin approve.
2. OR validate `organization_id` against `organizations.status = 'ACTIVE' AND organizations.public_enabled = true` and rate-limit per `organization_id` (not just per IP).
3. Move the limiter to Redis/DB so it can't be bypassed by IP rotation in serverless.

---

### B6 — ✅ OK · Every other tenant-scoped route correctly filters by `user.organizationId`
I went through every route file under `src/app/api/`. Routes that read `organizationId` from the session (via `getCurrentUser()`) AND filter every DB query by `.eq('organization_id', user.organizationId)`:

| Route | GET | POST | PATCH | DELETE | Notes |
|---|---|---|---|---|---|
| `/api/orders` | ✅ | ✅ |  |  | Also validates `tableId` + `menuItemId` belong to tenant |
| `/api/orders/[id]` | ✅ |  | ✅ |  | `db.order.findById(id, user.organizationId)` |
| `/api/reservations` | ✅ | ✅ |  |  | Validates `tableId` + `customerId` |
| `/api/reservations/[id]` |  |  | ✅ | ✅ | `db.reservation.findById(id, user.organizationId)` |
| `/api/tables` | ✅ | ✅ |  |  | |
| `/api/tables/[id]` |  |  | ✅ | ✅ | `db.table.findFirst(user.organizationId, { id })` + `db.table.update(id, user.organizationId, patch)` (double-filtered) |
| `/api/tables/positions` |  | ✅/✅ |  |  | `.eq('organization_id', user.organizationId)` on every UPDATE in the loop |
| `/api/tables/group` |  | ✅ |  | ✅ | Validates all `tableIds` belong to tenant before update |
| `/api/tables/transfer` |  | ✅ |  |  | Validates both reservation + newTable by `organization_id` |
| `/api/tables/available` | ✅ |  |  |  | Filters tables + reservations by org |
| `/api/categories` | ✅ | ✅ |  |  | |
| `/api/categories/[id]` |  |  | ✅ | ✅ | `db.category.findFirst(user.organizationId, { id })` + `db.category.update/delete(id, user.organizationId, …)` (double-filtered) |
| `/api/menu` | ✅ | ✅ |  |  | Validates `categoryId` belongs to tenant |
| `/api/menu/[id]` |  |  | ✅ | ✅ | `db.menuItem.findById(id, user.organizationId)` + double-filtered update/delete |
| `/api/restaurant` | ✅ |  | ✅ |  | Uses `user.organizationId` for findById/update/findByOrg/upsert. (B4 is a settings-mass-assignment issue, not an isolation issue.) |
| `/api/restaurant/import-web` | ✅ | ✅ |  |  | `runImportJob({ organizationId: user.organizationId, … })`; SSRF protection in src/lib/web-import.ts:141-166 |
| `/api/notifications` | ✅ |  |  |  | `.eq('organization_id', user.organizationId).or('user_id.eq.<me>,user_id.is.null')` |
| `/api/notifications/[id]` |  |  | ✅ |  | Verifies `notif.organization_id === user.organizationId` before any write |
| `/api/notifications/mark-all-read` |  | ✅ |  |  | Filters by `organization_id` |
| `/api/shifts` | ✅ | ✅ |  |  | |
| `/api/shifts/[id]` |  |  | ✅ | ✅ | `.eq('id', id).eq('organization_id', user.organizationId)` on UPDATE + DELETE |
| `/api/chat/channels` | ✅ | ✅ |  |  | |
| `/api/chat/messages` | ✅ | ⚠️ B3 |  |  | GET is fine; POST is B3 |
| `/api/customers` | ✅ | ✅ |  |  | |
| `/api/customers/[id]` | ✅ |  | ⚠️ B2 | ⚠️ B2 | |
| `/api/customers/search` | ✅ |  |  |  | |
| `/api/search` | ✅ |  |  |  | All 4 sub-queries filtered by org |
| `/api/analytics` | ✅ |  |  |  | `db.analytics.getDashboard(user.organizationId)` — every internal query is `.eq('organization_id', organizationId)` (src/lib/db.ts:700-747) |
| `/api/billing/checkout` |  | ✅ |  |  | `user.organizationId` |
| `/api/billing/portal` |  | ✅ |  |  | `getOrgPlan(user.organizationId)` |
| `/api/billing/subscription` | ✅ | ✅ |  |  | `user.organizationId` on every query |
| `/api/whatsapp/status` | ✅ |  |  |  | `.eq('organization_id', user.organizationId)` |
| `/api/user/profile` | ✅ | ✅ |  |  | Scoped by `user.id` |
| `/api/user/activity` | ✅ |  |  |  | `.eq('user_id', user.id)` |
| `/api/admin/tenants` | ✅ | ✅ |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/tenants/[id]` | ✅ | ✅ |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/tenants/[id]/details` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/users` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/logs` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/health` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/stats` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/system-status` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/billing` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/customers` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/search` | ✅ |  |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/reviews` | ✅ | ✅ | ✅ | ✅ | SUPER_ADMIN only — global by design |
| `/api/admin/notifications` | ✅ | ✅ |  |  | `.eq('user_id', user.id)` |
| `/api/admin/notifications/[id]` |  |  | ✅ | ✅ | `.eq('id', id).eq('user_id', user.id)` — double-filtered |
| `/api/admin/notifications/mark-all-read` |  | ✅ |  |  | `.eq('user_id', user.id)` |
| `/api/admin/maintenance` | ✅ | ✅ |  |  | SUPER_ADMIN only on POST; GET is public (intentional) |
| `/api/admin/settings` | ✅ | ✅ |  |  | SUPER_ADMIN only — global by design |
| `/api/admin/impersonate` |  | ✅ | ✅(DELETE) |  | SUPER_ADMIN only — see A8 |
| `/api/public/[slug]` | ✅ |  |  |  | Public by design; filters by `restaurant.id` |
| `/api/public/reviews` | ✅ | ⚠️ B5 |  |  | Public by design |
| `/api/health` | ✅ |  |  |  | Public by design |
| `/api/seed` |  | ❌ A2 |  |  | |
| `/api/seed-customers` |  | ✅ |  |  | `user.organizationId` |
| `/api/roles` | ✅ |  |  |  | |
| `/api/permissions` | ✅ |  |  |  | |
| `/api/route.ts` | ✅ |  |  |  | Returns `{message:"Hello, world!"}` — harmless |

The data-access layer (`src/lib/db.ts`) consistently takes `organizationId` as an explicit parameter and applies `.eq('organization_id', organizationId)` on every read, update, and delete. RLS is enabled as defense-in-depth (per migration 0002_hardened_rls.sql) but never relied upon because `supabaseAdmin` uses the service_role key. `organizationId` is stamped on every INSERT. The session type augmentation (`src/types/next-auth.d.ts:15,31,45`) enforces `organizationId: string` at compile time so a missing org context fails the build (where `ignoreBuildErrors: true` is OFF — see D5).

================================================================
C. OWASP TOP 10 QUICK SCAN
================================================================

### C1 — ✅ OK · A03 SQL Injection
No string-concatenated SQL anywhere. All DB access is via the Supabase JS client's parameterised REST API (`.eq()`, `.in()`, `.or()`, `.ilike()`, etc.). The only raw-SQL-ish patterns are:
- Regex HTML parsing in src/lib/web-import.ts:288-489 — operates on remote HTML strings, never touches SQL.
- The `.or(\`name.ilike.${like},…\`)` patterns in `search/route.ts:29,36,43,52` and `admin/search/route.ts:31,37,43` and `admin/customers/route.ts:23` and `customers/route.ts:26` and `customers/search/route.ts:20` — the `like` value is built from user-supplied `q` URL params. Supabase's PostgREST does parameterise these, BUT an attacker who injects `,` or `.` characters into `q` could potentially craft a malformed filter that errors out (PostgREST rejects malformed filters with 400). No SQL injection risk — PostgREST's `.or()` parser is strict. ✅

### C2 — ✅ OK · A03 XSS
Three `dangerouslySetInnerHTML` usages, all safe:
- `src/app/landing/page.tsx:213-216` and `src/app/landing/head.tsx:195-207`: render `JSON.stringify(<local object>)` into `<script type="application/ld+json">`. The data is built from constants + approved DB reviews — no user input reaches the JSON-LD unsanitised, and `JSON.stringify` escapes `<` and `>` into `\u003c`/`\u003e` by default in modern Node, which prevents `</script>` breakout.
- `src/components/ui/chart.tsx:83`: shadcn/ui chart style injector — uses static `THEMES` constant.
No other unescaped user-content rendering. React escapes by default, and all customer-supplied strings (customer notes, reservation notes, chat messages, review body, etc.) flow through `{}` JSX children. ✅

### C3 — ✅ OK · A01 CSRF
- NextAuth's built-in CSRF token is enabled by default on `/api/auth/*` POSTs (sign-in, sign-out, registration via the credentials provider).
- All other state-changing API routes require `Content-Type: application/json` (set by `src/lib/api.ts:10`) and the NextAuth session cookie is `sameSite: 'lax'` (default) — which means a cross-site HTML form POST (which sends `application/x-www-form-urlencoded`) cannot ride along the session cookie. Combined, traditional CSRF is mitigated.
- The impersonation endpoints (`/api/admin/impersonate` POST/DELETE) read `organizationId` from the body and write cookies — these are POST routes under `/api/admin/` so they require a SUPER_ADMIN JWT, which provides implicit CSRF protection (an attacker can't forge the cookie).

### C4 — ⚠️ WARN · A10 SSRF — image proxy / Next.js image optimizer + web-import
File: next.config.ts:9-15
```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "**" },
    { protocol: "http", hostname: "**" },
  ],
  formats: ["image/avif", "image/webp"],
  dangerouslyAllowSVG: true,
  contentDispositionType: "attachment",
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
},
```
The Next.js image optimizer accepts ANY http(s) URL via `_next/image?url=…` and fetches it server-side. An attacker can use this as an SSRF proxy: `/_next/image?url=http://169.254.169.254/latest/meta-data/iam/…&w=16&q=1`. Next.js does have an internal blocklist for some private IP ranges, but it has historically had bypasses (DNS rebinding, IPv6-mapped IPv4, decimal-octal encodings). The web-import service (src/lib/web-import.ts:141-166) has its OWN `isPrivateUrl` check that blocks 10.x / 172.16-31.x / 192.168.x / 169.254.x / metadata.google.internal — good — but it does NOT cover IPv6-mapped IPv4 (`::ffff:169.254.169.254`) or DNS rebinding. The image optimizer has no such check at all.

`dangerouslyAllowSVG: true` would let uploaded SVGs (which can contain `<script>` tags) execute in the browser — BUT `contentDispositionType: "attachment"` + `script-src 'none'` CSP on the image response mitigates this (the SVG is downloaded, not rendered inline, and inline scripts in the SVG are blocked). Still, allowing arbitrary SVG is risky if the CSP is ever loosened.

Concrete fix:
1. Restrict `remotePatterns` to a whitelist of known image CDNs (Cloudinary, Cloudflare Images, Supabase Storage, the app's own origin) — drop `hostname: "**"`.
2. Set `dangerouslyAllowSVG: false` (default) — if SVG support is truly needed, proxy uploads through a sanitizer like `isomorphic-dompurify`.
3. In `isPrivateUrl`, also block `::ffff:`-prefixed IPv4, hostnames that resolve to private IPs (use `dns.lookup`), and well-known cloud metadata hostnames (`metadata.google.internal`, `metadata.azure.com`, `169.254.169.254`).

### C5 — ✅ OK · A08 Mass Assignment
- `/api/restaurant/route.ts` PATCH destructures named fields (line 46-51) — safe.
- `/api/restaurant/route.ts` settings PATCH — see B4 (mass-assignment on settings sub-object). ⚠️
- `/api/customers/route.ts` POST and `/api/customers/[id]/route.ts` PATCH both build a `patch: any = {}` with explicit `if (body.X !== undefined) patch.Y = body.X` per field — safe.
- All `/api/tables`, `/api/menu`, `/api/categories`, `/api/orders`, `/api/reservations`, `/api/shifts` PATCH routes follow the same explicit-field-copy pattern — safe.
- `/api/admin/settings/route.ts:14-24` PATCH takes a `key` + `value` pair — explicit, safe.

### C6 — ✅ OK · A01 Open Redirect
Only one redirect in the codebase: `src/middleware.ts:30`:
```ts
if (token) return NextResponse.redirect(new URL('/', req.url))
```
The redirect target is hardcoded to `/`, using the request URL as the base — not user-controlled. Stripe success/cancel URLs are constructed from `process.env.NEXTAUTH_URL` + a hardcoded query string (src/app/api/billing/checkout/route.ts:30-31, src/lib/stripe.ts:84-85). No `req.body.returnUrl`-style pattern exists.

### C7 — ✅ OK · A01 Path Traversal
No file-upload endpoint actually exists in `src/app/api/` despite `src/lib/api.ts:30-40` defining an `uploadFile()` client helper that POSTs to `/api/upload` — that route does not exist in the codebase. So there's no path-traversal surface via the API. The web-import service stores HTML in a DB cache table (`import_html_cache`), not the filesystem. ✅ (Bonus: dead client code `uploadFile()` should be deleted.)

### C8 — ✅ OK · A02 Sensitive Data Exposure in API responses
- `password_hash` is on the `User` type (src/lib/db.ts:51) and is fetched by `db.user.findByEmail` (line 234-241), but it is only used inside `verifyPassword` and never serialized into a NextAuth session or API response. The session callback in src/lib/next-auth.ts:178-208 copies only `id, email, name, role, isSuperAdmin, restaurantId, organizationId, …` — no password hash.
- `verifyToken` is exposed in `/api/auth/register` response — see A5. ⚠️
- `resetToken` is exposed in `/api/auth/forgot-password` dev response — see A6. ⚠️
- `/api/admin/tenants/[id]` returns the full `users` row including `password_hash`! File: src/app/api/admin/tenants/[id]/route.ts:16-22
```ts
const [settings, users, …] = await Promise.all([
  // …
  (async () => {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const { data } = await supabaseAdmin.from('users').select('*').eq('organization_id', id)…
    return data || []
  })(),
```
`select('*')` returns `password_hash` for every user in the tenant. The response is sent to the super admin only (middleware enforces SUPER_ADMIN), so the blast radius is limited — but super admins should not see bcrypt hashes either (defense-in-depth + avoids trivial credential-stuffing if the admin token is ever stolen). Same issue in `/api/admin/tenants/[id]/details/route.ts:20` (`select('id, email, name, role, is_super_admin, created_at')` — this one is OK, it's an explicit column list).

Concrete fix for `tenants/[id]/route.ts`: replace `select('*')` with `select('id, email, name, role, is_super_admin, blocked, created_at, updated_at')`.

================================================================
D. RATE LIMITING
================================================================

### D1 — ❌ BUG · `src/lib/rate-limit.ts` is dead code — `checkRateLimit` and `RATE_LIMITS` are never imported
Grep for `checkRateLimit` returns only its own declaration (src/lib/rate-limit.ts:36). Grep for `RATE_LIMITS` returns only its own declaration (line 69). The carefully pre-configured limits (`auth`, `login`, `register`, `forgotPassword`, `reviews`, `api`, `webImport`) are never applied anywhere.

Concrete fix: import and call `checkRateLimit(req, RATE_LIMITS.login)` at the top of `/api/auth/[...nextauth]/route.ts` (wrap the POST handler — requires modifying the NextAuth handler, easier said than done; an alternative is to add a `middleware.ts`-level rate-limiter for `/api/auth/callback/credentials`). Add `checkRateLimit(req, RATE_LIMITS.register)` to `register/route.ts`, `RATE_LIMITS.forgotPassword` is already covered by an inline limiter, `RATE_LIMITS.api` should wrap every `/api/*` route, `RATE_LIMITS.webImport` is already covered by an inline limiter.

### D2 — ⚠️ WARN · In-memory limiters silently break in serverless / multi-instance
Per-route inline limiters exist in:
- `src/app/api/auth/forgot-password/route.ts:10-29` (Map, 3/10min/IP)
- `src/app/api/public/reviews/route.ts:23-37` (Map, 3/10min/IP)
- `src/app/api/restaurant/import-web/route.ts:14-42` (Map, 10/10min/user+IP)
- `src/lib/session-management.ts:180-225` (Map, brute-force on login)

All four are per-instance Maps. On Vercel/Cloudflare Workers, every warm instance has its own counter, so the effective limit is `MAX × N`. An attacker rotating across instances (or just hitting a freshly-spawned cold instance) bypasses the limit entirely.

Concrete fix: move all four to a shared backend — Upstash Redis (`@upstash/ratelimit`) is the canonical choice for Next.js serverless. Same for A4.

### D3 — ⚠️ WARN · `/api/stripe/webhook` and `/api/whatsapp/webhook` have NO rate limit AND no IP allowlist
Even if the middleware bug (E1 below) is fixed, both webhook endpoints are reachable by anyone who knows the URL. The Stripe webhook verifies the signature (src/lib/stripe.ts:182-195, uses `STRIPE_WEBHOOK_SECRET`) — good — so a forged request without a valid signature returns 400. The WhatsApp webhook has NO signature verification on POST (see E3) — anyone can POST fake message webhooks.

Concrete fix: in addition to fixing E1/E3, restrict both endpoints by source IP (Meta publishes their webhook egress IP ranges; Stripe's are documented). Add `checkRateLimit(req, { window: 60_000, max: 100 })` as a backstop.

### D4 — ✅ OK · `/api/auth/forgot-password` has a per-IP limiter (3/10min) — fine for single-instance
See D2 for the multi-instance caveat.

================================================================
E. SESSION MANAGEMENT
================================================================

### E1 — ❌ CRITICAL BUG · `/api/stripe/webhook` and `/api/whatsapp/webhook` are BLOCKED by middleware
File: src/middleware.ts:40-42
```ts
export const config = {
  matcher: ['/api/((?!auth|public|health).*)', '/login'],
}
```
File: src/middleware.ts:18-25
```ts
if (pathname.startsWith('/api/')) {
  const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // …
}
```
The matcher's negative lookahead only excludes `/api/auth`, `/api/public`, `/api/health`. `/api/stripe/webhook` and `/api/whatsapp/webhook` match the pattern (their path components `stripe` and `whatsapp` are not in the exclusion list), so middleware runs, calls `getToken`, gets `null` (Stripe/Meta don't send a NextAuth JWT), and returns 401. **Stripe webhooks and Meta webhook verifications never reach the route handler.** Billing will silently break: subscriptions created in Stripe won't update `organization_subscriptions.status`, invoices won't be recorded, payment failures won't suspend tenants. WhatsApp message ingestion won't work either.

Concrete fix: extend the matcher exclusion (and the early-return guard):
```ts
// matcher
matcher: ['/api/((?!auth|public|health|stripe/webhook|whatsapp/webhook).*)', '/login']

// inside middleware, before the /api/ check
if (pathname === '/api/stripe/webhook' || pathname === '/api/whatsapp/webhook') {
  return NextResponse.next()
}
```

---

### E2 — ⚠️ WARN · Session revocation is wired but never checked — `isSessionValid` defined, never called
See A1 for the full analysis. The `user_sessions` table is written to on login (src/lib/next-auth.ts:88, 116), updated on revoke (src/lib/session-management.ts:55-78), but never read by any auth-checking code path. Effect: the entire `user_sessions` table is write-only decoration.

Concrete fix: in `src/lib/next-auth.ts` `jwt()` callback, add at the top (before any other logic):
```ts
if (token.jti) {
  const ok = await isSessionValid(token.jti)
  if (!ok) {
    // Returning a fresh object with no user info makes the session callback
    // produce an unauthenticated session, which NextAuth treats as logged-out.
    return { ...token, _invalidated: true } as any
  }
}
```
And in `session()` callback: `if (token._invalidated) { delete session.user; return session }`. Combined with A1's logout-revokes-JTI fix, this gives proper session lifecycle.

---

### E3 — ⚠️ WARN · WhatsApp webhook POST has NO signature verification + hardcoded verify-token fallback
File: src/app/api/whatsapp/webhook/route.ts:19, 39-71
```ts
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "restopanel_verify_2026";
// …
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.info("[whatsapp] Webhook received:", JSON.stringify(body).substring(0, 500));
    if (body.object) {
      // … process messages + statuses without verifying X-Hub-Signature-256
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false }, { status: 400 });
  } catch (e: any) { /* … */ }
}
```
Two bugs:
1. The `VERIFY_TOKEN` fallback `"restopanel_verify_2026"` is publicly visible in the source code. If `WHATSAPP_VERIFY_TOKEN` is not set in production, anyone can hit `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=restopanel_verify_2026&hub.challenge=anything` and have Meta register their own webhook URL.
2. The POST handler accepts ANY JSON body and processes it without verifying the `X-Hub-Signature-256` HMAC against `WHATSAPP_APP_SECRET`. An attacker can POST fake "message received" events to trigger whatever downstream side-effects are added later (currently just `console.info`, but the comments at lines 57-61 say "Here we would: look up customer, store message, trigger auto-replies").

Concrete fix:
```ts
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
if (!VERIFY_TOKEN) throw new Error("WHATSAPP_VERIFY_TOKEN must be set")
const APP_SECRET = process.env.WHATSAPP_APP_SECRET
if (!APP_SECRET) throw new Error("WHATSAPP_APP_SECRET must be set")

export async function POST(req: Request) {
  const sig = req.headers.get("x-hub-signature-256") || ""
  const raw = await req.text()
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex")
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse("Forbidden", { status: 403 })
  }
  const body = JSON.parse(raw)
  // … process
}
```

---

### E4 — ⚠️ WARN · Concurrent session limit not enforced
File: src/lib/session-management.ts:80-93
```ts
export async function getActiveSessions(userId: string) {
  const { data } = await supabaseAdmin.from("user_sessions").select("*")
    .eq("user_id", userId).is("revoked_at", null)
    .order("created_at", { ascending: false });
  return data || [];
}
```
There is no `MAX_SESSIONS_PER_USER` constant, no check in `createSession` (line 16-36) that revokes older sessions when a new one is created, and no background job that revokes stale sessions past the 30-day `expires_at`. A user can accumulate an unlimited number of active sessions. Combined with E2 (revocation not checked), the `user_sessions` table is effectively a write-only audit log.

Concrete fix: in `createSession`, after insert, count active sessions for `userId`; if > N (e.g., 5), revoke the oldest. Also add a cron / scheduled function to delete rows where `expires_at < now()`.

---

### E5 — ✅ OK · "Remember me" expiry
File: src/lib/next-auth.ts:25
```ts
session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
```
30 days is reasonable for a SaaS dashboard. The `AuthScreen.tsx:280` "Recordarme" checkbox is currently decorative — it has no effect on the JWT maxAge. That's a minor UX bug, not a security issue: the session is always 30 days regardless of the checkbox.

================================================================
F. CONFIGURATION & BUILD
================================================================

### F1 — ⚠️ WARN · `typescript.ignoreBuildErrors: true` will silently ship type errors to production
File: next.config.ts:5-7
```ts
typescript: {
  ignoreBuildErrors: true,
},
```
This means `next build` will succeed even if the TypeScript compiler reports errors. Security-relevant type augmentations (e.g., `src/types/next-auth.d.ts` which enforces `organizationId: string` on every session) become advisory rather than enforced. A future refactor that accidentally removes `user.organizationId` from a session check would still build.

Concrete fix: set `ignoreBuildErrors: false`. If there are pre-existing type errors, fix them rather than masking them. Same reasoning applies to `eslint.ignoreDuringBuilds` if it's set (it isn't currently).

### F2 — ⚠️ WARN · No global Content-Security-Policy header
File: next.config.ts:20-42
The headers config sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a special CSP for `/_next/image` responses — but no CSP for the main HTML documents. A CSP header (`default-src 'self'; script-src 'self' 'unsafe-inline'; …`) would block the most common XSS payloads even if a future template bug introduces one. NextAuth's inline callbacks and the use of `<style>` tags in shadcn/ui components means `unsafe-inline` is likely required for scripts and styles, but `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'` are still high-value.

Concrete fix: add a `Content-Security-Policy` header to the `/(.*)` source in `next.config.ts` `headers()`.

### F3 — ⚠️ WARN · `reactStrictMode: false`
File: next.config.ts:8
Disables React's strict-mode double-rendering, which surfaces many bugs (effect cleanups, inconsistent state) in development. Not a security bug per se, but it weakens a useful safety net. Set to `true`.

### F4 — ✅ OK · Security headers present
`X-Frame-Options: SAMEORIGIN` (clickjacking defense), `X-Content-Type-Options: nosniff` (MIME-sniffing defense), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS for 2 years), `poweredByHeader: false`. Good baseline.

### F5 — ✅ OK · Supabase admin client uses non-NEXT_PUBLIC env vars
File: src/lib/supabase/admin.ts:19-30
`SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL` fallback) + `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix). The service_role key is therefore stripped from the client bundle by Next.js. The module throws at import time if the key is missing — fail-fast. ✅

### F6 — ✅ OK · `next.config.ts` poweredByHeader: false
Removes the `X-Powered-By: Next.js` header that would otherwise fingerprint the framework.

================================================================
G. DEAD CODE / OBSERVATIONS
================================================================

### G1 — `src/lib/rbac.ts` (316 lines) is unused
`hasPermission`, `requirePermission`, `assignRole`, `updateRolePermissions`, `invalidateRbacCache`, `getUserPermissions`, `getUserRoleLabel`, `getAllRoles`, `getAllPermissions`, `getPermissionsForRole` are all exported. Grep shows `hasPermission` / `requirePermission` are imported NOWHERE outside of rbac.ts itself. Routes use a simple `user.role !== 'ADMIN'` check instead. The RBAC tables (`roles`, `permissions`, `role_permissions`, `user_roles`) exist in the DB (migration 0014_enterprise_rbac.sql) and are populated, but no API route enforces a permission code. This is a major gap if the product is sold as "enterprise RBAC" — but it's not a vulnerability, just unenforced complexity.

### G2 — `src/lib/rate-limit.ts` (84 lines) is unused — see D1.

### G3 — `src/lib/api.ts:30-40` `uploadFile()` posts to `/api/upload` which does not exist. Either implement the upload route (with file-type + size + path-traversal validation) or delete the helper.

### G4 — `src/lib/session-management.ts:95-102` `updateSessionActivity()` is exported but never called. The `user_sessions.last_activity` column will always be NULL.

### G5 — `src/app/api/tables/positions/route.ts` POST handler is a duplicate of PATCH that simply re-invokes PATCH (line 41-43). Either route is reachable from the UI — but per audit-8 (worklog above) the UI button is always disabled, so both methods are dead.

================================================================
STAGE SUMMARY
================================================================

❌ CRITICAL (fix before any production deploy):
1. A1 — Logout does not invalidate the JWT; `isSessionValid` is dead code. Stolen tokens live for 30 days.
2. A2 — `/api/seed?force=true` lets ANY authenticated user wipe ALL tenant data + all users.
3. A3 — Hardcoded super-admin credentials `owner@restopanel.es / owner2026` in source + echoed in API response.
4. E1 — Middleware 401s `/api/stripe/webhook` and `/api/whatsapp/webhook`, so billing & WhatsApp ingestion are broken.

⚠️ HIGH (fix before "enterprise" pitch):
5. A4 — Brute-force protection is in-memory only; useless in serverless / multi-instance.
6. A5 — Register endpoint has no rate limit and leaks the verify-token in the response.
7. A8 — Impersonation cookies missing `secure: true`.
8. A9 — JWT role/isSuperAdmin/blocked not refreshed for 30 days.
9. B1 — IDOR on `/api/user/sessions` DELETE (any user can revoke any other user's session by `jti`).
10. B5 — Public reviews endpoint accepts arbitrary `organization_id` and auto-approves — reputation-attack vector.
11. D1 — `src/lib/rate-limit.ts` is dead code; pre-configured limits never applied.
12. E3 — WhatsApp webhook has no signature verification + hardcoded verify-token fallback.

⚠️ MEDIUM:
13. A6 — Forgot-password returns reset token in dev mode (NODE_ENV detection brittle).
14. A7 — Verify-email / reset-password tokens travel in URL query string.
15. B2 — `/api/customers/[id]` PATCH/DELETE/reservations skip `.eq('organization_id', …)` defense-in-depth.
16. B3 — `/api/chat/messages` POST doesn't validate `channelId` belongs to the tenant.
17. B4 — `/api/restaurant` settings PATCH is mass-assignable via dynamic snake_case conversion.
18. C4 — `images.remotePatterns: hostname: "**"` + `dangerouslyAllowSVG: true` is an SSRF/XSS surface.
19. C8 — `/api/admin/tenants/[id]` returns `password_hash` via `select('*')` on users.
20. E4 — Concurrent session limit not enforced.
21. F1 — `typescript.ignoreBuildErrors: true` ships type errors silently.

✅ OK (29 items):
- A10 NextAuth core config · A11 middleware unauth block · A12 server-side admin checks
- B6 (38 routes) all correctly org-scoped · C1 SQL injection · C2 XSS (3 dangerouslySetInnerHTML all safe) · C3 CSRF · C5 mass-assignment (most routes) · C6 open redirect · C7 path traversal · C8 password hash never in NextAuth session
- D4 forgot-password has inline limiter (single-instance caveat)
- E5 remember-me expiry sane
- F4 security headers · F5 service_role key not in client bundle · F6 poweredByHeader disabled
- G1-G5 dead code (RBAC, rate-limit, uploadFile, updateSessionActivity, tables/positions POST) — not vulnerabilities, but should be cleaned up.

This was a READ-ONLY audit. No source files were modified. Recommended next task: `audit-9-fix` to triage and patch the 4 CRITICAL items, then a follow-up `audit-9-hardening` pass for the HIGH/MEDIUM items.

---
Task ID: audit-2
Agent: Explore (DB audit)
Task: READ-ONLY audit of /home/z/my-project/supabase/migrations/ (17 SQL files: 0001_init.sql → 0017_billing_enterprise.sql). Scope: schema integrity, RLS, indexes, triggers/functions, migration ordering, billing/feature-flag/super-admin/transfer-RPC correctness, performance.

Summary:
- 17 migrations, sequential, ordered 0001 → 0017, all `create table if not exists` / `add column if not exists` (idempotent). ✅
- 5 CRITICAL bugs, 9 HIGH issues, 11 MEDIUM warnings. 14 ✅ OK items.
- The recursion fix in 0010 is INCOMPLETE — `is_current_user_super_admin()` itself no longer touches `users`, but the inline policies from 0003 (audit_logs, users, organizations, and the dynamic loop on categories/menu_items/tables/orders/order_items/reservations/organization_settings/verification_tokens) STILL embed `exists (select 1 from users u where u.id = auth.uid() and u.is_super_admin = true)` directly. Those still recurse and will cause `42P17 infinite recursion detected in policy for relation "users"` whenever a tenant-scoped query hits them.
- `transfer_reservation()` RPC is `SECURITY DEFINER` and has NO organization check → any authenticated user can move any reservation in the DB.
- `subscription_plans` was seeded with WRONG prices in 0014 (29/290, 59/590, 149/1490) but 0017 UPDATEs them to the CORRECT values (59/566, 119/1142, 249/2390). However, the 0017 header comment still references the OLD wrong yearly prices (590 / 950 / 1990) — misleading.
- `feature_flags` exists (0015), seeded (0015), `feature_flag_overrides` exists (0016). ✅
- `organization_subscriptions` becomes complete only after 0017 adds `cancel_at_period_end`, `canceled_at`, `extra_restaurants`, `extra_restaurant_price`. ✅
- `touch_updated_at()` trigger is missing on ~22 tables that have an `updated_at` column (zones, customers, customer_tags, chat_channels, chat_messages, staff_shifts, notifications, audit_logs, roles, user_roles, user_sessions, user_activity, subscription_plans, feature_flag_overrides, system_settings, event_log, email_queue, organization_usage, invoices, payment_methods, subscription_history, usage_logs).

==================================================================
A. SCHEMA INTEGRITY
==================================================================

❌ BUG · 0001:157 · order_items.menu_item_id FK uses ON DELETE CASCADE
```
menu_item_id    uuid not null references menu_items(id) on delete cascade,
```
Fix: change to `on delete set null` (and drop the NOT NULL), otherwise deleting a menu item silently destroys order history. Order items are accounting/audit records and must survive menu-item deletion.
```sql
alter table order_items alter column menu_item_id drop not null;
alter table order_items drop constraint order_items_menu_item_id_fkey;
alter table order_items add constraint order_items_menu_item_id_fkey
  foreign key (menu_item_id) references menu_items(id) on delete set null;
```

❌ BUG · 0008:6 · tables.group_id has no FK
```
ALTER TABLE tables ADD COLUMN IF NOT EXISTS group_id uuid;
```
A column literally called `group_id` with no FK target — there is no `table_groups` table anywhere in the migrations, so the column can hold any UUID. Either create the `table_groups` table (likely the original intent) or drop the column.
Fix:
```sql
-- option A: create the missing parent table
create table if not exists table_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table tables add constraint tables_group_id_fkey
  foreign key (group_id) references table_groups(id) on delete set null;
```

⚠️ WARN · 0014:263 · organization_subscriptions.plan_id FK has no ON DELETE behavior
```
plan_id         uuid not null references subscription_plans(id),
```
Defaults to `NO ACTION` which would block any plan deletion. Should be `on delete restrict` (intentional) or at least explicit. Fix:
```sql
alter table organization_subscriptions drop constraint organization_subscriptions_plan_id_fkey;
alter table organization_subscriptions add constraint organization_subscriptions_plan_id_fkey
  foreign key (plan_id) references subscription_plans(id) on delete restrict;
```

⚠️ WARN · 0012:10 · whatsapp_messages.organization_id is nullable with no clear reason
```
organization_id     uuid references organizations(id) on delete cascade,
```
Combined with `to_phone text not null`, a row with NULL organization_id is allowed — orphan messages that no tenant can see. Either `not null` or document why outbound system messages can be org-less.

⚠️ WARN · Missing CHECK constraints on enum-like text columns. All of these are documented as enums in comments but never enforced:
- 0001:51 `users.role` ('ADMIN' | 'STAFF')
- 0001:121 `tables.zone`, 0001:122 `tables.shape`, 0001:125 `tables.status`
- 0001:139 `orders.status`, 0001:140 `orders.order_type`
- 0001:178-181 `reservations.status`, `shift`, `source`
- 0006:136 `reservations.channel` (added)
- 0004:18-19 `notifications.type`, `notifications.severity`
- 0007:30 `chat_messages.priority`
- 0007:45,51 `staff_shifts.team`, `staff_shifts.status`
- 0009:32,43,44 `public_reviews.author_role`, `source`, `status`
- 0009:137 `google_review_settings.auto_response_mode`
- 0003:34 `audit_logs.actor_role`
- 0013:12 `import_jobs.status`
- 0012:15 `whatsapp_messages.status`
Fix: add `check (col in (...))` for each, or convert to `create type ... as enum (...)`. The 0014/0017 billing tables already do this correctly (`billing_cycle`, `invoices.status`) — apply the same pattern.

⚠️ WARN · 0006:43 · customers table lacks UNIQUE constraint on (organization_id, phone) and (organization_id, email)
Only indexes exist:
```
create index if not exists customers_organization_id_phone_idx on customers(organization_id, phone);
create index if not exists customers_organization_id_email_idx on customers(organization_id, email);
```
This allows duplicate customer rows for the same phone/email within one tenant. Fix:
```sql
alter table customers add constraint customers_org_phone_unique unique (organization_id, phone);
alter table customers add constraint customers_org_email_unique unique (organization_id, email);
```
(Email can be NULL — `unique` allows multiple NULLs, which is fine.)

✅ OK · 0001:53 · users.organization_id FK on delete cascade — correct.
✅ OK · 0001:143,183 · orders.table_id / reservations.table_id → tables(id) on delete set null — correct (don't lose order history when a table is deleted).
✅ OK · 0006:134 · reservations.customer_id → customers(id) on delete set null — correct (don't lose reservation history).
✅ OK · 0014:95 · user_roles UNIQUE (user_id, organization_id) — one role per user per org, correct.
✅ OK · 0014:273 · organization_subscriptions UNIQUE (organization_id) — one subscription per org, correct.

==================================================================
B. RLS (Row Level Security)
==================================================================

❌ BUG · 0003:60-66 · audit_logs_super_admin_select — STILL recursive after 0010
```
create policy audit_logs_super_admin_select on audit_logs
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.is_super_admin = true
    )
  );
```
The 0010 fix rewrote `is_current_user_super_admin()` to read the JWT claim, but this policy still embeds an inline subquery on `users`. When ANY query hits audit_logs, PostgreSQL evaluates this SELECT policy → the inner `select 1 from users u` triggers users' RLS → users_super_admin_select (also inline-recursive, see below) runs the same subquery → infinite recursion → `42P17`.
Fix:
```sql
drop policy if exists audit_logs_super_admin_select on audit_logs;
create policy audit_logs_super_admin_select on audit_logs
  for select using (is_current_user_super_admin());
```

❌ BUG · 0003:78-86 · users_super_admin_select — recursive
```
create policy users_super_admin_select on users
  for select using (
    exists (
      select 1 from users u
      where u.id = auth.uid() and u.is_super_admin = true
    )
  );
```
A policy on `users` that subqueries `users` — textbook infinite recursion. This is the policy that 0010 was supposed to fix but never touched. Fix:
```sql
drop policy if exists users_super_admin_select on users;
create policy users_super_admin_select on users
  for select using (is_current_user_super_admin());
```

❌ BUG · 0003:88-95 · users_super_admin_update — recursive (same pattern).
❌ BUG · 0003:100-107 · organizations_super_admin_select — recursive.
❌ BUG · 0003:109-116 · organizations_super_admin_update — recursive.
❌ BUG · 0003:124-166 · Dynamic loop creates `_super_admin_select`, `_super_admin_update`, `_super_admin_delete` policies on `categories, menu_items, tables, orders, order_items, reservations, organization_settings, verification_tokens` — ALL of them embed the same recursive `select 1 from users u where u.id = auth.uid() and u.is_super_admin = true` subquery. Every tenant table inherits the recursion bug.
Fix: drop every one of those policies and recreate them with `using (is_current_user_super_admin())`. This is what 0010 should have done. Suggested 0018 migration:
```sql
do $$
declare t text;
begin
  for t in select unnest(array[
    'categories','menu_items','tables','orders','order_items',
    'reservations','organization_settings','verification_tokens'
  ])
  loop
    execute format('drop policy if exists %I_super_admin_select on %I;', t, t);
    execute format('drop policy if exists %I_super_admin_update on %I;', t, t);
    execute format('drop policy if exists %I_super_admin_delete on %I;', t, t);
    execute format('create policy %I_super_admin_select on %I for select using (is_current_user_super_admin());', t, t);
    execute format('create policy %I_super_admin_update on %I for update using (is_current_user_super_admin()) with check (true);', t, t);
    execute format('create policy %I_super_admin_delete on %I for delete using (is_current_user_super_admin());', t, t);
  end loop;
end $$;
drop policy if exists users_super_admin_select on users;
create policy users_super_admin_select on users for select using (is_current_user_super_admin());
drop policy if exists users_super_admin_update on users;
create policy users_super_admin_update on users for update using (is_current_user_super_admin()) with check (true);
drop policy if exists organizations_super_admin_select on organizations;
create policy organizations_super_admin_select on organizations for select using (is_current_user_super_admin());
drop policy if exists organizations_super_admin_update on organizations;
create policy organizations_super_admin_update on organizations for update using (is_current_user_super_admin()) with check (true);
drop policy if exists audit_logs_super_admin_select on audit_logs;
create policy audit_logs_super_admin_select on audit_logs for select using (is_current_user_super_admin());
```

❌ BUG · 0014:139-141 · user_profiles_self_select — recursive
```
exists (select 1 from users u where u.id = user_id and u.organization_id = current_user_org_id())
```
Subqueries `users` and users has the recursive `users_super_admin_select` policy from 0003. Even though `current_user_org_id()` itself no longer recurses (post-0010), this subquery still triggers users' RLS → recursion. Fix: either drop the `exists` branch (relying on the JWT `sub` claim and super_admin is enough), or restructure with a SECURITY DEFINER helper.

❌ BUG · 0014:151, 184-187, 191, 197 · user_profiles_tenant_insert, user_sessions_self_select/insert/update — same recursive `exists (select 1 from users u where ...)` pattern.

❌ BUG · 0009:84-90 · public_reviews_public_insert lets anon users insert reviews with no rate-limit at the DB layer
```
create policy public_reviews_public_insert on public_reviews
  for insert with check (
    status = 'PENDING'
    and rating >= 1 and rating <= 5
    and length(author_name) >= 2 and length(author_name) <= 120
    and length(body) >= 10 and length(body) <= 2000
  );
```
The comment claims "rate-limited at the API layer" — but RLS-level there's no throttle. Any anon client can spam-insert pending reviews. Pair this with the recursion bug above and the INSERT path also triggers the public_reviews_super_admin_select policy which (post-0010) is fine, but the cumulative effect of N inserts each evaluating N+1 policy subqueries is a DoS vector. Fix: add a per-IP / per-day unique constraint or use pg_ratelimit / row count cap.

⚠️ WARN · 0001:326-334 · organizations has SELECT and UPDATE policies but NO INSERT or DELETE policy.
This means: only the service_role (which bypasses RLS) can create or delete organizations. Probably intentional (org creation goes through `/api/auth/register` which uses service_role), but it should be documented.

⚠️ WARN · 0004:40-46 · notifications has SELECT, UPDATE, broadcast-INSERT (0005) but NO DELETE policy.
Means tenants can't delete their own notifications, only super_admin via service_role can. Probably intentional but worth confirming.

⚠️ WARN · 0006:79-82, 35-38 · customers and zones get super_admin SELECT/UPDATE but NO super_admin INSERT/DELETE policies — super_admin can't insert or delete customer/zone rows through RLS, only via service_role.

⚠️ WARN · 0006:106-129 · customer_tags and customer_tag_assignments have NO super_admin policies at all — super_admin can't manage them through RLS.

⚠️ WARN · 0007:62-88 · chat_channels and chat_messages have only SELECT/INSERT tenant policies and super_admin SELECT. No UPDATE/DELETE for either tenant or super_admin. Messages cannot be deleted through RLS.

⚠️ WARN · 0013:30-47 · import_jobs: tenant has SELECT/INSERT/UPDATE, super_admin has SELECT only. No DELETE for either. Super_admin can't cancel/delete import jobs through RLS, and neither can a tenant.

⚠️ WARN · 0014:65-67 · permissions table: `create policy permissions_select on permissions for select using (true);` — readable by anyone, including anon. Probably fine for a permission catalog (no sensitive data) but the comment says "readable by all authenticated" while the policy actually allows anon too. Either tighten with `using (auth.role() = 'authenticated')` or fix the comment.

⚠️ WARN · 0014:78-83 · role_permissions: only a SELECT policy exists. No INSERT/UPDATE/DELETE — all role-permission assignment must go through service_role.

✅ OK · 0001:257-268 · `current_user_org_id()` reads JWT claim, returns NULL for anon → denies all. Correct.
✅ OK · 0010:37-52 · `is_current_user_super_admin()` post-fix reads JWT claim, marked STABLE SECURITY DEFINER. Function itself is recursion-safe.
✅ OK · 0016:96-98 · `system_settings_read` policy correctly hides secrets: `for select using (not is_secret)`.
✅ OK · 0017:47-51, 69-73, 93-97, 112-116 · invoices/payment_methods/subscription_history/usage_logs — all have tenant SELECT + super_admin ALL, complete coverage.

==================================================================
C. INDEXES
==================================================================

❌ BUG · 0001:154-165 · order_items has no index on menu_item_id
```
create index if not exists order_items_order_id_idx on order_items(order_id);
create index if not exists order_items_organization_id_idx on order_items(organization_id);
```
When a menu_item is deleted (with the cascade FK), Postgres must seq-scan order_items to find dependent rows. Same for any "which orders contain this dish?" report. Fix:
```sql
create index if not exists order_items_menu_item_id_idx on order_items(menu_item_id);
```

❌ BUG · 0001:143,183 · orders.table_id and reservations.table_id have no index
```
table_id        uuid references tables(id) on delete set null,
```
Foreign-key ON DELETE SET NULL forces Postgres to seq-scan orders/reservations every time a table is deleted. Fix:
```sql
create index if not exists orders_table_id_idx on orders(table_id) where table_id is not null;
create index if not exists reservations_table_id_idx on reservations(table_id) where table_id is not null;
```

❌ BUG · 0007:23-36 · chat_messages has no index on user_id
```
user_id         uuid references users(id) on delete set null,
```
ON DELETE SET NULL triggers a seq-scan when a user is deleted. Also blocks "show all messages by user X" queries. Fix:
```sql
create index if not exists chat_messages_user_id_idx on chat_messages(user_id) where user_id is not null;
```

❌ BUG · 0014:72-76 · role_permissions has no index on permission_id
```
create table if not exists role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);
```
PK gives `(role_id, permission_id)` index. Reverse lookup "which roles have permission X" needs `(permission_id, role_id)`. Fix:
```sql
create index if not exists role_permissions_permission_id_idx on role_permissions(permission_id);
```

❌ BUG · 0014:88-96 · user_roles has no index on role_id
```
create index if not exists user_roles_user_id_idx on user_roles(user_id);
create index if not exists user_roles_organization_id_idx on user_roles(organization_id);
```
Dropping a role forces seq-scan to cascade-delete user_roles rows. Fix:
```sql
create index if not exists user_roles_role_id_idx on user_roles(role_id);
```

⚠️ WARN · 0014:164-179 · user_sessions has 3 indexes (user_id, token_jti, active) but no index on organization_id. Likely fine because sessions are user-scoped, but if you ever query "all sessions for an org" it'll seq-scan.

⚠️ WARN · 0014:204-220 · user_activity: has indexes on user_id, organization_id, created_at, action — ✅. But action_idx is not partial; could be a hot index. Consider partial `where action in ('login','logout')` if those dominate.

✅ OK · 0001:148-149 · orders has composite indexes (organization_id, status) and (organization_id, created_at) — covers the two hottest query patterns (active orders by tenant, recent orders by tenant).
✅ OK · 0001:188-190 · reservations has (organization_id, date), (organization_id, status), (organization_id, shift) — fully covers calendar, status board, shift filter.
✅ OK · 0006:65-68 · customers has (organization_id), (organization_id, phone), (organization_id, email), and a partial (organization_id, vip_status) where vip_status=true — excellent coverage.
✅ OK · 0003:45-48 · audit_logs has created_at desc, actor_id, organization_id, action — complete.

==================================================================
D. TRIGGERS & FUNCTIONS
==================================================================

❌ BUG · 0015:6-53 · transfer_reservation RPC is SECURITY DEFINER with NO org check
```
CREATE OR REPLACE FUNCTION transfer_reservation(
  p_reservation_id UUID,
  p_old_table_id UUID,
  p_new_table_id UUID
)
RETURNS JSONB AS $$
...
  SELECT * INTO v_reservation FROM reservations WHERE id = p_reservation_id;
  ...
  UPDATE reservations SET table_id = p_new_table_id ... WHERE id = p_reservation_id;
  UPDATE tables SET status = 'AVAILABLE' ... WHERE id = p_old_table_id;
  UPDATE tables SET status = 'RESERVED' ... WHERE id = p_new_table_id;
...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
SECURITY DEFINER means the function runs as its owner (postgres, which bypasses RLS). Any authenticated user can call `select transfer_reservation(some_uuid, table_a, table_b);` and move ANY reservation in ANY tenant's table. There is no `where organization_id = current_user_org_id()` check anywhere.
Also: p_old_table_id is never validated to equal v_reservation.table_id, so a malicious caller could free an unrelated table by passing its UUID as p_old_table_id.
Fix:
```sql
create or replace function transfer_reservation(
  p_reservation_id uuid, p_old_table_id uuid, p_new_table_id uuid
) returns jsonb as $$
declare
  v_reservation record;
  v_new_table    record;
  v_org          uuid := current_user_org_id();
begin
  if v_org is null and not is_current_user_super_admin() then
    return jsonb_build_object('ok', false, 'error', 'No autenticado');
  end if;

  select * into v_reservation from reservations
   where id = p_reservation_id
     and (v_org is null or organization_id = v_org);  -- super_admin bypasses
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Reserva no encontrada');
  end if;

  if v_reservation.table_id is distinct from p_old_table_id then
    return jsonb_build_object('ok', false, 'error', 'La mesa origen no coincide con la reserva');
  end if;

  select * into v_new_table from tables
   where id = p_new_table_id
     and (v_org is null or organization_id = v_org);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Mesa de destino no encontrada');
  end if;

  update reservations set table_id = p_new_table_id, zone = v_new_table.zone, updated_at = now()
   where id = p_reservation_id;
  if p_old_table_id is not null then
    update tables set status = 'AVAILABLE', updated_at = now() where id = p_old_table_id;
  end if;
  update tables set status = 'RESERVED', updated_at = now() where id = p_new_table_id;

  return jsonb_build_object('ok', true, 'message', 'OK', 'new_table', row_to_json(v_new_table));
exception when others then
  return jsonb_build_object('ok', false, 'error', SQLERRM);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
```
(The `SET search_path` is critical for SECURITY DEFINER functions to prevent search_path hijacking.)

❌ BUG · 0006:148-184 · update_customer_metrics() doesn't decrement on status reversal
```
if new.status = 'COMPLETED' and (old.status is null or old.status <> 'COMPLETED') then
  update customers set visits_count = visits_count + 1, ...
end if;
```
If a reservation goes PENDING → COMPLETED → CANCELLED (a real-world scenario when staff clicks the wrong button), visits_count is incremented but never decremented. Same for NO_SHOW and CANCELLED counters. The CRM metrics drift permanently.
Fix: add reverse-update branches when transitioning OUT of a terminal state:
```sql
if old.status = 'COMPLETED' and new.status <> 'COMPLETED' then
  update customers set visits_count = greatest(visits_count - 1, 0) where id = new.customer_id;
end if;
-- and similar for NO_SHOW / CANCELLED
```

⚠️ WARN · 0001:213-233 · touch_updated_at() trigger created only on 8 tables (organizations, users, categories, menu_items, tables, orders, reservations, organization_settings). 22+ other tables with `updated_at` columns have NO touch trigger:
- zones (0006), customers (0006), customer_tags (0006)
- chat_channels (0007), chat_messages (no updated_at — skip), staff_shifts (0007)
- notifications (no updated_at — skip), audit_logs (no updated_at — skip)
- public_reviews (0009 — has trigger ✅), google_review_settings (0009 — has trigger ✅)
- whatsapp_messages (0012 — has trigger ✅)
- import_jobs (0013 — has trigger ✅)
- roles (no updated_at — skip)
- user_profiles (0014 — has trigger ✅), user_sessions (no updated_at — skip)
- subscription_plans (0014 — no trigger ❌), organization_subscriptions (0014 — has trigger ✅)
- feature_flag_overrides (0016 — has updated_at but no trigger ❌), system_settings (0016 — has updated_at but no trigger ❌), event_log (no updated_at — skip)
- email_queue (0015 — has updated_at but no trigger ❌), organization_usage (0015 — has updated_at but no trigger ❌)
- invoices (0017 — has updated_at but no trigger ❌), payment_methods (no updated_at — skip)
- subscription_history (no updated_at — skip), usage_logs (no updated_at — skip)
Fix: add a single migration 0018 that loops over the missing tables and creates the trigger:
```sql
do $$
declare t text;
begin
  for t in select unnest(array[
    'zones','customers','customer_tags','staff_shifts','chat_channels',
    'subscription_plans','feature_flag_overrides','system_settings',
    'email_queue','organization_usage','invoices'
  ])
  loop
    execute format('drop trigger if exists %I_touch on %I;', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at();', t, t);
  end loop;
end $$;
```

⚠️ WARN · 0004:53-78 · notify_super_admins() does a row-by-row loop instead of a single INSERT...SELECT
```
for admin_record in select id from users where is_super_admin = true
loop
  insert into notifications (...) values (admin_record.id, ...);
end loop;
```
Functionally correct, but for N super admins it issues N INSERTs. Fix:
```sql
insert into notifications (user_id, type, severity, title, message, organization_id, action_url, metadata)
select id, p_type, p_severity, p_title, p_message, p_organization_id, p_action_url, p_metadata
  from users where is_super_admin = true;
```

⚠️ WARN · 0006:184 · update_customer_metrics() is marked SECURITY DEFINER but has no `set search_path`. Same for transfer_reservation (0015:53), notify_super_admins (0004:78). All SECURITY DEFINER functions should pin search_path to prevent hijacking. Fix: append `set search_path = public, pg_temp` to each `create function ... $$ language plpgsql security definer set search_path = public, pg_temp;`.

✅ OK · 0001:214-220 · touch_updated_at() definition — simple, correct, idempotent (`create or replace`).
✅ OK · 0002:43-63 · rls_check() — pure SQL, STABLE, safe, used only for diagnostics.
✅ OK · 0010:37-52 · is_current_user_super_admin() post-fix — STABLE, SECURITY DEFINER, no table access.
✅ OK · 0010:61-69 · current_user_org_id() post-fix — STABLE, SECURITY DEFINER, no table access.

==================================================================
E. MIGRATION ORDERING
==================================================================

✅ OK · 17 migrations numbered 0001 → 0017 sequentially, no gaps.
✅ OK · Every `create table` uses `if not exists`, every `alter table ... add column` uses `if not exists`, every `create index` uses `if not exists`, every `create or replace function` is idempotent. Re-running the whole chain is safe.
✅ OK · No migration creates a table already created by another. (0017 only ADDS COLUMNS to subscription_plans/organization_subscriptions, doesn't recreate them.)
✅ OK · No migration drops something a later migration depends on. (0011 drops users_super_admin_update, but recreates it immediately in the same migration. 0003 drops & recreates various policies — fine.)

⚠️ WARN · 0017:7-21 — "Autocontenida" header says it ADDS columns that "pudieran faltar" but the columns already exist (created in 0014). The `add column if not exists` is harmless but the migration is noisier than it needs to be. Not a bug, just style.

⚠️ WARN · 0017:119-127 — Header comment references OLD wrong yearly prices:
```
-- Inicio: 59€/mes, 590€/año (59*10=590, ahorro real ~17%)
-- Premium: 119€/mes, 950€/año (119*8=952, redondeado a 950 para 20% aprox)
-- Empresarial: 249€/mes, 1990€/año (249*8=1992, redondeado a 1990)
```
But the actual UPDATEs further down use the correct 566 / 1142 / 2390. The comment is misleading — fix the comment to match the SQL.

==================================================================
F. SPECIFIC CONCERNS
==================================================================

F1. subscription_plans seeded with correct prices (59/566, 119/1142, 249/2390)?
---
❌ BUG · 0014:443-450 — WRONG initial seed:
```
insert into subscription_plans (...) values
  ('starter', 'Starter', ..., 29.00, 290.00, 15, 3, 500, ..., 1),
  ('professional', 'Professional', ..., 59.00, 590.00, 50, 10, null, ..., 2),
  ('enterprise', 'Enterprise', ..., 149.00, 1490.00, null, null, null, ..., 3)
on conflict (name) do nothing;
```
Monthly prices are 29/59/149 (wrong — should be 59/119/249). Yearly 290/590/1490 (wrong — should be 566/1142/2390).

✅ OK · 0017:129-166 — UPDATEs the rows to the correct values:
```
UPDATE subscription_plans SET price_monthly = 59.00, price_yearly = 566.00, ... WHERE name = 'starter';
UPDATE subscription_plans SET price_monthly = 119.00, price_yearly = 1142.00, ... WHERE name = 'professional';
UPDATE subscription_plans SET price_monthly = 249.00, price_yearly = 2390.00, ... WHERE name = 'enterprise';
```

✅ OK · 0017:169-182 — Fallback INSERTs with the correct prices for fresh installs where the 0014 seed didn't run.

NET RESULT after 0017: prices are correct ✅. But: if anyone snapshots the DB after 0014 but before 0017, they get the wrong prices. And the label rename ('Starter'→'Inicio', 'Professional'→'Premium', 'Enterprise'→'Empresarial') is also done in 0017. The 0017 comment block at lines 119-127 still shows the OLD prices (590/950/1990) — misleading.

F2. feature_flags table — exists, where, seeded?
---
✅ OK · 0015:82-90 — table created:
```
CREATE TABLE IF NOT EXISTS feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  description     TEXT,
  default_value   BOOLEAN NOT NULL DEFAULT false,
  plan_required   TEXT,  -- 'starter', 'professional', 'enterprise', or NULL for all
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
✅ OK · 0015:92-93 — RLS enabled, public SELECT policy.
✅ OK · 0015:96-111 — Seeded with 14 flags (reservations, tables, crm, menu, analytics, chat, shifts, kitchen, whatsapp, web_import, google_reviews, advanced_analytics, api_access, white_label).
✅ OK · 0016:53-62 — `feature_flag_overrides` table created for per-org overrides with UNIQUE (organization_id, flag_key) and FK to feature_flags(key) on delete cascade.

F3. organization_subscriptions table — complete?
---
⚠️ WARN · 0014:260-274 — Initial schema is INCOMPLETE. Has: organization_id, plan_id, billing_cycle, status, trial_ends_at, current_period_start/end, stripe_customer_id, stripe_subscription_id. Missing: cancel_at_period_end, canceled_at, extra_restaurants, extra_restaurant_price.
✅ OK · 0017:185-188 — Adds the 4 missing columns:
```
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS extra_restaurants INT NOT NULL DEFAULT 0;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS extra_restaurant_price NUMERIC(10,2) NOT NULL DEFAULT 49.00;
```
NET RESULT after 0017: table is complete ✅. Default `extra_restaurant_price = 49.00` is hardcoded — should arguably live in `system_settings` for tunability.

F4. is_current_user_super_admin() recursion fix — 0003 vs 0010?
---
❌ BUG · 0003:171-179 — Original definition IS recursive:
```
create or replace function is_current_user_super_admin()
returns boolean as $$
begin
  return exists (
    select 1 from users u
    where u.id = auth.uid() and u.is_super_admin = true
  );
end;
$$ language plpgsql stable;
```
✅ OK · 0010:37-52 — Function rewritten to read JWT claim only:
```
create or replace function is_current_user_super_admin()
returns boolean as $$
declare claim text;
begin
  claim := current_setting('request.jwt.claim.is_super_admin', true);
  return coalesce(claim = 'true' or claim = 't' or claim = '1', false);
end;
$$ language plpgsql stable security definer;
```
❌ BUG · The 0010 fix is INCOMPLETE. Migration 0003 created ELEVEN inline policies that embed the same `select 1 from users u where u.id = auth.uid() and u.is_super_admin = true` subquery directly (NOT through the function):
- audit_logs_super_admin_select (0003:60-66)
- users_super_admin_select (0003:78-86)
- users_super_admin_update (0003:88-95) — later replaced by 0011:15-18 which uses the function ✅
- organizations_super_admin_select (0003:100-107)
- organizations_super_admin_update (0003:109-116)
- categories_super_admin_select/update/delete (0003:135-163, dynamic loop)
- menu_items_super_admin_select/update/delete
- tables_super_admin_select/update/delete
- orders_super_admin_select/update/delete
- order_items_super_admin_select/update/delete
- reservations_super_admin_select/update/delete
- organization_settings_super_admin_select/update/delete
- verification_tokens_super_admin_select/update/delete
Migration 0010 did NOT drop or rewrite any of these. They STILL contain the recursive subquery. Only `users_super_admin_update` was incidentally fixed by 0011 (because 0011 rewrote that one policy). All others remain recursive.

F5. transfer_reservation RPC — exists and correct?
---
✅ OK · 0015:6-53 — Function exists, takes (p_reservation_id, p_old_table_id, p_new_table_id), returns JSONB.
❌ BUG · SECURITY DEFINER with no org check (see D above for full analysis & fix).
❌ BUG · p_old_table_id not validated against the reservation's current table_id — a caller could free any table by passing its UUID.
❌ BUG · No `SET search_path` — vulnerable to search_path hijacking if any schema attack is possible.
✅ OK · Exception handler present, returns JSON error.
✅ OK · Parameterized queries — no SQL injection.

==================================================================
G. PERFORMANCE
==================================================================

⚠️ WARN · 0006:148-184 · update_customer_metrics() fires on every UPDATE of reservations and runs up to 3 separate UPDATE queries against customers. For a busy restaurant doing many reservation status changes per minute, this is 3 row-updates per reservation status change. Combined with the missing reverse-decrement logic (see D), the table is also wrong. Consider a single conditional UPDATE or a daily rollup job.

⚠️ WARN · 0014:353-438 · The role_permissions seed issues 9 separate INSERT...SELECT statements (one per role). Functionally fine but could be one statement with a VALUES+WHERE. Not a hot path, low priority.

⚠️ WARN · 0014:456-480 · The user_roles migration issues 3 INSERT...SELECT statements with `not exists` anti-joins. Each one seq-scans users. Fine for one-time migration, but if re-run on a large users table it'll be slow. Acceptable.

✅ OK · 0001:148-149 · orders composite indexes (organization_id, status) + (organization_id, created_at) — covers the two hottest query patterns. No N+1.
✅ OK · 0001:188-190 · reservations composite indexes — covers calendar, status, shift filter.
✅ OK · 0006:65-68 · customers has 4 indexes including a partial VIP index — well-designed for CRM queries.
✅ OK · 0003:45-48 · audit_logs has 4 indexes including `action` — supports admin audit dashboard filtering.
✅ OK · 0002:43-63 · rls_check() — single SQL query, no N+1.

==================================================================
NEXT ACTIONS (recommended for a follow-up `audit-2-fix` task)
==================================================================
1. CRITICAL: Create migration 0018 that drops and recreates ALL 11+ inline super_admin policies from 0003, replacing the recursive `exists (select 1 from users u where u.id = auth.uid() and u.is_super_admin = true)` subqueries with `is_current_user_super_admin()`. Without this, the recursion bug from 0010 is only half-fixed and any tenant query that touches a super_admin policy will error with 42P17.
2. CRITICAL: Rewrite transfer_reservation() to validate org ownership of both the reservation and the target table, validate p_old_table_id matches, and add `set search_path = public, pg_temp`.
3. CRITICAL: Fix order_items.menu_item_id FK to ON DELETE SET NULL (and drop NOT NULL) to prevent order history loss.
4. HIGH: Fix update_customer_metrics() to decrement counters on status reversal.
5. HIGH: Add the missing FK on tables.group_id (create table_groups table) or drop the column.
6. HIGH: Add missing indexes on order_items.menu_item_id, orders.table_id, reservations.table_id, chat_messages.user_id, role_permissions.permission_id, user_roles.role_id.
7. HIGH: Add touch_updated_at() triggers on the 11 tables with `updated_at` but no trigger (zones, customers, customer_tags, staff_shifts, chat_channels, subscription_plans, feature_flag_overrides, system_settings, email_queue, organization_usage, invoices).
8. MEDIUM: Add CHECK constraints on all enum-like text columns (or convert to proper enums).
9. MEDIUM: Add UNIQUE constraints on customers (organization_id, phone) and (organization_id, email).
10. MEDIUM: Fix the misleading 0017 header comment that references old wrong yearly prices.
11. MEDIUM: Tighten the public_reviews INSERT policy or add a per-IP rate-limit table to prevent anon spam.
12. LOW: Replace notify_super_admins() row-by-row loop with INSERT...SELECT.
13. LOW: Add `set search_path` to all SECURITY DEFINER functions.

This was a READ-ONLY audit. No source files were modified. Recommended next task: `audit-2-fix` to triage and patch the 5 CRITICAL items (recursive RLS policies, transfer_reservation org check, order_items FK cascade), followed by a `audit-2-hardening` pass for the HIGH/MEDIUM items.

---
Task ID: audit-7
Agent: explore (audit sub-agent)
Task: Read-only audit of Stripe billing integration (webhook security, idempotency, races, subscription lifecycle, customer management, plan limits enforcement, trial period, pricing consistency, endpoint config).

Scope inspected:
- src/lib/stripe.ts (292 lines) — Stripe SDK wrapper, PLANS const, getOrCreateCustomer, createCheckoutSession, ensureStripePrice, createPortalSession, cancel/reactivate, verifyWebhookSignature, getOrgPlan, checkLimit.
- src/app/api/stripe/webhook/route.ts (206 lines) — single POST handler with switch on event.type.
- src/app/api/billing/checkout/route.ts (39 lines) — POST creates checkout session.
- src/app/api/billing/portal/route.ts (25 lines) — POST creates billing portal session.
- src/app/api/billing/subscription/route.ts (91 lines) — GET (usage+invoices+PMs) and POST (cancel/reactivate).
- src/app/api/admin/billing/route.ts (54 lines) — super-admin MRR/ARR dashboard.
- src/components/dashboard/sections/BillingSection.tsx (250 lines) — pricing UI + usage bars + invoices list + cancel/reactivate.
- Cross-checked: src/middleware.ts, supabase/migrations/0014_enterprise_rbac.sql (defines organization_subscriptions, subscription_plans, trial seed), supabase/migrations/0017_billing_enterprise.sql (invoices/payment_methods/subscription_history tables + plan prices), supabase/migrations/0001_init.sql, src/app/api/tables/route.ts (limit enforcement check), src/app/api/auth/register/route.ts (trial setup for new orgs).
- Searched src/ for `checkLimit`, `trial_ends_at`, `runtime.*nodejs`, `dynamic.*force-dynamic` to confirm call sites.

==================================================================
A. WEBHOOK SECURITY
==================================================================

A1. Signature verified correctly?
✅ OK · src/lib/stripe.ts:182-195 — `verifyWebhookSignature` calls `stripe.webhooks.constructEvent(payload, signature, endpointSecret)` (the canonical Stripe SDK method). Errors are caught, logged, and converted to `null` (caller returns 400).
```ts
export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event | null {
  const stripe = getStripe();
  if (!stripe) return null;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) return null;
  try {
    return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (e: any) {
    logger.error("Stripe webhook signature verification failed", "stripe", { error: e.message });
    return null;
  }
}
```

A2. Raw body used (not JSON-parsed)?
✅ OK · src/app/api/stripe/webhook/route.ts:7 — uses `req.text()` (raw string), passed verbatim to `verifyWebhookSignature`. No `await req.json()` call.
```ts
const payload = await req.text();
const signature = req.headers.get("stripe-signature") || "";
const event = verifyWebhookSignature(payload, signature);
```

A3. STRIPE_WEBHOOK_SECRET required? What if missing?
⚠️ WARN · src/lib/stripe.ts:186-187 — If `STRIPE_WEBHOOK_SECRET` env var is missing, `verifyWebhookSignature` returns `null` → webhook returns 400 → Stripe retries forever → silent failure in production. The logger.error inside the catch block is NEVER reached when the env var is missing (the function returns earlier at line 187). Should hard-fail at boot OR log explicitly when missing.
```ts
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (!endpointSecret) return null;   // ← silent return, no log
```
Fix: add `logger.error("STRIPE_WEBHOOK_SECRET not set — webhook will reject all events", "stripe");` before returning null, OR throw at module load.

A4. Can the webhook be called WITHOUT auth? (MUST be callable by Stripe.)
❌ BUG (CRITICAL, production-blocking) · src/middleware.ts:11-25 — The middleware runs on every `/api/*` route except `/api/auth/`, `/api/public/`, `/api/health`. `/api/stripe/webhook` matches none of those exemptions, so middleware executes `getToken({ req })`. Stripe's webhook call has no NextAuth JWT cookie → `token` is null → middleware returns 401 BEFORE the route handler is ever invoked. **Stripe can never deliver a webhook event.** No subscription, invoice, or payment_method will ever be recorded.
```ts
// src/middleware.ts:11-25
if (pathname.startsWith('/api/auth/')) return NextResponse.next()
if (pathname.startsWith('/api/public/') || pathname === '/api/health') return NextResponse.next()
// ...
if (pathname.startsWith('/api/')) {
  const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // ...
}
```
Fix:
```ts
// src/middleware.ts — add the stripe webhook to the public bypass list at the top:
if (pathname.startsWith('/api/stripe/webhook')) return NextResponse.next()
```
AND update the matcher so it doesn't even enter middleware:
```ts
export const config = {
  matcher: ['/api/((?!auth|public|health|stripe).*)', '/login'],
}
```

A5. Webhook excluded from middleware auth?
❌ BUG (same as A4) · src/middleware.ts:40-42 — matcher is `'/api/((?!auth|public|health).*)'`. The negative lookahead excludes only `auth|public|health` — `stripe` is NOT excluded, so middleware runs on `/api/stripe/webhook`. Confirmed by reading the file: there is no `/api/stripe/` exemption anywhere in middleware.ts.
```ts
export const config = {
  matcher: ['/api/((?!auth|public|health).*)', '/login'],
}
```

==================================================================
B. IDEMPOTENCY
==================================================================

B1. Duplicate `checkout.session.completed` (Stripe retry)?
❌ BUG · src/app/api/stripe/webhook/route.ts:51-56 — The UPDATE on `organization_subscriptions` is idempotent (one row per org thanks to `unique (organization_id)` constraint from 0014:273), BUT the INSERT into `subscription_history` has no idempotency guard. Stripe retries the same event 3+ times by default → 3 duplicate `subscription.created` rows in history.
```ts
// route.ts:51-56
await supabaseAdmin.from("subscription_history").insert({
  organization_id: orgId,
  event_type: "subscription.created",
  to_plan: planName,
  to_cycle: billingCycle,
});
```
Same bug pattern repeats for `subscription.canceled` (line 95-98), `invoice.paid` (line 131-135), and `payment.failed` (line 156-160).
Fix options (pick one):
  (a) Add a `processed_events` table keyed on `event.id`; check at top of handler, insert at end. Recommended.
  (b) Add UNIQUE constraints to `subscription_history` on `(organization_id, event_type, stripe_event_id)` and store `event.id` as a column.
  (c) Use `event.id` as a synthetic dedup key — log it (already done at route.ts:15) but actually persist it.

B2. Duplicate `invoice.paid` for same invoice ID?
❌ BUG · src/app/api/stripe/webhook/route.ts:115-129 + supabase/migrations/0017_billing_enterprise.sql:27 — The migration correctly defines `stripe_invoice_id TEXT UNIQUE` (line 27), but the Supabase `upsert()` call does NOT specify `onConflict: 'stripe_invoice_id'`. PostgREST's default `Prefer: resolution=merge-duplicates` resolves conflicts on the PRIMARY KEY (`id` UUID, auto-generated), NOT on the unique constraint. So a retry: (1) generates a fresh uuid PK (no PK conflict), (2) hits the `stripe_invoice_id` UNIQUE violation, (3) Postgres raises 42P01, (4) Supabase returns `{ data: null, error: ... }` (not thrown), (5) handler returns 500 → Stripe retries → infinite loop.
```ts
// route.ts:115-129
await supabaseAdmin.from("invoices").upsert({
  organization_id: orgSub.organization_id,
  stripe_invoice_id: invoice.id,
  // ...
});
```
```sql
-- 0017_billing_enterprise.sql:24-41
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  ...
);
```
Fix:
```ts
await supabaseAdmin.from("invoices").upsert({
  // ... same payload
}, { onConflict: 'stripe_invoice_id' });
```

B3. Duplicate `payment_method.attached`?
❌ BUG · src/app/api/stripe/webhook/route.ts:176-185 + 0017_billing_enterprise.sql:57 — Same root cause as B2. `stripe_payment_method_id TEXT UNIQUE` exists but `upsert()` doesn't pass `onConflict: 'stripe_payment_method_id'`. Retries fail with 500.
```ts
// route.ts:176-185
await supabaseAdmin.from("payment_methods").upsert({
  organization_id: orgSub.organization_id,
  stripe_payment_method_id: pm.id,
  // ...
});
```
Fix:
```ts
}, { onConflict: 'stripe_payment_method_id' });
```

==================================================================
C. RACE CONDITIONS
==================================================================

C1. Double-click "Upgrade to Premium"?
⚠️ WARN · src/app/api/billing/checkout/route.ts:5-39 + src/components/dashboard/sections/BillingSection.tsx:157-166 — Two rapid clicks each call POST /api/billing/checkout. The handler has no in-flight guard: it calls `getOrCreateCustomer` then `createCheckoutSession` twice → two Stripe Checkout Sessions created. Stripe allows multiple sessions per customer; the user can complete either (whichever they land on). Result: wasted sessions, but no DB corruption (only one will be `completed`). The frontend `disabled={checkoutMut.isPending || p.name === plan?.planName}` (line 159) only disables the SAME button during the mutation — a second button click on a different plan, or a second tab, bypasses it.
```ts
// BillingSection.tsx:157-166
<Button
  onClick={() => checkoutMut.mutate({ planName: p.name, billingCycle: cycle })}
  disabled={checkoutMut.isPending || p.name === plan?.planName}
  ...
>
```
Fix: server-side, before creating a session, query Stripe for any existing `open` checkout session for this customer (or store active session_id in DB with TTL) and return its URL instead of creating a new one.

C2. Two tabs open checkout simultaneously?
⚠️ WARN · Same as C1. Two tabs → two sessions → whichever the user completes wins. If they complete BOTH (e.g., go back and forth), Stripe will replace the customer's existing subscription with the second one (Stripe enforces "one active subscription per customer" by default unless multiple is configured). The `customer.subscription.updated` webhook will fire for the replacement; DB stays consistent. Not a data-integrity bug, just a poor UX. Acceptable for v1, but worth a note.

C3. Webhook fires while user is mid-checkout?
✅ OK · The webhook handler UPDATEs `organization_subscriptions` by `organization_id` (idempotent) and relies on Stripe as source of truth. If `checkout.session.completed` arrives while the user is still on the Stripe-hosted page, the DB is updated to `status: active` — that's fine, the user is redirected to `/?billing=success` afterward. No ordering bug. The `unique (organization_id)` constraint on `organization_subscriptions` (0014:273) guarantees a single row regardless of insert-vs-update race.

==================================================================
D. SUBSCRIPTION LIFECYCLE
==================================================================

D1. checkout.session.completed → plan_id updated correctly?
✅ OK (with minor caveat) · src/app/api/stripe/webhook/route.ts:36-48 — Plan is read from `session.metadata.plan_name`, looked up in `subscription_plans` by name, and UPDATEd. **Caveat ⚠️:** the first UPDATE (lines 27-34) sets `status: active` and `billing_cycle` but NOT `plan_id` — it relies on the second UPDATE (lines 43-48) to set the plan. If the second lookup fails (e.g., `planName` metadata is missing or the plan row doesn't exist), the org ends up `status: active` with whatever plan_id they had before (could be `starter` from `getOrCreateCustomer`). Also: `current_period_start: new Date().toISOString()` (line 32) uses server wall-clock, not Stripe's `subscription.current_period_start`. Minor.
```ts
// route.ts:36-48
const { data: plan } = await supabaseAdmin
  .from("subscription_plans")
  .select("id")
  .eq("name", planName)
  .single();
if (plan) {
  await supabaseAdmin
    .from("organization_subscriptions")
    .update({ plan_id: plan.id })
    .eq("organization_id", orgId);
}
```
Fix: collapse into one UPDATE with plan_id, AND fetch the Stripe subscription object to use its `current_period_start`/`current_period_end`:
```ts
const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
await supabaseAdmin.from("organization_subscriptions").update({
  stripe_subscription_id: session.subscription,
  status: "active",
  billing_cycle: billingCycle || "monthly",
  plan_id: plan?.id,
  current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
  current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
  cancel_at_period_end: stripeSub.cancel_at_period_end,
}).eq("organization_id", orgId);
```

D2. customer.subscription.updated → current_period_end stored?
✅ OK · src/app/api/stripe/webhook/route.ts:66-77 — `sub.current_period_end` (unix seconds) is converted to ISO and stored. Also stores `current_period_start`, `status` (with mapping for active/past_due/canceled), and `cancel_at_period_end`.
```ts
const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
await supabaseAdmin.from("organization_subscriptions").update({
  status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : sub.status === "canceled" ? "canceled" : sub.status,
  current_period_start: periodStart,
  current_period_end: periodEnd,
  cancel_at_period_end: sub.cancel_at_period_end,
}).eq("organization_id", orgId);
```
⚠️ WARN (bonus): This handler does NOT update `plan_id`. If a customer upgrades/downgrades via Stripe billing portal, the new price's `plan_name` is NOT propagated to DB → the displayed plan becomes stale. Also no `subscription_history` entry is inserted for plan changes. Fix: read `sub.metadata.plan_name` and update plan_id + insert history when it differs from current.

D3. customer.subscription.deleted → status='canceled' + canceled_at?
✅ OK · src/app/api/stripe/webhook/route.ts:82-101 — Both fields set correctly, plus a `subscription.canceled` history entry.
```ts
await supabaseAdmin.from("organization_subscriptions").update({
  status: "canceled",
  canceled_at: new Date().toISOString(),
}).eq("organization_id", orgId);
```
⚠️ WARN (minor): `current_period_end` and `cancel_at_period_end` are NOT cleared on deletion — should also set `cancel_at_period_end: false` and `stripe_subscription_id: null` to avoid stale state if the org later resubscribes.

D4. Cancel at period end → cancel_at_period_end stored?
✅ OK · Two paths converge correctly:
  - Client path: src/app/api/billing/subscription/route.ts:59-69 calls `cancelSubscription(stripeSubscriptionId)` (which `stripe.subscriptions.update(..., { cancel_at_period_end: true })`) then locally UPDATEs `cancel_at_period_end: true`.
  - Webhook path: Stripe fires `customer.subscription.updated` with `cancel_at_period_end: true`, route.ts:75 sets it again.
```ts
// subscription/route.ts:60-64
await cancelSubscription(plan.stripeSubscriptionId);
await supabaseAdmin
  .from("organization_subscriptions")
  .update({ cancel_at_period_end: true })
  .eq("organization_id", user.organizationId);
```

D5. Reactivate → cancel_at_period_end reset?
✅ OK · src/app/api/billing/subscription/route.ts:74-84 — Calls `reactivateSubscription` (sets `cancel_at_period_end: false` in Stripe) then locally sets `cancel_at_period_end: false, canceled_at: null`. The `customer.subscription.updated` webhook will also confirm.
```ts
await reactivateSubscription(plan.stripeSubscriptionId);
await supabaseAdmin
  .from("organization_subscriptions")
  .update({ cancel_at_period_end: false, canceled_at: null })
  .eq("organization_id", user.organizationId);
```

==================================================================
E. CUSTOMER MANAGEMENT
==================================================================

E1. getOrCreateCustomer race condition?
❌ BUG (two distinct bugs in one function) · src/lib/stripe.ts:27-59:

  **Bug #1 — Race creates orphaned Stripe customers:** Two concurrent calls for the same org: (a) both check DB (line 32-38) → both see null → (b) both call `stripe.customers.create` (line 41-45) → TWO customers exist in Stripe, only ONE is ever stored in DB. The other is orphaned (still billed nothing, but counts against Stripe's customer list and pollutes the dashboard). The webhook handler looks up `orgSub` by `stripe_customer_id` (e.g. route.ts:108-112, 169-173), so any event referencing the orphaned customer will be silently dropped.

  **Bug #2 — Upsert silently fails on the second call:** The `organization_subscriptions` table has `unique (organization_id)` (0014:273), but `supabaseAdmin.upsert({...})` (line 48-56) does NOT pass `onConflict: 'organization_id'`. PostgREST's default `merge-duplicates` resolves on PRIMARY KEY (`id` UUID, auto-generated). Second call generates a fresh uuid → no PK conflict → hits the `organization_id` UNIQUE violation → PostgREST returns `{ data: null, error: ... }` (NOT thrown by supabase-js) → caller's `await` resolves normally → function returns `customer.id` from the now-orphaned second customer.

```ts
// src/lib/stripe.ts:27-59
export async function getOrCreateCustomer(organizationId, email, name) {
  const { data: sub } = await supabaseAdmin
    .from("organization_subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (sub?.stripe_customer_id) return sub.stripe_customer_id;   // ← race window here

  const customer = await stripe.customers.create({...});         // ← both calls create
  await supabaseAdmin
    .from("organization_subscriptions")
    .upsert({                                                    // ← no onConflict → second call fails
      organization_id: organizationId,
      stripe_customer_id: customer.id,
      // ...
    });
  return customer.id;                                            // ← returned regardless of upsert success
}
```
Fix:
```ts
// (1) pass onConflict so the upsert actually works:
const { data: existing } = await supabaseAdmin
  .from("organization_subscriptions")
  .upsert({
    organization_id: organizationId,
    stripe_customer_id: customer.id,
    plan_id: (await supabaseAdmin.from("subscription_plans").select("id").eq("name","starter").single()).data?.id,
    billing_cycle: "monthly",
    status: "trial",
  }, { onConflict: 'organization_id' })
  .select("stripe_customer_id")
  .single();

// (2) guard with a Postgres advisory lock OR an idempotency table to prevent
//     two stripe.customers.create calls for the same org:
//   const { error } = await supabaseAdmin.rpc('lock_org', { org_id: organizationId });
//   ... create customer ... release lock.
// Alternative: wrap customer creation in a DB UNIQUE constraint + a retry:
//   if upsert returns the existing customer_id (because another call won the race),
//   use that and DELETE the just-created orphan from Stripe.
```

E2. stripe_customer_id saved on first checkout or only on webhook?
✅ OK · Saved in `getOrCreateCustomer` (stripe.ts:48-56) on first checkout — before the user ever reaches Stripe. Webhook does NOT save it (it's already there). The `checkout.session.completed` handler only updates `stripe_subscription_id` (route.ts:29), confirming this design. ✅ correct.
⚠️ WARN (depends on E1): Because of bug #2 in E1, the upsert is unreliable — for new orgs (no migration-seeded row) the FIRST checkout may fail to persist `stripe_customer_id`, in which case `invoice.paid` / `payment_method.attached` webhooks (which look up by `stripe_customer_id`) will find no match and silently drop the event.

==================================================================
F. PLAN LIMITS ENFORCEMENT
==================================================================

F1. Are plan limits (max_tables, max_users, max_restaurants) enforced anywhere?
❌ BUG (CRITICAL — defeats the entire billing model) · src/lib/stripe.ts:251-291 — `checkLimit` is DEFINED but NEVER CALLED. Grep for `checkLimit` across `src/` returns only the definition itself (1 match). No API route imports or invokes it. Not in `/api/tables/route.ts`, not in `/api/tables/[id]/route.ts`, not in `/api/restaurants/*`, not in `/api/users/*`, not in `/api/auth/register/route.ts`. The function exists dead.
```ts
// src/lib/stripe.ts:251
export async function checkLimit(organizationId: string, metric: "restaurants" | "users" | "tables" | "reservations"): Promise<{ allowed: boolean; current: number; limit: number | null }> {
  // ... computes current count vs plan limit ...
  return { allowed: limit === null || current < limit, current, limit };
}
```
Grep evidence:
```
$ rg "checkLimit" src/
src/lib/stripe.ts:251:export async function checkLimit(...)  ← only the definition
```
Fix: call `checkLimit` in every resource-creating API route:
  - POST /api/tables → check 'tables'
  - POST /api/restaurants → check 'restaurants'
  - POST /api/users (or /api/auth/register if it creates users in the same org) → check 'users'
  - POST /api/reservations → check 'reservations'
Return 402 Payment Required or 403 Forbidden with a clear "Upgrade your plan" message when `!allowed`.

F2. Can a Starter user create 50 tables via POST /api/tables?
❌ BUG (confirmed) · src/app/api/tables/route.ts:57-89 — The POST handler checks only `user.role === 'ADMIN'` and a duplicate-number guard. There is NO plan-limit check. A Starter user (max_tables=15) can create unlimited tables by repeatedly hitting POST /api/tables.
```ts
// src/app/api/tables/route.ts:57-89
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json()
  const { number, name, capacity, zone, shape, posX, posY } = body
  if (!number || !number.trim())
    return NextResponse.json({ error: 'Número obligatorio' }, { status: 400 })
  const existing = await db.table.findFirst(user.organizationId, { number: number.trim() })
  if (existing) return NextResponse.json({ error: 'Ya existe una mesa con ese número' }, { status: 409 })
  const table = await db.table.create({...})  // ← no checkLimit('tables') call before this
  // ...
}
```
Fix:
```ts
import { checkLimit } from '@/lib/stripe'
// ... after the duplicate-number check, before db.table.create:
const limit = await checkLimit(user.organizationId, 'tables')
if (!limit.allowed) {
  return NextResponse.json(
    { error: `Has alcanzado el límite de mesas de tu plan (${limit.limit}). Mejora tu plan para crear más.` },
    { status: 402 }
  )
}
```

==================================================================
G. TRIAL PERIOD
==================================================================

G1. Is the 30-day trial set when an org is created?
⚠️ WARN (inconsistent) · Two competing sources:
  - Migration 0014_enterprise_rbac.sql:494-499 seeds EXISTING orgs (at migration time) with `plan_id = professional`, `status = 'trial'`, `trial_ends_at = now() + 30 days`. So orgs present when 0014 ran get a Premium trial.
  - `getOrCreateCustomer` (stripe.ts:48-56) upserts NEW orgs (those without a subscription row) with `plan_id = starter`, `status = 'trial'`, **and does NOT set `trial_ends_at`** (column stays NULL).
  - `src/app/api/auth/register/route.ts` — grep for `subscription|trial|plan` returns NO matches. So org registration does NOT create a subscription row at all.
  
Net effect: NEW orgs registered after migration 0014 have NO subscription row until they first open the billing page or click "Cambiar plan" (which triggers `getOrCreateCustomer`). At that point they get `plan_id=starter, status=trial, trial_ends_at=NULL`. Existing (seeded) orgs have `plan_id=professional, status=trial, trial_ends_at=now()+30d`. **Two different trial experiences depending on when the org was created.**
```ts
// stripe.ts:48-56 — note: no trial_ends_at
await supabaseAdmin.from("organization_subscriptions").upsert({
  organization_id: organizationId,
  stripe_customer_id: customer.id,
  plan_id: (await supabaseAdmin.from("subscription_plans").select("id").eq("name", "starter").single()).data?.id,
  billing_cycle: "monthly",
  status: "trial",
  // ← trial_ends_at missing
});
```
Fix: (a) set `trial_ends_at: new Date(Date.now() + 30*24*3600*1000).toISOString()` in the upsert; (b) ideally create the subscription row in `/api/auth/register/route.ts` immediately after org creation, with the same values as migration 0014's seed (professional trial); (c) pick ONE trial plan (professional or starter) and use it consistently.

G2. What happens when trial ends? Is the org downgraded? Locked?
❌ BUG · No cron job, no scheduled function, no on-request check. Grep for `trial_ends_at` in `src/` returns ZERO matches (the column is set in DB by migration 0014 but never read by application code). After 30 days, the org's row still says `status='trial'` forever. Users continue to access all features with no downgrade or lock. The trial period is decorative.
Fix: either (a) add a Supabase scheduled function (pg_cron) that runs daily and flips `status='trial'` rows where `trial_ends_at < now()` to `status='canceled'` (or to a new `status='trial_ended'`) and downgrades `plan_id` to starter; OR (b) check `trial_ends_at < now()` in middleware or `getCurrentUser` and block writes (return 402) until payment is set up.

G3. Is trial_ends_at checked anywhere in the code?
❌ BUG · As noted in G2, `trial_ends_at` is NEVER read in `src/`. Confirmed by grep:
```
$ rg "trial_ends_at" src/
(no matches)
```
The column is written (by migration 0014:494) but never consulted. Dead column.

==================================================================
H. PRICING CONSISTENCY
==================================================================

H1. src/lib/stripe.ts PLANS vs DB subscription_plans?
✅ OK · stripe.ts:18-22 monthly/yearly: starter 59/566, professional 119/1142, enterprise 249/2390. Migration 0017:129-166 UPDATEs subscription_plans to identical values. Match.
```ts
// stripe.ts:18-22
export const PLANS = {
  starter:      { name: "starter",      label: "Inicio",      monthly: 59,  yearly: 566,  ... },
  professional: { name: "professional", label: "Premium",     monthly: 119, yearly: 1142, ... },
  enterprise:   { name: "enterprise",   label: "Empresarial", monthly: 249, yearly: 2390, ... },
} as const;
```

H2. BillingSection.tsx PLANS vs stripe.ts?
✅ OK · BillingSection.tsx:12-16 hardcodes the same numbers: starter 59/566, professional 119/1142, enterprise 249/2390. Match with stripe.ts. (Minor ⚠️: the UI duplicates the PLANS const instead of importing it from `@/lib/stripe` — drift risk on future price changes. Fix: `import { PLANS } from '@/lib/stripe'` and derive the UI from it.)

H3. Prices match the spec (starter 59/566, professional 119/1142, enterprise 249/2390)?
✅ OK · All three sources agree:
  - stripe.ts:19-21 — 59/566, 119/1142, 249/2390 ✅
  - BillingSection.tsx:13-15 — 59/566, 119/1142, 249/2390 ✅
  - 0017_billing_enterprise.sql:129-166 — 59.00/566.00, 119.00/1142.00, 249.00/2390.00 ✅
  - (note: 0017 header comment at lines 119-127 references OLD prices 590/950/1990 — already flagged in audit-2 as a misleading-comment WARN; the actual UPDATE/INSERT statements use the correct values.)

==================================================================
I. WEBHOOK ENDPOINT CONFIG
==================================================================

I1. `const runtime = 'nodejs'` exported?
⚠️ WARN · src/app/api/stripe/webhook/route.ts — NO `runtime` export. In Next.js 16 app router the default runtime for non-edge routes is `nodejs`, so the Stripe SDK (which depends on Node `crypto`, `https`, `Buffer`) currently works. But: (a) it's a best practice to be explicit; (b) if anyone adds `export const runtime = 'edge'` globally or to a parent segment, the webhook silently breaks (Stripe SDK cannot run on edge). Add the export to make the intent self-documenting and future-proof.
Fix:
```ts
// route.ts — add at the top, after imports:
export const runtime = 'nodejs';
```

I2. `const dynamic = 'force-dynamic'` exported?
⚠️ WARN · src/app/api/stripe/webhook/route.ts — NO `dynamic` export. POST routes are inherently dynamic in Next.js (cannot be statically rendered), so functionally OK. But: (a) Next.js has historically had bugs where dynamic POST routes still got partial caching of the route segment; (b) explicit is safer. Add the export.
Fix:
```ts
export const dynamic = 'force-dynamic';
```

I3. `req.text()` used for raw body?
✅ OK · src/app/api/stripe/webhook/route.ts:7 — `const payload = await req.text()`. Raw string, NOT `req.json()`. Confirmed correct for Stripe signature verification (which requires the exact bytes Stripe sent).

==================================================================
BONUS FINDINGS (discovered during audit)
==================================================================

J1. ❌ BUG · src/lib/stripe.ts:240-243 — `getOrgPlan` uses `|| fallback` for maxUsers/maxTables/maxReservations, which converts `NULL` (meaning "unlimited") to a numeric fallback. Enterprise has `max_tables=NULL, max_users=NULL, max_reservations=NULL` (0017:155-161). So enterprise users see `maxTables: 15, maxUsers: 3, maxReservations: 500` in the UI — WRONG. The UI then shows "X/15 tables" and would block them at 15 even if checkLimit were called (it isn't — see F1). Professional has `max_reservations=NULL` (0017:147) → also wrongly capped to 500.
```ts
// stripe.ts:240-243
maxUsers: plan?.max_users || 3,
maxTables: plan?.max_tables || 15,
maxReservations: plan?.max_reservations || 500,
```
Fix — use nullish coalescing (`??`) and let `null` mean unlimited:
```ts
maxUsers: plan?.max_users ?? null,
maxTables: plan?.max_tables ?? null,
maxReservations: plan?.max_reservations ?? null,
```
(Update the TypeScript return type accordingly — already declares `number | null` for these fields, so the runtime just needs to match.)

J2. ⚠️ WARN · src/lib/stripe.ts:104-142 — `ensureStripePrice` calls `stripe.products.list({ limit: 100 })` and `stripe.prices.list({ product, limit: 10 })` on EVERY checkout request. With >100 products in the account, the lookup silently misses existing products and creates a duplicate. Cache the price_id in `subscription_plans.stripe_price_id_monthly` / `stripe_price_id_yearly` columns (which migration 0017:17-18 already provisions — currently unused!).

J3. ⚠️ WARN · src/app/api/admin/billing/route.ts:36 — MRR/ARR calculation treats yearly subscriptions the same as monthly (`mrr = price` regardless of cycle). A yearly subscriber paying 566€/yr should count as 47.17€/mo MRR, not 566€/mo. Fix: `const mrr = s.billing_cycle === 'yearly' ? price / 12 : price;`.

J4. ⚠️ WARN · src/app/api/billing/subscription/route.ts:60-69 — The local `cancel_at_period_end: true` UPDATE happens AFTER `await cancelSubscription(...)` returns. If the Stripe call succeeds but the DB UPDATE fails (network blip), the DB says "not canceled" while Stripe says "will cancel at period end". The webhook `customer.subscription.updated` will reconcile on next fire — usually fine, but if Stripe never fires it (rare), the UI lies. Fix: rely solely on the webhook for state; the local UPDATE is a UX optimization that should be wrapped in try/catch + toast warning on failure (it currently isn't).

J5. ⚠️ WARN · src/lib/stripe.ts:8-16 — `STRIPE_SECRET_KEY` falls back to `""` and `getStripe()` returns `null` if missing. This means in dev without a key, `createCheckoutSession`, `createPortalSession`, etc. all return `null`, and callers return generic 503 errors. Acceptable for dev, but in production this should hard-fail at boot (`throw new Error('STRIPE_SECRET_KEY required')` at module load) — silent 503s on billing are dangerous.

==================================================================
SUMMARY
==================================================================

CRITICAL (production-blocking or revenue-affecting):
  A4/A5 — Middleware blocks Stripe webhook with 401 (webhook never receives events) — BREAKS ALL BILLING.
  B2/B3 — invoices/payment_methods upserts missing `onConflict` → 500 on every Stripe retry → infinite retry loop.
  E1 — getOrCreateCustomer race + bad upsert → orphaned Stripe customers + silently-dropped webhooks.
  F1/F2 — checkLimit defined but never called → users on Starter can create unlimited tables/users/restaurants.
  G2/G3 — trial_ends_at never checked → trials never expire → revenue leakage.

HIGH:
  B1 — subscription_history lacks idempotency → duplicate history rows on Stripe retry.
  D2 (bonus) — customer.subscription.updated doesn't update plan_id → plan changes via Stripe portal invisible to app.
  J1 — getOrgPlan converts NULL (unlimited) limits to 15/3/500 → enterprise users see wrong limits in UI.
  G1 — trial setup inconsistent between migration-seeded orgs (professional trial) and new orgs (starter trial, no trial_ends_at).

MEDIUM:
  A3 — STRIPE_WEBHOOK_SECRET missing silently → 400 with no log.
  C1/C2 — no in-flight guard on checkout → duplicate sessions on double-click.
  D3 (bonus) — customer.subscription.deleted doesn't clear stripe_subscription_id → stale state on resubscribe.
  I1/I2 — webhook route missing explicit `runtime='nodejs'` and `dynamic='force-dynamic'` exports.
  J2 — ensureStripePrice lists all products/prices on every checkout (no caching).
  J3 — admin MRR/ARR treats yearly as monthly.
  J4 — local cancel UPDATE not wrapped in try/catch.
  J5 — STRIPE_SECRET_KEY missing silently returns null instead of throwing at boot.

OK (no action needed):
  A1, A2, I3 (signature verification, raw body, req.text) — correct.
  C3 — webhook-vs-mid-checkout ordering — fine.
  D1, D4, D5 — checkout.completed plan_id update, cancel/reactivate state — correct (D1 has minor caveat).
  E2 — stripe_customer_id saved on first checkout (correct design; just undermined by E1 bug).
  H1, H2, H3 — pricing consistent across stripe.ts, BillingSection.tsx, and migration 0017.

==================================================================
NEXT ACTIONS (recommended for a follow-up `audit-7-fix` task)
==================================================================
1. CRITICAL: Add `/api/stripe/webhook` to middleware's bypass list AND to the matcher's negative lookahead. Without this, billing is completely non-functional in any deployed environment (Stripe cannot deliver a single event).
2. CRITICAL: Add `onConflict: 'stripe_invoice_id'` and `onConflict: 'stripe_payment_method_id'` to the two upserts in the webhook handler. One-line fixes each.
3. CRITICAL: Wire `checkLimit` into POST /api/tables, POST /api/restaurants, POST /api/users, POST /api/reservations (and any other resource-creating routes). Return 402 with a "upgrade your plan" message when `!allowed`.
4. CRITICAL: Add a daily pg_cron job (or a request-time guard in `getCurrentUser`) that flips `status='trial'` rows with `trial_ends_at < now()` to a downgraded/locked state. Without this, trials never expire.
5. CRITICAL: Fix `getOrCreateCustomer` — pass `onConflict: 'organization_id'` AND wrap customer creation in an idempotency guard (advisory lock or unique constraint + retry). Optionally delete the orphaned Stripe customer if the race was lost.
6. HIGH: Add a `processed_events` table keyed on `event.id`; check it at the top of the webhook handler, insert at end. Eliminates B1, B2, B3 in one shot.
7. HIGH: Fix `getOrgPlan` to use `??` instead of `||` so NULL means "unlimited" (matches the DB schema and the TS return type).
8. HIGH: Add `plan_id` update + `subscription_history` insert to the `customer.subscription.updated` webhook handler so Stripe-portal plan changes are reflected.
9. MEDIUM: Add explicit `runtime='nodejs'` and `dynamic='force-dynamic'` to the webhook route.
10. MEDIUM: Cache Stripe price IDs in `subscription_plans.stripe_price_id_{monthly,yearly}` (columns already exist from 0017) to avoid list-and-search on every checkout.
11. MEDIUM: Create the `organization_subscriptions` row in `/api/auth/register` with consistent trial values (plan=starter or professional — pick one — and `trial_ends_at = now()+30d`).
12. MEDIUM: Fix admin MRR/ARR to divide yearly prices by 12.
13. LOW: Have BillingSection.tsx import PLANS from `@/lib/stripe` instead of redeclaring.
14. LOW: Throw at boot if `STRIPE_SECRET_KEY` is missing in production (NODE_ENV=production).

This was a READ-ONLY audit. No source files were modified. Recommended next task: `audit-7-fix` to patch the 5 CRITICAL items (middleware bypass, upsert onConflict, checkLimit wiring, trial expiry, getOrCreateCustomer race) — these together unblock production billing. The HIGH/MEDIUM items can follow in `audit-7-hardening`.

---
Task ID: audit-10-11
Agent: Explore (Read-Only Audit)
Task: AUDIT (read-only) emails, WhatsApp, and web-import subsystems. Be VERY THOROUGH.

Scope inspected:
- src/lib/email.ts (476 lines)
- src/lib/email-processor.ts (186 lines)
- src/lib/whatsapp.ts (345 lines)
- src/lib/web-import.ts (846 lines)
- src/app/api/whatsapp/webhook/route.ts
- src/app/api/whatsapp/status/route.ts
- src/app/api/restaurant/import-web/route.ts
- src/app/api/auth/register/route.ts (email-sending sites)
- src/app/api/auth/forgot-password/route.ts
- src/app/api/reservations/route.ts (email-sending sites)
- supabase/migrations/0012_whatsapp_messages.sql
- supabase/migrations/0013_import_jobs.sql
- supabase/migrations/0015_transfer_rpc.sql (email_queue table)
- scripts/apply-missing-migrations.sql

Methodology: file read + targeted ripgrep across src/ for queue processors, signature-verification primitives (createHmac, timingSafeEqual), escaping primitives (escapeHtml, DOMPurify, xss), and references to "X-Hub-Signature". No files were modified.

================================================================================
# 1. EMAILS — Findings
================================================================================

## 1.1 ❌ BUG (CRITICAL) — Email queue processor is DEAD CODE (never started)
File: src/lib/email-processor.ts:20
Code:
```
export function startEmailProcessor() {
  if (intervalHandle) return;
  logger.info("Email queue processor started", "email-queue");
  intervalHandle = setInterval(processEmailQueue, PROCESS_INTERVAL);
  processEmailQueue().catch(() => {});
}
```
Evidence: ripgrep across the entire project (`src/`, root) shows `startEmailProcessor` is only defined — it is NEVER imported or invoked. There is no `instrumentation.ts`, no `app/api/cron/email/route.ts`, no other caller.
Impact: `email.ts:sendEmail` does 5 in-process retries with exponential backoff. On final failure (or when `getClient()` returns null), the email is written to `email_queue` with `status: "queued"`. Because the processor is never started, queued rows accumulate forever. Password-reset emails, welcome emails, reservation confirmations — anything that fails transiently (e.g. Resend 429/500) is silently lost from the user's perspective. `getQueueStats()` will report ever-growing `queued` counts, but nothing drains them.
Fix:
1. Add `src/instrumentation.ts`:
   ```ts
   export async function register() {
     if (process.env.NEXT_RUNTIME === "nodejs") {
       const { startEmailProcessor } = await import("@/lib/email-processor");
       startEmailProcessor();
     }
   }
   ```
   (Next.js auto-detects `instrumentation.ts`; register() runs once per Node process at boot.)
2. OR add a Vercel Cron route `app/api/cron/email-queue/route.ts` protected by a CRON_SECRET header that calls `processEmailQueue()` directly.
3. Wire `startEmailProcessor()` into any existing boot hook (e.g. alongside Stripe webhook setup if any).

## 1.2 ❌ BUG (HIGH) — `logEmailToDb` does not actually await its DB write
File: src/lib/email.ts:440-469
Code:
```
export async function logEmailToDb(log: EmailLog, organizationId?: string) {
  try {
    if (!supabaseAdmin) return;
    // Best-effort — don't await in the caller
    supabaseAdmin.from("audit_logs").insert({
      ...
    }).then(({ error }: any) => {
      if (error) console.warn("[email] Failed to log to audit_logs:", error.message);
    });
  } catch {
    // silent
  }
}
```
Issue: The inner `supabaseAdmin.insert(...).then(...)` is a Promise that is never awaited. The outer `async` returns immediately. `sendEmailAndLog` awaits `logEmailToDb` (`await logEmailToDb(log, opts.organizationId);`), but the await is effectively a no-op. On a serverless function that returns immediately after, the insert can be cancelled (Vercel/lambda freeze).
Fix: Either `await` the promise inside `logEmailToDb`, or change it to fire-and-forget semantics with `void supabaseAdmin...insert()` and explicitly document it.

## 1.3 ⚠️ WARN (HIGH) — Silent failure when RESEND_API_KEY is unset in production
File: src/lib/email.ts:101-117
Code:
```
// Dev mode: no API key, just log
if (!RESEND_API_KEY) {
  console.log(`\n📧 [EMAIL · DEV MODE] ──────────────────────`);
  ...
  return {
    to: opts.to,
    subject: opts.subject,
    status: "dev_logged",
    attempt,
    sentAt,
  };
}
```
Issue: There is no NODE_ENV check. If `RESEND_API_KEY` is accidentally unset in production (misconfigured env, missing secret), all emails are silently swallowed and only logged to console. No alerting. No error. The user-facing flows (registration, password reset) appear to succeed but no email arrives. Worst case: a user can't reset password and there's no signal.
Fix:
```
if (!RESEND_API_KEY) {
  if (process.env.NODE_ENV === "production") {
    console.error("[email] FATAL: RESEND_API_KEY not set in production — email cannot be sent");
    await queueEmail(opts, "RESEND_API_KEY not configured");
    return { ...opts, status: "queued", error: "RESEND_API_KEY not configured" };
  }
  // ... existing dev log ...
}
```

## 1.4 ⚠️ WARN (HIGH) — No XSS / HTML-escaping in email templates (HTML injection)
File: src/lib/email.ts:240-436 (all templates), esp. `welcome`, `passwordReset`, `emailVerification`, `reservationConfirmation`, `reservationReminder`, `staffNotification`
Code (representative):
```
welcome({ name, restaurantName, loginUrl }: ...) {
  const html = WRAPPER(`
    <h1 ...>¡Bienvenido a RestoPanel, ${name}! 👋</h1>
    <p ...>Tu restaurante <strong ...>${restaurantName}</strong> ya está creado...</p>
    ...
```
And `BUTTON`:
```
const BUTTON = (text: string, href: string) => `
  <a href="${href}" ...>${text}</a>
`;
```
Issue: `name`, `customerName`, `restaurantName`, `message`, `title`, `zone`, `cancelUrl` are interpolated raw. The reservation confirmation email is fired from `/api/reservations` where `customerName` is fully unauthenticated-CRM user-controlled (anyone can POST a reservation). An attacker can submit `customerName: '<img src=x onerror=alert(1)>'`. Email clients (Gmail/Outlook) generally strip `<script>` and `onerror`, but they DO render `<a href=phishing>` and `<form>`. So phishing payloads against the restaurant's own customers are feasible. `BUTTON`'s `href` is built from `${baseUrl}/cancel-reservation?id=...` — `baseUrl` is `process.env.NEXTAUTH_URL`, so it's safe today, but `resetUrl`/`verifyUrl`/`cancelUrl` would be dangerous if any of them ever include user input. No `escapeHtml`/`DOMPurify` import anywhere in `src/` (ripgrep confirmed: 0 matches).
Fix: Add a `escapeHtml` util:
```
const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
```
And apply to every user-supplied field interpolated into HTML. Validate `href` with `new URL(href)` and require `http:`/`https:` protocol before interpolation.

## 1.5 ⚠️ WARN (MEDIUM) — Email queue "delivered" status is unverified
File: src/lib/email.ts:147-154
Code:
```
return {
  to: opts.to,
  subject: opts.subject,
  status: "delivered",   // <-- optimistic
  attempt,
  messageId: data?.id,
  sentAt,
};
```
Issue: Resend returns 200 + message ID when it accepts the email — this means "accepted by Resend", not "delivered to inbox". True delivery requires Resend webhooks (sent/delivered/bounced/opened) — none are wired up. The `email_queue` schema has a `bounced` status (migration 0015) but nothing ever sets it.
Fix: Add `POST /api/email/webhook` that verifies the Resend webhook signature and updates `email_queue.status` to `delivered`/`bounced` based on `event.type`. Update `sendEmail` to return `status: "sent"` (not `"delivered"`) until the webhook confirms delivery.

## 1.6 ⚠️ WARN (MEDIUM) — No dedicated email_logs table; audit_logs overload
File: src/lib/email.ts:442-465
Code:
```
// We don't have a dedicated email_logs table, so we use audit_logs
if (!supabaseAdmin) return;
supabaseAdmin.from("audit_logs").insert({ action: "EMAIL_SENT", ... });
```
Issue: Mixing email-send telemetry with security audit events (login, role changes, etc.) makes audit queries noisier and breaks RBAC separation (audit_logs is super-admin-only, but tenant admins should arguably see their own email stats). The `email_queue` table already exists and tracks everything needed; the duplicate `audit_logs` insert is redundant.
Fix: Drop the `audit_logs` insert for successful sends. Keep `email_queue` as the single source of truth for email state. Optionally expose a tenant-scoped view of `email_queue` via a new policy.

## 1.7 ⚠️ WARN (LOW) — In-process retry blocks the request thread
File: src/lib/email.ts:155-176
Code:
```
} catch (err: any) {
  if (attempt < MAX_ATTEMPTS) {
    const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
    console.warn(`[email] Attempt ${attempt} failed, retrying in ${delay}ms: ${err.message}`);
    await sleep(delay);
    return sendEmail({ ...opts, _attempt: attempt + 1 });
  }
  ...
}
```
Issue: With 5 attempts and `BASE_DELAY_MS = 2000`, worst-case total wait = 2+4+8+16+32 = 62 seconds. `await sleep(delay)` blocks the request handler. The reservations route fires this in a `.catch(()=>{})` (fire-and-forget), so the user response is fine — but the register route does `await sendEmailAndLog(...)` twice (welcome + verification) synchronously, so a new tenant can wait 124 s before the API responds. On Vercel this hits the function timeout (10 s default, 60 s on Pro).
Fix: Always fire-and-forget from route handlers (queue + return immediately), and let the background processor do the retries against `email_queue`. Reduce MAX_ATTEMPTS in-process to 1 (or 2), then queue for the remaining retries.

## 1.8 ✅ OK — Retry math (exponential backoff, capped attempts)
File: src/lib/email.ts:64-65, 158
Both in-process (`email.ts`) and DB-driven (`email-processor.ts:134`) backoffs use `BASE * 2^(attempt-1)` and respect `MAX_ATTEMPTS = 5`. `email_queue.max_attempts` is set per-row. The DB processor correctly increments `attempts` and schedules `next_attempt_at`. (The only issue is the processor isn't started — see 1.1.)

## 1.9 ✅ OK — Email templates cover the right surface
Templates present: `welcome`, `passwordReset`, `emailVerification`, `reservationConfirmation`, `reservationReminder`, `staffNotification`. All have HTML + text variants. Call sites: register (welcome + verify), forgot-password (reset), reservations (confirmation). Reminder template exists but is not currently invoked anywhere (no scheduled job) — that's a feature gap, not a bug.

================================================================================
# 2. WHATSAPP — Findings
================================================================================

## 2.1 ❌ BUG (CRITICAL) — WhatsApp webhook has NO signature verification
File: src/app/api/whatsapp/webhook/route.ts:39-78
Code:
```
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.info("[whatsapp] Webhook received:", JSON.stringify(body).substring(0, 500));
    if (body.object) {
      if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const text = message.text?.body || "";
        ...
        // Here we would:
        // 1. Look up the customer by phone number
        // 2. Store the message in the CRM
        // 3. Trigger auto-replies if configured
      }
      ...
      return NextResponse.json({ ok: true });
    }
```
Issue: Meta requires verifying `X-Hub-Signature-256` (HMAC-SHA256 of the raw body using `WHATSAPP_APP_SECRET`). This code does NOT verify anything. ripgrep confirms zero matches for `X-Hub-Signature`, `createHmac`, `crypto.verify`, or `timingSafeEqual` in the entire `src/`. Today the handler is a stub (just logs) so impact is limited — but the moment someone implements step "1. Look up customer... 2. Store in CRM... 3. Trigger auto-replies", any attacker can POST a spoofed message webhook and inject fake customer messages, trigger arbitrary auto-replies, and exfiltrate customer data via auto-reply content.
Fix: Implement signature verification:
```ts
import crypto from "crypto";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET!;
const raw = await req.text();
const sig = req.headers.get("x-hub-signature-256") || "";
const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return new NextResponse("Forbidden", { status: 403 });
}
const body = JSON.parse(raw);
```

## 2.2 ❌ BUG (CRITICAL) — WhatsApp queue is in-memory only; lost on server restart
File: src/lib/whatsapp.ts:120, 194-231
Code:
```
const queue: QueuedMessage[] = [];
...
async function processQueue() {
  if (processorRunning) return;
  processorRunning = true;
  try {
    const now = Date.now();
    const ready = queue.filter((m) => m.nextAttemptAt <= now && m.attempts < MAX_ATTEMPTS);
    for (const msg of ready) { ... }
  } finally {
    processorRunning = false;
  }
}
```
Issue: `queue` is a module-level array. On any serverless cold-start, server restart, or deployment, it's wiped. The code DOES persist each message to `whatsapp_messages` table via `logMessageToDb(msg, "queued")` on enqueue — but `processQueue` only iterates the in-memory `queue`, never the DB rows. So a queued message that hasn't been processed before the process dies stays in the DB with `status="queued"` forever, and is never retried. (Same problem for `status="retrying"` rows.) The email-processor got this right (reads from DB); the whatsapp processor did not.
Fix: Either (a) change `processQueue` to query `whatsapp_messages where status in ('queued','retrying') and next_attempt_at <= now() limit N`, mutate in DB, and skip the in-memory array entirely; or (b) on boot, rehydrate the in-memory `queue` from the DB.

## 2.3 ❌ BUG (HIGH) — WhatsApp queue processor never started
File: src/lib/whatsapp.ts:235-242
Code:
```
export function startWhatsAppProcessor() {
  if (intervalHandle) return;
  if (!WHATSAPP_TOKEN) {
    console.log("[whatsapp] WHATSAPP_TOKEN not set — running in dev/log mode");
  }
  intervalHandle = setInterval(processQueue, 10000);
  console.log("[whatsapp] Queue processor started (10s interval)");
}
```
Issue: Same as email — `startWhatsAppProcessor` is exported but never imported or invoked anywhere (ripgrep confirms only the definition matches). Even if 2.2 were fixed, no scheduler ever drains the queue.
Fix: Add `instrumentation.ts` (same fix as 1.1) that also calls `startWhatsAppProcessor()` in the Node runtime. Note that `setInterval` does NOT survive Vercel serverless freezes — for Vercel, use Vercel Cron (`vercel.json` cron + a CRON_SECRET-protected route that calls `processQueue()`).

## 2.4 ⚠️ WARN (HIGH) — Webhook verify-token has a hardcoded default
File: src/app/api/whatsapp/webhook/route.ts:19
Code:
```
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "restopanel_verify_2026";
```
Issue: If the env var is unset (which is the default state in dev, and a common misconfiguration in prod), the verify token defaults to a publicly-known string. Anyone can subscribe a malicious webhook pointing at this server using the leaked default. While the POST handler is currently a stub, this would let an attacker hijack the webhook URL slot in a victim's Meta Business Manager (if they have access to it) — Meta rejects duplicate webhook URLs only by verification, so this enables persistent hijacking.
Fix: Refuse to start the GET handler if the env var is unset:
```
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
if (!VERIFY_TOKEN) {
  return new NextResponse("Webhook not configured", { status: 503 });
}
```
Also use `crypto.timingSafeEqual` for the token compare (currently `===`).

## 2.5 ⚠️ WARN (HIGH) — Templates hardcoded; no Meta-approval check or fallback
File: src/lib/whatsapp.ts:43-104, 150-191
Code:
```
reservationConfirmation: (data) => ({
  text: `¡Hola! Tu reserva en *${data.restaurantName}* ...`,
  template: {
    name: "reservation_confirmation",
    language: { code: "es" },
    components: [{ type: "body", parameters: [...] }],
  },
}),
...
async function sendViaWhatsAppAPI(to, text, template) {
  ...
  if (template) {
    body.type = "template";
    body.template = template;
  } else if (text) {
    body.type = "text";
    body.text = { body: text };
  }
```
Issue: Templates must be pre-approved in Meta Business Manager. There is no check anywhere (no API call to `/message_templates`, no env-var override, no admin UI) — the code blindly sends `reservation_confirmation`/`reservation_reminder` as type=template. If those names aren't approved, Meta returns 422 with `(#132012) Template name does not exist in the translation...`. The code then retries (3×), each retry sends the same template, all fail, message is marked `failed`. There is no fallback to free-text (which is what the `text` field is for, and which works in the 24h customer-service window after the customer's first message).
Fix: On a 4xx template error, immediately retry once with `type: "text"` using `msg.text` (the reservation confirmation flow IS customer-initiated — the customer just submitted the reservation — so the 24h window is open). Optionally cache approved template names on boot via `GET /v21.0/{phone_id}/message_templates` and only attach `template` if the name is approved.

## 2.6 ⚠️ WARN (MEDIUM) — Phone-number validation is too lax
File: src/lib/whatsapp.ts:160
Code:
```
to: to.replace(/[^0-9]/g, ""),
```
Issue: Strips everything non-digit. Accepts `"abc12345"` → `"12345"`. No E.164 validation (length 6-15, leading country code). Reservation form submits phone as free-text. If the WhatsApp token is configured, the system will attempt to send to invalid numbers, generating 422s and burning the retry budget.
Fix:
```
const normalize = (s: string) => {
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length < 6 || digits.length > 15) throw new Error("Invalid phone");
  return digits;
};
```

## 2.7 ⚠️ WARN (MEDIUM) — Webhook logs full body to console (PII)
File: src/app/api/whatsapp/webhook/route.ts:44
Code:
```
console.info("[whatsapp] Webhook received:", JSON.stringify(body).substring(0, 500));
...
console.info(`[whatsapp] Message from ${from}: ${text.substring(0, 100)}`);
```
Issue: Phone numbers + message text are PII. In production with structured logging (Vercel/Datadog/Logflare) these end up in log aggregators with weak retention controls. GDPR risk.
Fix: Log only `message_id`, `from` SHA-256-hashed, and `timestamp`. Never log `text`.

## 2.8 ✅ OK — Verify-token GET flow (when env is set)
File: src/app/api/whatsapp/webhook/route.ts:22-36
The `hub.mode === "subscribe" && token === VERIFY_TOKEN` then return `challenge` flow is correct per Meta's spec. Only issues are the default-token (2.4) and non-timing-safe compare.

## 2.9 ✅ OK — Retry math
File: src/lib/whatsapp.ts:121-122, 222
`MAX_ATTEMPTS = 3`, `BASE_DELAY_MS = 5000`, exponential `BASE * 2^(attempt-1)` = 5s/10s/20s. Correctly stops at MAX_ATTEMPTS and marks `failed`.

================================================================================
# 3. WEB IMPORT — Findings
================================================================================

## 3.1 ❌ BUG (CRITICAL) — SSRF protection is bypassable via HTTP redirects
File: src/lib/web-import.ts:169-204
Code:
```
async function fetchHtml(url: string, timeoutMs = 12000): Promise<...> {
  // SSRF check
  if (isPrivateUrl(url)) {
    throw new Error("URL apunta a una dirección privada o interna (no permitida)");
  }
  ...
  const resp = await fetch(url, {
    signal: controller.signal,
    headers: {...},
    redirect: "follow",     // <-- !!!
  });
  ...
  return { html, finalUrl: resp.url || url, ... };
}
```
Issue: `isPrivateUrl(url)` is only checked on the *initial* URL. `redirect: "follow"` lets fetch follow 30x redirects to ANY URL — including `http://169.254.169.254/`, `http://localhost/`, internal VPC services. The returned `finalUrl` is then passed to `parseRobots(finalUrl)` and `parseSitemap(finalUrl)`, which fetch `/robots.txt` and `/sitemap.xml` of the (potentially-internal) host. So a single attacker-controlled URL `https://evil.com/redirect?to=http://169.254.169.254/` bypasses everything.
Fix: Set `redirect: "manual"`, then loop: for each `Location` header, run `isPrivateUrl(loc)` and `new URL(loc).hostname`-based DNS resolution check (see 3.2). Refuse to follow more than 5 redirects. Cap total redirect bytes.

## 3.2 ❌ BUG (CRITICAL) — SSRF check is string-only, no DNS resolution (DNS rebinding + encoding bypass)
File: src/lib/web-import.ts:141-166
Code:
```
function isPrivateUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
    if (host === "::1" || host === "[::1]") return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
    if (host === "169.254.169.254") return true;
    if (host === "metadata.google.internal") return true;
    if (/^169\.254\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch { return true; }
}
```
Issue: This is hostname-string matching, NOT IP resolution. Multiple bypasses:
- **DNS rebinding / A-record-to-internal**: Register `evil.com` with A record `127.0.0.1` (or `169.254.169.254`). The regex doesn't match `evil.com`, so it passes. `fetch()` then connects to the internal IP. This is the classic SSRF bypass.
- **Encoded IPs**: `2130706433` (decimal for 127.0.0.1), `0x7f000001` (hex), `0177.0.0.1` (octal), `127.1` (short form) all parse to 127.0.0.1 via `URL` but bypass the regexes.
- **IPv6-mapped IPv4**: `::ffff:127.0.0.1` and `::ffff:7f00:1` reach 127.0.0.1 but bypass `::1` check.
- **IPv6 ULA**: `fc00::`/`fd00::` (unique-local) not blocked. `fec0::` (site-local deprecated) not blocked.
- **Other cloud metadata**: AWS IMDSv1 at `169.254.169.254` IS blocked. But Azure `169.254.169.254/metadata/instance` (same IP, blocked). GCP `metadata.google.internal` IS blocked. Alibaba `100.100.100.200` NOT blocked. Oracle `169.254.169.254/opc/v2/` IS blocked (same IP). DigitalOcean `169.254.169.254/metadata/v1.json` IS blocked (same IP). ChinaCloud `100.100.100.200` NOT blocked.
Fix:
```ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

async function isPrivateResolved(hostname: string): Promise<boolean> {
  // Resolve hostname to IPs and check each
  try {
    const addrs = await lookup(hostname, { all: true });
    for (const a of addrs) {
      const ip = a.address;
      if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
      if (ip.startsWith("10.")) return true;
      if (ip.startsWith("192.168.")) return true;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
      if (ip.startsWith("169.254.")) return true;
      if (ip.startsWith("fc") || ip.startsWith("fd")) return true;       // IPv6 ULA
      if (ip.startsWith("fe80")) return true;                            // IPv6 link-local
      if (ip.startsWith("::ffff:")) return isPrivateResolved(ip.slice(7)); // IPv4-mapped
      if (ip === "100.100.100.200") return true;                         // Alibaba metadata
    }
    return false;
  } catch { return true; }
}
```
And call `await isPrivateResolved(new URL(url).hostname)` BEFORE `fetch()` AND on every redirect target (see 3.1).

## 3.3 ❌ BUG (HIGH) — Sitemap parser fetches arbitrary attacker-controlled URLs without SSRF check
File: src/lib/web-import.ts:215-252
Code:
```
for (const smUrl of sitemapUrls) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(smUrl, {        // <-- smUrl is /sitemap.xml of baseUrl — same origin OK
      signal: controller.signal,
      ...
    });
    ...
    const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/gi);
    for (const m of matches) {
      const u = m[1].trim();                // <-- attacker-controlled
      if (u.startsWith("http")) {
        if (u.endsWith(".xml")) {
          // Recurse into nested sitemap (1 level deep)
          try {
            const r2 = await fetch(u, { signal: AbortSignal.timeout(8000) });   // <-- !!! NO SSRF CHECK ON `u` !!!
            const xml2 = await r2.text();
            ...
          } catch {}
        } else {
          urls.push(u);
        }
      }
    }
```
Issue: The user submits `https://evil.com/` (attacker-controlled restaurant URL). `parseSitemap` fetches `https://evil.com/sitemap.xml` (same origin, OK). That sitemap contains `<loc>http://169.254.169.254/.xml</loc>`. The code then fetches that internal metadata URL directly via `fetch(u)` — `isPrivateUrl` is NEVER called on `u`. This is a direct, unauthenticated-to-the-target SSRF vector (only the submitter needs to be a logged-in tenant admin, which is trivial).
Also: `parseRobots(finalUrl)` (line 263) calls `fetch(robotsUrl, ...)` on `finalUrl`, which after a redirect (see 3.1) can be an internal URL.
Fix: Wrap ALL `fetch()` calls in this module (sitemap, robots, nested sitemap, sub-pages) with the same `fetchHtml()` helper that does SSRF checks. Specifically, replace the bare `fetch(u, ...)` in the nested sitemap block with `await fetchHtml(u, 8000)` — but note that fetchHtml requires `text/html` content-type, so add a `fetchRaw(url, timeoutMs)` variant that does SSRF+timeout but allows any content-type for sitemap/robots XML.

## 3.4 ⚠️ WARN (HIGH) — `import_html_cache` table has no eviction / size cap
File: src/lib/web-import.ts:126-136; migration 0013:50-58
Code:
```
async function setCachedHtml(url: string, html: string, statusCode: number): Promise<void> {
  try {
    await supabaseAdmin.from("import_html_cache").upsert({
      url, html, status_code: statusCode,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch {}
}
```
Migration:
```
create table if not exists import_html_cache (
  url         text primary key,
  html        text not null,
  status_code int,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);
```
Issue: HTML is truncated at 2 MB per fetch (`email.ts:198`). 10 imports per 10 minutes per user (rate limit), 1440 minutes/day = 1440 imports/day per user. With multiple tenants, the table grows unbounded. `expires_at` is set but nothing DELETES expired rows. No TTL job, no row-size guard. A single malicious tenant can fill DB storage with 2 MB × 1440 = 2.88 GB/day.
Fix: Add a daily cron job: `DELETE FROM import_html_cache WHERE expires_at < now()`. Also cap `html` column with `CHECK (octet_length(html) < 2100000)` and consider storing in S3/R2 instead of DB.

## 3.5 ⚠️ WARN (MEDIUM) — No protection against long-running orphaned jobs
File: src/lib/web-import.ts:622-633, 824-832
Code:
```
const { data: jobRow, error: jobError } = await supabaseAdmin
  .from("import_jobs")
  .insert({ organization_id, url, status: "running", progress: 0, progress_label: "Iniciando...", started_at: new Date().toISOString() })
  .select().single();
...
} catch (error: any) {
  await updateJob({ status: "failed", error: error.message, completed_at: new Date().toISOString(), ... });
  throw error;
}
```
Issue: If the process dies mid-import (serverless timeout, OOM kill, deploy mid-flight), the `catch` never runs and the row stays `status="running"` forever. The UI shows a perpetually-running job. No reaper. Same problem on the GET history endpoint — no filter for stale `running` rows.
Fix: Add a cron route that marks any `import_jobs.status="running"` with `started_at < now() - interval '15 minutes'` as `failed` with `error="Timed out"`. Also add a `UNIQUE(url, organization_id)` partial index on `status in ('queued','running')` to prevent two concurrent imports of the same URL by the same tenant.

## 3.6 ⚠️ WARN (MEDIUM) — Rate limiter is in-memory and per-process
File: src/app/api/restaurant/import-web/route.ts:14-42
Code:
```
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const attempts = new Map<string, number[]>();  // timestamps array
...
function rateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = attempts.get(key) || [];
  const recent = timestamps.filter(ts => now - ts < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  attempts.set(key, recent);
  return false;
}
```
Issue: In-memory `Map` is per-process. On Vercel serverless (multiple concurrent instances), each instance has its own map, so the effective limit becomes `MAX_PER_WINDOW × instance_count`. An attacker cycling across instances gets 10× the limit. The forgot-password route has the same issue (`attempts` Map per process). The codebase's own `src/lib/rate-limit.ts` has the same design with a comment "For production with multiple instances, use Redis instead."
Fix: Move to Upstash Redis (REST API, edge-compatible):
```
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();
const key = `import:${user.id}:${ip}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 600);
if (count > 10) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
```

## 3.7 ⚠️ WARN (MEDIUM) — Regex-based HTML parsers are fragile
File: src/lib/web-import.ts:307-336 (microdata), 287-305 (JSON-LD), 456-480 (heuristic)
Code (representative):
```
const itemscopeRegex = /<[^>]+itemscope[^>]*>([\s\S]*?)<\/(?:div|section|article|li)>/gi;
...
const nameMatch = block.match(/itemprop=["']name["'][^>]*>([^<]+)</i);
```
Issue: Pure regex parsing of HTML is brittle. Comment in code admits "This is a simplified regex-based parser — a full DOM parser would be more robust but we avoid external dependencies." Failure modes:
- Nested `<div itemscope>...<div itemscope>...</div>...</div>` — the non-greedy `([\s\S]*?)` matches up to the FIRST `</div>`, missing the outer scope's data.
- Self-closing tags `<div itemprop="name" />` — not matched.
- HTML entities (`&amp;`, `&#x2019;`) — not decoded.
- Attributes with `>` inside quoted values: `<div data-x="a>b" itemprop="name">` — broken.
- JSON-LD with `<script>` containing `</script>` inside a string literal — the regex stops early.
A real restaurant site (SquareSpace, Wix, WordPress Menu plugins) typically produces well-formed JSON-LD, but the heuristic fallback (line 457+) matches arbitrary `<h2>`, `<strong>`, `<li>` text near prices — this picks up navigation items, footer links, and headings that happen to be near a price string (e.g., near "Reserva: 5€").
Fix: Use `linkedom` (server-side DOM, no jsdom bloat) or `cheerio` (already a dep transitively via shadcn? confirm with `package.json`). Parse once, query with selectors. For JSON-LD, use `JSON.parse` (already done) but wrap each `<script>` extraction in a stateful parser that respects `</script>` only at the correct nesting.

## 3.8 ⚠️ WARN (LOW) — Microdata parser regex captures wrong closing tag
File: src/lib/web-import.ts:314
Code:
```
const itemscopeRegex = /<[^>]+itemscope[^>]*>([\s\S]*?)<\/(?:div|section|article|li)>/gi;
```
Issue: If an itemscope opens on a `<span>`, `<ul>`, `<tr>`, etc., the regex looks for `</div>`, `</section>`, `</article>`, or `</li>` — but the actual closing tag may be `</span>` etc. The block then either captures too much (until the next `</div>`) or too little. This silently drops valid menu items.
Fix: Use a DOM parser (see 3.7) — this entire regex-based microdata parser should be replaced.

## 3.9 ✅ OK — No RCE / path traversal surface
File: src/lib/web-import.ts (full file)
ripgrep confirms zero usage of `fs`, `child_process`, `exec`, `spawn`, `writeFile`, or any shell-escape primitive anywhere in `web-import.ts`. The only side-effecting writes are:
1. `import_jobs` table — INSERT/UPDATE via supabaseAdmin (parameterized, no SQL injection).
2. `import_html_cache` table — UPSERT via supabaseAdmin (parameterized).
3. `menu_items` table — INSERT via supabaseAdmin (parameterized).
4. `audit_logs` table — INSERT via `db.auditLogs.insert` (parameterized).
5. Network: outbound `fetch()` calls.
No file-system writes, no shell commands. The `applyNew` flag writes only to `menu_items` with hardcoded column names — no path component is taken from user input. No RCE/path-traversal risk in this module.

## 3.10 ✅ OK — Timeout on fetches
File: src/lib/web-import.ts:169, 218, 235, 240, 263
All `fetch()` calls have either `AbortController` with explicit `setTimeout(..., timeoutMs)` (main fetch: 12 s; sitemap: 8 s; nested sitemap: 8 s) or `AbortSignal.timeout(ms)` (robots: 5 s; sub-pages: 8 s). HTML capped at 2 MB. No unbounded fetch.

## 3.11 ✅ OK — Import jobs tracked in DB with full status
File: src/lib/web-import.ts:612-833, migration 0013
`import_jobs` table has `status` (queued/running/completed/failed/cancelled), `progress`, `progress_label`, `pages_crawled`, `items_detected`, `items_imported`, `result` (jsonb with full preview), `error`, `started_at`, `completed_at`, `created_at`, `updated_at`. RLS policies enforce tenant isolation + super-admin access. The job lifecycle is correctly maintained (only failure is the orphaned-job case in 3.5).

================================================================================
# Summary
================================================================================

Counts:
- ❌ BUG: 7 (1 in emails, 3 in whatsapp, 3 in web-import)
- ⚠️ WARN: 11 (5 in emails, 4 in whatsapp, 4 in web-import — some overlap)
- ✅ OK: 6

Top 5 priorities (by impact × likelihood):
1. CRITICAL — Web-import SSRF bypass via redirect (3.1) + DNS-rebinding (3.2) + sitemap-fetch SSRF (3.3). All three combine to make the web-import endpoint an open SSRF proxy for any authenticated tenant. Patch together.
2. CRITICAL — WhatsApp webhook has no signature verification (2.1). Currently a stub, but a footgun for the next dev who implements message handling.
3. CRITICAL — Both email queue (1.1) and WhatsApp queue (2.2, 2.3) processors are never started. Queues silently accumulate. User-visible: lost password resets, lost reservation confirmations.
4. HIGH — Email templates have no HTML escaping (1.4). Reservation confirmations are sent to untrusted customer-supplied emails with attacker-controlled `customerName` interpolated raw.
5. HIGH — WhatsApp templates have no fallback if not Meta-approved (2.5). All WhatsApp sends fail silently in any environment where templates aren't pre-approved.

This was a READ-ONLY audit. No source files were modified. Recommended next task: `audit-10-11-fix` to patch the 7 CRITICAL/HIGH items in priority order — items 1, 2, 3 above are unblockers for production; 4 and 5 are user-visible correctness bugs.

---
Task ID: audit-5-6-14
Agent: explore (Read-only audit)
Task: AUDIT RBAC, feature flags, and the build pipeline of RestoPanel at /home/z/my-project.

Scope:
  A. RBAC (src/lib/rbac.ts, src/app/api/roles/*, src/app/api/permissions/*)
  B. Feature flags (src/lib/feature-flags.ts)
  C. Build pipeline (next.config.ts, tsconfig.json, eslint.config.mjs, tsc, eslint)
  D. Hydration issues
  E. Dead code / unused imports

This was a READ-ONLY audit. No source files were modified.

================================================================================
# A. RBAC (Role-Based Access Control)
================================================================================

## A.1 ❌ BUG (CRITICAL) — `requirePermission` / `hasPermission` are never called by any API route
File: src/lib/rbac.ts (defines helpers) vs all src/app/api/** routes (don't import them).

Grep proves it:
  $ rg "requirePermission|hasPermission|hasAnyPermission|hasAllPermissions" src
  src/lib/rbac.ts:8:    //   import { hasPermission, requirePermission } from "@/lib/rbac";
  src/lib/rbac.ts:91:   export async function hasPermission(...)
  src/lib/rbac.ts:132:  export async function requirePermission(...)
  → 0 callers in src/app/api/**

The only consumers of `@/lib/rbac` are:
  src/app/api/permissions/route.ts  → getAllPermissions / getPermissionsForRole (UI listing only)
  src/app/api/roles/route.ts        → getAllRoles (UI listing only)

Every privileged API route still uses the legacy hardcoded check from src/lib/session.ts:
  if (!user || user.role !== 'ADMIN') return 401

So the entire RBAC layer (user_roles, role_permissions, permissions tables + 316-line service file) is dead code in production. The DB tables may exist but no route ever queries them to authorize a request.

Concrete fix: in every write route, replace `user.role !== 'ADMIN'` with:
  const auth = await requirePermission(user, "menu.manage")
  if (!auth.authorized) return auth.response!
and remove the legacy `requireAdmin()` helper in src/lib/session.ts.

## A.2 ❌ BUG — Roles are NOT loaded from DB for auth decisions
File: src/lib/session.ts:13-17
```ts
export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  return user
}
```
The session's `role` field is the legacy hardcoded 'ADMIN' | 'STAFF' | 'SUPER_ADMIN' value assigned at login time from `users.role` (src/lib/next-auth.ts:122, `role: user.role as 'ADMIN' | 'STAFF'`). It is never cross-referenced with `user_roles` / `role_permissions`. The DB RBAC tables exist in migration `0014_enterprise_rbac.sql` but are bypassed by the live auth flow.

## A.3 ⚠️ WARN — Session caches role for 30 days, RBAC changes don't propagate
File: src/lib/next-auth.ts:25
```ts
session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
```
Even if `assignRole()` were called (it isn't — see A.4), the user's JWT would keep the old `role` claim until they re-login or the JWT refreshes. The `jwt` callback only writes the role on initial sign-in (`if (user) { token.role = u.role }`) and never re-reads it from DB.

Concrete fix: in the `jwt({ token, trigger })` callback, when `trigger === 'update'` or on a periodic refresh, re-fetch the role from `user_roles` and overwrite `token.role`.

## A.4 ❌ BUG — `assignRole` / `updateRolePermissions` are never called by any route
File: src/lib/rbac.ts:207 (`assignRole`), src/lib/rbac.ts:275 (`updateRolePermissions`)
Grep for callers:
  $ rg "assignRole|updateRolePermissions" src/app/api
  → 0 results
There is no admin endpoint to change a user's role or to edit role→permission mappings. The "RBAC admin UI" surface implied by `/api/roles` and `/api/permissions` (which only do GET) is incomplete. Even if an admin clicks a hypothetical "Make this user MANAGER" button in the UI, no API route exists to persist it.

## A.5 ❌ BUG — STAFF CAN call /api/tables POST? No — but Reception CAN call /api/analytics (spec violation)
File: src/app/api/tables/route.ts:57-60 (POST)
```ts
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
```
This route is correctly locked to ADMIN — STAFF gets 401. ✅ for that specific question.

But /api/analytics GET:
File: src/app/api/analytics/route.ts:5-11
```ts
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const data = await db.analytics.getDashboard(user.organizationId)
  return NextResponse.json(data)
}
```
Any authenticated user — including STAFF, RECEPCION, or any future fine-grained role that the spec wants to block — can read the full tenant analytics dashboard. The spec says /api/analytics should be MANAGER+; current code lets any STAFF/RECEPTION user in.

Same pattern (auth-only, no role check) in:
- src/app/api/reservations/route.ts:44-46 (POST) — any STAFF can create reservations
- src/app/api/reservations/[id]/route.ts:7-9 (PATCH), :48-50 (DELETE) — any STAFF can edit/cancel any reservation
- src/app/api/orders/route.ts:51-53 (POST) — any STAFF can create orders
- src/app/api/orders/[id]/route.ts:11-13 (PATCH) — any STAFF can advance/cancel orders
- src/app/api/customers/[id]/route.ts:83-87 (PATCH), :134-138 (DELETE) — any STAFF can edit/delete any customer
- src/app/api/shifts/route.ts:35-37 (POST), src/app/api/shifts/[id]/route.ts:5-7 (PATCH), :32-34 (DELETE) — any STAFF can edit/delete shifts
- src/app/api/chat/messages/route.ts:27-29 (POST) — any STAFF can post chat messages
- src/app/api/chat/channels/route.ts:35-37 (POST) — any STAFF can create channels
- src/app/api/tables/transfer/route.ts:6-10 (POST) — any STAFF can transfer reservations between tables
- src/app/api/tables/group/route.ts:8-12 (POST), :54-58 (DELETE) — any STAFF can group/ungroup tables
- src/app/api/restaurant/import-web/route.ts:54-58 (POST) — any STAFF can trigger web imports (SSRF surface)
- src/app/api/billing/subscription/route.ts:6-10 (GET), :45-49 (POST) — any STAFF can read billing info and cancel/reactivate the subscription
- src/app/api/billing/checkout/route.ts:5-9 (POST) — any STAFF can initiate checkout for any plan
- src/app/api/billing/portal/route.ts (POST, inferred) — any STAFF can open the Stripe portal
- src/app/api/whatsapp/status/route.ts:6-10 (GET) — any STAFF can read WhatsApp config (token presence, phone ID)

Concrete fix: enforce `requirePermission(user, "<feature>.<action>")` at the top of each handler, returning `auth.response` if not authorized.

## A.6 ⚠️ WARN — RBAC cache (5-min TTL) is invalidated only by helpers that are themselves never called
File: src/lib/rbac.ts:21-26 (cache + TTL), :180-187 (`invalidateRbacCache`)
```ts
const rolePermissionsCache = new Map<string, { permissions: Set<string>; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;
...
export function invalidateRbacCache(roleId?: string) {
  if (roleId) { rolePermissionsCache.delete(roleId); }
  else { rolePermissionsCache.clear(); }
  userRoleCache.clear();
}
```
`invalidateRbacCache` is only called from `assignRole` and `updateRolePermissions` (rbac.ts:230, 284, 295, 313) — and per A.4 those functions are themselves never invoked by any route. So in practice the cache never gets invalidated today. If A.1 is fixed and RBAC starts being queried, an admin who changes a user's role would need to wait 5 minutes (or restart the server) for the change to take effect.

Concrete fix: when an admin endpoint to change roles is added, it MUST call `invalidateRbacCache(roleId)` and ideally also revoke the affected user's JWT (`revokeSession(user.id)` in session-management.ts).

## A.7 ⚠️ WARN — No central auth helper; each route rolls its own check
There is no shared `withPermission(handler, "perm")` wrapper. Every route hand-writes:
```ts
const user = await getCurrentUser()
if (!user || user.role !== 'ADMIN') return NextResponse.json({error:'No autorizado'}, {status:401})
```
This is brittle: easy to forget on a new route, easy to typo the role string, and impossible to audit centrally. The `requirePermission` helper in rbac.ts returns `{authorized, response?}` rather than throwing, so callers must remember to `return auth.response` — also error-prone.

Concrete fix: add a `withAuth(permission: string, handler: (user) => Promise<Response>)` HOF and migrate every route to it.

================================================================================
# B. Feature Flags (src/lib/feature-flags.ts)
================================================================================

## B.1 ❌ BUG (CRITICAL) — `isFeatureEnabled` is never imported by any route or component
File: src/lib/feature-flags.ts (defines it).
Grep proves it:
  $ rg "from ['\"]@/lib/feature-flags['\"]" src
  src/lib/feature-flags.ts:8:    //   import { isFeatureEnabled } from "@/lib/feature-flags";
  → 0 actual importers.
Same pattern as A.1: a 218-line service file that is dead code. The entire plan-gating promise ("Starter vs Professional vs Enterprise") is not enforced anywhere.

## B.2 ❌ BUG — Starter users can hit all Premium APIs directly
Spec question: "Can a Starter user access Premium features (WhatsApp, Advanced Analytics, Chat, Shifts) by hitting the API directly?"
Answer: YES, all of them. None of these routes check the feature flag:

  WhatsApp   src/app/api/whatsapp/status/route.ts:6-10     — only `if (!user || !user.organizationId)`
  WhatsApp   src/app/api/whatsapp/webhook/route.ts         — public (correct, Meta needs to reach it) but no signature verification (already flagged in prior audit)
  Chat       src/app/api/chat/messages/route.ts:6-7        — only auth check
  Chat       src/app/api/chat/channels/route.ts:6-7        — only auth check
  Shifts     src/app/api/shifts/route.ts:6-7               — only auth check
  Shifts     src/app/api/shifts/[id]/route.ts:6-7          — only auth check
  Analytics  src/app/api/analytics/route.ts:6-7            — only auth check (full dashboard returned to any tenant user)

Concrete fix: at the top of each handler:
```ts
const enabled = await isFeatureEnabled(user.organizationId, "whatsapp")
if (!enabled) return NextResponse.json({error:"FEATURE_NOT_ENABLED"}, {status:402})
```

## B.3 ❌ BUG — No URL-direct access protection
Spec question: "Does the page check the flag, AND does the API check the flag?"
Answer: NEITHER.

Sidebar (src/components/dashboard/Sidebar.tsx:44-45) hardcodes WhatsApp and Billing nav items for every tenant user regardless of plan:
```ts
{ id: "whatsapp", label: "WhatsApp", icon: MessageCircle, group: "Gestión" },
{ id: "billing", label: "Facturación", icon: CreditCard, group: "Gestión" },
```

Worse — DashboardShell (src/components/dashboard/DashboardShell.tsx:65-74) does NOT render WhatsAppSection, BillingSection, ShiftsSection, ChatSection, or WebImportSection at all:
```ts
{section === "dashboard" && <DashboardSection />}
{section === "orders" && <OrdersSection />}
{section === "tables" && <TablesSection />}
{section === "kitchen" && <KitchenSection />}
{section === "menus" && <MenusSection />}
{section === "analytics" && <AnalyticsSection />}
{section === "reservations" && <ReservationsSection />}
{section === "customers" && <CustomersSection />}
{section === "settings" && <SettingsSection />}
{section === "public" && <PublicMenuSection slug={user.restaurantSlug} />}
```
So clicking "WhatsApp" or "Facturación" in the sidebar results in a blank main panel (the section state changes but no component renders). This is a UX bug independent of feature flags, but also means the UI never checks the flag — there is no "Upgrade to access WhatsApp" gate.

The five orphaned section components (WhatsAppSection, BillingSection, ShiftsSection, ChatSection, WebImport) exist in src/components/dashboard/sections/ but are imported only by themselves (verified by grep). See §E.

Concrete fix:
  1. In DashboardShell, render every section + wrap each in a `<FeatureGate feature="whatsapp">` HOC that fetches `/api/me/features` (a new endpoint returning `getEnabledFeatures(orgId)`) and shows an upgrade CTA when disabled.
  2. In each API route, also call `isFeatureEnabled(orgId, featureKey)` server-side (defense in depth — see B.2).

## B.4 ❌ BUG — Cache NOT invalidated on plan upgrade
File: src/lib/feature-flags.ts:137-143 (`invalidateFeatureFlagsCache`)
File: src/app/api/stripe/webhook/route.ts:25-58 (`checkout.session.completed` updates DB but does not call `invalidateFeatureFlagsCache(orgId)`)

Grep for callers:
  $ rg "invalidateFeatureFlagsCache" src
  src/lib/feature-flags.ts:137:  export function invalidateFeatureFlagsCache(...)
  → 0 callers.
The 60-second TTL is the only refresh mechanism. After an org upgrades Starter→Professional, they will wait up to 60 seconds before WhatsApp/Chat/Shifts become accessible. Conversely, after a downgrade Professional→Starter, the user has a 60-second window where they can still call Premium APIs (because the cached flags still say "true").

Concrete fix: in src/app/api/stripe/webhook/route.ts, after every successful `organization_subscriptions` update that changes `plan_id` or `status`, call `invalidateFeatureFlagsCache(orgId)`. Also call it from `/api/billing/subscription` POST on cancel/reactivate.

## B.5 ⚠️ WARN — DB-error behavior is fail-OPEN
File: src/lib/feature-flags.ts:97-100
```ts
} catch {
  // DB error — use defaults
  Object.entries(DEFAULT_FLAGS).forEach(([k, v]) => flags.set(k, v));
}
```
DEFAULT_FLAGS (lines 19-34) sets `whatsapp: false`, `advanced_analytics: false`, `api_access: false`, `white_label: false` — so for those, DB failure = deny (good, fail-closed).

But for `chat: true`, `shifts: true`, `analytics: true`, `web_import: true`, `google_reviews: true`, `crm: true`, `reservations: true`, `tables: true`, `menu: true`, `kitchen: true` — DB failure = ALLOW (fail-open). A transient Supabase outage would let Starter users access Premium-tier Chat/Shifts for up to 60 seconds.

Same fail-open pattern in `checkUsageLimit` (line 170-173): "Table doesn't exist — allow everything".

Concrete fix: for plan-gated features, default to `false` on DB error. Only default-true features should be those that are free-tier.

## B.6 ⚠️ WARN — `incrementUsage` has a TOCTOU race + non-atomic counter
File: src/lib/feature-flags.ts:177-218
```ts
await supabaseAdmin.from("organization_usage").upsert({ count: 1, ... }, { onConflict: "organization_id,metric,period" });
// then immediately:
const { data: existing } = await supabaseAdmin.from("organization_usage").select("count").maybeSingle();
if (existing) { await ...update({ count: existing.count + 1 }) }
```
Two requests racing in the same millisecond will both read `count = N` and both write `count = N+1`, losing one increment. The `upsert({count:1})` followed by `select + update` is also redundant — the upsert resets count to 1 on conflict (the `count: 1` in the upsert payload overrides the existing value).

Concrete fix: use a single SQL `INSERT ... ON CONFLICT DO UPDATE SET count = organization_usage.count + 1` via `supabaseAdmin.rpc('increment_usage', {...})`, or use Postgres atomic `UPDATE ... SET count = count + 1`.

================================================================================
# C. Build pipeline
================================================================================

## C.1 ❌ BUG (HIGH) — `typescript.ignoreBuildErrors: true`
File: next.config.ts:5-7
```ts
typescript: {
  ignoreBuildErrors: true,
},
```
This silently hides ALL TypeScript errors at build time. `npx tsc --noEmit` reports 7 real errors (see C.5). With this flag, `next build` succeeds even though the codebase does not type-check. This is a deployment-time footgun — the production build may fail at runtime in code paths the type checker would have flagged.

Concrete fix: set `ignoreBuildErrors: false`, fix the 7 tsc errors (most are in chart.tsx and example/skill files outside src/), and add `tsc --noEmit` to CI.

## C.2 ⚠️ WARN — ESLint config disables almost every useful rule
File: eslint.config.mjs:11-44
```ts
"@typescript-eslint/no-explicit-any": "off",
"@typescript-eslint/no-unused-vars": "off",
"@typescript-eslint/no-non-null-assertion": "off",
"@typescript-eslint/ban-ts-comment": "off",
"react-hooks/exhaustive-deps": "off",
"no-unused-vars": "off",
"no-console": "off",
"no-debugger": "off",
"no-unreachable": "off",
... (16 rules disabled in total)
```
Notably `no-unused-vars` and `@typescript-eslint/no-unused-vars` are OFF, so eslint will never report dead code or unused imports (see §E). `react-hooks/exhaustive-deps` is OFF, so missing effect deps go unflagged. `no-debugger` and `no-console` are OFF, so `console.log` debug statements ship to production.

There is no `eslint.ignoreDuringBuilds: true` in next.config.ts (✅ for that part) — but with this rule set, the build-time lint pass is mostly cosmetic.

Concrete fix: re-enable at least `@typescript-eslint/no-unused-vars` (with `argsIgnorePattern: "^_"`), `react-hooks/exhaustive-deps` ("warn"), `no-console` (allow `console.warn`/`console.error`), and `no-debugger` ("error"). Fix the resulting warnings.

## C.3 ❌ BUG — `dangerouslyAllowSVG: true` + wildcard `remotePatterns`
File: next.config.ts:9-17
```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "**" },
    { protocol: "http", hostname: "**" },
  ],
  formats: ["image/avif", "image/webp"],
  dangerouslyAllowSVG: true,
  contentDispositionType: "attachment",
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
},
```
- `dangerouslyAllowSVG: true` — Next.js will serve SVGs through the image optimizer. SVGs can carry inline `<script>` and `<onload>` handlers. The CSP `script-src 'none'; sandbox;` mitigates this for browsers that enforce CSP, but the SVG is still served from your origin, allowing XSS in older browsers and bypass via `<svg><use href="...">` in some cases.
- `hostname: "**"` for both http and https — any URL on the internet is a valid `next/image` src. This makes your server an open image proxy (someone can use your domain to load images from anywhere, including internal IPs if SSRF is possible). Combined with `dangerouslyAllowSVG`, an attacker can host an SVG payload anywhere and have your domain serve it.

Concrete fix:
  - Set `dangerouslyAllowSVG: false` (default). If SVG support is required, sanitize with DOMPurify before serving.
  - Replace `hostname: "**"` with an explicit allowlist of CDN hosts (Supabase storage, your uploads bucket, etc.).

## C.4 ❌ BUG — `reactStrictMode: false`
File: next.config.ts:8
```ts
reactStrictMode: false,
```
StrictMode is off, so the double-invoke behavior in dev (which catches impure renders, missing cleanup in effects, stale state) is disabled. This hides a whole class of bugs that would otherwise surface in development.

Concrete fix: set `reactStrictMode: true`. Fix any double-effect issues that surface (they are real bugs).

## C.5 ❌ BUG — `npx tsc --noEmit` reports 7 errors (full output)
Command: `cd /home/z/my-project && npx tsc --noEmit 2>&1 | head -100`
Full output (8 lines of error messages, 7 distinct errors):

```
examples/websocket/frontend.tsx(4,20): error TS2307: Cannot find module 'socket.io-client' or its corresponding type declarations.
examples/websocket/server.ts(2,24): error TS2307: Cannot find module 'socket.io' or its corresponding type declarations.
skills/image-edit/scripts/image-edit.ts(10,4): error TS2561: Object literal may only specify known properties, but 'images' does not exist in type 'CreateImageEditBody'. Did you mean to write 'image'?
src/components/ui/chart.tsx(109,3): error TS2339: Property 'payload' does not exist on type 'Omit<Props<ValueType, NameType>, PropertiesReadFromContext> & { active?: boolean | undefined; ... } & { ...; }'.
src/components/ui/chart.tsx(114,3): error TS2339: Property 'label' does not exist on type '... same as above ...'.
src/components/ui/chart.tsx(260,39): error TS2344: Type '"verticalAlign" | "payload"' does not satisfy the constraint '"string" | "d" | "k" | ... | "portal"'. Type '"payload"' is not assignable to type '"string" | ...'.
src/components/ui/chart.tsx(266,17): error TS2339: Property 'length' does not exist on type '{}'.
src/components/ui/chart.tsx(278,16): error TS2339: Property 'map' does not exist on type '{}'.
```

Breakdown:
- 2 errors in `examples/websocket/*` — modules not installed. These are example files outside src/. Move them out of the tsconfig `include` or install the deps.
- 1 error in `skills/image-edit/scripts/image-edit.ts` — wrong property name (`images` should be `image`). Out of src/.
- 4 errors in `src/components/ui/chart.tsx` (lines 109, 114, 260, 266, 278) — Recharts types changed and the shadcn `ChartTooltipContent`/`ChartLegendContent` props no longer match. The `payload` and `label` props are typed as `{}` instead of `Payload[]`, so `.length` and `.map` fail.

Because of C.1 (`ignoreBuildErrors: true`), `next build` does NOT fail on these — but they are real type errors that will surface as runtime bugs if the tooltip/legend content is rendered with a non-array `payload`.

Concrete fix:
  - chart.tsx: cast `payload` to `Payload[]` explicitly, or upgrade shadcn `chart.tsx` to the latest version that matches your `recharts` version (recharts 3.x changed the Tooltip/Legend prop types).
  - examples/ and skills/ folders: add them to `exclude` in tsconfig.json, or `ignores` in eslint.config.mjs (eslint already ignores `examples/**` and `skills`, but tsc does not).

## C.6 `npx eslint .` output (full)
Command: `cd /home/z/my-project && npx eslint . 2>&1 | head -100`
Full output:
```
/home/z/my-project/cloudflare/workers/security.js
  13:1  warning  Assign object to a variable before exporting as module default  import/no-anonymous-default-export

/home/z/my-project/scripts/apply_migration_0009.cjs
  2:20  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  3:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  4:14  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/home/z/my-project/scripts/apply_migrations_via_cli.cjs
  1:22  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  2:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  3:14  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/home/z/my-project/scripts/db_setup.cjs
   20:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
   21:14  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  120:24  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

/home/z/my-project/scripts/setup.cjs
  20:33  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  21:12  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports
  22:14  error  A `require()` style import is forbidden  @typescript-eslint/no-require-imports

✖ 13 problems (12 errors, 1 warning)
```
12 errors are all `@typescript-eslint/no-require-imports` in `.cjs` files under `scripts/` — these are CommonJS files that legitimately must use `require()`. The fix is to add `*.cjs` (and `scripts/**`) to the eslint `ignores` list:
```js
ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "scripts/**", "cloudflare/**", "**/*.cjs"]
```
1 warning in `cloudflare/workers/security.js` is benign (anonymous default export).

Note: ESLint does NOT report any `no-unused-vars` even though there is clear dead code (see §E) because the rule is disabled in eslint.config.mjs. So a clean ESLint run ≠ clean code.

## C.7 ⚠️ WARN — `any` types: 221 occurrences across 73 files
Grep: `rg ": any|as any" src` → 221 matches in 73 files.
Hot spots: src/lib/db.ts (24), src/lib/web-import.ts (11), src/app/api/admin/stats/route.ts (12), src/app/api/stripe/webhook/route.ts (8), src/lib/next-auth.ts (7), src/components/dashboard/sections/TablesSection.tsx (11), src/components/dashboard/sections/BillingSection.tsx (6), src/components/dashboard/sections/MenusSection.tsx (5).

Many of these are `as any` casts on Supabase responses (`(data || []) as any[]`) which is workaround for the underlying typing issue. They are not bugs per se but they defeat the purpose of TypeScript and would fail under `@typescript-eslint/no-explicit-any: "error"`.

Concrete fix: define proper row types in `src/types/db.ts` matching the Supabase schema, and `SupabaseClient<Database>` typing.

## C.8 ✅ OK — No `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error` in src/
Grep: `rg "@ts-ignore|@ts-nocheck|@ts-expect-error" src` → 0 matches.
The team is using `as any` casts instead of suppression comments. Still not great (see C.7) but at least there are no blanket suppressions.

## C.9 ✅ OK — src/middleware.ts logic is sound (with one caveat)
File: src/middleware.ts:7-42
The matcher correctly excludes `/api/auth/`, `/api/public/`, `/api/health` from auth. The admin gate `if (pathname.startsWith('/api/admin/') && !token.isSuperAdmin) return 403` is correct.

Caveat: the matcher pattern is `['/api/((?!auth|public|health).*)', '/login']` — this means middleware only runs on /api/* and /login. Pages like `/` and `/landing` are NOT matched, so middleware never blocks them. The `/` page is protected via `getServerSession` server-side (src/app/page.tsx:11), and `/landing` is intentionally public, so this is fine. But it does mean any future page (e.g. `/admin`) added without a server-side check would be exposed.

## C.10 ✅ OK — src/app/layout.tsx is correct
File: src/app/layout.tsx
Fonts loaded via `next/font/google` (correct, avoids layout shift). `suppressHydrationWarning` on `<html>` is set (correct when using theme providers). Toaster + SonnerToaster both mounted. No hydration issues.

================================================================================
# D. Hydration issues
================================================================================

## D.1 ✅ OK — No `useLayoutEffect` anywhere
Grep: `rg "useLayoutEffect" src` → 0 matches.

## D.2 ✅ OK — All `Date.now()` / `Math.random()` in components are inside "use client" files
Reviewed every match in src/components/**:
  - src/components/ui/sidebar.tsx:611 — `Math.random()` inside `useMemo(() => {...}, [])` in `SidebarMenuSkeleton`. Component is part of shadcn `ui/` which is client-only by default. The `useMemo` runs once on mount (client-side), no SSR/hydration mismatch.
  - src/components/landing/LandingPage.tsx:999-1032 — file starts with `"use client"` (line 1). Date.now() calls are inside client-side mock data. No SSR mismatch.
  - src/components/admin/NotificationBell.tsx:180, src/components/dashboard/TenantNotificationBell.tsx:167 — `Math.floor((Date.now() - d.getTime()) / 1000)` inside a `formatRelative` helper. Both files use `"use client"`. The relative time string is recomputed on every render (client-side), so no hydration mismatch because the bell is rendered inside a client-only dashboard shell.

## D.3 ✅ OK — `typeof window !== "undefined"` guards in place
Only one file uses it: src/components/dashboard/sections/PublicMenuSection.tsx:61, 98. Both uses are correct. The component is dynamically imported with `ssr: false` from DashboardShell.tsx:25, so it only ever renders client-side anyway — the guard is defense in depth.

## D.4 ✅ OK — `process.env.NEXT_PUBLIC_LAUNCH_MODE` access in AuthScreen
File: src/components/auth/AuthScreen.tsx:64
```ts
const isPrivateMode = process.env.NEXT_PUBLIC_LAUNCH_MODE === "private";
```
`NEXT_PUBLIC_*` vars are inlined by Next.js at build time, so this is a static value baked into the client bundle. No hydration mismatch.

No hydration issues found.

================================================================================
# E. Dead code / unused imports / orphan files
================================================================================

## E.1 ❌ BUG — Four library modules in src/lib are completely unused
Grep verified zero importers (excluding self and docstring examples):

  src/lib/events.ts         — full event-log emitter (118 lines). Zero callers. The `emit()` function is never called by any route, so the `event_log` table is never written to.
  src/lib/errors.ts         — full typed-error hierarchy (AppError, ValidationError, PermissionError, etc., 115 lines). Zero callers. API routes use `NextResponse.json({error: ...})` ad-hoc instead.
  src/lib/rate-limit.ts     — `checkRateLimit` helper + `RATE_LIMITS` presets (85 lines). Zero callers. The /api/auth/register, /api/auth/forgot-password, /api/restaurant/import-web routes each re-implement their own in-memory rate limiter instead.
  src/lib/soft-delete.ts    — `softDelete` / `restoreSoftDelete` / `getDeletedRecords` (80 lines). Zero callers. API routes hard-delete via `db.X.delete()` directly.

Concrete fix: either delete these files (if the features are not on the roadmap) or wire them up. The rate-limit one is particularly valuable — `/api/auth/register` has NO rate limiting today and is a signup-spam vector.

## E.2 ❌ BUG — Four dashboard section components are dead code (never rendered)
Grep: `rg "WhatsAppSection|ShiftsSection|ChatSection|BillingSection" src`
  → only the definition lines match, no import statements.

  src/components/dashboard/sections/WhatsAppSection.tsx (273 lines) — never imported
  src/components/dashboard/sections/ShiftsSection.tsx   (315 lines) — never imported
  src/components/dashboard/sections/ChatSection.tsx     (~? lines) — never imported
  src/components/dashboard/sections/BillingSection.tsx  (250 lines) — never imported

Yet the Sidebar (Sidebar.tsx:44-45) shows nav buttons for "WhatsApp" and "Facturación" — clicking them sets `section = "whatsapp"` / `"billing"` in the store, but DashboardShell.tsx:65-74 has no `{section === "whatsapp" && <WhatsAppSection />}` branch, so the user gets a blank main panel.

Concrete fix: either wire these sections into DashboardShell (and add feature-flag gates per B.3), or remove the nav items from the Sidebar.

## E.3 ⚠️ WARN — Two example files outside src/ cause tsc errors but are tracked in repo
  examples/websocket/frontend.tsx, examples/websocket/server.ts — reference `socket.io-client` and `socket.io` which are not in package.json. They cause 2 of the 7 tsc errors. They are already in the eslint `ignores` list but not in the tsconfig `exclude` list.

Concrete fix: add `"examples/**"`, `"skills/**"`, `"scripts/**"`, `"cloudflare/**"` to `exclude` in tsconfig.json.

## E.4 ⚠️ WARN — Re-implemented rate limiters instead of using src/lib/rate-limit.ts
Three routes copy-paste the same in-memory rate-limiter pattern:
  src/app/api/auth/forgot-password/route.ts:10-29
  src/app/api/restaurant/import-web/route.ts:16-42
  (and `src/lib/rate-limit.ts` itself contains the canonical version)

If you fix E.1 by deleting rate-limit.ts, you accept three copies of the same algorithm with no shared test coverage. If you keep rate-limit.ts, you should DRY-up these three call sites.

## E.5 ✅ OK — No unused-vars reports (because the rule is off — see C.2)
ESLint does not report `no-unused-vars` because both `no-unused-vars` and `@typescript-eslint/no-unused-vars` are set to `"off"` in eslint.config.mjs:13-14, 33. This is a config decision, not a code-cleanliness win. Spot-checking src/lib/next-auth.ts:156, `await import('next/headers')` is used; no obvious unused imports found in the audited files, but the rule being off means there's no safety net.

================================================================================
# Summary
================================================================================

Counts:
- ❌ BUG: 13 (5 in RBAC, 5 in feature flags, 3 in build pipeline, plus 2 dead-code-as-bug)
- ⚠️ WARN: 8 (2 in RBAC, 2 in feature flags, 3 in build pipeline, 2 in dead code)
- ✅ OK: 6 (no @ts-ignore, middleware sound, layout correct, no hydration issues, no useLayoutEffect, Date.now/Math.random usage is safe)

Top 5 priorities (by impact × likelihood):

1. CRITICAL — RBAC is dead code (A.1, A.4). `requirePermission` / `hasPermission` are never called. Every API route uses the legacy `user.role !== 'ADMIN'` check, which (a) ignores the entire user_roles/role_permissions/permissions schema, (b) cannot express fine-grained roles like MANAGER or RECEPTION, (c) means STAFF can read /api/analytics and edit/delete reservations, customers, shifts, chat channels, table transfers, billing subscriptions. This is the single biggest security gap in the codebase.

2. CRITICAL — Feature flags are dead code (B.1, B.2, B.3). `isFeatureEnabled` is never called by any route or component. A Starter-plan user can call /api/whatsapp/status, /api/chat/*, /api/shifts/*, /api/analytics directly and get full data. There is no plan-gating anywhere in the product. The Stripe checkout flow takes their money but delivers no actual restriction.

3. HIGH — `typescript.ignoreBuildErrors: true` (C.1) hides 7 real type errors (C.5). The 4 chart.tsx errors will surface as runtime crashes when ChartTooltipContent renders with a non-array payload. Fix the errors, then flip the flag.

4. HIGH — `dangerouslyAllowSVG: true` + `hostname: "**"` in next.config.ts (C.3). Your domain is an open image proxy and will serve arbitrary SVGs from anywhere on the internet. Remove the wildcard, disable SVG (or sanitize).

5. HIGH — Cache invalidation is never triggered (A.6, B.4). Even after RBAC and feature flags are wired up, `invalidateRbacCache` and `invalidateFeatureFlagsCache` have zero callers. Role/plan changes will take 5 min / 60 s to propagate, with a security window on downgrades. Wire these into the (yet-to-be-built) admin role-change endpoint and into the Stripe webhook handler.

Secondary:
6. MEDIUM — 4 dead library modules (E.1) and 4 dead section components (E.2). Delete or wire up.
7. MEDIUM — ESLint rule set (C.2) disables every useful check. Re-enable `no-unused-vars`, `react-hooks/exhaustive-deps`, `no-debugger`.
8. MEDIUM — `reactStrictMode: false` (C.4). Turn on, fix what surfaces.
9. LOW — 221 `as any` casts (C.7). Not a bug today but defeats TypeScript's value.
10. LOW — `incrementUsage` race condition (B.6). Only matters when usage limits are actually enforced (which today they aren't, per B.1).

This was a READ-ONLY audit. No source files were modified. Recommended next task: `audit-5-6-14-fix` to patch items 1, 2, 3, 4, 5 above in priority order. Items 1 and 2 are unblockers for the SaaS to actually be a SaaS; items 3 and 4 are unblockers for production deployment; item 5 closes the privilege-escalation window that items 1 and 2 introduce when fixed.
