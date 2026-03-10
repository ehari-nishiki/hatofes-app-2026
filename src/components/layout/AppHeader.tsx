import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LevelBadge } from '@/components/ui/LevelBadge'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { RoleBadge } from '@/lib/roleDisplay'

interface AppHeaderProps {
  username?: string
  grade?: number | 'teacher'
  classNumber?: string
  points?: number
  department?: string
  showLogout?: boolean
  showThemeToggle?: boolean
}

export default function AppHeader({ username = '勇敢な虹色の鳩', grade: _grade = 2, classNumber: _classNumber = 'A', points, department, showLogout = true, showThemeToggle = false }: AppHeaderProps) {
  const { signOut, userData } = useAuth()
  const navigate = useNavigate()

  // propsが渡されていない場合はuserDataから取得
  const displayPoints = points ?? userData?.totalPoints ?? 0

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="relative z-20 pt-4">
      <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 px-4 lg:px-6">
        <Link
          to="/home"
          className="rounded-[1.1rem] px-4 py-3 text-sm font-medium tracking-[-0.02em] shadow-[0_14px_30px_rgba(0,0,0,0.16)] backdrop-blur sm:px-5 sm:py-3.5"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 88%, transparent)',
            color: 'var(--color-text-primary)',
          }}
        >
          <span className="block text-[10px] uppercase tracking-[0.28em] theme-text-muted">Platform</span>
          <span className="mt-1.5 block font-display text-[1.55rem] font-black leading-none tracking-[-0.04em] sm:text-[1.9rem]">
            HatoFesApp
          </span>
        </Link>

        <div className="flex shrink-0 items-start gap-2 pt-1 sm:items-center sm:pt-0">
          {showThemeToggle && (
            <div
              className="rounded-[1rem] p-1.5 shadow-[0_14px_30px_rgba(0,0,0,0.16)] backdrop-blur"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 88%, transparent)' }}
            >
              <ThemeToggle />
            </div>
          )}

          <Link
            to="/profile"
            className="inline-flex h-12 items-center gap-2 rounded-[1rem] px-4 text-sm font-medium shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition-colors backdrop-blur"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 88%, transparent)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <UserAvatar name={username} imageUrl={userData?.profileImageUrl} size="sm" />
            <span className="hidden max-w-[9rem] truncate sm:inline">{username}</span>
            <LevelBadge points={displayPoints} size="sm" />
            {userData?.role ? <span className="hidden lg:inline-flex"><RoleBadge role={userData.role} department={department ?? userData.department} size="sm" /></span> : null}
          </Link>

          {showLogout && (
            <button
              onClick={handleLogout}
              className="flex h-12 w-12 items-center justify-center rounded-[1rem] shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition-colors backdrop-blur"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 88%, transparent)',
                color: 'var(--color-text-secondary)',
              }}
              title="ログアウト"
              aria-label="ログアウト"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}

        </div>
      </div>
    </header>
  )
}
