import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LevelBadge } from '@/components/ui/LevelBadge'

interface AppHeaderProps {
  username?: string
  grade?: number | 'teacher'
  classNumber?: string
  points?: number
  department?: string
}

export default function AppHeader({ username = '勇敢な虹色の鳩', grade = 2, classNumber = 'A', points, department }: AppHeaderProps) {
  const { signOut, userData } = useAuth()
  const navigate = useNavigate()
  const affiliation = grade === 'teacher' ? '教員' : `${grade}年${classNumber}組`

  // propsが渡されていない場合はuserDataから取得
  const displayPoints = points ?? userData?.totalPoints ?? 0
  const displayDepartment = department ?? userData?.department

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="bg-hatofes-bg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link to="/home" className="font-display font-bold text-lg tracking-tight text-gradient">
          Hato Fes App.
        </Link>

        {/* Account & Logout */}
        <div className="flex items-center gap-4">
          {/* Account Info - Clickable */}
          <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-0.5">
                <p className="text-xs text-hatofes-white font-medium">{username}</p>
                <LevelBadge points={displayPoints} size="sm" />
              </div>
              <p className="text-xs text-hatofes-gray-light">{affiliation}</p>
              {displayDepartment && (
                <p className="text-xs text-hatofes-accent-yellow">{displayDepartment}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hatofes-accent-yellow to-hatofes-accent-orange flex items-center justify-center text-white font-bold">
              {username.charAt(0)}
            </div>
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 text-hatofes-gray hover:text-hatofes-accent-orange transition-colors group"
            title="ログアウト"
          >
            <svg
              className="w-5 h-5 transform group-hover:translate-x-0.5 transition-transform"
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
        </div>
      </div>
    </header>
  )
}
