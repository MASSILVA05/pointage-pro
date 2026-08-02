import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { buildDailyReport, buildMonthlyReport } from '../../lib/reports'
import { downloadDailyReportExcel, downloadMonthlyReportExcel } from '../../lib/excel'
import { dateKey, formatTimeStr, monthKey } from '../../lib/dateFormat'
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, CARD_CLASS } from '../../lib/ui'

const SELECT_CLASS =
  'min-h-10 rounded-md border border-border bg-white px-3 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft'

export default function Reports() {
  const { org } = useAuth()
  const [mode, setMode] = useState('day')
  const [dayValue, setDayValue] = useState(dateKey(new Date()))
  const [monthValue, setMonthValue] = useState(monthKey(new Date()))

  const [employees, setEmployees] = useState([])
  const [pointages, setPointages] = useState([])
  const [leaves, setLeaves] = useState([])
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [exportProgress, setExportProgress] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const [{ data: emp }, { data: pts }, { data: lv }, { data: pay }] = await Promise.all([
        supabase.from('employees').select('*').eq('org_id', org.id),
        supabase.from('pointages').select('*').eq('org_id', org.id),
        supabase.from('leaves').select('*').eq('org_id', org.id),
        supabase.from('employee_payroll').select('*').eq('org_id', org.id),
      ])
      if (!active) return
      setEmployees(emp ?? [])
      setPointages(pts ?? [])
      setLeaves(lv ?? [])
      setPayrolls(pay ?? [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [org.id])

  const dailyReport = useMemo(
    () => buildDailyReport({ employees, pointages, leaves, day: dayValue }),
    [employees, pointages, leaves, dayValue]
  )

  const monthlyReport = useMemo(
    () => buildMonthlyReport({ employees, pointages, leaves, payrolls, month: monthValue }),
    [employees, pointages, leaves, payrolls, monthValue]
  )

  async function handleExportDaily() {
    setExportProgress({ done: 0, total: dailyReport.length })
    try {
      await downloadDailyReportExcel(dailyReport, `rapport_journalier_${dayValue}.xlsx`, {
        onProgress: (done, total) => setExportProgress({ done, total }),
      })
    } finally {
      setExportProgress(null)
    }
  }

  async function handleExportMonthly() {
    await downloadMonthlyReportExcel(monthlyReport, `rapport_mensuel_${monthValue}.xlsx`)
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Chargement…</p>
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="no-print">
        <h1 className="text-xl font-semibold text-text">Rapports</h1>
        <p className="mt-1 text-sm text-text-muted">Heures travaillées, congés et estimation de paye.</p>
      </div>

      <div className="no-print flex items-center gap-3">
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
          <input
            type="date"
            value={dayValue}
            onChange={(e) => setDayValue(e.target.value)}
            className={SELECT_CLASS}
          />
        ) : (
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className={SELECT_CLASS}
          />
        )}
      </div>

      {mode === 'day' ? (
        <>
          <div className="no-print flex items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              {exportProgress
                ? `Export en cours… ${exportProgress.done}/${exportProgress.total}`
                : `${dailyReport.length} employé${dailyReport.length > 1 ? 's' : ''}`}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => window.print()} className={BUTTON_SECONDARY_CLASS}>
                Imprimer
              </button>
              <button
                type="button"
                onClick={handleExportDaily}
                disabled={!!exportProgress || dailyReport.length === 0}
                className={BUTTON_PRIMARY_CLASS}
              >
                {exportProgress ? 'Export…' : 'Exporter (.xlsx)'}
              </button>
            </div>
          </div>

          <div id="print-area" className={`${CARD_CLASS} overflow-x-auto p-0`}>
            <div className="p-5 print:p-0">
              <h2 className="text-lg font-semibold text-text">{org.name}</h2>
              <p className="mb-4 text-sm text-text-muted">Rapport journalier — {dayValue}</p>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="py-2 pr-4 font-medium">Employé</th>
                    <th className="py-2 pr-4 font-medium">Arrivée</th>
                    <th className="py-2 pr-4 font-medium">Départ</th>
                    <th className="py-2 pr-4 font-medium">Heures</th>
                    <th className="py-2 pr-4 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyReport.map((r) => (
                    <tr key={r.employee.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 font-medium text-text">
                        {r.employee.first_name} {r.employee.last_name}
                      </td>
                      <td className="py-2 pr-4 text-text-muted">
                        {r.arrivalTime ? formatTimeStr(new Date(r.arrivalTime)) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-text-muted">
                        {r.departureTime ? formatTimeStr(new Date(r.departureTime)) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-text-muted">{r.hours.toFixed(2)} h</td>
                      <td className="py-2 pr-4 text-text-muted">{r.status}</td>
                    </tr>
                  ))}
                  {dailyReport.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-text-muted">
                        Aucun employé
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="no-print flex items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              {monthlyReport.length} employé{monthlyReport.length > 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={handleExportMonthly}
              disabled={monthlyReport.length === 0}
              className={BUTTON_PRIMARY_CLASS}
            >
              Exporter (.xlsx)
            </button>
          </div>

          <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="px-4 py-3 font-medium">Employé</th>
                  <th className="px-4 py-3 font-medium">Total heures</th>
                  <th className="px-4 py-3 font-medium">Congés payés</th>
                  <th className="px-4 py-3 font-medium">Congés maladie</th>
                  <th className="px-4 py-3 font-medium">Sans solde</th>
                  <th className="px-4 py-3 font-medium">Absences</th>
                  <th className="px-4 py-3 font-medium">Paye estimée</th>
                </tr>
              </thead>
              <tbody>
                {monthlyReport.map((r) => (
                  <tr key={r.employee.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-text">
                      {r.employee.first_name} {r.employee.last_name}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{r.totalHours.toFixed(2)} h</td>
                    <td className="px-4 py-3 text-text-muted">{r.leaveDayCounts.paid ?? 0} j</td>
                    <td className="px-4 py-3 text-text-muted">{r.leaveDayCounts.sick ?? 0} j</td>
                    <td className="px-4 py-3 text-text-muted">{r.leaveDayCounts.unpaid ?? 0} j</td>
                    <td className="px-4 py-3 text-text-muted">{r.absentDays} j</td>
                    <td className="px-4 py-3 font-medium text-text">
                      {r.payEstimate != null ? `${r.payEstimate.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
                {monthlyReport.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-text-muted">
                      Aucun employé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
