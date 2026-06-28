# RestoPanel · Fase Privada de Revisión (Pre-lanzamiento)

Esta fase deja el sistema listo para que TÚ, como dueño, revises todo el producto antes del lanzamiento público. **No es el lanzamiento final** — es una fase de control y validación.

---

## 1. Cómo accedes como dueño (SUPER_ADMIN)

### Credenciales del owner

```
Email:    owner@restopanel.es
Password: owner2026
```

⚠️ **Cambia esta contraseña inmediatamente** después de tu primera revisión. Para hacerlo, ejecuta en el SQL Editor de Supabase:

```sql
-- Genera un nuevo hash con bcrypt y actualízalo:
UPDATE users
SET password_hash = 'NUEVO_HASH_BCRYPT'
WHERE email = 'owner@restopanel.es';
```

### Cómo entrar

1. Abre <http://localhost:3000> (o tu URL de producción).
2. La pestaña "Crear cuenta" está OCULTA porque `LAUNCH_MODE=private`.
3. Introduce `owner@restopanel.es` / `owner2026`.
4. El sistema detecta que eres SUPER_ADMIN y te redirige automáticamente al **panel global** (no al dashboard de un tenant).

### Cómo sé que soy super admin

Verás en el sidebar izquierdo el texto **"SUPER ADMIN · HQ"** debajo del logo, con un fondo oscuro (diferente al tema claro de los tenants).

---

## 2. El panel global (`/admin`)

El panel privado del dueño tiene 4 secciones accesibles desde el sidebar:

### A) Resumen global

- **8 KPIs**: empresas activas/total, usuarios totales, platos en catálogo, mesas configuradas, reservas totales, pedidos totales, entradas de auditoría, empresas suspendidas.
- **Actividad reciente**: las últimas 20 acciones críticas del sistema con badges de color según el tipo (impersonación = morado, suspensión = rojo, activación = verde).

### B) Empresas (tenants)

- Lista de todas las empresas registradas con búsqueda y filtro por estado.
- Para cada empresa ves: nombre, slug, ciudad, país, estado (ACTIVE/SUSPENDED/PENDING), y contadores de usuarios/platos/mesas/reservas/pedidos.
- Acciones por empresa:
  - **Entrar como cliente** (impersonación) — abre un diálogo de confirmación que avisa de que la acción queda registrada.
  - **Suspender** — bloquea el login de esa empresa sin borrar datos.
  - **Activar** — reactiva una empresa suspendida.

### C) Usuarios

- Lista de TODOS los usuarios del sistema (todos los tenants + super admins).
- Búsqueda por email/nombre y filtro por rol.
- Columnas: usuario (avatar + nombre + email), empresa, rol (con badge visual), fecha de creación, última actualización.
- Los SUPER_ADMIN aparecen con badge morado "SUPER ADMIN", los ADMIN con badge azul, los STAFF con badge gris.

### D) Auditoría

- Log inmutable de todas las acciones privilegiadas.
- Filtros por tipo de acción: todas, impersonación inicio, impersonación fin, empresas suspendidas, empresas activadas.
- Cada entrada muestra: tipo de acción (badge de color), descripción, actor (email + rol), IP, fecha/hora exacta, y un JSON con detalles adicionales.
- Los registros **nunca se borran automáticamente** — solo el owner de la BD puede eliminarlos vía SQL.

---

## 3. Cómo entras al contexto de un cliente (impersonation)

### Para entrar

1. Entra al panel global como SUPER_ADMIN.
2. Ve a la sección **Empresas**.
3. Pulsa **"Entrar como cliente"** en la tarjeta de la empresa que quieres revisar.
4. Aparece un diálogo de confirmación avisando de que la acción queda registrada.
5. Pulsa **"Entrar"**.

### Qué pasa entonces

