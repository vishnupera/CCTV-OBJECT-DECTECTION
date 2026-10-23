import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/detection-capabilities', label: 'Capabilities' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/contact', label: 'Contact' },
]

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                <Shield size={16} className="text-accent" />
              </div>
              <span className="font-bold text-white tracking-tight">SafeWatch<span className="text-accent">AI</span></span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    location.pathname === link.to
                      ? 'text-accent bg-accent/10'
                      : 'text-secondary hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/contact" className="btn-primary text-sm py-2 px-4">
                Request Demo
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden text-secondary hover:text-white p-1"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-white/5 overflow-hidden"
            >
              <nav className="px-4 py-4 flex flex-col gap-1">
                {navLinks.map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === link.to ? 'text-accent bg-accent/10' : 'text-secondary'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-panel/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                  <Shield size={16} className="text-accent" />
                </div>
                <span className="font-bold text-white">SafeWatch<span className="text-accent">AI</span></span>
              </div>
              <p className="text-secondary text-sm leading-relaxed max-w-sm">
                AI-assisted crowd safety and incident detection. Every detection is an alert for human review — not proof, not identification.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs text-secondary">Human-in-the-loop always</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
              <ul className="space-y-2">
                {[['Features', '/features'], ['How It Works', '/how-it-works'], ['Capabilities', '/detection-capabilities']].map(([label, to]) => (
                  <li key={to}><Link to={to} className="text-secondary text-sm hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Legal</h4>
              <ul className="space-y-2">
                {[['Privacy & Responsible Use', '/privacy'], ['Contact', '/contact']].map(([label, to]) => (
                  <li key={to}><Link to={to} className="text-secondary text-sm hover:text-white transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-secondary text-xs">© 2024 SafeWatchAI. Crowd safety through responsible AI.</p>
            <p className="text-secondary text-xs">AI detects. Humans decide. Always.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
