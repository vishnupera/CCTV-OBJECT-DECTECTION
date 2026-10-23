import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'
import { useToast } from '../hooks/useToast'
import { Trash2, Save } from 'lucide-react'

export default function ZonesPage() {
  const [cameras, setCameras] = useState<any[]>([])
  const [selectedCam, setSelectedCam] = useState<string>('')
  const [zones, setZones] = useState<any[]>([])
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<[number, number][]>([])
  const [zoneName, setZoneName] = useState('')
  const [ruleType, setRuleType] = useState('restricted')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()

  useEffect(() => { api.get('/cameras/').then(r => setCameras(r.data)) }, [])
  
  useEffect(() => {
    if (!selectedCam) return
    api.get(`/zones/?camera_id=${selectedCam}`).then(r => setZones(r.data))
  }, [selectedCam])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)
    setPoints(prev => [...prev, [x, y]])
  }

  const saveZone = async () => {
    if (points.length < 3) { toast('error', 'Invalid', 'Draw at least 3 points'); return }
    try {
      await api.post('/zones/', {
        camera_id: selectedCam,
        name: zoneName || 'Zone ' + (zones.length + 1),
        polygon: { points },
        rule_type: ruleType,
        color: '#2A835F',
      })
      setPoints([]); setDrawing(false); setZoneName('')
      const r = await api.get(`/zones/?camera_id=${selectedCam}`)
      setZones(r.data)
      toast('success', 'Zone saved')
    } catch { toast('error', 'Error', 'Failed to save zone') }
  }

  const deleteZone = async (id: string) => {
    await api.delete(`/zones/${id}`)
    setZones(prev => prev.filter(z => z.id !== id))
    toast('success', 'Zone deleted')
  }

  return (
    <div className="space-y-4">
      <h1 className="section-title">Zone Editor</h1>

      <div className="flex flex-wrap gap-3">
        <select className="input w-auto" value={selectedCam} onChange={e => setSelectedCam(e.target.value)}>
          <option value="">Select a camera</option>
          {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {selectedCam && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-2 card border border-white/5 overflow-hidden">
            <div className="p-3 border-b border-white/5 flex flex-wrap gap-2 items-center">
              <input className="input flex-1 min-w-[140px] text-sm py-1.5" placeholder="Zone name" value={zoneName} onChange={e => setZoneName(e.target.value)} />
              <select className="input w-auto text-sm py-1.5" value={ruleType} onChange={e => setRuleType(e.target.value)}>
                <option value="restricted">Restricted Zone</option>
                <option value="loitering">Loitering</option>
                <option value="density">Density</option>
              </select>
              <button onClick={() => setDrawing(!drawing)} className={drawing ? 'btn-primary text-sm py-1.5' : 'btn-secondary text-sm py-1.5'}>
                {drawing ? 'Drawing...' : 'Draw Zone'}
              </button>
              {points.length >= 3 && (
                <button onClick={saveZone} className="btn-primary text-sm py-1.5 flex items-center gap-1">
                  <Save size={13} /> Save
                </button>
              )}
              {points.length > 0 && (
                <button onClick={() => setPoints([])} className="btn-secondary text-sm py-1.5">Clear</button>
              )}
            </div>
            <div className="relative">
              {/* MJPEG background */}
              <img src={`/api/stream/mjpeg/${selectedCam}`} alt="Camera feed" className="w-full" />
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full ${drawing ? 'cursor-crosshair' : ''}`}
                width={640} height={360}
                onClick={handleCanvasClick}
                style={{ pointerEvents: drawing ? 'auto' : 'none' }}
              />
              {/* Draw preview points */}
              {points.length > 0 && (
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                  <polygon
                    points={points.map(p => p.join(',')).join(' ')}
                    fill="rgba(42,131,95,0.2)"
                    stroke="#2A835F"
                    strokeWidth="2"
                    strokeDasharray="6,3"
                  />
                  {points.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r="5" fill="#2A835F" stroke="white" strokeWidth="1.5" />
                  ))}
                </svg>
              )}
            </div>
          </div>

          {/* Zone list */}
          <div className="card border border-white/5">
            <div className="p-3 border-b border-white/5">
              <p className="text-white text-sm font-semibold">Zones ({zones.length})</p>
            </div>
            <div className="divide-y divide-white/5">
              {zones.length === 0 ? (
                <div className="p-6 text-center text-secondary text-sm">No zones defined</div>
              ) : zones.map(zone => (
                <div key={zone.id} className="p-3 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-sm mt-0.5 shrink-0" style={{ background: zone.color || '#2A835F' }} />
                    <div>
                      <p className="text-white text-sm font-medium">{zone.name}</p>
                      <p className="text-secondary text-xs">{zone.rule_type}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteZone(zone.id)} className="p-1 text-secondary hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
