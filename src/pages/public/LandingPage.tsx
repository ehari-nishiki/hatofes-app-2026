import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useAuth } from '@/contexts/AuthContext'

export default function LandingPage() {
  const navigate = useNavigate()
  const { currentUser, userData, loading, userDataChecked } = useAuth()

  // 既にログイン済みの場合はホームへリダイレクト
  useEffect(() => {
    if (loading || !userDataChecked) return

    if (currentUser && userData) {
      navigate('/home', { replace: true })
    }
  }, [currentUser, userData, loading, userDataChecked, navigate])

  return (
    <div className="min-h-screen flex flex-col bg-hatofes-bg">
      <Header />

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center py-16 md:py-24">
        <div className="text-center px-4">
          <h1 className="font-display text-6xl md:text-8xl font-bold text-gradient tracking-tight">
            鳩祭
          </h1>
        </div>
      </section>

      {/* Movie Section */}
      <section className="py-12 md:py-16 border-t border-hatofes-gray-lighter">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold tracking-wider mb-8 text-hatofes-white">
            MOVIE
          </h2>
          {/* Video Placeholder */}
          <div className="aspect-video bg-hatofes-dark rounded-lg flex items-center justify-center border border-hatofes-gray-lighter">
            <span className="text-hatofes-gray">Coming Soon</span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
