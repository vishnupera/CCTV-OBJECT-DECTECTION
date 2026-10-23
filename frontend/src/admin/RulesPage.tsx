import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'
import api from '../lib/api'

const TIER_COLORS: Record<string, string> = {
  critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low'
}

export default function RulesPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/rules/watchlist').then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="section-title">Rules & Watch-list</h1>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
          data?.custom_model_loaded
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
        }`}>
          {data?.custom_model_loaded
            ? <><CheckCircle size={12} /> Custom model loaded</>
            : <><AlertCircle size={12} /> Custom model not loaded</>
          }
        </div>
      </div>

      {!data?.custom_model_loaded && (
        <div className="card border border-yellow-500/20 bg-yellow-500/5 p-4 flex gap-3">
          <Info size={16} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-secondary text-sm">
            Custom model not found at <code className="text-yellow-400 text-xs">{data?.custom_model_path}</code>. Custom-class detections (firearm, fire, smoke, etc.) are disabled. The system runs on COCO classes only. Drop your trained <code className="text-xs text-accent">custom.pt</code> file at the configured path and restart the backend.
          </p>
        </div>
      )}

      {/* Classes table */}
      <div className="card border border-white/5 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-white font-semibold text-sm">Detection Classes ({data?.classes?.length || 0})</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-secondary text-xs border-b border-white/5">
                <th className="text-left px-4 py-2.5 font-medium">Class</th>
                <th className="text-left px-4 py-2.5 font-medium">Source</th>
                <th className="text-left px-4 py-2.5 font-medium">Tier</th>
                <th className="text-left px-4 py-2.5 font-medium">Confidence</th>
                <th className="text-left px-4 py-2.5 font-medium">Consec. Secs</th>
                <th className="text-left px-4 py-2.5 font-medium">Cooldown</th>
                <th className="text-left px-4 py-2.5 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {(data?.classes || []).map((cls: any) => (
                <tr key={cls.class} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white text-sm font-medium">{cls.label}</p>
                    <p className="text-secondary text-xs font-mono">{cls.class}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      cls.source === 'custom'
                        ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                        : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    }`}>
                      {cls.source}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className={TIER_COLORS[cls.tier] || 'badge-low'}>{cls.tier}</span></td>
                  <td className="px-4 py-3 text-secondary text-sm">{(cls.confidence * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-secondary text-sm">{cls.consecutive_seconds}s</td>
                  <td className="px-4 py-3 text-secondary text-sm">{cls.cooldown_seconds}s</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${cls.enabled ? 'text-green-400' : 'text-secondary'}`}>
                      {cls.enabled ? '✓ Active' : '— Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Behavior rules */}
      <div className="card border border-white/5 p-4">
        <p className="text-white font-semibold mb-4">Behavior Rules</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(data?.rules || {}).map(([key, rule]: [string, any]) => (
            <div key={key} className="p-3 rounded-xl border border-white/5 bg-white/3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                <span className={`text-xs font-semibold ${rule.enabled ? 'text-green-400' : 'text-secondary'}`}>
                  {rule.enabled ? 'Active' : 'Off'}
                </span>
              </div>
              {rule.tier && <span className={TIER_COLORS[rule.tier] || 'badge-low'}>{rule.tier}</span>}
              {rule.notes && <p className="text-secondary text-xs mt-1">{rule.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
