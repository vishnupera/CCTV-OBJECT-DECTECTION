import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, Eye, AlertTriangle, Users, Camera, Activity,
  ChevronRight, CheckCircle, Zap, Lock
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 }
}

const stats = [
  { value: '< 1s', label: 'Alert latency' },
  { value: '24/7', label: 'Monitoring' },
  { value: '100%', label: 'Human review' },
  { value: '0', label: 'Auto-actions' },
]

const features = [
  {
    icon: Eye,
    title: 'Real-time Detection',
    desc: 'YOLO-powered object detection running at 5+ FPS with GPU acceleration when available.'
  },
  {
    icon: Users,
    title: 'Crowd Analytics',
    desc: 'Track density, movement patterns, and sudden velocity changes across defined zones.'
  },
  {
    icon: AlertTriangle,
    title: 'Smart Alerting',
    desc: 'Configurable thresholds, cooldowns, and temporal confirmation prevent alert fatigue.'
  },
  {
    icon: Lock,
    title: 'Privacy First',
    desc: 'No biometric identification, no automatic enforcement. Audit logs on every action.'
  },
  {
    icon: Camera,
    title: 'Multi-Camera',
    desc: 'Webcam, MP4 files, and RTSP streams. Hot-swap without restarting the system.'
  },
  {
    icon: Activity,
    title: 'Evidence Chain',
    desc: 'Full-frame snapshots, cropped evidence, and 10-second video clips for each incident.'
  },
]

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-screen flex items-center hero-gradient overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-60" />

        {/* Animated rings */}
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 hidden lg:block">
          <div className="relative w-96 h-96">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border border-accent/20 ring-pulse"
                style={{ transform: `scale(${1 + i * 0.35})`, animationDelay: `${i * 0.7}s` }}
              />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-2xl bg-panel border border-accent/30 flex items-center justify-center glow-accent">
                <Shield size={52} className="text-accent" />
              </div>
            </div>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold mb-6"
            >
              <Zap size={12} />
              AI-Assisted Crowd Safety System
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl lg:text-6xl font-black text-white leading-tight mb-6"
            >
              Smart Surveillance.{' '}
              <span className="text-accent">Human Judgment.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-secondary text-lg leading-relaxed mb-8"
            >
              SafeWatchAI detects potential incidents in real time and alerts your security team. Every detection is a signal for human review — <strong className="text-white">never automatic enforcement, never identification</strong>.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-3"
            >
              <Link to="/how-it-works" className="btn-primary flex items-center gap-2">
                See How It Works <ChevronRight size={16} />
              </Link>
              <Link to="/detection-capabilities" className="btn-secondary flex items-center gap-2">
                View Capabilities
              </Link>
            </motion.div>

            {/* Trust line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 flex items-center gap-2 text-sm text-secondary"
            >
              <CheckCircle size={14} className="text-accent" />
              No biometric identification &nbsp;·&nbsp;
              <CheckCircle size={14} className="text-accent" />
              Full audit trail &nbsp;·&nbsp;
              <CheckCircle size={14} className="text-accent" />
              GDPR-conscious design
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 border-t border-white/5 bg-panel/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div key={s.label} {...fadeUp} transition={{ delay: i * 0.1, duration: 0.5 }} className="text-center">
                <div className="text-4xl font-black text-accent mb-1">{s.value}</div>
                <div className="text-secondary text-sm">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Built for Safety Operations</h2>
            <p className="text-secondary text-lg max-w-2xl mx-auto">
              Every feature is designed to assist human operators, not replace them.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.title}
                  {...fadeUp}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="card-hover p-6"
                >
                  <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-accent" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-secondary text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Ethics banner */}
      <section className="py-16 bg-panel/50 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div {...fadeUp}>
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6">
              <Shield size={28} className="text-accent" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Our Core Commitment</h2>
            <p className="text-secondary text-lg leading-relaxed mb-6">
              SafeWatchAI generates alerts. Security officers make all decisions. The system never identifies individuals, labels anyone as a criminal, or takes automatic enforcement action.
            </p>
            <p className="text-accent font-semibold text-xl italic">
              "AI detects. Humans decide. Always."
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-4xl font-bold text-white mb-6">Ready to enhance your security?</h2>
            <p className="text-secondary text-lg mb-8">Get in touch to see a live demonstration of the system.</p>
            <Link to="/contact" className="btn-primary text-lg px-8 py-3 inline-flex items-center gap-2">
              Request a Demo <ChevronRight size={20} />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  )
}
