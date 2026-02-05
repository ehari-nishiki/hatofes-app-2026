import { Routes, Route } from 'react-router-dom'

// Public pages
import LandingPage from './pages/public/LandingPage'
import AboutPage from './pages/public/AboutPage'
import LoginPage from './pages/public/LoginPage'
import QandAPage from './pages/public/QandAPage'

// Auth pages
import RegisterPage from './pages/auth/RegisterPage'
import GoogleAuthPage from './pages/auth/GoogleAuthPage'

// User pages
import HomePage from './pages/user/HomePage'
import NotificationsPage, { NotificationDetailPage } from './pages/user/NotificationsPage'
import TasksPage from './pages/user/TasksPage'
import MissionsPage from './pages/user/MissionsPage'
import SurveyDetailPage from './pages/user/SurveyDetailPage'
import PointPage from './pages/user/PointPage'
import ProfilePage from './pages/user/ProfilePage'
import RankingPage from './pages/user/RankingPage'
import SettingsPage from './pages/user/SettingsPage'
import GachaPage from './pages/user/GachaPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPointsPage from './pages/admin/AdminPointsPage'
import AdminSurveysPage from './pages/admin/AdminSurveysPage'
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminGachaPage from './pages/admin/AdminGachaPage'

// Route protection
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AdminRoute } from './components/auth/AdminRoute'

// Dev tools
import { AccountSwitcher } from './components/dev/AccountSwitcher'

function App() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/QandA" element={<QandAPage />} />

        {/* Auth routes */}
        <Route path="/auth/google" element={<GoogleAuthPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* User routes - Protected */}
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/notifications/:notificationId" element={<ProtectedRoute><NotificationDetailPage /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
        <Route path="/tasks/:surveyId" element={<ProtectedRoute><SurveyDetailPage /></ProtectedRoute>} />
        <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
        <Route path="/missions/:surveyId" element={<ProtectedRoute><SurveyDetailPage /></ProtectedRoute>} />
        <Route path="/surveys" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
        <Route path="/point" element={<ProtectedRoute><PointPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/gacha" element={<ProtectedRoute><GachaPage /></ProtectedRoute>} />

        {/* Admin routes - Protected by AdminRoute */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/points" element={<AdminRoute><AdminPointsPage /></AdminRoute>} />
        <Route path="/admin/surveys" element={<AdminRoute><AdminSurveysPage /></AdminRoute>} />
        <Route path="/admin/notifications" element={<AdminRoute><AdminNotificationsPage /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="/admin/gacha" element={<AdminRoute><AdminGachaPage /></AdminRoute>} />
      </Routes>

      {/* Dev tools - only visible in development mode */}
      <AccountSwitcher />
    </>
  )
}

export default App
