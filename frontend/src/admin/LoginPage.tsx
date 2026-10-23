import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff, Lock, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const ADMIN_SLUG = import.meta.env.VITE_ADMIN_SLUG || 'ops-console-a1b2c3'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [showTotp, setShowTotp] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  // noindex meta
  if (typeof document !== 'undefined') {
    let meta = document.querySelector('meta[name="robots"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'robots')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', 'noindex,nofollow')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password, totp || undefined)
      navigate(`/${ADMIN_SLUG}`)
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login failed'
      if (msg.includes('TOTP') || msg.includes('totp')) {
        setShowTotp(true)
        setError(msg)
      } else if (msg.includes('locked')) {
        setError(msg)
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 hero-gradient">
      <div className="absolute inset-0 grid-bg opacity-40" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="card border border-white/10 p-8 shadow-card">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4 glow-accent">
              <Shield size={28} className="text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-white">Security Console</h1>
            <p className="text-secondary text-sm mt-1">Authorized personnel only</p>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/10 flex gap-2 items-start"
            >
              <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="operator@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-white"
                  onClick={() => setShowPwd(!showPwd)}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {showTotp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                <label className="label">Authenticator Code</label>
                <input
                  id="login-totp"
                  type="text"
                  className="input tracking-widest"
                  placeholder="000000"
                  value={totp}
                  onChange={e => setTotp(e.target.value)}
                  maxLength={6}
                  pattern="\d{6}"
                  autoComplete="one-time-code"
                />
              </motion.div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Lock size={15} /> Sign In</>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 text-xs text-secondary/50 justify-center">
            <Lock size={10} />
            All access attempts are logged
          </div>
        </div>
      </motion.div>
    </div>
  )
}
