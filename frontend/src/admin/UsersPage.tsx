import { useEffect, useState } from 'react'
import { Plus, UserCheck, UserX, Key } from 'lucide-react'
import api from '../lib/api'
import { useToast } from '../hooks/useToast'
import { motion } from 'framer-motion'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'viewer' })
  const [resetPwd, setResetPwd] = useState<{ id: string; pwd: string } | null>(null)
  const { toast } = useToast()

  const load = () => api.get('/users/').then(r => setUsers(r.data))
  useEffect(() => { load() }, [])

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/users/', form)
      toast('success', 'User created')
      setShowForm(false); setForm({ email: '', password: '', full_name: '', role: 'viewer' }); load()
    } catch (err: any) { toast('error', 'Error', err.response?.data?.detail) }
  }

  const toggleActive = async (user: any) => {
    await api.patch(`/users/${user.id}`, { is_active: !user.is_active })
    toast('success', user.is_active ? 'User disabled' : 'User enabled')
    load()
  }

  const doResetPwd = async () => {
    if (!resetPwd) return
    await api.post(`/users/${resetPwd.id}/reset-password`, { new_password: resetPwd.pwd })
    toast('success', 'Password reset')
    setResetPwd(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="section-title">Users & Roles</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Add User
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card border border-white/10 p-6 w-full max-w-md">
            <h2 className="text-white font-bold mb-4">Create User</h2>
            <form onSubmit={createUser} className="space-y-3">
              <div><label className="label">Email</label><input type="email" className="input" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><label className="label">Password</label><input type="password" className="input" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
              <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="viewer">Viewer</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Create</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {resetPwd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card border border-white/10 p-6 w-full max-w-sm">
            <h2 className="text-white font-bold mb-4">Reset Password</h2>
            <input type="password" className="input mb-3" placeholder="New password" value={resetPwd.pwd} onChange={e => setResetPwd({...resetPwd, pwd: e.target.value})} />
            <div className="flex gap-2">
              <button onClick={doResetPwd} className="btn-primary flex-1">Reset</button>
              <button onClick={() => setResetPwd(null)} className="btn-secondary">Cancel</button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="card border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-secondary text-xs border-b border-white/5">
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Last Login</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="table-row">
                <td className="px-4 py-3">
                  <p className="text-white text-sm">{u.email}</p>
                  {u.full_name && <p className="text-secondary text-xs">{u.full_name}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    u.role === 'admin' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
                    u.role === 'operator' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                    'text-secondary bg-white/5 border-white/10'
                  }`}>{u.role}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${u.is_active ? 'text-green-400' : 'text-red-400'}`}>
                    {u.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-secondary text-xs">
                  {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                </td>
                <td className="px-4 py-3 flex items-center gap-2">
                  <button onClick={() => toggleActive(u)} className="p-1.5 text-secondary hover:text-white transition-colors" title={u.is_active ? 'Disable' : 'Enable'}>
                    {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                  </button>
                  <button onClick={() => setResetPwd({ id: u.id, pwd: '' })} className="p-1.5 text-secondary hover:text-yellow-400 transition-colors" title="Reset Password">
                    <Key size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
