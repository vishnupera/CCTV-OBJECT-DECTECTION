import { motion } from 'framer-motion'
import { Camera, Cpu, Target, GitBranch, Bell, UserCheck } from 'lucide-react'

const steps = [
  {
    icon: Camera,
    number: '01',
    title: 'Camera Input',
    desc: 'Video frames arrive from webcam, MP4, or RTSP stream. A background thread reads frames continuously and stores them in a rolling buffer for evidence collection.',
    color: '#2A835F',
  },
  {
    icon: Cpu,
    number: '02',
    title: 'AI Detection',
    desc: 'YOLOv8 processes each frame at 5 FPS. Objects are detected with bounding boxes and confidence scores. Custom model weights load automatically if present.',
    color: '#3b82f6',
  },
  {
    icon: Target,
    number: '03',
    title: 'Persistent Tracking',
    desc: 'IoU-based tracker assigns stable IDs across frames. Position history enables velocity measurement for stampede detection and loitering duration tracking.',
    color: '#8b5cf6',
  },
  {
    icon: GitBranch,
    number: '04',
    title: 'Rules Engine',
    desc: 'Deterministic rules check each frame: watch-list classes, crowd density, zone intrusions, unattended bags. Temporal confirmation and cooldowns prevent false alerts.',
    color: '#f59e0b',
  },
  {
    icon: Bell,
    number: '05',
    title: 'Incident Created',
    desc: 'When a rule fires, an incident record is created: INC-YYYY-NNNNN with severity, evidence package (snapshot + crops + clip), and all metadata.',
    color: '#ef4444',
  },
  {
    icon: UserCheck,
    number: '06',
    title: 'Human Review',
    desc: 'The security operator reviews the evidence and decides: Acknowledge, Escalate, or Mark False Positive. The system never takes automatic action.',
    color: '#8BBB92',
  },
]

export default function HowItWorksPage() {
  return (
    <div className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <span className="text-accent text-sm font-semibold uppercase tracking-wider">System Architecture</span>
          <h1 className="text-5xl font-black text-white mt-2 mb-4">How It Works</h1>
          <p className="text-secondary text-lg max-w-xl mx-auto">
            A transparent, six-stage pipeline from camera to human decision.
          </p>
        </motion.div>

        {/* Pipeline diagram */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-accent/40 via-accent/20 to-transparent hidden md:block" />

          <div className="space-y-8">
            {steps.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="flex gap-6 items-start"
                >
                  {/* Step icon */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border relative z-10"
                    style={{ background: `${step.color}15`, borderColor: `${step.color}30` }}
                  >
                    <Icon size={24} style={{ color: step.color }} />
                  </div>

                  {/* Content */}
                  <div className="card-hover p-5 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-secondary/50 tracking-widest">{step.number}</span>
                      <h3 className="text-white font-semibold text-lg">{step.title}</h3>
                    </div>
                    <p className="text-secondary text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 p-6 rounded-2xl border border-accent/20 bg-accent/5 text-center"
        >
          <p className="text-secondary text-sm leading-relaxed">
            <span className="text-accent font-semibold">Important: </span>
            All decisions in step 6 are made by a human security officer. SafeWatchAI provides information and alerts — it does not identify individuals, label anyone as dangerous, or take any automatic enforcement action. All detections are stated as "Potential security incident" to reflect their probabilistic nature.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
