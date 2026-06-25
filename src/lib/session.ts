import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/next-auth'

export async function getSession() {
  return getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return null
  return user
}
