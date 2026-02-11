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
import TetrisPage from './pages/user/TetrisPage'
import LevelPage from './pages/user/LevelPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminPointsPage from './pages/admin/AdminPointsPage'
import AdminSurveysPage from './pages/admin/AdminSurveysPage'
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminGachaPage from './pages/admin/AdminGachaPage'
import AuthErrorsPage from './pages/admin/AuthErrorsPage'

// Route protection
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { StaffRoute } from './components/auth/StaffRoute'

// Staff pages
import StaffDashboard from './pages/admin/StaffDashboard'


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
        <Route path="/tetris" element={<ProtectedRoute><TetrisPage /></ProtectedRoute>} />
        <Route path="/level" element={<ProtectedRoute><LevelPage /></ProtectedRoute>} />

        {/* Admin routes - Protected by StaffRoute with different access levels */}
        <Route path="/admin" element={<StaffRoute staffAllowed={false}><AdminDashboard /></StaffRoute>} />
        <Route path="/admin/staff-dashboard" element={<StaffRoute staffAllowed={true}><StaffDashboard /></StaffRoute>} />
        <Route path="/admin/points" element={<StaffRoute staffAllowed={false}><AdminPointsPage /></StaffRoute>} />
        <Route path="/admin/surveys" element={<StaffRoute staffAllowed={true}><AdminSurveysPage /></StaffRoute>} />
        <Route path="/admin/notifications" element={<StaffRoute staffAllowed={true}><AdminNotificationsPage /></StaffRoute>} />
        <Route path="/admin/users" element={<StaffRoute staffAllowed={false}><AdminUsersPage /></StaffRoute>} />
        <Route path="/admin/gacha" element={<StaffRoute staffAllowed={false}><AdminGachaPage /></StaffRoute>} />
        <Route path="/admin/auth-errors" element={<StaffRoute staffAllowed={true}><AuthErrorsPage /></StaffRoute>} />
      </Routes>
    </>
  )
}

export default App
