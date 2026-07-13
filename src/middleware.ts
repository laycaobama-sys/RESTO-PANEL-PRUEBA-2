import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET

/**
 * Public API routes that DO NOT require authentication.
 * - /api/auth/*       → NextAuth handlers
 * - /api/public/*     → public menu/reservation endpoints
 * - /api/health       → uptime probe
 * - /api/stripe/webhook → called by Stripe (no cookie, signed body)
 * - /api/whatsapp/webhook → called by Meta (X-Hub-Signature-256)
 * - /api/whatsapp/status  → called by Meta for delivery status
 */
const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/public/',
  '/api/health',
  '/api/stripe/webhook',
  '/api/whatsapp/webhook',
  '/api/whatsapp/status',
  '/api/setup',           // one-time super-admin setup
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public assets / Next internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/llms.txt' ||
    pathname === '/llms-full.txt'
  ) {
    return NextResponse.next()
  }

  // API route protection
  if (pathname.startsWith('/api/')) {
    // Public API routes (webhooks, auth, public, health)
    if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.next()
    }

    const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Super-admin only routes
    if (pathname.startsWith('/api/admin/') && !token.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: se requiere SUPER_ADMIN' },
        { status: 403 }
      )
    }

    // /api/seed can wipe ALL tenant data — restrict to super-admin only
    // (Previously any authenticated STAFF user could wipe every org.)
    if (pathname.startsWith('/api/seed') && !token.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: /api/seed requiere SUPER_ADMIN' },
        { status: 403 }
      )
    }

    return NextResponse.next()
  }

  // /login redirect (if already logged in)
  if (pathname === '/login') {
    const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })
    if (token) return NextResponse.redirect(new URL('/', req.url))
    return NextResponse.next()
  }

  // /setup — one-time super-admin setup (public, but API checks if already exists)
  if (pathname === '/setup') return NextResponse.next()

  // /landing always public
  if (pathname === '/landing') return NextResponse.next()

  return NextResponse.next()
}

export const config = {
  // Match all /api/* EXCEPT the public ones; also match /login
  matcher: [
    '/api/((?!auth|public|health|stripe/webhook|whatsapp/webhook|whatsapp/status).*)',
    '/login',
  ],
}
