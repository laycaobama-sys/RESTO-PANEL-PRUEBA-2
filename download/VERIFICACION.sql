-- ============================================================================
-- RestoPanel · SCRIPT DE VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- Pega este script en el SQL Editor de Supabase DESPUÉS de ejecutar
-- MIGRACION-MAESTRA.sql. Confirma que todas las tablas y datos quedaron OK.
-- ============================================================================

-- 1. Verificar planes y precios (debe devolver 3 filas con los precios correctos)
SELECT '=== PLANES DE SUSCRIPCIÓN ===' AS info;
SELECT name, label, price_monthly, price_yearly, max_tables, max_users, sort_order
FROM subscription_plans
ORDER BY sort_order;

-- 2. Verificar que organization_subscriptions tiene las columnas nuevas
SELECT '=== COLUMNAS DE organization_subscriptions ===' AS info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organization_subscriptions'
ORDER BY ordinal_position;

-- 3. Verificar qué organizaciones tienen trial
SELECT '=== SUSCRIPCIONES POR ORGANIZACIÓN ===' AS info;
SELECT os.organization_id, o.name AS org_name, sp.name AS plan_name, sp.label, os.status, os.trial_ends_at
FROM organization_subscriptions os
JOIN organizations o ON o.id = os.organization_id
JOIN subscription_plans sp ON sp.id = os.plan_id
ORDER BY os.created_at DESC;

-- 4. Verificar que todas las tablas de billing existen
SELECT '=== TABLAS DE BILLING CREADAS ===' AS info;
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('subscription_plans','organization_subscriptions','invoices','payment_methods','subscription_history','usage_logs','feature_flags','organization_usage')
ORDER BY tablename;
-- Debe devolver 8 filas

-- 5. Verificar que las funciones helper existen
SELECT '=== FUNCIONES HELPER ===' AS info;
SELECT proname, lanname
FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE proname IN ('current_user_org_id','is_current_user_super_admin','touch_updated_at');
-- Debe devolver 3 filas

-- 6. Verificar feature flags (debe haber 14)
SELECT '=== FEATURE FLAGS ===' AS info;
SELECT key, default_value, plan_required
FROM feature_flags
ORDER BY key;
-- Debe devolver 14 filas

-- 7. Verificar que RLS está activo en todas las tablas críticas
SELECT '=== RLS ACTIVO ===' AS info;
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('subscription_plans','organization_subscriptions','invoices','payment_methods','subscription_history','usage_logs','feature_flags','organization_usage')
ORDER BY tablename;
-- Todas deben tener rowsecurity = true (excepto subscription_plans y feature_flags que también lo tienen)

-- ============================================================================
-- Si todo lo anterior devuelve datos correctamente, la migración fue OK.
-- ============================================================================
