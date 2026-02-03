import { Link } from 'react-router-dom'
import { useState } from 'react'

interface HeaderProps {
  showLoginButton?: boolean
}

export default function Header({ showLoginButton = true }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="bg-hatofes-bg">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Hamburger Menu */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex flex-col justify-center gap-1.5 w-8 h-8"
          aria-label="メニュー"
        >
          <span className={`bg-hatofes-white h-0.5 w-6 transition-transform ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`bg-hatofes-white h-0.5 w-6 transition-opacity ${isMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`bg-hatofes-white h-0.5 w-6 transition-transform ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>

        {/* Logo */}
        <Link to="/" className="font-display font-bold text-lg tracking-tight text-hatofes-white">
          Hato Fes App.
        </Link>

        {/* Login Button */}
        {showLoginButton ? (
          <Link to="/login" className="btn-main text-sm px-4 py-1.5">
            Log in
          </Link>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <nav className="bg-hatofes-bg border-t border-hatofes-gray-lighter px-4 py-4">
          <ul className="space-y-4">
            <li>
              <Link to="/" className="block py-2 text-hatofes-white hover:text-hatofes-accent-yellow" onClick={() => setIsMenuOpen(false)}>
                Home
              </Link>
            </li>
            <li>
              <Link to="/about" className="block py-2 text-hatofes-white hover:text-hatofes-accent-yellow" onClick={() => setIsMenuOpen(false)}>
                About
              </Link>
            </li>
            <li>
              <Link to="/QandA" className="block py-2 text-hatofes-white hover:text-hatofes-accent-yellow" onClick={() => setIsMenuOpen(false)}>
                Q & A
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
