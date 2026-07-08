import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET

/**
 * Middleware de protección de rutas.
 *
 * Defense-in-depth architecture:
 *
 * 1. /api/auth/* — NextAuth routes, no interference
 * 2. /api/public/* — public endpoints
 * 3. /api/health — health check
 * 4. All other /api/* — requires valid JWT
 * 5. /api/admin/* — requires SUPER_ADMIN
 *
 * Also protects page routes:
 * - Unauthenticated → /login
 * - Authenticated at /login → / (dashboard)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ─── Allow public routes ────────────────────────────────
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()
  if (pathname.startsWith('/api/public/') || pathname === '/api/health') return NextResponse.next()
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon') ||
      pathname === '/robots.txt' || pathname === '/sitemap.xml' ||
      pathname === '/llms.txt' || pathname === '/llms-full.txt') return NextResponse.next()

  // ─── API route protection ───────────────────────────────
  if (pathname.startsWith('/api/')) {
    const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // /api/admin/* requires SUPER_ADMIN
    if (pathname.startsWith('/api/admin/') && !token.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: se requiere SUPER_ADMIN' },
        { status: 403 }
      )
    }

    return NextResponse.next()
  }

  // ─── Page route protection ──────────────────────────────
  // /login: redirect to dashboard if already authenticated
  if (pathname === '/login') {
    const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })
    if (token) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // /landing: always public
  if (pathname === '/landing') return NextResponse.next()

  // Root: server component handles redirect logic (page.tsx)
  // All other page routes are public (landing, login, etc.)
  // The dashboard is rendered conditionally at / based on session

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Protect all API routes except auth, public, health
    '/api/((?!auth|public|health).*)',
    // Protect /login (redirect if authenticated)
    '/login',
  ],
}
