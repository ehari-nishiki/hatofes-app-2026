import { Routes, Route } from 'react-router-dom'

// Public pages
import LandingPage from './pages/public/LandingPage'
import AboutPage from './pages/public/AboutPage'
import LoginPage from './pages/public/LoginPage'

// Auth pages
import RegisterPage from './pages/auth/RegisterPage'
import GoogleAuthPage from './pages/auth/GoogleAuthPage'

// User pages
import HomePage from './pages/user/HomePage'
import NotificationsPage from './pages/user/NotificationsPage'
import MissionsPage from './pages/user/MissionsPage'
import PointPage from './pages/user/PointPage'
import ProfilePage from './pages/user/ProfilePage'

// Route protection
import { ProtectedRoute } from './components/auth/ProtectedRoute'

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

        {/* Auth routes */}
        <Route path="/auth/google" element={<GoogleAuthPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* User routes - Protected */}
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/missions" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
        <Route path="/surveys" element={<ProtectedRoute><MissionsPage /></ProtectedRoute>} />
        <Route path="/point" element={<ProtectedRoute><PointPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        {/* TODO: Add more routes */}
      </Routes>

      {/* Dev tools - only visible in development mode */}
      <AccountSwitcher />
    </>
  )
}

export default App
