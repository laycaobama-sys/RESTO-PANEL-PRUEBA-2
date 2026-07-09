import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()
  if (pathname.startsWith('/api/public/') || pathname === '/api/health') return NextResponse.next()
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon') ||
      pathname === '/robots.txt' || pathname === '/sitemap.xml' ||
      pathname === '/llms.txt' || pathname === '/llms-full.txt') return NextResponse.next()

  // API route protection
  if (pathname.startsWith('/api/')) {
    const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (pathname.startsWith('/api/admin/') && !token.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: se requiere SUPER_ADMIN' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // /login redirect
  if (pathname === '/login') {
    const token = await getToken({ req, secret: NEXTAUTH_SECRET || '' })
    if (token) return NextResponse.redirect(new URL('/', req.url))
    return NextResponse.next()
  }

  // /landing always public
  if (pathname === '/landing') return NextResponse.next()

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/((?!auth|public|health).*)', '/login'],
}
