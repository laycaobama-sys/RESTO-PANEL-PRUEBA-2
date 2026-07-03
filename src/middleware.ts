import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET
if (!NEXTAUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('NEXTAUTH_SECRET is required in production.')
}

/**
 * Middleware de protección de rutas.
 *
 * Defensa en profundidad: además de la validación `user.isSuperAdmin` que
 * cada API route hace internamente, este middleware rechaza cualquier
 * petición a `/api/admin/*` o `/admin` que no tenga un JWT válido con el
 * flag `isSuperAdmin`. Así, incluso si una route handler se olvida de
 * validar, el middleware la bloquea antes.
 *
 * El JWT se verifica con NEXTAUTH_SECRET (server-only), así que un token
 * falsificado no pasaría.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Proteger todas las rutas /api/admin/* y /admin
  if (pathname.startsWith('/api/admin') || pathname === '/admin') {
    const token = await getToken({
      req,
      secret: NEXTAUTH_SECRET || '',
    })

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!token.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: se requiere SUPER_ADMIN' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/admin/:path*', '/admin'],
}
