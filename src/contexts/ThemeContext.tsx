import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from './AuthContext'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { currentUser, userData } = useAuth()
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage or default to dark
    const stored = localStorage.getItem('hatofes-theme') as Theme | null
    return stored || 'dark'
  })

  // Sync theme from user data when available
  useEffect(() => {
    if (userData?.theme) {
      setThemeState(userData.theme)
      localStorage.setItem('hatofes-theme', userData.theme)
    }
  }, [userData?.theme])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // Also set color-scheme for browser UI elements
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('hatofes-theme', newTheme)

    // Persist to Firestore if logged in
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { theme: newTheme })
      } catch (error) {
        console.error('Error updating theme setting:', error)
      }
    }
  }

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
