import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../../lib/firebase'

export default function GoogleAuthPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleAuth = async () => {
    setLoading(true)
    setError(null)

    try {
      // Sign in with Google
      const result = await signInWithPopup(auth, googleProvider)

      // ドメインチェック（VITE_RESTRICT_DOMAIN=true の場合のみ）
      if (import.meta.env.VITE_RESTRICT_DOMAIN === 'true') {
        const email = result.user.email || ''
        if (!email.endsWith('@g.nagano-c.ed.jp')) {
          setError('学校のGoogleアカウント（@g.nagano-c.ed.jp）でログインしてください')
          await auth.signOut()
          setLoading(false)
          return
        }
      }

      // 認証成功後は /home へ。ProtectedRoute がユーザードキュメントの存在確認を行い、
      // 新規アカウントの場合は /register へリダイレクトする
      navigate('/home')
    } catch (err: unknown) {
      console.error('Error during Google sign-in:', err)
      if (err instanceof Error) {
        if (err.message.includes('popup-closed-by-user')) {
          setError('ログインがキャンセルされました')
        } else if (err.message.includes('popup-blocked')) {
          setError('ポップアップがブロックされました。ブラウザの設定を確認してください')
        } else {
          setError('ログインに失敗しました。もう一度お試しください')
        }
      } else {
        setError('ログインに失敗しました。もう一度お試しください')
      }
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-hatofes-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-8">
        {/* Logo */}
        <div className="mb-12">
          <p className="text-sm text-hatofes-white mb-2">
            第 <span className="text-gradient font-display text-2xl font-bold mx-1">70</span> 期 鳩祭実行委員会
          </p>
          <h1 className="font-display text-3xl font-bold text-gradient">
            Hato Fes App.
          </h1>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Google Login Button */}
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="btn-main w-full py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              ログイン中...
            </span>
          ) : (
            'Googleでログイン'
          )}
        </button>

        {/* Back Button */}
        <button onClick={() => navigate('/login')} className="btn-sub w-full py-3 rounded-full">
          ホームに戻る
        </button>

        {/* Info */}
        <p className="text-xs text-hatofes-gray-light mt-8">
          ※ 学校のGoogleアカウント<br />
          （@g.nagano-c.ed.jp）でログインしてください
        </p>
      </div>
    </div>
  )
}
