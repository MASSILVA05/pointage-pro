import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { buildDailyReport, buildMonthlyReport } from '../lib/reports'
import { downloadDailyReportExcel, downloadMonthlyReportExcel } from '../lib/excel'
import { dateKey, formatTimeStr, monthKey } from '../lib/dateFormat'
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, CARD_CLASS, INPUT_CLASS } from '../lib/ui'

// Même logique que src/pages/dashboard/Reports.jsx (côté manager), mais
// restreinte de fait à l'employé connecté : la requête pointages/leaves ne
// charge que ses propres lignes (RLS ne permettrait rien d'autre de toute
// façon), et employees ne contient que sa propre fiche. Pas de payrolls
// chargé — l'employé n'a aucun accès RLS à employee_payroll — donc pas de
// colonne "paye estimée" ici, volontairement absente de l'UI.
export default function EmployeeReport() {
  const { employee } = useAuth()
  const [mode, setMode] = useState('day')
  const [dayValue, setDayValue] = useState(dateKey(new Date()))
  const [monthValue, setMonthValue] = useState(monthKey(new Date()))

  const [pointages, setPointages] = useState([])
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const [{ data: pts }, { data: lv }] = await Promise.all([
        supabase.from('pointages').select('*').eq('employee_id', employee.id),
        supabase.from('leaves').select('*').eq('employee_id', employee.id),
      ])
      if (!active) return
      setPointages(pts ?? [])
      setLeaves(lv ?? [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [employee.id])

  const dailyReport = useMemo(
    () => buildDailyReport({ employees: [employee], pointages, leaves, day: dayValue }),
    [employee, pointages, leaves, dayValue]
  )
  const monthlyReport = useMemo(
    () => buildMonthlyReport({ employees: [employee], pointages, leaves, payrolls: [], month: monthValue }),
    [employee, pointages, leaves, monthValue]
  )

  async function handleExportDaily() {
    setExporting(true)
    try {
      await downloadDailyReportExcel(dailyReport, `ma_fiche_journaliere_${dayValue}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  async function handleExportMonthly() {
    setExporting(true)
    try {
      await downloadMonthlyReportExcel(monthlyReport, `ma_fiche_mensuelle_${monthValue}.xlsx`)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Chargement…</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print">
        <h1 className="text-lg font-semibold text-text">Ma fiche</h1>
        <p className="mt-1 text-sm text-text-muted">Vos heures travaillées et congés.</p>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-border bg-white p-0.5">
          <button
            type="button"
            onClick={() => setMode('day')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              mode === 'day' ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            Journalier
          </button>
          <button
            type="button"
            onClick={() => setMode('month')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              mode === 'month' ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            Mensuel
          </button>
        </div>

        {mode === 'day' ? (
          <input type="date" value={dayValue} onChange={(e) => setDayValue(e.target.value)} className={INPUT_CLASS} />
        ) : (
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className={INPUT_CLASS}
          />
        )}
      </div>

      <div className="no-print flex gap-2">
        <button type="button" onClick={() => window.print()} className={BUTTON_SECONDARY_CLASS}>
          Imprimer
        </button>
        <button
          type="button"
          onClick={mode === 'day' ? handleExportDaily : handleExportMonthly}
          disabled={exporting}
          className={BUTTON_PRIMARY_CLASS}
        >
          {exporting ? 'Export…' : 'Exporter (.xlsx)'}
        </button>
      </div>

      {mode === 'day' ? (
        <div id="print-area" className={`${CARD_CLASS} p-4`}>
          <h2 className="text-base font-semibold text-text">
            {employee.first_name} {employee.last_name}
          </h2>
          <p className="mb-3 text-sm text-text-muted">Fiche journalière — {dayValue}</p>
          {dailyReport.map((r) => (
            <dl key={r.employee.id} className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-text-muted">Arrivée</dt>
              <dd className="text-text">{r.arrivalTime ? formatTimeStr(new Date(r.arrivalTime)) : '—'}</dd>
              <dt className="text-text-muted">Départ</dt>
              <dd className="text-text">{r.departureTime ? formatTimeStr(new Date(r.departureTime)) : '—'}</dd>
              <dt className="text-text-muted">Heures</dt>
              <dd className="font-medium text-text">{r.hours.toFixed(2)} h</dd>
              <dt className="text-text-muted">Statut</dt>
              <dd className="text-text">{r.status}</dd>
            </dl>
          ))}
        </div>
      ) : (
        <div id="print-area" className={`${CARD_CLASS} p-4`}>
          <h2 className="text-base font-semibold text-text">
            {employee.first_name} {employee.last_name}
          </h2>
          <p className="mb-3 text-sm text-text-muted">Fiche mensuelle — {monthValue}</p>
          {monthlyReport.map((r) => (
            <dl key={r.employee.id} className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-text-muted">Total heures</dt>
              <dd className="font-medium text-text">{r.totalHours.toFixed(2)} h</dd>
              <dt className="text-text-muted">Congés payés</dt>
              <dd className="text-text">{r.leaveDayCounts.paid ?? 0} j</dd>
              <dt className="text-text-muted">Congés maladie</dt>
              <dd className="text-text">{r.leaveDayCounts.sick ?? 0} j</dd>
              <dt className="text-text-muted">Sans solde</dt>
              <dd className="text-text">{r.leaveDayCounts.unpaid ?? 0} j</dd>
              <dt className="text-text-muted">Absences</dt>
              <dd className="text-text">{r.absentDays} j</dd>
            </dl>
          ))}
        </div>
      )}
    </div>
  )
}
