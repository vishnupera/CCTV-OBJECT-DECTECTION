import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Image } from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/useToast'

function SeverityBadge({ severity }: { severity: string }) {
  const cls: Record<string, string> = {
    critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low'
  }
  return <span className={cls[severity] || 'badge-low'}>{severity}</span>
}

export default function IncidentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [incident, setIncident] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [fpReason, setFpReason] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    api.get(`/incidents/${id}`).then(r => {
      setIncident(r.data)
      setNotes(r.data.operator_notes || '')
    }).finally(() => setLoading(false))
  }, [id])

  const update = async (status: string, extra: any = {}) => {
    if (status === 'false_positive' && !fpReason) {
      toast('error', 'Required', 'Please provide a reason for marking as false positive')
      return
    }
    setUpdating(true)
    try {
      const payload: any = { status, operator_notes: notes, ...extra }
      if (status === 'false_positive') payload.false_positive_reason = fpReason
      const res = await api.patch(`/incidents/${id}`, payload)
      setIncident(res.data)
      toast('success', 'Updated', `Incident marked as ${status.replace(/_/g, ' ')}`)
    } catch {
      toast('error', 'Error', 'Failed to update incident')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
  if (!incident) return <div className="text-secondary text-center py-16">Incident not found</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-secondary hover:text-white text-sm transition-colors">
        <ArrowLeft size={15} /> Back to Incidents
      </button>

      {/* Header */}
      <div className="card border border-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-secondary text-xs font-mono mb-1">{incident.incident_number}</p>
            <h1 className="text-xl font-bold text-white mb-2">{incident.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                incident.status === 'pending_review' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                incident.status === 'acknowledged' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                incident.status === 'escalated' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                'text-gray-400 bg-gray-500/10 border-gray-500/20'
              }`}>
                {incident.status?.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-secondary text-xs">{new Date(incident.timestamp).toLocaleString()}</p>
            <p className="text-secondary text-xs mt-1">Rule: <span className="text-white">{incident.rule_triggered}</span></p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="text-secondary text-xs">Event Type</p><p className="text-white font-medium">{incident.event_type?.replace(/_/g, ' ')}</p></div>
          <div><p className="text-secondary text-xs">Camera</p><p className="text-white font-medium">{incident.camera_name || incident.camera_id?.slice(0,8)}</p></div>
          <div><p className="text-secondary text-xs">Location</p><p className="text-white font-medium">{incident.location || '—'}</p></div>
          {incident.confidence && <div><p className="text-secondary text-xs">Confidence</p><p className="text-white font-medium">{(incident.confidence * 100).toFixed(1)}%</p></div>}
          {incident.track_ids?.length > 0 && <div><p className="text-secondary text-xs">Track IDs</p><p className="text-white font-medium font-mono">{incident.track_ids.join(', ')}</p></div>}
        </div>
      </div>

      {/* Evidence */}
      {incident.evidence?.length > 0 && (
        <div className="card border border-white/5 p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Image size={15} className="text-accent" /> Evidence
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {incident.evidence.map((ev: any) => (
              <div key={ev.id} className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                {ev.mime_type?.startsWith('image') ? (
                  <img src={ev.url + '/file'} alt={ev.type} className="w-full h-full object-cover" />
                ) : ev.mime_type?.startsWith('video') ? (
                  <video src={ev.url + '/file'} controls className="w-full h-full" />
                ) : null}
                <p className="text-secondary text-xs px-2 pb-2">{ev.type?.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {incident.status === 'pending_review' && (
        <div className="card border border-white/5 p-6 space-y-4">
          <h2 className="text-white font-semibold">Operator Review</h2>
          <p className="text-secondary text-sm">Review the evidence above and take action. All actions are logged.</p>

          <div>
            <label className="label">Operator Notes</label>
            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="Add notes about this incident..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div>
            <label className="label">False Positive Reason (required if marking FP)</label>
            <input
              className="input"
              placeholder="Explain why this is a false positive..."
              value={fpReason}
              onChange={e => setFpReason(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => update('acknowledged')}
              disabled={updating}
              className="btn-primary flex items-center gap-2"
            >
              <CheckCircle size={15} /> Acknowledge
            </button>
            <button
              onClick={() => update('escalated')}
              disabled={updating}
              className="btn-secondary flex items-center gap-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            >
              <AlertTriangle size={15} /> Escalate
            </button>
            <button
              onClick={() => update('false_positive')}
              disabled={updating}
              className="btn-danger flex items-center gap-2"
            >
              <XCircle size={15} /> Mark False Positive
            </button>
          </div>
        </div>
      )}

      {incident.operator_notes && (
        <div className="card border border-accent/20 bg-accent/5 p-4">
          <p className="text-secondary text-xs mb-1">Operator Notes</p>
          <p className="text-white text-sm">{incident.operator_notes}</p>
        </div>
      )}
    </div>
  )
}
