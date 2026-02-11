import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { currentUser, userData, loading, userDataChecked } = useAuth()

  // 既にログイン済みの場合はホームへリダイレクト
  useEffect(() => {
    if (loading || !userDataChecked) return

    if (currentUser && userData) {
      navigate('/home', { replace: true })
    }
  }, [currentUser, userData, loading, userDataChecked, navigate])

  const handleLogin = () => {
    // Googleログイン画面へ
    navigate('/auth/google')
  }

  const handleJoinIn = () => {
    // 新規登録フローへ（まずGoogle認証を行う）
    navigate('/auth/google')
  }

  return (
    <div className="min-h-screen flex flex-col bg-hatofes-bg">
      <Header showLoginButton={false} />

      {/* Main Content */}
      <main className="flex-1 px-4 py-12">
        <div className="max-w-md mx-auto space-y-10">
          {/* Login Section */}
          <section className="text-center">
            <p className="text-hatofes-white mb-4">ログインはこちら</p>
            <button onClick={handleLogin} className="btn-main w-48 py-3 rounded-full">
              Log In
            </button>
          </section>

          {/* Divider */}
          <div className="border-t border-hatofes-gray-lighter" />

          {/* Join Section */}
          <section className="text-center">
            <p className="text-hatofes-white mb-4">はじめてのご利用はこちら</p>
            <button onClick={handleJoinIn} className="btn-sub w-48 py-3 rounded-full">
              Join In
            </button>
          </section>

          {/* Divider */}
          <div className="border-t border-hatofes-gray-lighter" />

          {/* Q&A Section */}
          <section className="text-center">
            <p className="text-hatofes-white mb-4">よくある質問</p>
            <Link to="/QandA" className="btn-sub w-48 py-3 rounded-full inline-block text-center">
              Access to Q & A
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
