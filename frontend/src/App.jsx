import { useEffect, useState } from 'react'
import { getStoredUser } from './services/authService'
import { TOKEN_STORAGE_KEY } from './services/api'
import { Dashboard, Login } from './views'

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (token) setUser(getStoredUser())
  }, [])

  const handleLoginSuccess = (authUser) => setUser(authUser)
  const handleLogout = () => setUser(null)

  return user ? (
    <Dashboard user={user} onLogout={handleLogout} />
  ) : (
    <Login onLoginSuccess={handleLoginSuccess} />
  )
}

export default App
