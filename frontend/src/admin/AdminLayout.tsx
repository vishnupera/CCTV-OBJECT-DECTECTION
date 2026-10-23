import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Monitor, AlertTriangle, Camera, Map,
  Settings2, BarChart2, Users, FileText, Activity, Settings,
  Shield, LogOut, Menu, X
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAlertWebSocket } from '../hooks/useAlertWS'
import { useToast } from '../hooks/useToast'

interface Props {
  adminSlug: string
}

const navItems = (slug: string) => [
  { to: `/${slug}`, icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: `/${slug}/monitor`, icon: Monitor, label: 'Live Monitor' },
  { to: `/${slug}/incidents`, icon: AlertTriangle, label: 'Incidents' },
  { to: `/${slug}/cameras`, icon: Camera, label: 'Cameras' },
  { to: `/${slug}/zones`, icon: Map, label: 'Zones' },
  { to: `/${slug}/rules`, icon: Settings2, label: 'Rules' },
  { to: `/${slug}/analytics`, icon: BarChart2, label: 'Analytics' },
  { to: `/${slug}/users`, icon: Users, label: 'Users' },
  { to: `/${slug}/audit`, icon: FileText, label: 'Audit Log' },
  { to: `/${slug}/health`, icon: Activity, label: 'System Health' },
  { to: `/${slug}/settings`, icon: Settings, label: 'Settings' },
]

export default function AdminLayout({ adminSlug }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [alertCount, setAlertCount] = useState(0)

  // Real-time alerts via WebSocket
  useAlertWebSocket({
    onMessage: (msg) => {
      if (msg.type === 'new_incident') {
        setAlertCount(c => c + 1)
        const sev = msg.severity || 'medium'
        if (sev === 'critical' || sev === 'high') {
          toast('error', 'Security Alert', `${msg.event_type?.replace(/_/g, ' ')} — ${sev.toUpperCase()}`)
        } else {
          toast('warning', 'Incident Detected', msg.event_type?.replace(/_/g, ' ') || 'New incident')
        }
      }
    }
  })

  const handleLogout = async () => {
    await logout()
    navigate(`/${adminSlug}/login`)
  }

  const items = navItems(adminSlug)

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="bg-panel border-r border-white/5 flex flex-col overflow-hidden shrink-0"
          >
            {/* Logo */}
            <div className="px-4 py-4 border-b border-white/5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                <Shield size={16} className="text-accent" />
              </div>
              <div>
                <span className="font-bold text-white text-sm tracking-tight">SafeWatch<span className="text-accent">AI</span></span>
                <p className="text-secondary text-xs">Control Room</p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {items.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive ? 'sidebar-link-active' : 'sidebar-link'
                    }
                  >
                    <Icon size={17} />
                    <span className="flex-1">{item.label}</span>
                    {item.label === 'Incidents' && alertCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {alertCount > 99 ? '99+' : alertCount}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </nav>

            {/* User */}
            <div className="px-3 py-3 border-t border-white/5">
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
                <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
                  <span className="text-accent text-xs font-bold">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{user?.email}</p>
                  <p className="text-secondary text-xs capitalize">{user?.role}</p>
                </div>
                <button onClick={handleLogout} className="text-secondary hover:text-red-400 transition-colors p-1">
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-panel border-b border-white/5 flex items-center px-4 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-secondary hover:text-white transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="status-online" />
              <span className="text-secondary text-xs">System Active</span>
            </div>
            <span className="text-white/10">|</span>
            <span className="text-secondary text-xs capitalize">{user?.role}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
