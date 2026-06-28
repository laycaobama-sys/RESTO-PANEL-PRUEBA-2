import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
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
  interface User {
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
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
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
