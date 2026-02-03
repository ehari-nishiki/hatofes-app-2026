import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-hatofes-dark text-hatofes-white">
      {/* Navigation */}
      <div className="py-4">
        <nav className="max-w-6xl mx-auto px-4">
          <ul className="flex justify-center gap-8 text-sm">
            <li>
              <Link to="/" className="hover:text-hatofes-accent-yellow transition-colors">
                Home
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-hatofes-accent-yellow transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link to="/QandA" className="hover:text-hatofes-accent-yellow transition-colors">
                Q & A
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Logo Section */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center">
          <p className="font-display text-2xl font-bold text-gradient">Hato Fes App.</p>
        </div>
      </div>

      {/* 70th Anniversary */}
      <div className="py-3">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-sm">
            第 <span className="font-display text-xl font-bold text-gradient mx-1">70</span> 期 鳩祭実行委員会
          </p>
        </div>
      </div>

      {/* Copyright */}
      <div className="bg-hatofes-black py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-hatofes-gray">
          <p className="mb-1">
            Powered by the Hato festival Executive Committee, Information Division
          </p>
          <p>
            © 2026 Hato festival Executive Committee, Yashiro High School - All rights reserved
          </p>
        </div>
      </div>
    </footer>
  )
}
