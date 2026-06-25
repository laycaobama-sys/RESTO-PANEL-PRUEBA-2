import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'

// Ensure a stable secret is always available. In production this MUST come
// from the environment. If missing, we fail loudly rather than silently
// signing JWTs with a random value (which would break sessions and trigger
// CLIENT_FETCH_ERROR on the browser).
const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? undefined
    : 'RestoPanel_Dev_Secret_2026_ChangeMe_8f7a9b2c4e1d')

if (!NEXTAUTH_SECRET) {
  throw new Error(
    'NEXTAUTH_SECRET is required. Generate one with `openssl rand -base64 32` and set it in your .env file.'
  )
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  secret: NEXTAUTH_SECRET,
  // trustHost lets NextAuth derive the URL from the Host header. This is the
  // recommended approach for Vercel, Docker, and any reverse-proxy setup.
  // We still fall back to NEXTAUTH_URL if present.
  ...(process.env.NEXTAUTH_URL ? { url: process.env.NEXTAUTH_URL } : {}),
  trustHost: true,
  pages: { signIn: '/' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { restaurant: true },
        })
        if (!user) return null
        const ok = await verifyPassword(credentials.password, user.passwordHash)
        if (!ok) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurantId,
          restaurantName: user.restaurant.name,
          restaurantSlug: user.restaurant.slug,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.restaurantId = (user as any).restaurantId
        token.restaurantName = (user as any).restaurantName
        token.restaurantSlug = (user as any).restaurantSlug
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).restaurantId = token.restaurantId
        ;(session.user as any).restaurantName = token.restaurantName
        ;(session.user as any).restaurantSlug = token.restaurantSlug
      }
      return session
    },
  },
}

export type AppSession = {
  user: {
    id: string
    email: string
    name: string
    role: 'ADMIN' | 'STAFF'
    restaurantId: string
    restaurantName: string
    restaurantSlug: string
  }
}
