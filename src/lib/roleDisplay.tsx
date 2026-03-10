import type { ReactNode } from 'react'
import type { UserRole } from '@/types/firestore'

export const ROLE_LABELS: Record<UserRole, string> = {
  student: '生徒',
  teacher: '教員',
  staff: '運営',
  admin: '管理',
}

export function getRoleDisplayLabel(role: UserRole, department?: string | null) {
  if ((role === 'staff' || role === 'admin') && department?.trim()) {
    return department.trim()
  }
  return ROLE_LABELS[role]
}

export function getRoleTone(role: UserRole) {
  if (role === 'admin') {
    return {
      bg: 'bg-[#2d2818]',
      text: 'text-[#f7d37c]',
      border: 'border-[#f7d37c]/20',
    }
  }
  if (role === 'staff') {
    return {
      bg: 'bg-[#251933]',
      text: 'text-[#d6bcff]',
      border: 'border-[#d6bcff]/20',
    }
  }
  if (role === 'teacher') {
    return {
      bg: 'bg-[#18251d]',
      text: 'text-[#bde5c5]',
      border: 'border-[#bde5c5]/20',
    }
  }
  return {
    bg: 'bg-[#162232]',
    text: 'text-[#bfd5ff]',
    border: 'border-[#bfd5ff]/20',
  }
}

export function RoleBadge({
  role,
  department,
  size = 'md',
  suffix,
}: {
  role: UserRole
  department?: string | null
  size?: 'sm' | 'md'
  suffix?: ReactNode
}) {
  const tone = getRoleTone(role)
  const label = getRoleDisplayLabel(role, department)
  const padding = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'

  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full border ${tone.bg} ${tone.text} ${tone.border} ${padding}`}>
      <span className="truncate whitespace-nowrap">{label}</span>
      {suffix}
    </span>
  )
}
