import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET

/**
 * Middleware de protección de rutas.
 *
 * Defense-in-depth architecture:
 *
 * 1. /api/admin/* — requires SUPER_ADMIN (verified here at edge)
 * 2. /api/* (non-public) — requires valid JWT (verified here at edge)
 * 3. /api/public/* — no auth required (public endpoints)
 * 4. /api/auth/* — NextAuth routes, no middleware interference
 * 5. /api/health — public health check
 *
 * This means even if a route handler forgets to check auth,
 * the middleware blocks it before it reaches the handler.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow NextAuth routes (login, register, callback, etc.)
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // Allow public endpoints
  if (pathname.startsWith('/api/public/') || pathname === '/api/health') {
    return NextResponse.next()
  }

  // Allow static assets and Next.js internals
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon') ||
      pathname === '/robots.txt' || pathname === '/sitemap.xml' ||
      pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    return NextResponse.next()
  }

  // For all other /api/ routes, require a valid JWT
  if (pathname.startsWith('/api/')) {
    const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })

    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // /api/admin/* requires SUPER_ADMIN
    if (pathname.startsWith('/api/admin/')) {
      if (!token.isSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: se requiere SUPER_ADMIN' },
          { status: 403 }
        )
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  // Protect all API routes except auth, public, and health
  matcher: [
    '/api/((?!auth|public|health).*)',
  ],
}
