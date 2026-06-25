import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Re-export format helpers for backward compatibility (server-only)
export {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  timeAgo,
  minutesBetween,
  slugify,
} from '@/lib/format'