- El servidor setea dos cookies httpOnly: `impersonate_org_id` y `impersonate_org_name`.
- El JWT callback de NextAuth las lee y sobrescribe el `organizationId` en la sesión.
- Tu sesión pasa a tener el contexto de ese tenant.
- La app te redirige automáticamente al dashboard del tenant (no al panel global).
- Aparece un **banner morado arriba** que dice: "Modo cliente · viendo como {empresa}. Conectado como super admin: owner@restopanel.es. Todas tus acciones quedan registradas."
- El banner tiene un botón **"Salir del modo cliente"**.

### Qué puedes hacer mientras impersonas

TODO lo que el admin del tenant puede hacer:

- Ver y editar el dashboard (KPIs, gráficas).
- Crear/editar/eliminar platos y categorías.
- Ver y editar mesas (plano visual).
- Gestionar reservas (crear, confirmar, cancelar).
- Ver pedidos y cocina (KDS).
- Cambiar ajustes del restaurante (horarios, branding, módulos).
- Ver la carta pública.

### Cómo sales

1. Pulsa **"Salir del modo cliente"** en el banner morado.
2. El servidor borra las cookies de impersonación.
3. Se registra un evento `IMPERSONATE_END` en el log de auditoría.
4. La app te redirige automáticamente de vuelta al panel global de super admin.

### Límites de seguridad

- Solo SUPER_ADMIN puede impersonar (verificado en servidor + RLS).
- Las cookies de impersonación expiran a las 8 horas máximo.
- Si una cookie de impersonación se manipula, el JWT callback la ignora (valida que el usuario sea super admin antes de aplicarla).
- Todas las acciones de impersonación quedan en el log con IP y user-agent del super admin.

---

## 4. Qué puedes modificar

| Sección | Acciones del SUPER_ADMIN |
|---|---|
| Empresas | Ver todas, suspender, activar, entrar como cliente |
| Usuarios | Ver todos, ver roles, ver última actividad |
| Dashboard de tenant (impersonando) | Todo lo que puede hacer el admin del tenant |
| Menús/Carta (impersonando) | Crear, editar, eliminar platos y categorías |
| Mesas (impersonando) | Crear, editar, eliminar, cambiar estado, mover en el plano |
| Reservas (impersonando) | Crear, confirmar, cancelar, marcar no-show |
| Pedidos (impersonando) | Ver, avanzar estado, cancelar |
| Ajustes (impersonando) | Cambiar datos del restaurante, horarios, branding, módulos |
| Auditoría | Ver todos los logs, filtrar por acción |

---

## 5. Seguridad y auditoría

### RBAC implementado

```
SUPER_ADMIN  (global, sin organization_id)
   ↓ puede impersonar y ver todo
ADMIN        (limitado a su organization_id)
   ↓ gestiona su tenant completo
STAFF        (limitado a su organization_id)
   ↓ solo operaciones de día a día (no ajustes globales)
```

### Capas de defensa

1. **App server**: cada API route valida `user.isSuperAdmin` antes de ejecutar acciones privilegiadas. Las queries de tenant siempre filtran por `user.organizationId`.
2. **JWT session**: el `organizationId` se deriva del JWT firmado, no del cliente. Las cookies de impersonación solo se aplican si el JWT confirma que es super admin.
3. **RLS en Supabase**: cada tabla tiene políticas que filtran por `organization_id`. Las políticas de super admin (`is_current_user_super_admin()`) son las únicas que permiten leer cruzando tenants, y solo funcionan si el JWT de Supabase Auth tiene el flag. Como usamos NextAuth (no Supabase Auth), las políticas de super admin no aplican al navegador — solo el servidor (service_role) puede hacerlo.
4. **Auditoría**: cada acción privilegiada se registra en `audit_logs` con actor, IP, user-agent, target y detalles JSON.

### Recomendaciones de refuerzo (no implementadas aún)

Para producción con clientes reales, considera añadir:

- **2FA para SUPER_ADMIN**: usa TOTP con `otplib` o WebAuthn.
- **Re-autenticación para acciones destructivas**: pide la contraseña de nuevo antes de suspender un tenant o borrar datos masivamente.
- **Confirmación por email**: al suspender un tenant, envía un email al cliente avisándole.
- **Rate limiting**: limita el número de impersonaciones por hora para detectar abuso.
- **Alertas de seguridad**: notifica al owner por email si hay 5 intentos de login fallidos de super admin.
- **Rotación de NEXTAUTH_SECRET**: cada 90 días, fuerza re-login de todas las sesiones.

