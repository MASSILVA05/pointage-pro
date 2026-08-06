import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { leaveLabel } from '../../lib/reports'
import { formatIsoDateOnly } from '../../lib/dateFormat'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../../lib/ui'

const TYPE_OPTIONS = [
  { value: 'paid', label: 'Congé payé' },
  { value: 'sick', label: 'Congé maladie' },
  { value: 'unpaid', label: 'Congé sans solde' },
]

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-bg-subtle text-text-muted',
    approved: 'bg-success-soft text-success',
    rejected: 'bg-danger-soft text-danger',
  }
  const labels = { pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function Leaves() {
  const { org } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  const [employeeId, setEmployeeId] = useState('')
  const [type, setType] = useState('paid')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [actioningId, setActioningId] = useState(null)

  async function load() {
    setLoading(true)
    const [{ data: lv }, { data: emp }] = await Promise.all([
      supabase
        .from('leaves')
        .select('*, employees(id, first_name, last_name)')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name').eq('org_id', org.id),
    ])
    setLeaves(lv ?? [])
    setEmployees(emp ?? [])
    if (!employeeId && emp?.length) setEmployeeId(emp[0].id)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    if (!employeeId) {
      setCreateError('Sélectionnez un employé')
      return
    }
    if (!startDate || !endDate || endDate < startDate) {
      setCreateError('Dates invalides')
      return
    }

    setCreating(true)
    try {
      const { error } = await supabase.from('leaves').insert({
        org_id: org.id,
        employee_id: employeeId,
        type,
        start_date: startDate,
        end_date: endDate,
        status: 'pending',
      })
      if (error) throw error
      setStartDate('')
      setEndDate('')
      await load()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(id, status) {
    setActioningId(id)
    try {
      await supabase.from('leaves').update({ status }).eq('id', id)
      await load()
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Congés</h1>
        <p className="mt-1 text-sm text-text-muted">Demandes de congé de votre organisation.</p>
      </div>

      <div className={CARD_CLASS}>
        <h2 className="mb-3 text-sm font-semibold text-text">Créer une demande</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="leaveEmployee" className={LABEL_CLASS}>
              Employé
            </label>
            <select
              id="leaveEmployee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={INPUT_CLASS}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="leaveType" className={LABEL_CLASS}>
              Type
            </label>
            <select id="leaveType" value={type} onChange={(e) => setType(e.target.value)} className={INPUT_CLASS}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="leaveStart" className={LABEL_CLASS}>
              Début
            </label>
            <input
              id="leaveStart"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="leaveEnd" className={LABEL_CLASS}>
              Fin
            </label>
            <input
              id="leaveEnd"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          {createError && <p className="text-sm text-danger sm:col-span-4">{createError}</p>}

          <div className="sm:col-span-4">
            <button type="submit" disabled={creating || !employees.length} className={BUTTON_PRIMARY_CLASS}>
              {creating ? 'Création…' : 'Créer la demande'}
            </button>
          </div>
        </form>
      </div>

      <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
        {loading ? (
          <p className="p-5 text-sm text-text-muted">Chargement…</p>
        ) : leaves.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">Aucune demande de congé</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-4 py-3 font-medium">Employé</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Période</th>
                <th className="px-4 py-3 font-medium">Commentaire</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((lv) => (
                <tr key={lv.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-text">
                    {lv.employees?.first_name} {lv.employees?.last_name}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{leaveLabel(lv.type)}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {formatIsoDateOnly(lv.start_date)} → {formatIsoDateOnly(lv.end_date)}
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-3 text-text-muted" title={lv.comment || ''}>
                    {lv.comment || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lv.status} />
                  </td>
                  <td className="px-4 py-3">
                    {lv.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actioningId === lv.id}
                          onClick={() => updateStatus(lv.id, 'approved')}
                          className="rounded-md border border-success px-2 py-1 text-xs font-medium text-success hover:bg-success-soft disabled:opacity-50"
                        >
                          Approuver
                        </button>
                        <button
                          type="button"
                          disabled={actioningId === lv.id}
                          onClick={() => updateStatus(lv.id, 'rejected')}
                          className="rounded-md border border-danger px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
                        >
                          Rejeter
                        </button>
                      </div>
                    ) : (
                      <span className="text-text-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
