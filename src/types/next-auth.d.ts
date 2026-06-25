import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
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
  interface User {
    id: string
    email: string
    name: string
    role: 'ADMIN' | 'STAFF'
    restaurantId: string
    restaurantName: string
    restaurantSlug: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'STAFF'
    restaurantId: string
    restaurantName: string
    restaurantSlug: string
  }
}
