const API_BASE_URL = 'http://localhost:3000/api'
const TOKEN_STORAGE_KEY = 'rotajusta_token'

const getToken = () => localStorage.getItem(TOKEN_STORAGE_KEY)

const buildHeaders = (customHeaders = {}) => {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...customHeaders }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

const toApiError = async (response) => {
  const fallback = `HTTP ${response.status}`
  const payload = await response.json().catch(() => ({}))
  const message = payload.error || payload.message || fallback
  const error = new Error(message)
  error.status = response.status
  error.payload = payload
  return error
}

export const apiRequest = async (path, options = {}) => {
  const { headers, ...rest } = options
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: buildHeaders(headers),
  })
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return null
  return response.json()
}

export const api = {
  get: (path, options) => apiRequest(path, { method: 'GET', ...options }),
  post: (path, body, options) => apiRequest(path, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (path, body, options) => apiRequest(path, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (path, body, options) => apiRequest(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  del: (path, options) => apiRequest(path, { method: 'DELETE', ...options }),
}

export { API_BASE_URL, TOKEN_STORAGE_KEY }