---

## 6. Checklist para tu revisión personal

Imprime esta lista y revisa cada punto:

### Acceso y autenticación
- [ ] Puedo entrar con `owner@restopanel.es` / `owner2026`.
- [ ] La pestaña "Crear cuenta" NO aparece (modo privado activo).
- [ ] Si intento registrar una empresa vía API, devuelve 403.
- [ ] Tras login, veo el panel global (no el dashboard de tenant).

### Panel global
- [ ] El dashboard muestra 8 KPIs con números reales.
- [ ] La actividad reciente muestra los últimos eventos.
- [ ] Puedo navegar entre Empresas, Usuarios y Auditoría.

### Gestión de tenants
- [ ] Veo todas las empresas registradas (La Zamorana, Bistró del Puerto, Trattoria Bella).
- [ ] Cada empresa muestra contadores correctos (usuarios, platos, mesas, reservas).
- [ ] Puedo suspender una empresa y al intentar loguearme con ella, falla.
- [ ] Puedo reactivarla y vuelve a funcionar el login.

### Impersonation
- [ ] Al pulsar "Entrar como cliente" aparece un diálogo de confirmación.
- [ ] Tras confirmar, aparezco en el dashboard del tenant con un banner morado arriba.
- [ ] El banner muestra mi email de super admin y el nombre del tenant.
- [ ] Puedo navegar por menús, mesas, reservas, ajustes del tenant.
- [ ] Al pulsar "Salir del modo cliente", vuelvo al panel global.
- [ ] En la sección Auditoría veo los eventos IMPERSONATE_START e IMPERSONATE_END con mi email.

### Aislamiento multi-tenant
- [ ] Un usuario ADMIN de La Zamorana NO puede acceder a `/api/admin/*` (devuelve 403).
- [ ] Un usuario ADMIN de La Zamorana NO ve los platos de Bistró del Puerto.
- [ ] La `anon key` de Supabase NO puede leer ninguna tabla (RLS lo bloquea).

### Auditoría
- [ ] Cada impersonación queda registrada con email, IP y timestamp.
- [ ] Cada suspensión/activación de tenant queda registrada.
- [ ] Los logs se pueden filtrar por tipo de acción.
- [ ] Los logs muestran el JSON de detalles cuando aplica.

### Dashboard de tenant (impersonando o como cliente)
- [ ] Dashboard carga con KPIs y gráficas.
- [ ] Reservas se ven con filtros por turno/zona/estado.
- [ ] Mesas se ven en plano visual con zonas.
- [ ] Menús/Carta se ven con CRUD completo.
- [ ] Cocina (KDS) se ve con pedidos en preparación.
- [ ] Analytics carga con gráficas.
- [ ] Ajustes carga con 4 tabs (general, branding, horarios, módulos).
- [ ] Carta pública carga con browser chrome y datos reales.

### Sin errores
- [ ] No hay errores rojos en la consola del navegador.
- [ ] No hay errores en el log del servidor (`dev.log`).
- [ ] Lint pasa sin errores ni warnings.
- [ ] Next.js no muestra "Issues" en el panel de desarrollo.

---

## 7. Después de tu aprobación

Una vez que hayas revisado todo y des el OK, pasaremos a la **fase final de lanzamiento**:

