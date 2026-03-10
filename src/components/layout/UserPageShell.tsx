import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '@/components/layout/AppHeader'

interface UserPageShellProps {
  username: string
  grade?: number | 'teacher'
  classNumber?: string
  showThemeToggle?: boolean
  children: ReactNode
}

interface PageSectionProps {
  children: ReactNode
  className?: string
}

interface PageHeroProps {
  eyebrow?: string
  title: string
  description?: string
  badge?: ReactNode
  aside?: ReactNode
}

const shellBorder = 'border'
const shellShadow = 'shadow-[0_22px_70px_rgba(0,0,0,0.28)]'

export function UserPageShell({ username, grade, classNumber, showThemeToggle = false, children }: UserPageShellProps) {
  return (
    <div className="min-h-screen pb-10 theme-bg theme-text">
      <AppHeader username={username} grade={grade} classNumber={classNumber} showThemeToggle={showThemeToggle} />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-5 lg:px-6">
        <div
          className={`rounded-[1.75rem] p-4 sm:p-5 lg:p-7 ${shellBorder} ${shellShadow}`}
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-light)',
          }}
        >
          {children}
        </div>
      </main>
    </div>
  )
}

export function PageHero({ eyebrow, title, description, badge, aside }: PageHeroProps) {
  return (
    <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] uppercase tracking-[0.22em] theme-text-muted">{eyebrow}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-[-0.04em] theme-text sm:text-[2rem]">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 theme-text-secondary sm:text-[15px]">{description}</p>
        ) : null}
      </div>
      {aside ? <div className="flex justify-start lg:justify-end">{aside}</div> : null}
    </section>
  )
}

export function PageSection({ children, className = '' }: PageSectionProps) {
  return (
    <section
      className={`rounded-[1.35rem] p-4 sm:p-5 ${shellBorder} ${className}`}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border-light)',
      }}
    >
      {children}
    </section>
  )
}

export function PageSectionTitle({
  eyebrow,
  title,
  meta,
}: {
  eyebrow?: string
  title: string
  meta?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        {eyebrow ? <p className="text-[11px] uppercase tracking-[0.2em] theme-text-muted">{eyebrow}</p> : null}
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] theme-text">{title}</h2>
      </div>
      {meta}
    </div>
  )
}

export function PageMetric({
  label,
  value,
  unit,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  unit?: string
  tone?: 'default' | 'soft' | 'accent'
}) {
  const toneClass = tone === 'accent'
    ? ''
    : tone === 'soft'
      ? ''
      : ''
  const toneStyle = tone === 'accent'
    ? { backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)' }
    : tone === 'soft'
      ? { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)' }
      : { backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-light)' }

  return (
    <div className={`rounded-[1.2rem] p-4 ${toneClass}`} style={toneStyle}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-current/55">{label}</p>
      <div className="mt-3 flex items-end gap-1.5">
        <div className="text-3xl font-semibold tracking-[-0.05em]">{value}</div>
        {unit ? <span className="pb-1 text-sm text-current/65">{unit}</span> : null}
      </div>
    </div>
  )
}

export function PageBackLink({ to = '/home', label = 'ホームに戻る' }: { to?: string; label?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-11 items-center justify-center rounded-[1rem] border px-4 text-sm font-medium transition-colors"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border-light)',
        color: 'var(--color-text-secondary)',
      }}
    >
      {label}
    </Link>
  )
}

export function PageEmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div
      className="rounded-[1.2rem] border border-dashed px-4 py-8 text-center"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border-light)',
      }}
    >
      <p className="text-sm font-medium theme-text">{title}</p>
      {description ? <p className="mt-2 text-sm theme-text-secondary">{description}</p> : null}
    </div>
  )
}
