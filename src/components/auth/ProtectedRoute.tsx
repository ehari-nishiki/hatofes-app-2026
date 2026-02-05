import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, userData, loading, userDataLoading, userDataChecked } = useAuth();

  // Show loading state while checking auth or loading user data
  if (loading || userDataLoading || !userDataChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hatofes-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hatofes-accent-yellow mx-auto mb-4"></div>
          <p className="text-hatofes-gray">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but no user data (confirmed after check) - redirect to registration
  if (!userData) {
    return <Navigate to="/register" replace />;
  }

  // Authenticated and has user data - allow access
  return <>{children}</>;
}
