import { api, TOKEN_STORAGE_KEY } from './api'

const AUTH_LOGIN_PATH = '/auth/login'

const getTokenFromResponse = (data) => data.token || data.jwt || null

export const login = async (email, password) => {
  const data = await api.post(AUTH_LOGIN_PATH, { email, password })
  const token = getTokenFromResponse(data)
  if (!token) throw new Error('Login sin token JWT en la respuesta')
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  return data
}
