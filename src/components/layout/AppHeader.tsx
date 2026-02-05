import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface AppHeaderProps {
  username?: string
  grade?: number | 'teacher'
  classNumber?: string
}

export default function AppHeader({ username = '勇敢な虹色の鳩', grade = 2, classNumber = 'A' }: AppHeaderProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const affiliation = grade === 'teacher' ? '教員' : `${grade}年${classNumber}組`

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
              <p className="text-xs text-hatofes-white font-medium">{username}</p>
              <p className="text-xs text-hatofes-gray-light">{affiliation}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hatofes-accent-yellow to-hatofes-accent-orange flex items-center justify-center text-white font-bold">
              {username.charAt(0)}
            </div>
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="text-xs text-hatofes-gray hover:text-hatofes-accent-orange transition-colors"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  )
}
