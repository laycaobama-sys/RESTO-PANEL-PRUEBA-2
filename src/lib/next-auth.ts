import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'

// Stable secret — required for production. Fail loudly if missing.
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
        // Look up the user in Supabase (server-side, service_role).
        const user = await db.user.findByEmail(credentials.email.toLowerCase().trim())
        if (!user) return null
        const ok = await verifyPassword(credentials.password, user.password_hash)
        if (!ok) return null
        // Fetch the organization so we can put it in the JWT.
        const org = await db.organization.findById(user.organization_id)
        if (!org) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as 'ADMIN' | 'STAFF',
          restaurantId: org.id,           // alias for backward compat
          restaurantName: org.name,
          restaurantSlug: org.slug,
          organizationId: org.id,
          organizationName: org.name,
          organizationSlug: org.slug,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any
        token.id = u.id
        token.role = u.role
        // Keep both naming conventions so old code doesn't break.
        token.restaurantId = u.restaurantId
        token.restaurantName = u.restaurantName
        token.restaurantSlug = u.restaurantSlug
        token.organizationId = u.organizationId
        token.organizationName = u.organizationName
        token.organizationSlug = u.organizationSlug
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any
        u.id = token.id
        u.role = token.role
        u.restaurantId = token.restaurantId
        u.restaurantName = token.restaurantName
        u.restaurantSlug = token.restaurantSlug
        u.organizationId = token.organizationId
        u.organizationName = token.organizationName
        u.organizationSlug = token.organizationSlug
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
    organizationId: string
    organizationName: string
    organizationSlug: string
  }
}
