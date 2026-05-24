import { api, AUTH_USER_KEY, TOKEN_STORAGE_KEY } from './api'

const AUTH_LOGIN_PATH = '/auth/login'

const getTokenFromResponse = (data) => data.token || data.jwt || null

export const login = async (email, password) => {
  const data = await api.post(AUTH_LOGIN_PATH, { email, password })
  const token = getTokenFromResponse(data)
  if (!token) throw new Error('Login sin token JWT en la respuesta')
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user || {}))
  return data
}

export const logout = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}

export const getStoredUser = () => {
  const rawUser = localStorage.getItem(AUTH_USER_KEY)
  if (!rawUser) return null
  try {
    return JSON.parse(rawUser)
  } catch (_) {
    return null
  }
}

export const getCurrentUser = () => api.get('/auth/me')

export const refreshCurrentUser = async () => {
  const data = await getCurrentUser()
  const user = data?.user || null
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  return user
}

export const getEmployees = () => api.get('/auth/employees')
