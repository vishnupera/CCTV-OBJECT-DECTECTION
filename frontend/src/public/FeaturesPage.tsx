import { motion } from 'framer-motion'
import { 
  Eye, Users, AlertTriangle, Shield, Camera, Activity, 
  Database, Lock, Zap, BarChart2, Map, Settings
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 }
}

const features = [
  { icon: Camera, title: 'Multi-Source Video', desc: 'Webcam, MP4 files, RTSP streams — switch with a single env variable, no code changes.' },
  { icon: Eye, title: 'YOLO Detection', desc: 'YOLOv8 base model covers 80 COCO classes. Custom model slot for specialized detections.' },
  { icon: Users, title: 'Persistent Tracking', desc: 'ByteTrack-style tracker assigns stable IDs across frames, enabling loitering and zone rules.' },
  { icon: Map, title: 'Polygon Zones', desc: 'Draw zones on the live feed canvas. Each zone can have its own rule type and thresholds.' },
  { icon: AlertTriangle, title: 'Smart Rules Engine', desc: 'Deterministic rules: density, stampede, loitering, unattended bags, restricted zones.' },
  { icon: Database, title: 'Evidence Package', desc: 'Each incident auto-generates a snapshot, cropped objects, and a ±5s video clip.' },
  { icon: Lock, title: 'Role-Based Access', desc: 'Admin, Operator, Viewer roles. JWT + httpOnly cookies. Rate limiting and lockout.' },
  { icon: BarChart2, title: 'Analytics Dashboard', desc: 'Incident trends, type breakdown, false-positive rates, and response time metrics.' },
  { icon: Activity, title: 'System Health', desc: 'Real-time stream FPS, model latency, CPU/GPU usage, storage, and database status.' },
  { icon: Shield, title: 'Audit Log', desc: 'Immutable log of every login, action, and incident update for compliance and accountability.' },
  { icon: Zap, title: 'Real-time Alerts', desc: 'WebSocket-driven toasts for high/critical incidents. Optional alert sound.' },
  { icon: Settings, title: 'Live Configuration', desc: 'Edit class thresholds, cooldowns, and tiers without restarting the system.' },
]

export default function FeaturesPage() {
  return (
    <div className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-16">
          <span className="text-accent text-sm font-semibold uppercase tracking-wider">Platform Features</span>
          <h1 className="text-5xl font-black text-white mt-2 mb-4">Everything You Need</h1>
          <p className="text-secondary text-lg max-w-2xl mx-auto">
            A complete, production-ready crowd safety platform built on open-source AI with enterprise-grade security.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="card-hover p-6 group"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <Icon size={22} className="text-accent" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-secondary text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
