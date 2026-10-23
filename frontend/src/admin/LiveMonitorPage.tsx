import { useEffect, useState } from 'react'
import { Camera, Eye, EyeOff, Download, Power } from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/useToast'

export default function LiveMonitorPage() {
  const [cameras, setCameras] = useState<any[]>([])
  const [selectedCam, setSelectedCam] = useState<string>('')
  const [showOverlay, setShowOverlay] = useState(true)
  const [state, setState] = useState<any>(null)
  const [toggling, setToggling] = useState(false)
  const { toast } = useToast()

  const loadCameras = () => {
    api.get('/cameras/').then(r => {
      setCameras(r.data)
      if (r.data.length > 0 && !selectedCam) {
        setSelectedCam(r.data[0].id)
      }
    })
  }

  useEffect(() => {
    loadCameras()
  }, [])

  const currentCam = cameras.find(c => c.id === selectedCam)

  useEffect(() => {
    if (!selectedCam || (currentCam && !currentCam.is_enabled)) {
      setState(null)
      return
    }
    const interval = setInterval(() => {
      api.get(`/stream/state/${selectedCam}`).then(r => setState(r.data)).catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [selectedCam, currentCam?.is_enabled])

  const handleToggleCamera = async () => {
    if (!selectedCam || !currentCam) return
    setToggling(true)
    try {
      const res = await api.post(`/cameras/${selectedCam}/toggle`)
      toast(
        'success',
        res.data.is_enabled ? 'Camera Turned ON' : 'Camera Turned OFF',
        `${currentCam.name} is now ${res.data.is_enabled ? 'active & streaming' : 'powered off'}`
      )
      loadCameras()
    } catch (err: any) {
      toast('error', 'Toggle Failed', err.response?.data?.detail || 'Could not toggle camera')
    } finally {
      setToggling(false)
    }
  }

  const handleSnapshot = async () => {
    if (!selectedCam) return
    const res = await fetch(`/api/stream/snapshot/${selectedCam}`, { credentials: 'include' })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `snapshot-${Date.now()}.jpg`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">Live Monitor</h1>
        <div className="flex items-center gap-2">
          <select className="input w-auto text-sm" value={selectedCam} onChange={e => setSelectedCam(e.target.value)}>
            {cameras.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.is_enabled ? '(ON)' : '(OFF)'}
              </option>
            ))}
          </select>

          {/* Camera ON / OFF Button */}
          {currentCam && (
            <button
              onClick={handleToggleCamera}
              disabled={toggling}
              className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                currentCam.is_enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30 shadow-sm shadow-emerald-950/50'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
              }`}
              title={currentCam.is_enabled ? "Turn Camera OFF" : "Turn Camera ON"}
            >
              <Power size={13} className={toggling ? 'animate-spin' : ''} />
              <span>{currentCam.is_enabled ? 'Camera ON' : 'Camera OFF'}</span>
            </button>
          )}

          <button onClick={() => setShowOverlay(!showOverlay)} className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm">
            {showOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
            {showOverlay ? 'Hide' : 'Show'} Overlays
          </button>
          <button onClick={handleSnapshot} disabled={!currentCam?.is_enabled} className="btn-secondary flex items-center gap-2 py-2 px-3 text-sm disabled:opacity-50">
            <Download size={14} /> Snapshot
          </button>
        </div>
      </div>

      {selectedCam ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Full-screen feed */}
          <div className="lg:col-span-3 card border border-white/5 overflow-hidden">
            <div className="relative bg-black flex items-center justify-center min-h-[360px]">
              {currentCam && !currentCam.is_enabled ? (
                <div className="w-full flex flex-col items-center justify-center text-center py-20 px-4 bg-zinc-950">
                  <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
                    <Power size={24} className="text-rose-400" />
                  </div>
                  <h3 className="text-white font-semibold text-lg">Camera is Powered OFF</h3>
                  <p className="text-secondary text-xs max-w-sm mt-1 mb-5">
                    Live stream, AI detection pipeline, and recording are currently paused for this camera.
                  </p>
                  <button
                    onClick={handleToggleCamera}
                    disabled={toggling}
                    className="btn-primary flex items-center gap-2 py-2 px-4 text-xs font-semibold"
                  >
                    <Power size={14} /> Turn Camera ON
                  </button>
                </div>
              ) : (
                <>
                  <img
                    src={`/api/stream/mjpeg/${selectedCam}${showOverlay ? '' : '?raw=1'}`}
                    alt="Live feed"
                    className="w-full"
                    style={{ minHeight: '360px', objectFit: 'contain' }}
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-xs font-medium">LIVE</span>
                  </div>
                  {state && (
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                      <p className="text-white text-xs font-mono">
                        {state.stream_fps?.toFixed(1)} fps | {state.inference_ms?.toFixed(0)} ms | {state.person_count} persons
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Detections panel */}
          <div className="card border border-white/5 overflow-hidden">
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
              <p className="text-white text-sm font-semibold">Live Detections</p>
              {currentCam && (
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  currentCam.is_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {currentCam.is_enabled ? 'Active' : 'Offline'}
                </span>
              )}
            </div>
            <div className="p-3 overflow-y-auto max-h-[400px] space-y-2">
              {!currentCam?.is_enabled ? (
                <p className="text-secondary text-xs text-center py-8">Camera powered off</p>
              ) : state?.detections?.length > 0 ? (
                state.detections.map((det: any, i: number) => (
                  <div key={i} className="p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{det.class_name}</span>
                      <span className="text-secondary">{(det.confidence * 100).toFixed(0)}%</span>
                    </div>
                    {det.track_id && <p className="text-secondary mt-0.5">Track #{det.track_id}</p>}
                  </div>
                ))
              ) : (
                <p className="text-secondary text-xs text-center py-8">No detections</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card border border-white/5 p-12 text-center">
          <Camera size={40} className="text-secondary/30 mx-auto mb-3" />
          <p className="text-secondary">No cameras available</p>
        </div>
      )}
    </div>
  )
}
