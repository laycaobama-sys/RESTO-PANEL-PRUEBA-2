import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'

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
        const user = await db.user.findByEmail(credentials.email.toLowerCase().trim())
        if (!user) return null
        const ok = await verifyPassword(credentials.password, user.password_hash)
        if (!ok) return null

        // SUPER_ADMIN login — no organization needed, will see global panel.
        if (user.is_super_admin) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: 'SUPER_ADMIN' as const,
            isSuperAdmin: true,
            // No organization context for super admins.
            restaurantId: '',
            restaurantName: 'RestoPanel HQ',
            restaurantSlug: '',
            organizationId: '',
            organizationName: 'RestoPanel HQ',
            organizationSlug: '',
          } as any
        }

        // Regular tenant user — load organization context.
        if (!user.organization_id) return null
        const org = await db.organization.findById(user.organization_id)
        if (!org) return null

        // Block suspended tenants from logging in.
        if (org.status === 'SUSPENDED') return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as 'ADMIN' | 'STAFF',
          isSuperAdmin: false,
          restaurantId: org.id,
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
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in: copy user fields into the JWT.
      if (user) {
        const u = user as any
        token.id = u.id
        token.role = u.role
        token.isSuperAdmin = u.isSuperAdmin || false
        token.restaurantId = u.restaurantId
        token.restaurantName = u.restaurantName
        token.restaurantSlug = u.restaurantSlug
        token.organizationId = u.organizationId
        token.organizationName = u.organizationName
        token.organizationSlug = u.organizationSlug
        token.impersonatingOrgId = null
        token.impersonatingOrgName = null
      }

      // Read impersonation cookies (set by /api/admin/impersonate).
      // Only super admins are allowed to impersonate; for everyone else
      // the cookies are ignored even if somehow set.
      if (token.isSuperAdmin) {
        const { cookies } = await import('next/headers')
        const cookieStore = await cookies()
        const impId = cookieStore.get('impersonate_org_id')?.value || null
        const impName = cookieStore.get('impersonate_org_name')?.value || null
        token.impersonatingOrgId = impId
        token.impersonatingOrgName = impName
      } else {
        token.impersonatingOrgId = null
        token.impersonatingOrgName = null
      }

      // Allow session update via `update` trigger (used to refresh data
      // after impersonation changes).
      if (trigger === 'update' && session) {
        const s = session as any
        if (s.impersonatingOrgId !== undefined) {
          token.impersonatingOrgId = s.impersonatingOrgId
          token.impersonatingOrgName = s.impersonatingOrgName
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any
        u.id = token.id
        u.role = token.role
        u.isSuperAdmin = token.isSuperAdmin
        // If the super admin is impersonating a tenant, override the
        // organization context so the dashboard shows that tenant's data.
        if (token.isSuperAdmin && token.impersonatingOrgId) {
          u.organizationId = token.impersonatingOrgId
          u.organizationName = token.impersonatingOrgName
          u.organizationSlug = token.impersonatingOrgId // not used for impersonated view
          u.restaurantId = token.impersonatingOrgId
          u.restaurantName = token.impersonatingOrgName
          u.restaurantSlug = ''
          u.role = 'ADMIN' // super admin acts as tenant admin while impersonating
        } else {
          u.restaurantId = token.restaurantId
          u.restaurantName = token.restaurantName
          u.restaurantSlug = token.restaurantSlug
          u.organizationId = token.organizationId
          u.organizationName = token.organizationName
          u.organizationSlug = token.organizationSlug
        }
        u.impersonatingOrgId = token.impersonatingOrgId
        u.impersonatingOrgName = token.impersonatingOrgName
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
    role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF'
    isSuperAdmin: boolean
    restaurantId: string
    restaurantName: string
    restaurantSlug: string
    organizationId: string
    organizationName: string
    organizationSlug: string
    impersonatingOrgId: string | null
    impersonatingOrgName: string | null
  }
}
