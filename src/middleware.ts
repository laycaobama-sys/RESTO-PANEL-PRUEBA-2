import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

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
      secret: process.env.NEXTAUTH_SECRET || 'RestoPanel_Dev_Secret_2026_ChangeMe_8f7a9b2c4e1d',
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
