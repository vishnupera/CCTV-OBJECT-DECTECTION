import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Plus, Trash2, Edit2, RefreshCw, Wifi, Power } from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/useToast'

export default function CamerasPage() {
  const [cameras, setCameras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCam, setEditCam] = useState<any>(null)
  const [form, setForm] = useState({ name: '', source: '', description: '', location: '' })
  const [testing, setTesting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const { toast } = useToast()

  const load = () => api.get('/cameras/').then(r => setCameras(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const toggleCamera = async (cam: any) => {
    setToggling(cam.id)
    try {
      const res = await api.post(`/cameras/${cam.id}/toggle`)
      toast(
        'success',
        res.data.is_enabled ? 'Camera Turned ON' : 'Camera Turned OFF',
        `${cam.name} is now ${res.data.is_enabled ? 'streaming & active' : 'powered off'}`
      )
      load()
    } catch (err: any) {
      toast('error', 'Toggle Failed', err.response?.data?.detail || 'Could not toggle camera')
    } finally {
      setToggling(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editCam) {
        await api.patch(`/cameras/${editCam.id}`, form)
        toast('success', 'Updated', 'Camera updated')
      } else {
        await api.post('/cameras/', form)
        toast('success', 'Created', 'Camera added and pipeline started')
      }
      setShowForm(false); setEditCam(null); setForm({ name: '', source: '', description: '', location: '' }); load()
    } catch (err: any) {
      toast('error', 'Error', err.response?.data?.detail || 'Failed')
    }
  }

  const deleteCamera = async (id: string) => {
    if (!confirm('Delete this camera?')) return
    await api.delete(`/cameras/${id}`)
    toast('success', 'Deleted', 'Camera removed')
    load()
  }

  const testConnection = async (id: string) => {
    setTesting(id)
    try {
      const r = await api.post(`/cameras/${id}/test`)
      toast(r.data.connected ? 'success' : 'error', r.data.connected ? 'Connected' : 'Failed', `Source: ${r.data.source}`)
    } catch {
      toast('error', 'Error', 'Connection test failed')
    } finally { setTesting(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="section-title">Cameras</h1>
        <button onClick={() => { setShowForm(true); setEditCam(null) }} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Add Camera
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card border border-white/10 p-6 w-full max-w-md">
            <h2 className="text-white font-bold mb-4">{editCam ? 'Edit Camera' : 'Add Camera'}</h2>
            <form onSubmit={submit} className="space-y-3">
              <div><label className="label">Name</label><input className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Main Entrance" /></div>
              <div><label className="label">Source</label><input className="input" required value={form.source} onChange={e => setForm({...form, source: e.target.value})} placeholder="0 | /path/to.mp4 | rtsp://..." /></div>
              <div><label className="label">Location</label><input className="input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Building A, Floor 2" /></div>
              <div><label className="label">Description</label><input className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Save</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Camera list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)
        ) : cameras.length === 0 ? (
          <div className="col-span-3 card border border-white/5 p-12 text-center">
            <Camera size={40} className="text-secondary/30 mx-auto mb-3" />
            <p className="text-secondary">No cameras configured yet</p>
          </div>
        ) : cameras.map(cam => (
          <div key={cam.id} className="card border border-white/5 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cam.is_enabled ? 'status-online' : 'status-offline'} />
                <div>
                  <span className="text-white font-semibold text-sm block">{cam.name}</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-secondary">
                    {cam.is_enabled ? 'Active / Online' : 'Powered Off'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Camera ON / OFF Button */}
                <button
                  onClick={() => toggleCamera(cam)}
                  disabled={toggling === cam.id}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    cam.is_enabled
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-sm shadow-emerald-950/50'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
                  }`}
                  title={cam.is_enabled ? "Turn Camera OFF" : "Turn Camera ON"}
                >
                  <Power size={12} className={toggling === cam.id ? 'animate-spin' : ''} />
                  <span>{cam.is_enabled ? 'ON' : 'OFF'}</span>
                </button>

                <button onClick={() => testConnection(cam.id)} className="p-1.5 text-secondary hover:text-accent transition-colors" title="Test connection">
                  {testing === cam.id ? <RefreshCw size={14} className="animate-spin" /> : <Wifi size={14} />}
                </button>
                <button onClick={() => { setEditCam(cam); setForm({ name: cam.name, source: cam.source, description: cam.description || '', location: cam.location || '' }); setShowForm(true) }} className="p-1.5 text-secondary hover:text-white transition-colors" title="Edit camera">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteCamera(cam.id)} className="p-1.5 text-secondary hover:text-red-400 transition-colors" title="Delete camera">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <p className="text-secondary">Source: <span className="text-white font-mono">{cam.source}</span></p>
              {cam.location && <p className="text-secondary">Location: <span className="text-white">{cam.location}</span></p>}
              {cam.fps && <p className="text-secondary">FPS: <span className="text-white">{cam.fps.toFixed(1)}</span></p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
