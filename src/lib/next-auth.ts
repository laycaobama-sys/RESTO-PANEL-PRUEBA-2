import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import {
  isAccountLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  getLockoutRemaining,
  generateJti,
  createSession,
  isSessionValid,
  revokeSession,
  updateLastLogin,
  logActivity,
} from '@/lib/session-management'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET

if (!NEXTAUTH_SECRET) {
  throw new Error(
    'NEXTAUTH_SECRET is required. Generate one with `openssl rand -base64 32` and set it in your .env file.'
  )
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  secret: NEXTAUTH_SECRET,
  ...(({ trustHost: true } as any) as Partial<NextAuthOptions>),
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.toLowerCase().trim()

        // ─── Brute force protection ──────────────────────────
        if (isAccountLocked(email)) {
          const remaining = getLockoutRemaining(email)
          throw new Error(`Cuenta bloqueada. Intenta de nuevo en ${Math.ceil(remaining / 60)} minutos.`)
        }

        const user = await db.user.findByEmail(email)
        if (!user) {
          recordFailedLogin(email)
          return null
        }

        // Blocked users cannot log in.
        if (user.blocked) {
          recordFailedLogin(email)
          return null
        }

        // Email verification gate: in production, users with unverified
        // emails cannot log in. This is controlled by REQUIRE_EMAIL_VERIFICATION
        // env var (defaults to true in production, false in development).
        // Super admins bypass this check (they're created via env var).
        const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true'
          || process.env.NODE_ENV === 'production'
        if (requireVerification && !user.email_verified && !user.is_super_admin) {
          recordFailedLogin(email)
          throw new Error('Tu email no está verificado. Revisa tu correo y haz clic en el enlace de verificación.')
        }

        const ok = await verifyPassword(credentials.password, user.password_hash)
        if (!ok) {
          const result = recordFailedLogin(email)
          if (result.locked) {
            throw new Error('Cuenta bloqueada por demasiados intentos. Intenta de nuevo en 15 minutos.')
          }
          return null
        }

        // ─── Successful login ────────────────────────────────
        recordSuccessfulLogin(email)

        // Get IP and user agent for session tracking
        // NextAuth v4 passes a different request object — use safe access
        const headers = (req as any)?.headers || {};
        const ip = headers['x-forwarded-for']?.split(',')[0]?.trim()
          || headers['x-real-ip'] || null;
        const ua = headers['user-agent'] || null;

        // Update last login
        await updateLastLogin(user.id, ip, ua)

        // Log activity
        await logActivity(user.id, user.organization_id, 'login', undefined, undefined, { ip, ua }, ip, ua)

        // SUPER_ADMIN login — no organization needed, will see global panel.
        if (user.is_super_admin) {
          const jti = generateJti()
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          await createSession(user.id, null, jti, ip, ua, expiresAt)

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: 'SUPER_ADMIN' as const,
            isSuperAdmin: true,
            restaurantId: '',
            restaurantName: 'RestoPanel HQ',
            restaurantSlug: '',
            organizationId: '',
            organizationName: 'RestoPanel HQ',
            organizationSlug: '',
            jti,
          } as any
        }

        // Regular tenant user — load organization context.
        if (!user.organization_id) return null
        const org = await db.organization.findById(user.organization_id)
        if (!org) return null

        // Block suspended tenants from logging in.
        if (org.status === 'SUSPENDED') return null

        const jti = generateJti()
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        await createSession(user.id, user.organization_id, jti, ip, ua, expiresAt)

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
          jti,
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
        token.jti = u.jti || ''
        return token
      }

      // ─── Per-request session validity check ────────────────
      // If the JTI has been revoked (e.g., user logged out from
      // another device, or super-admin revoked the session), the
      // token is invalidated and the user must re-authenticate.
      if (token.jti) {
        const valid = await isSessionValid(token.jti as string)
        if (!valid) {
          // Returning an empty object drops all claims — NextAuth
          // treats this as "logged out" and redirects to /login.
          return {} as any
        }
      }

      // Read impersonation cookies (set by /api/admin/impersonate).
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

      // Allow session update via `update` trigger.
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
        u.jti = token.jti

        // If the super admin is impersonating a tenant, override the
        // organization context so the dashboard shows that tenant's data.
        if (token.isSuperAdmin && token.impersonatingOrgId) {
          u.organizationId = token.impersonatingOrgId
          u.organizationName = token.impersonatingOrgName
          u.organizationSlug = token.impersonatingOrgId
          u.restaurantId = token.impersonatingOrgId
          u.restaurantName = token.impersonatingOrgName
          u.restaurantSlug = ''
          u.role = 'ADMIN'
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
  events: {
    // When the user logs out (signOut), revoke the DB-tracked session
    // so that the JTI can no longer be used even if the JWT cookie
    // hasn't expired client-side.
    async signOut(message) {
      const token = message.token as any
      if (token?.jti) {
        await revokeSession(token.jti as string)
      }
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
    jti: string
  }
}
