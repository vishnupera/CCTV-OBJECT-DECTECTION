import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Camera, Clock, ShieldAlert, Activity, Power } from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/useToast'

const ADMIN_SLUG = import.meta.env.VITE_ADMIN_SLUG || 'ops-console-a1b2c3'

function KpiCard({ title, value, icon: Icon, color, sub }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 border border-white/5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-secondary text-xs font-medium mb-1">{title}</p>
          <p className="text-3xl font-black text-white">{value ?? <span className="skeleton w-12 h-8 inline-block rounded" />}</p>
          {sub && <p className="text-secondary text-xs mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls: Record<string, string> = {
    critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low'
  }
  return <span className={cls[severity] || 'badge-low'}>{severity}</span>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [incidents, setIncidents] = useState<any[]>([])
  const [cameras, setCameras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const [s, i, c] = await Promise.all([
        api.get('/incidents/stats/summary'),
        api.get('/incidents/?page_size=10'),
        api.get('/cameras/'),
      ])
      setStats(s.data)
      setIncidents(i.data.items || [])
      setCameras(c.data || [])
    } catch { /* handle in prod */ }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 15000)
    return () => clearInterval(timer)
  }, [])

  const toggleCamera = async (cam: any) => {
    setToggling(cam.id)
    try {
      const res = await api.post(`/cameras/${cam.id}/toggle`)
      toast(
        'success',
        res.data.is_enabled ? 'Camera Turned ON' : 'Camera Turned OFF',
        `${cam.name} is now ${res.data.is_enabled ? 'online' : 'powered off'}`
      )
      loadData()
    } catch (err: any) {
      toast('error', 'Toggle Failed', err.response?.data?.detail || 'Could not toggle camera')
    } finally {
      setToggling(null)
    }
  }

  // Get first available camera for MJPEG
  const firstCamera = cameras[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Control Room</h1>
          <p className="text-secondary text-sm mt-0.5">Live system overview</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="status-online" />
          <span className="text-secondary text-xs">Live</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Incidents Today" value={stats?.total_today} icon={AlertTriangle} color="bg-red-500/20 text-red-400" />
        <KpiCard title="Pending Review" value={stats?.pending_review} icon={Clock} color="bg-yellow-500/20 text-yellow-400" />
        <KpiCard title="Critical Today" value={stats?.critical_today} icon={ShieldAlert} color="bg-red-600/20 text-red-500" />
        <KpiCard title="Active Cameras" value={cameras.filter(c => c.is_enabled).length} icon={Camera} color="bg-accent/20 text-accent" />
      </div>

      {/* Main content: live feed + incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live feed */}
        <div className="lg:col-span-2 card border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-accent" />
              <span className="text-white text-sm font-semibold">Live Feed</span>
              {firstCamera && (
                <span className="text-secondary text-xs">({firstCamera.name})</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {firstCamera && (
                <button
                  onClick={() => toggleCamera(firstCamera)}
                  disabled={toggling === firstCamera.id}
                  className={`px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 border transition-all ${
                    firstCamera.is_enabled
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                  }`}
                  title={firstCamera.is_enabled ? "Turn Camera OFF" : "Turn Camera ON"}
                >
                  <Power size={11} className={toggling === firstCamera.id ? 'animate-spin' : ''} />
                  <span>{firstCamera.is_enabled ? 'Camera ON' : 'Camera OFF'}</span>
                </button>
              )}
              {firstCamera && (
                <Link to={`/${ADMIN_SLUG}/monitor`} className="text-accent text-xs hover:underline">
                  Full screen →
                </Link>
              )}
            </div>
          </div>
          {firstCamera ? (
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {!firstCamera.is_enabled ? (
                <div className="text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-2">
                    <Power size={20} className="text-rose-400" />
                  </div>
                  <p className="text-white text-sm font-medium">Camera is Powered OFF</p>
                  <button
                    onClick={() => toggleCamera(firstCamera)}
                    disabled={toggling === firstCamera.id}
                    className="btn-primary text-xs py-1.5 px-3 mt-3 inline-flex items-center gap-1.5"
                  >
                    <Power size={12} /> Turn ON
                  </button>
                </div>
              ) : (
                <>
                  <img
                    src={`/api/stream/mjpeg/${firstCamera.id}`}
                    alt="Live camera feed"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-xs font-medium">LIVE</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-black/30 flex items-center justify-center">
              <div className="text-center">
                <Camera size={40} className="text-secondary/30 mx-auto mb-2" />
                <p className="text-secondary text-sm">No cameras configured</p>
                <Link to={`/${ADMIN_SLUG}/cameras`} className="text-accent text-xs hover:underline mt-1 block">
                  Add a camera →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Camera list */}
        <div className="card border border-white/5">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-white text-sm font-semibold">Cameras</span>
            <Link to={`/${ADMIN_SLUG}/cameras`} className="text-accent text-xs hover:underline">Manage</Link>
          </div>
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded" />)}
              </div>
            ) : cameras.length === 0 ? (
              <div className="p-6 text-center text-secondary text-sm">No cameras</div>
            ) : (
              cameras.map(cam => (
                <div key={cam.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={cam.is_enabled ? 'status-online' : 'status-offline'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{cam.name}</p>
                    <p className="text-secondary text-xs">{cam.location || cam.source}</p>
                  </div>
                  <button
                    onClick={() => toggleCamera(cam)}
                    disabled={toggling === cam.id}
                    className={`p-1.5 rounded-lg border transition-all ${
                      cam.is_enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                    }`}
                    title={cam.is_enabled ? "Turn Camera OFF" : "Turn Camera ON"}
                  >
                    <Power size={13} className={toggling === cam.id ? 'animate-spin' : ''} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent incidents */}
      <div className="card border border-white/5">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="text-white text-sm font-semibold">Recent Incidents</span>
          <Link to={`/${ADMIN_SLUG}/incidents`} className="text-accent text-xs hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-secondary text-xs border-b border-white/5">
                <th className="text-left px-4 py-2.5 font-medium">ID</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">Severity</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-secondary">Loading...</td></tr>
              ) : incidents.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-secondary text-sm">No incidents yet</td></tr>
              ) : (
                incidents.map(inc => (
                  <tr key={inc.id} className="table-row">
                    <td className="px-4 py-3">
                      <Link to={`/${ADMIN_SLUG}/incidents/${inc.id}`} className="text-accent text-sm hover:underline font-mono">
                        {inc.incident_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-secondary text-sm">{inc.event_type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        inc.status === 'pending_review' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                        inc.status === 'acknowledged' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                        inc.status === 'escalated' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                        'text-secondary bg-white/5 border-white/10'
                      }`}>
                        {inc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary text-xs">
                      {inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
