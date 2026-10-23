import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: 'border-green-500/30 bg-green-900/30 text-green-400',
  error: 'border-red-500/30 bg-red-900/30 text-red-400',
  warning: 'border-yellow-500/30 bg-yellow-900/30 text-yellow-400',
  info: 'border-blue-500/30 bg-blue-900/30 text-blue-400',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }, [])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toasts.map(t => {
            const Icon = icons[t.type]
            return (
              <motion.div
                key={t.id}
                initial={{ x: 120, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 120, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`card border px-4 py-3 flex items-start gap-3 shadow-card ${colors[t.type]}`}
              >
                <Icon size={18} className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white">{t.title}</p>
                  {t.message && <p className="text-xs text-secondary mt-0.5">{t.message}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} className="text-secondary hover:text-white shrink-0">
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
