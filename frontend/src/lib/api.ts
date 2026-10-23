import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async error => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true
      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        return api(error.config)
      } catch {
        // Force re-login
        window.location.href = window.location.pathname.includes('ops-console')
          ? window.location.pathname.split('/').slice(0, 2).join('/') + '/login'
          : '/'
      }
    }
    return Promise.reject(error)
  }
)

export default api
