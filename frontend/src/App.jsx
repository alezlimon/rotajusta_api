import { useEffect, useState } from 'react'
import { getStoredUser, logout, refreshCurrentUser } from './services/authService'
import { TOKEN_STORAGE_KEY } from './services/api'
import { Login, ScheduleTimeline } from './views'

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const syncUser = async () => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (!token) return
      setUser(getStoredUser())
      try {
        const freshUser = await refreshCurrentUser()
        if (freshUser) setUser(freshUser)
      } catch (_) {
        logout()
        setUser(null)
      }
    }

    syncUser()
  }, [])

  const handleLoginSuccess = (authUser) => setUser(authUser)
  const handleLogout = () => setUser(null)

  return user ? (
    <ScheduleTimeline user={user} onLogout={handleLogout} />
  ) : (
    <Login onLoginSuccess={handleLoginSuccess} />
  )
}

export default App
