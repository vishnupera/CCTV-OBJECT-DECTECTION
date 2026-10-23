import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import api from '../lib/api'

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [email, setEmail] = useState('')
  const PAGE_SIZE = 50

  useEffect(() => {
    const params: any = { page, page_size: PAGE_SIZE }
    if (action) params.action = action
    if (email) params.user_email = email
    api.get('/audit/', { params }).then(r => { setLogs(r.data.items || []); setTotal(r.data.total || 0) })
  }, [page, action, email])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <h1 className="section-title">Audit Log</h1>
      <p className="text-secondary text-sm">Immutable record of all system actions. Read-only.</p>

      <div className="card border border-white/5 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input className="input pl-9 text-sm py-2" placeholder="Filter by action..." value={action} onChange={e => { setAction(e.target.value); setPage(1) }} />
        </div>
        <input className="input text-sm py-2 w-auto" placeholder="Filter by email..." value={email} onChange={e => { setEmail(e.target.value); setPage(1) }} />
      </div>

      <div className="card border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-secondary text-xs border-b border-white/5">
                <th className="text-left px-4 py-2.5 font-medium">Timestamp</th>
                <th className="text-left px-4 py-2.5 font-medium">User</th>
                <th className="text-left px-4 py-2.5 font-medium">Action</th>
                <th className="text-left px-4 py-2.5 font-medium">Resource</th>
                <th className="text-left px-4 py-2.5 font-medium">IP</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-secondary text-sm">No audit entries</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-2.5 text-secondary text-xs whitespace-nowrap">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-white text-xs">{log.user_email || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono bg-white/5 px-2 py-0.5 rounded">{log.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-secondary text-xs">
                    {log.resource_type}{log.resource_id ? `:${log.resource_id.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-secondary text-xs font-mono">{log.ip_address || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold ${log.success ? 'text-green-400' : 'text-red-400'}`}>
                      {log.success ? '✓' : '✗'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-secondary text-xs">{total} entries | Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-secondary py-1.5 px-3 disabled:opacity-40"><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} className="btn-secondary py-1.5 px-3 disabled:opacity-40"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
