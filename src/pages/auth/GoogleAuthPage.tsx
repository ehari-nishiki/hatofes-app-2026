import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithPopup, signInWithRedirect, getRedirectResult, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { logAuthError } from '../../lib/authErrors'

// モバイル判定（デスクトップサイト表示モード対応）
const isMobile = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase()
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isSmallScreen = window.innerWidth < 768
  const mobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)

  return (hasTouchScreen && isSmallScreen) || mobileUserAgent
}

// localStorage に永続化されたログを読み込む
const loadPersistedLogs = (): string[] => {
  try {
    const logs = localStorage.getItem('auth_debug_logs')
    return logs ? JSON.parse(logs) : ['Component mounted']
  } catch {
    return ['Component mounted']
  }
}

// localStorage にログを保存
const savePersistedLog = (msg: string) => {
  try {
    const logs = loadPersistedLogs()
    const newLogs = [...logs, `${new Date().toLocaleTimeString()}: ${msg}`].slice(-20) // 最新20件を保持
    localStorage.setItem('auth_debug_logs', JSON.stringify(newLogs))
  } catch (err) {
    console.error('Failed to save log to localStorage:', err)
  }
}

export default function GoogleAuthPage() {
  const navigate = useNavigate()
  const { currentUser, userData, loading: authLoading, userDataChecked } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string[]>(loadPersistedLogs())
  const processingAuthRef = useRef(false)

  // デバッグログを画面に追加 & localStorage に永続化
  const addDebugLog = useCallback((msg: string) => {
    console.log(`[GoogleAuth] ${msg}`)
    savePersistedLog(msg)
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`].slice(-20))
  }, [])

  // 認証後のナビゲーション処理
  const handlePostAuthNavigation = useCallback(async (user: User) => {
    if (processingAuthRef.current) {
      addDebugLog('Already processing, skipping')
      return
    }
    processingAuthRef.current = true
    addDebugLog(`Post-auth nav for: ${user.email}`)

    try {
      // Firestoreでユーザードキュメントを直接確認
      const userDocRef = doc(db, 'users', user.uid)
      const userDocSnap = await getDoc(userDocRef)

      addDebugLog(`User doc exists: ${userDocSnap.exists()}`)

      if (userDocSnap.exists()) {
        addDebugLog('Navigating to /home')
        navigate('/home', { replace: true })
      } else {
        addDebugLog('Navigating to /register')
        navigate('/register', { replace: true })
      }
    } catch (err) {
      console.error('[GoogleAuth] Error checking user document:', err)
      addDebugLog(`Error: ${err instanceof Error ? err.message : 'Unknown'}`)
      // エラー時はAuthContextに任せる
      processingAuthRef.current = false
      setLoading(false)
      setError('ユーザー情報の取得に失敗しました')
    }
  }, [navigate, addDebugLog])

  // 既にログイン済みの場合はリダイレクト
  useEffect(() => {
    addDebugLog(`Auto-redirect check: authLoading=${authLoading}, userDataChecked=${userDataChecked}, processing=${processingAuthRef.current}, currentUser=${!!currentUser}, userData=${!!userData}`)

    if (authLoading || !userDataChecked || processingAuthRef.current) {
      addDebugLog('Auto-redirect skipped (waiting for auth)')
      return
    }

    if (currentUser) {
      if (userData) {
        addDebugLog('Auto-redirecting to /home')
        navigate('/home', { replace: true })
      } else {
        addDebugLog('Auto-redirecting to /register')
        navigate('/register', { replace: true })
      }
    } else {
      addDebugLog('No current user for auto-redirect')
    }
  }, [currentUser, userData, authLoading, userDataChecked, navigate, addDebugLog])

  // リダイレクト結果を処理
  useEffect(() => {
    addDebugLog('=== Page loaded/mounted ===')
    addDebugLog(`useEffect triggered - URL: ${window.location.href}`)

    // 既に処理済みかチェック
    const redirectProcessed = sessionStorage.getItem('redirect_processed')
    if (redirectProcessed === 'true') {
      addDebugLog('Redirect already processed this session, skipping')
      setLoading(false)
      return
    }

    const handleRedirectResult = async () => {
      addDebugLog('Starting redirect check')

      try {
        // 処理中フラグを設定
        sessionStorage.setItem('redirect_processing', 'true')

        addDebugLog('Calling getRedirectResult...')
        const result = await getRedirectResult(auth)

        // 処理済みフラグを設定
        sessionStorage.setItem('redirect_processed', 'true')
        sessionStorage.removeItem('redirect_processing')

        addDebugLog(`Redirect result: ${result ? 'User found' : 'No result'}`)

        if (result && result.user) {
          console.log('[GoogleAuth] User from redirect:', result.user.email)
          addDebugLog(`User from redirect: ${result.user.email}`)

          // ドメインチェック
          if (import.meta.env.VITE_RESTRICT_DOMAIN === 'true') {
            const email = result.user.email || ''
            if (!email.endsWith('@g.nagano-c.ed.jp')) {
              console.log('[GoogleAuth] Invalid domain:', email)
              addDebugLog(`Invalid domain: ${email}`)
              logAuthError('AUTH_001', new Error('Invalid email domain in redirect'), {
                email,
                step: 'auth',
              }, result.user.uid).catch(console.error)
              setError('学校のGoogleアカウント（@g.nagano-c.ed.jp）でログインしてください')
              await auth.signOut()
              setLoading(false)
              return
            }
          }

          // Firestore操作にタイムアウト追加（10秒）
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 10000)
          )

          try {
            await Promise.race([
              handlePostAuthNavigation(result.user),
              timeoutPromise
            ])
          } catch (err) {
            if (err instanceof Error && err.message === 'Firestore timeout') {
              addDebugLog('Firestore timeout - retrying...')
              await handlePostAuthNavigation(result.user)
            } else {
              throw err
            }
          }
          return
        }

        // リダイレクト結果なし - 既存ユーザーチェック
        console.log('[GoogleAuth] No redirect result')
        addDebugLog('No redirect result, checking existing user')

        if (auth.currentUser && !processingAuthRef.current) {
          console.log('[GoogleAuth] Existing user found:', auth.currentUser.uid)
          addDebugLog(`Existing user: ${auth.currentUser.email}`)
          await handlePostAuthNavigation(auth.currentUser)
          return
        }

        console.log('[GoogleAuth] No user found, stopping loading')
        addDebugLog('No user found - login required')
        setLoading(false)
      } catch (err: unknown) {
        console.error('[GoogleAuth] Error processing redirect result:', err)
        const errMsg = err instanceof Error ? err.message : String(err)
        addDebugLog(`Redirect error: ${errMsg}`)
        sessionStorage.removeItem('redirect_processing')
        logAuthError('AUTH_008', err, { step: 'auth' }).catch(console.error)
        setError('ログインに失敗しました。もう一度お試しください')
        setLoading(false)
        processingAuthRef.current = false
      }
    }

    // 処理中でなければ実行
    const isProcessing = sessionStorage.getItem('redirect_processing')
    if (isProcessing !== 'true') {
      handleRedirectResult()
    } else {
      addDebugLog('Redirect processing in progress, waiting...')
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // クリーンアップ用useEffect追加
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('redirect_processing')
    }
  }, [])

  const handleGoogleAuth = async () => {
    setLoading(true)
    setError(null)
    addDebugLog('=== Login button clicked ===')

    try {
      const mobile = isMobile()
      addDebugLog(`Device: ${mobile ? 'Mobile' : 'Desktop'}`)
      addDebugLog(`User agent: ${navigator.userAgent}`)
      addDebugLog(`Window size: ${window.innerWidth}x${window.innerHeight}`)
      addDebugLog(`localStorage test: ${(() => { try { localStorage.setItem('test', '1'); localStorage.removeItem('test'); return 'OK' } catch { return 'BLOCKED' } })()}`)

      // モバイルでもまず Popup を試す（iOS Safari 14.5+, Android Chrome 88+ はサポート）
      const usePopup = !mobile || window.innerWidth >= 768 // タブレットサイズ以上は Popup

      if (usePopup) {
        // Popup方式
        addDebugLog('Attempting popup sign-in')
        try {
          const result = await signInWithPopup(auth, googleProvider)
          addDebugLog(`Popup result: ${result.user.email}`)

          // ドメインチェック
          if (import.meta.env.VITE_RESTRICT_DOMAIN === 'true') {
            const email = result.user.email || ''
            if (!email.endsWith('@g.nagano-c.ed.jp')) {
              logAuthError('AUTH_001', new Error('Invalid email domain in popup'), {
                email,
                step: 'auth',
              }, result.user.uid).catch(console.error)
              setError('学校のGoogleアカウント（@g.nagano-c.ed.jp）でログインしてください')
              await auth.signOut()
              setLoading(false)
              return
            }
          }

          // 直接ナビゲーション
          await handlePostAuthNavigation(result.user)
          return
        } catch (popupErr) {
          addDebugLog(`Popup failed: ${popupErr instanceof Error ? popupErr.message : String(popupErr)}`)

          // Popup がブロックされた場合のみ Redirect にフォールバック
          if (popupErr instanceof Error && (popupErr.message.includes('popup-blocked') || popupErr.message.includes('popup-closed-by-user'))) {
            if (!mobile) {
              // デスクトップでは Popup エラーを表示
              setError('ポップアップがブロックされました。ブラウザの設定を確認してください')
              setLoading(false)
              return
            }
            // モバイルは Redirect にフォールバック
            addDebugLog('Falling back to redirect sign-in')
          } else {
            throw popupErr // その他のエラーは外側の catch で処理
          }
        }
      }

      // モバイル: リダイレクト方式（Popup が使えない場合のみ）
      addDebugLog('Starting redirect sign-in')
      addDebugLog(`Auth domain: ${auth.config.authDomain}`)
      addDebugLog(`Current URL: ${window.location.href}`)
      addDebugLog(`Redirect will return to: ${window.location.origin}${window.location.pathname}`)

      await signInWithRedirect(auth, googleProvider)
      addDebugLog('Redirect initiated (this log will disappear after redirect)')
      // この後、ページ全体がリダイレクトされるため、以降のコードは実行されない

      // Redirect では return されないため、ここには到達しない
    } catch (err: unknown) {
      console.error('Error during Google sign-in:', err)
      addDebugLog(`Sign-in error: ${err instanceof Error ? err.message : String(err)}`)

      if (err instanceof Error) {
        if (err.message.includes('popup-closed-by-user')) {
          setError('ログインがキャンセルされました')
        } else if (err.message.includes('popup-blocked')) {
          logAuthError('AUTH_007', err, { step: 'auth' }).catch(console.error)
          setError('ポップアップがブロックされました。ブラウザの設定を確認してください')
        } else if (err.message.includes('auth/unauthorized-domain')) {
          logAuthError('AUTH_009', err, { step: 'auth' }).catch(console.error)
          setError('認証エラー: ドメインが許可されていません。Firebase Consoleを確認してください')
        } else {
          logAuthError('AUTH_008', err, { step: 'auth' }).catch(console.error)
          setError('ログインに失敗しました。もう一度お試しください')
        }
      } else {
        logAuthError('AUTH_008', err, { step: 'auth' }).catch(console.error)
        setError('ログインに失敗しました。もう一度お試しください')
      }
      setLoading(false)
    }
  }

  // ログクリア機能
  const clearDebugLogs = () => {
    try {
      localStorage.removeItem('auth_debug_logs')
      setDebugInfo(['Logs cleared'])
      addDebugLog('Logs cleared by user')
    } catch (err) {
      console.error('Failed to clear logs:', err)
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

        {/* Debug Info */}
        {debugInfo.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500 text-blue-400 px-3 py-2 rounded-lg text-xs text-left">
            <div className="flex justify-between items-center mb-1">
              <div className="font-bold">🔍 Debug Log (永続化):</div>
              <button
                onClick={clearDebugLogs}
                className="text-[10px] bg-red-500/20 hover:bg-red-500/30 px-2 py-1 rounded"
              >
                Clear
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {debugInfo.map((log, i) => (
                <div key={i} className="font-mono text-[10px] break-all">{log}</div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-blue-500/30 text-[10px] opacity-70">
              Storage: localStorage={typeof localStorage !== 'undefined' ? '✅' : '❌'} |
              sessionStorage={typeof sessionStorage !== 'undefined' ? '✅' : '❌'}
            </div>
          </div>
        )}

        {/* Status Info */}
        {loading && (
          <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg text-sm">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
              <span>認証処理中...</span>
            </div>
            <div className="text-xs mt-2 opacity-70">
              User: {currentUser ? '認証済み' : '未認証'}<br/>
              UserData: {userData ? '取得済み' : '未取得'}<br/>
              Processing: {processingAuthRef.current ? 'true' : 'false'}
            </div>
          </div>
        )}

        {/* Current State Info */}
        <div className="bg-gray-500/10 border border-gray-500 text-gray-400 px-3 py-2 rounded-lg text-xs">
          <div className="font-bold mb-2">📊 System State:</div>
          <div className="grid grid-cols-2 gap-2">
            <div>Auth Loading: {authLoading ? '🟡' : '✅'}</div>
            <div>Data Checked: {userDataChecked ? '✅' : '🟡'}</div>
            <div>Current User: {currentUser ? '✅' : '❌'}</div>
            <div>User Data: {userData ? '✅' : '❌'}</div>
            <div>Page Loading: {loading ? '🟡' : '✅'}</div>
            <div>Processing: {processingAuthRef.current ? '🟡' : '✅'}</div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-500/30 text-[10px]">
            <div>Device: {isMobile() ? '📱 Mobile' : '💻 Desktop'}</div>
            <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
          </div>
        </div>

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
