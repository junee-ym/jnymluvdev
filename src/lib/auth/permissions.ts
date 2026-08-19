import type { Role } from '@/lib/types'

export function isOperatorOrAdmin(role: Role): boolean {
  return role === 'OPERATOR' || role === 'ADMIN'
}

export function canModify(
  currentUserId: string,
  ownerUserId: string,
  role: Role
): boolean {
  return currentUserId === ownerUserId || isOperatorOrAdmin(role)
}