1. **Cambiar `LAUNCH_MODE=public`** en `.env` (y en Vercel).
2. **Cambiar `NEXT_PUBLIC_LAUNCH_MODE=public`** para que vuelva a aparecer la pestaña "Crear cuenta".
3. **Limpiar datos temporales**: borrar la empresa "Trattoria Bella" (era de prueba) y cualquier otro dato de testing.
4. **Rotar `NEXTAUTH_SECRET`** con `openssl rand -base64 32`.
5. **Cambiar la contraseña del owner** `owner2026` por una fuerte y única.
6. **Marcar `SUPABASE_SERVICE_ROLE_KEY` como Sensitive** en Vercel.
7. **Desplegar en Vercel** con GitHub conectado.
8. **Configurar dominio personalizado** + HTTPS automático.
9. **Activar backups PITR** en Supabase (plan Pro o superior).
10. **Configurar email transaccional** (Resend, SendGrid) para:
    - Verificación de email al registrarse.
    - Recuperación de contraseña.
    - Notificación al owner cuando se registra una nueva empresa.

Hasta que no me confirmes que esta fase está perfecta, NO avanzaremos a la siguiente.

---

## 8. Archivos clave de esta fase

| Archivo | Propósito |
|---|---|
| `supabase/migrations/0003_super_admin_audit.sql` | Añade `is_super_admin`, `organizations.status`, `audit_logs` + RLS |
| `src/lib/next-auth.ts` | Maneja SUPER_ADMIN + cookies de impersonación en JWT callback |
| `src/lib/audit.ts` | Helper `logAction()` para registrar acciones privilegiadas |
| `src/lib/db.ts` | Añade `auditLogs` y `superAdmin` (queries globales) |
| `src/app/api/admin/stats/route.ts` | KPIs globales + actividad reciente |
| `src/app/api/admin/tenants/route.ts` | Lista/suspende/activa empresas |
| `src/app/api/admin/tenants/[id]/route.ts` | Detalle de un tenant |
| `src/app/api/admin/users/route.ts` | Lista todos los usuarios |
| `src/app/api/admin/logs/route.ts` | Lista logs de auditoría |
| `src/app/api/admin/impersonate/route.ts` | Inicia/finaliza impersonación (con cookies httpOnly) |
| `src/app/api/admin/seed-super-admin/route.ts` | Crea la cuenta owner si no existe |
| `src/app/api/auth/register/route.ts` | Bloquea registro si `LAUNCH_MODE=private` |
| `src/components/admin/SuperAdminShell.tsx` | Layout del panel global (tema oscuro) |
| `src/components/admin/sections/SuperAdminDashboard.tsx` | KPIs + actividad reciente |
| `src/components/admin/sections/TenantsSection.tsx` | Gestión de empresas + impersonación |
| `src/components/admin/sections/UsersSection.tsx` | Lista global de usuarios |
| `src/components/admin/sections/AuditLogsSection.tsx` | Visor de logs de auditoría |
| `src/components/admin/ImpersonationBanner.tsx` | Banner morado para salir del modo cliente |
| `src/components/AppRouter.tsx` | Enruta a SuperAdminShell o DashboardShell según rol/impersonación |
| `src/components/auth/AuthScreen.tsx` | Oculta "Crear cuenta" si `LAUNCH_MODE=private` |

---

## 9. Verificación técnica pasada

| Check | Estado |
|---|---|
| Lint | ✅ 0 errores, 0 warnings |
| HTTP `/` | ✅ 200 |
| HTTP `/landing` | ✅ 200 |
| HTTP `/api/admin/stats` sin auth | ✅ 403 Forbidden |
| HTTP `/api/admin/tenants` sin auth | ✅ 403 Forbidden |
| HTTP `/api/auth/register` en modo privado | ✅ 403 (registro bloqueado) |
| HTTP `/api/public/la-zamorana` | ✅ 200 (carta pública accesible) |
| RLS en 10 tablas | ✅ Activo, 4-7 políticas por tabla |
| Login SUPER_ADMIN | ✅ Redirige al panel global |
| Login ADMIN de tenant | ✅ Redirige al dashboard del tenant |
| Login tenant SUSPENDED | ✅ Bloqueado |
| Impersonation start | ✅ Muestra banner morado |
| Impersonation end | ✅ Vuelve al panel global |
| Audit log registro | ✅ IMPERSONATE_START/END visibles |
| Aislamiento tenant | ✅ Admin no puede acceder a /api/admin/* (403) |
| Errores consola | ✅ Ninguno |
