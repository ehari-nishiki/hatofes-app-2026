import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface StaffRouteProps {
  children: React.ReactNode
  staffAllowed?: boolean
}

/**
 * スタッフ権限制限コンポーネント
 * - admin: 全ページにアクセス可能
 * - staff: staffAllowed=true のページのみアクセス可能
 * - その他: /home にリダイレクト
 */
export function StaffRoute({ children, staffAllowed = false }: StaffRouteProps) {
  const { currentUser, userData, loading, userDataLoading, userDataChecked } = useAuth()

  // 認証チェック中はローディング表示
  if (loading || userDataLoading || !userDataChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hatofes-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hatofes-accent-yellow mx-auto mb-4"></div>
          <p className="text-hatofes-gray">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 未認証 → ログイン画面へ
  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  // ユーザーデータなし → 登録画面へ
  if (!userData) {
    return <Navigate to="/register" replace />
  }

  // adminは全ページにアクセス可能
  if (userData.role === 'admin') {
    return <>{children}</>
  }

  // staffは指定されたページのみアクセス可能
  if (userData.role === 'staff') {
    if (staffAllowed) {
      return <>{children}</>
    }
    // アクセス不可の場合はスタッフダッシュボードへ
    return <Navigate to="/admin/staff-dashboard" replace />
  }

  // その他のロールはホームへリダイレクト
  return <Navigate to="/home" replace />
}
