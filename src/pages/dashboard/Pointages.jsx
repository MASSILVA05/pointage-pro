import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { downloadPointagesExcel } from '../../lib/excel'
import { dateKey, formatDateTimeStr, monthKey } from '../../lib/dateFormat'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS } from '../../lib/ui'

const SELECT_CLASS =
  'min-h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft'

function buildFilename({ periodMode, dayValue, monthValue, startValue, endValue }) {
  if (periodMode === 'day' && dayValue) return `pointages_${dayValue}.xlsx`
  if (periodMode === 'month' && monthValue) return `pointages_${monthValue}.xlsx`
  if (periodMode === 'custom' && startValue && endValue) return `pointages_${startValue}_${endValue}.xlsx`
  if (periodMode === 'custom' && (startValue || endValue)) return `pointages_${startValue || endValue}.xlsx`
  return 'pointages_tous.xlsx'
}

export default function Pointages() {
  const { org } = useAuth()
  const [pointages, setPointages] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [employeeId, setEmployeeId] = useState('Tous')
  const [periodMode, setPeriodMode] = useState('all')
  const [dayValue, setDayValue] = useState('')
  const [monthValue, setMonthValue] = useState('')
  const [startValue, setStartValue] = useState('')
  const [endValue, setEndValue] = useState('')
  const [exportProgress, setExportProgress] = useState(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const [{ data: pts, error: ptsError }, { data: emps }] = await Promise.all([
        supabase
          .from('pointages')
          .select('*, employees(id, first_name, last_name)')
          .eq('org_id', org.id)
          .order('time', { ascending: false }),
        supabase.from('employees').select('id, first_name, last_name').eq('org_id', org.id),
      ])
      if (!active) return
      if (ptsError) {
        setError(`Erreur de chargement : ${ptsError.message}`)
      } else {
        setPointages(pts ?? [])
        setError('')
      }
      setEmployees(emps ?? [])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel('pointages-manager')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pointages', filter: `org_id=eq.${org.id}` },
        (payload) => {
          const emp = employees.find((e) => e.id === payload.new.employee_id)
          setPointages((current) => [{ ...payload.new, employees: emp }, ...current])
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const filtered = useMemo(() => {
    return pointages.filter((p) => {
      if (employeeId !== 'Tous' && p.employee_id !== employeeId) return false

      const d = new Date(p.time)
      if (periodMode === 'day') {
        if (dayValue && dateKey(d) !== dayValue) return false
      } else if (periodMode === 'month') {
        if (monthValue && monthKey(d) !== monthValue) return false
      } else if (periodMode === 'custom') {
        const key = dateKey(d)
        if (startValue && key < startValue) return false
        if (endValue && key > endValue) return false
      }
      return true
    })
  }, [pointages, employeeId, periodMode, dayValue, monthValue, startValue, endValue])

  async function handleExport() {
    const filename = buildFilename({ periodMode, dayValue, monthValue, startValue, endValue })
    setExportProgress({ done: 0, total: filtered.length })
    try {
      await downloadPointagesExcel(filtered, filename, {
        onProgress: (done, total) => setExportProgress({ done, total }),
      })
    } finally {
      setExportProgress(null)
    }
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Pointages</h1>
        <p className="mt-1 text-sm text-text-muted">Historique des pointages de votre organisation.</p>
      </div>

      <div className={`${CARD_CLASS} grid grid-cols-1 gap-3 sm:grid-cols-4`}>
        <div>
          <label htmlFor="filter-employee" className="mb-1.5 block text-sm font-medium text-text">
            Employé
          </label>
          <select
            id="filter-employee"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="Tous">Tous</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-period" className="mb-1.5 block text-sm font-medium text-text">
            Période
          </label>
          <select
            id="filter-period"
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">Toutes les dates</option>
            <option value="day">Jour précis</option>
            <option value="month">Mois précis</option>
            <option value="custom">Plage personnalisée</option>
          </select>
        </div>

        {periodMode === 'day' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Jour</label>
            <input
              type="date"
              value={dayValue}
              onChange={(e) => setDayValue(e.target.value)}
              className={SELECT_CLASS}
            />
          </div>
        )}

        {periodMode === 'month' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Mois</label>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className={SELECT_CLASS}
            />
          </div>
        )}

        {periodMode === 'custom' && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Début</label>
              <input
                type="date"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                className={SELECT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text">Fin</label>
              <input
                type="date"
                value={endValue}
                onChange={(e) => setEndValue(e.target.value)}
                className={SELECT_CLASS}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {loading
            ? 'Chargement…'
            : exportProgress
              ? `Export en cours… ${exportProgress.done}/${exportProgress.total} photo${exportProgress.total > 1 ? 's' : ''}`
              : `${filtered.length} pointage${filtered.length > 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={handleExport}
          disabled={filtered.length === 0 || !!exportProgress}
          className={BUTTON_PRIMARY_CLASS}
        >
          {exportProgress ? 'Export…' : 'Exporter (.xlsx)'}
        </button>
      </div>

      <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
        {loading ? (
          <p className="p-5 text-sm text-text-muted">Chargement…</p>
        ) : error ? (
          <p className="p-5 text-sm text-danger">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">Aucun pointage pour ces filtres</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-4 py-3 font-medium">Photo</th>
                <th className="px-4 py-3 font-medium">Employé</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Date &amp; heure</th>
                <th className="px-4 py-3 font-medium">Position</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <img src={p.photo_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                  </td>
                  <td className="px-4 py-2 font-medium text-text">
                    {p.employees?.first_name} {p.employees?.last_name}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.type === 'sortie' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
                      }`}
                    >
                      {p.type === 'sortie' ? 'Sortie' : 'Entrée'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-text-muted">{formatDateTimeStr(new Date(p.time))}</td>
                  <td className="px-4 py-2">
                    <a
                      href={`https://www.google.com/maps?q=${p.lat},${p.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-accent hover:underline"
                    >
                      Voir sur la carte
                    </a>
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
