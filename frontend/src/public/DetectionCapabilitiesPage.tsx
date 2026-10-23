import { motion } from 'framer-motion'
import { AlertTriangle, Info } from 'lucide-react'

const tiers = [
  {
    tier: 'critical',
    label: 'Critical',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    items: [
      { name: 'Possible Firearm', source: 'Custom Model Required', desc: 'Highest-priority alert. Evidence image mandatory for officer review.' },
      { name: 'Fire / Flame', source: 'Custom Model Required', desc: 'Immediate life-safety concern. Triggers highest urgency notification.' },
    ]
  },
  {
    tier: 'high',
    label: 'High',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    items: [
      { name: 'Sharp Object (Knife)', source: 'COCO Model', desc: 'Context-dependent. Detected as knife class. Visual verification essential.' },
      { name: 'Smoke', source: 'Custom Model Required', desc: 'Possible fire precursor. Requires temporal confirmation.' },
      { name: 'Unattended Suitcase', source: 'COCO Model + Rule', desc: 'Triggers after bag is static with no nearby person for N seconds.' },
      { name: 'Thrown Object', source: 'Custom Model Required', desc: 'Stones or projectile motion detected.' },
      { name: 'Broken Glass', source: 'Custom Model Required', desc: 'Property damage or forced entry indicator.' },
      { name: 'Restricted Zone Intrusion', source: 'Zone Rule', desc: 'Person in a restricted polygon for more than the configured time.' },
      { name: 'Sudden Crowd Movement', source: 'Behavior Rule', desc: 'Multiple tracks with sudden velocity increase — possible stampede.' },
    ]
  },
  {
    tier: 'medium',
    label: 'Medium',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    items: [
      { name: 'Blunt Object (Baseball Bat)', source: 'COCO Model', desc: 'Context-dependent. Common sporting use. Visual review required.' },
      { name: 'Sharp Object (Scissors)', source: 'COCO Model', desc: 'Office use is common. Meaningful only in specific zone contexts.' },
      { name: 'Unattended Backpack / Handbag', source: 'COCO Model + Rule', desc: 'Static bag with no person nearby for configured duration.' },
      { name: 'Crowd Density Spike', source: 'Behavior Rule', desc: 'Person count in a zone exceeds the configured threshold.' },
      { name: 'Helmet / Face Covering', source: 'Custom Model Required', desc: 'Context-dependent. Disabled by default.' },
    ]
  },
  {
    tier: 'low',
    label: 'Low',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    items: [
      { name: 'Loitering', source: 'Zone Rule', desc: 'Person stays inside a loitering zone beyond the configured duration.' },
      { name: 'Flag / Banner / Placard', source: 'Custom Model Required', desc: 'Crowd control context. Disabled by default.' },
      { name: 'Bottle', source: 'COCO Model', desc: 'Only meaningful with zone rules. Disabled by default.' },
    ]
  },
]

const SeverityBadge = ({ label, color, bg, border }: any) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${bg} ${color} border ${border}`}>
    {label}
  </span>
)

export default function DetectionCapabilitiesPage() {
  return (
    <div className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <span className="text-accent text-sm font-semibold uppercase tracking-wider">Detection Capabilities</span>
          <h1 className="text-5xl font-black text-white mt-2 mb-4">What We Detect</h1>
          <p className="text-secondary text-lg max-w-2xl mx-auto">
            Tiered alert system from Low to Critical. All detections are probabilistic signals — not proof.
          </p>
        </motion.div>

        {/* Disclaimer banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-12 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 flex gap-3"
        >
          <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 text-sm font-semibold">Alerts, Not Proof</p>
            <p className="text-secondary text-sm mt-0.5">
              Every detection is labeled "Potential security incident detected." No individual is identified, accused, or subjected to automatic action. All alerts require human review before any response.
            </p>
          </div>
        </motion.div>

        <div className="space-y-8">
          {tiers.map((tier, ti) => (
            <motion.div
              key={tier.tier}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ti * 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <SeverityBadge {...tier} />
                <span className="text-secondary text-sm">({tier.items.length} detection types)</span>
              </div>
              <div className="space-y-3">
                {tier.items.map(item => (
                  <div key={item.name} className={`card p-4 border ${tier.border} ${tier.bg}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className={`font-semibold ${tier.color}`}>{item.name}</h3>
                        <p className="text-secondary text-sm mt-1">{item.desc}</p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-md bg-white/5 text-secondary border border-white/10 shrink-0">
                        {item.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Custom model note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 p-6 card border border-accent/20"
        >
          <div className="flex gap-3">
            <Info size={18} className="text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold mb-1">Custom Model Integration</p>
              <p className="text-secondary text-sm leading-relaxed">
                Detections marked "Custom Model Required" are hooks ready for custom-trained YOLO weights. Drop your model file into <code className="bg-white/10 px-1 rounded text-accent text-xs">models/yolo/custom.pt</code> and configure class names in the admin Rules panel. The system will automatically detect and load the custom model on startup.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
