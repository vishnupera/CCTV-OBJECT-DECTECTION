import { useEffect, useState } from 'react'
import { Activity, Cpu, HardDrive, Database, Wifi, WifiOff } from 'lucide-react'
import api from '../lib/api'

export default function SystemHealthPage() {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = () => api.get('/health/full').then(r => setHealth(r.data)).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [])

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="section-title">System Health</h1>
        <div className={`flex items-center gap-2 text-sm ${health?.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          {health?.status === 'ok' ? 'All systems operational' : 'Degraded'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={15} className="text-accent" />
            <span className="text-secondary text-xs">CPU Usage</span>
          </div>
          <p className="text-white text-3xl font-black">{health?.cpu_percent?.toFixed(1)}%</p>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${health?.cpu_percent || 0}%` }} />
          </div>
        </div>

        <div className="card border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={15} className="text-accent" />
            <span className="text-secondary text-xs">Memory</span>
          </div>
          <p className="text-white text-3xl font-black">{health?.memory?.percent?.toFixed(1)}%</p>
          <p className="text-secondary text-xs mt-1">{health?.memory?.used_mb} / {health?.memory?.total_mb} MB</p>
        </div>

        <div className="card border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database size={15} className="text-accent" />
            <span className="text-secondary text-xs">Database</span>
          </div>
          <p className={`text-xl font-bold ${health?.database?.connected ? 'text-green-400' : 'text-red-400'}`}>
            {health?.database?.connected ? 'Connected' : 'Disconnected'}
          </p>
        </div>

        <div className="card border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={15} className="text-accent" />
            <span className="text-secondary text-xs">Uptime</span>
          </div>
          <p className="text-white text-2xl font-black">
            {Math.floor((health?.uptime_seconds || 0) / 3600)}h {Math.floor(((health?.uptime_seconds || 0) % 3600) / 60)}m
          </p>
        </div>
      </div>

      {/* GPU */}
      {health?.gpu?.length > 0 && (
        <div className="card border border-white/5 p-5">
          <h2 className="text-white font-semibold mb-4">GPU</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {health.gpu.map((gpu: any, i: number) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5">
                <p className="text-white font-medium text-sm mb-2">{gpu.name}</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-secondary"><span>Load</span><span className="text-white">{gpu.load_pct}%</span></div>
                  <div className="h-1.5 bg-white/10 rounded-full"><div className="h-full bg-accent rounded-full" style={{ width: `${gpu.load_pct}%` }} /></div>
                  <div className="flex justify-between text-secondary"><span>VRAM</span><span className="text-white">{gpu.mem_used_mb} / {gpu.mem_total_mb} MB</span></div>
                  <div className="flex justify-between text-secondary"><span>Temp</span><span className="text-white">{gpu.temperature}°C</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera pipelines */}
      {health?.pipelines && Object.keys(health.pipelines).length > 0 && (
        <div className="card border border-white/5 p-5">
          <h2 className="text-white font-semibold mb-4">Camera Pipelines</h2>
          <div className="space-y-2">
            {Object.entries(health.pipelines).map(([id, state]: [string, any]) => (
              <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2">
                  {state.connected ? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-red-400" />}
                  <span className="text-white text-sm font-mono">{id.slice(0, 8)}...</span>
                </div>
                <div className="flex gap-4 text-xs text-secondary">
                  <span>{state.fps?.toFixed(1)} fps</span>
                  <span>{state.inference_ms?.toFixed(0)} ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Storage */}
      {health?.storage && (
        <div className="card border border-white/5 p-5">
          <h2 className="text-white font-semibold mb-4">Storage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(health.storage).map(([path, info]: [string, any]) => (
              <div key={path} className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-secondary text-xs mb-1">{path}</p>
                <p className="text-white font-semibold">{info.size_mb} MB</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
