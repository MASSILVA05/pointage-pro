import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { hoursForDay } from '../lib/reports'
import { dateKey, formatIsoDateOnly, formatTimeStr } from '../lib/dateFormat'
import { CARD_CLASS } from '../lib/ui'

// Regroupe les pointages par jour (du plus récent au plus ancien) et calcule
// les heures travaillées de chaque jour avec hoursForDay (même logique que
// les rapports manager, cf. src/lib/reports.js).
function groupByDayDesc(pointages) {
  const byDay = new Map()
  for (const p of pointages) {
    const key = dateKey(new Date(p.time))
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(p)
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

export default function EmployeeHistory() {
  const { employee } = useAuth()
  const [pointages, setPointages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      // Lecture seule : aucun update()/delete() nulle part sur cette page.
      // La policy RLS "Employé voit ses propres pointages" (SELECT
      // uniquement) empêche de toute façon toute modification côté serveur,
      // même en cas de bug côté client.
      const { data } = await supabase
        .from('pointages')
        .select('type, time')
        .eq('employee_id', employee.id)
        .order('time', { ascending: false })
      if (!active) return
      setPointages(data ?? [])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [employee.id])

  const days = groupByDayDesc(pointages)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Mes pointages</h1>
        <p className="mt-1 text-sm text-text-muted">Historique en lecture seule.</p>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : days.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun pointage pour le moment</p>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map(([day, dayPointages]) => {
            const sorted = [...dayPointages].sort((a, b) => new Date(a.time) - new Date(b.time))
            const entree = sorted.find((p) => p.type === 'entrée')
            const sortie = [...sorted].reverse().find((p) => p.type === 'sortie')
            const hours = hoursForDay(dayPointages)
            return (
              <div key={day} className={`${CARD_CLASS} flex items-center justify-between`}>
                <div>
                  <p className="text-sm font-medium text-text">{formatIsoDateOnly(day)}</p>
                  <p className="text-xs text-text-muted">
                    {entree ? formatTimeStr(new Date(entree.time)) : '—'} →{' '}
                    {sortie ? formatTimeStr(new Date(sortie.time)) : '—'}
                  </p>
                </div>
                <p className="text-sm font-semibold text-text">{hours.toFixed(2)} h</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
