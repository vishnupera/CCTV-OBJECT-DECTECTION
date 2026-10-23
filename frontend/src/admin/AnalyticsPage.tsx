import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import api from '../lib/api'

const COLORS = ['#2A835F', '#8BBB92', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card border border-white/10 p-3 text-xs">
      <p className="text-secondary mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [perHour, setPerHour] = useState<any[]>([])
  const [byType, setByType] = useState<any[]>([])
  const [bySeverity, setBySeverity] = useState<any[]>([])
  const [fpRate, setFpRate] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/incidents-per-hour?hours=24'),
      api.get('/analytics/by-type?days=7'),
      api.get('/analytics/by-severity?days=7'),
      api.get('/analytics/false-positive-rate?days=30'),
    ]).then(([h, t, s, fp]) => {
      setPerHour(h.data.map((r: any) => ({ ...r, hour: new Date(r.hour).getHours() + ':00' })))
      setByType(t.data)
      setBySeverity(s.data)
      setFpRate(fp.data.filter((r: any) => r.total > 0))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-64 rounded-2xl" />)}</div>

  return (
    <div className="space-y-6">
      <h1 className="section-title">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents per hour */}
        <div className="card border border-white/5 p-5">
          <h2 className="text-white font-semibold mb-4">Incidents (Last 24h)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={perHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fill: '#8BBB92', fontSize: 11 }} />
              <YAxis tick={{ fill: '#8BBB92', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" stroke="#2A835F" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* By type */}
        <div className="card border border-white/5 p-5">
          <h2 className="text-white font-semibold mb-4">By Type (7 Days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byType.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="event_type" tick={{ fill: '#8BBB92', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8BBB92', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#2A835F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Severity distribution */}
        <div className="card border border-white/5 p-5">
          <h2 className="text-white font-semibold mb-4">Severity Distribution (7 Days)</h2>
          {bySeverity.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={bySeverity} dataKey="count" nameKey="severity" outerRadius={80} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {bySeverity.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-secondary text-sm">No data yet</div>
          )}
        </div>

        {/* False positive rate */}
        <div className="card border border-white/5 p-5">
          <h2 className="text-white font-semibold mb-4">False Positive Rate (30 Days)</h2>
          {fpRate.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={fpRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="event_type" tick={{ fill: '#8BBB92', fontSize: 10 }} />
                <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#8BBB92', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="fp_rate" name="FP Rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-secondary text-sm">No data yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
