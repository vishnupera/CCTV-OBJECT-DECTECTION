import { useState } from 'react'
import { Save } from 'lucide-react'
import { useToast } from '../hooks/useToast'

export default function SettingsPage() {
  const [retention, setRetention] = useState(30)
  const [alertSound, setAlertSound] = useState(true)
  const { toast } = useToast()

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="section-title">Settings</h1>

      <div className="card border border-white/5 p-6 space-y-6">
        <h2 className="text-white font-semibold border-b border-white/5 pb-3">Evidence Retention</h2>
        <div>
          <label className="label">Retention Period (days)</label>
          <input
            type="number"
            min="1"
            max="365"
            className="input w-32"
            value={retention}
            onChange={e => setRetention(Number(e.target.value))}
          />
          <p className="text-secondary text-xs mt-1.5">Evidence files older than this will be automatically deleted by the retention job.</p>
        </div>
      </div>

      <div className="card border border-white/5 p-6 space-y-6">
        <h2 className="text-white font-semibold border-b border-white/5 pb-3">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">Alert Sound</p>
            <p className="text-secondary text-xs mt-0.5">Play a sound when high/critical incidents are detected</p>
          </div>
          <button
            onClick={() => setAlertSound(!alertSound)}
            className={`w-12 h-6 rounded-full transition-colors duration-200 relative ${alertSound ? 'bg-accent' : 'bg-white/10'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${alertSound ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="card border border-white/5 p-6 space-y-4">
        <h2 className="text-white font-semibold border-b border-white/5 pb-3">System Configuration</h2>
        <p className="text-secondary text-sm leading-relaxed">
          Core system settings (admin path slug, video source, model paths, JWT secrets) are configured via the <code className="bg-white/10 px-1 rounded text-accent text-xs">.env</code> file. Restart the backend after changing these values.
        </p>
        <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs font-mono text-secondary space-y-1">
          <p>VIDEO_SOURCE=0                # 0=webcam, path, rtsp://</p>
          <p>ADMIN_PATH_SLUG=ops-console-xxx</p>
          <p>EVIDENCE_RETENTION_DAYS=30</p>
          <p>CUSTOM_MODEL_PATH=models/yolo/custom.pt</p>
        </div>
      </div>

      <button onClick={() => toast('success', 'Settings saved')} className="btn-primary flex items-center gap-2">
        <Save size={15} /> Save Settings
      </button>
    </div>
  )
}
