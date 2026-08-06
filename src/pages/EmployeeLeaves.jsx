import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { leaveLabel } from '../lib/reports'
import { formatIsoDateOnly } from '../lib/dateFormat'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../lib/ui'

// Volontairement seulement payé/maladie ici (contrairement au formulaire
// manager qui propose aussi "sans solde") : un employé demande un congé, il
// ne décide pas s'il sera payé ou non.
const TYPE_OPTIONS = [
  { value: 'paid', label: 'Congé payé' },
  { value: 'sick', label: 'Congé maladie' },
]

const STATUS_STYLES = {
  pending: 'bg-bg-subtle text-text-muted',
  approved: 'bg-success-soft text-success',
  rejected: 'bg-danger-soft text-danger',
}
const STATUS_LABELS = { pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté' }

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export default function EmployeeLeaves() {
  const { employee } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)

  const [type, setType] = useState('paid')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [comment, setComment] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('leaves')
      .select('*')
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false })
    setLeaves(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id])

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    if (!startDate || !endDate || endDate < startDate) {
      setCreateError('Dates invalides')
      return
    }

    setCreating(true)
    try {
      // org_id n'est jamais envoyé : forcé côté serveur par le trigger
      // set_leave_org (schema.sql V7), à partir de employee_id. status
      // toujours 'pending' — seul le manager peut approuver/rejeter,
      // policy RLS "Employé demande un congé pour lui-même" le vérifie
      // aussi côté serveur.
      const { error } = await supabase.from('leaves').insert({
        employee_id: employee.id,
        type,
        start_date: startDate,
        end_date: endDate,
        status: 'pending',
        comment: comment || null,
      })
      if (error) throw error
      setStartDate('')
      setEndDate('')
      setComment('')
      await load()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Mes congés</h1>
        <p className="mt-1 text-sm text-text-muted">Demander un congé et suivre son statut.</p>
      </div>

      <div className={CARD_CLASS}>
        <h2 className="mb-3 text-sm font-semibold text-text">Nouvelle demande</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
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
          <div>
            <label htmlFor="leaveComment" className={LABEL_CLASS}>
              Commentaire (optionnel)
            </label>
            <textarea
              id="leaveComment"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          {createError && <p className="text-sm text-danger">{createError}</p>}
          <button type="submit" disabled={creating} className={BUTTON_PRIMARY_CLASS}>
            {creating ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-text-muted">Chargement…</p>
        ) : leaves.length === 0 ? (
          <p className="text-sm text-text-muted">Aucune demande pour le moment</p>
        ) : (
          leaves.map((lv) => (
            <div key={lv.id} className={CARD_CLASS}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text">{leaveLabel(lv.type)}</p>
                  <p className="text-xs text-text-muted">
                    {formatIsoDateOnly(lv.start_date)} → {formatIsoDateOnly(lv.end_date)}
                  </p>
                  {lv.comment && <p className="mt-1 text-xs text-text-muted">{lv.comment}</p>}
                </div>
                <StatusBadge status={lv.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
