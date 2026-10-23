import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../lib/api'

const ADMIN_SLUG = import.meta.env.VITE_ADMIN_SLUG || 'ops-console-a1b2c3'

function SeverityBadge({ severity }: { severity: string }) {
  const cls: Record<string, string> = {
    critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low'
  }
  return <span className={cls[severity] || 'badge-low'}>{severity}</span>
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')

  const PAGE_SIZE = 20

  useEffect(() => {
    setLoading(true)
    const params: any = { page, page_size: PAGE_SIZE }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (severityFilter) params.severity = severityFilter
    api.get('/incidents/', { params }).then(r => {
      setIncidents(r.data.items || [])
      setTotal(r.data.total || 0)
    }).finally(() => setLoading(false))
  }, [page, search, statusFilter, severityFilter])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="section-title">Incidents</h1>
        <span className="text-secondary text-sm">{total} total</span>
      </div>

      {/* Filters */}
      <div className="card border border-white/5 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            className="input pl-9"
            placeholder="Search by incident number..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="input w-auto" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          <option value="pending_review">Pending Review</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="escalated">Escalated</option>
          <option value="false_positive">False Positive</option>
        </select>
        <select className="input w-auto" value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1) }}>
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Table */}
      <div className="card border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-secondary text-xs border-b border-white/5 bg-white/2">
                <th className="text-left px-4 py-3 font-medium">Incident</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Severity</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Time</th>
                <th className="text-left px-4 py-3 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-secondary">Loading...</td></tr>
              ) : incidents.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-secondary">No incidents found</td></tr>
              ) : incidents.map(inc => (
                <tr key={inc.id} className="table-row">
                  <td className="px-4 py-3">
                    <Link to={`/${ADMIN_SLUG}/incidents/${inc.id}`} className="text-accent hover:underline font-mono text-sm">
                      {inc.incident_number}
                    </Link>
                    <p className="text-secondary text-xs mt-0.5 truncate max-w-[200px]">{inc.title}</p>
                  </td>
                  <td className="px-4 py-3 text-secondary text-sm">{inc.event_type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3"><SeverityBadge severity={inc.severity} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      inc.status === 'pending_review' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                      inc.status === 'acknowledged' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                      inc.status === 'escalated' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                      'text-gray-400 bg-gray-500/10 border-gray-500/20'
                    }`}>
                      {inc.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-secondary text-xs whitespace-nowrap">
                    {new Date(inc.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-secondary text-sm">{inc.evidence_count || 0} files</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-secondary text-xs">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="btn-secondary py-1.5 px-3 disabled:opacity-40">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
