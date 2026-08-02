import { dateKey } from './dateFormat'

const MS_PER_HOUR = 3600000

const LEAVE_LABELS = {
  paid: 'Congé payé',
  sick: 'Congé maladie',
  unpaid: 'Congé sans solde',
}

export function leaveLabel(type) {
  return LEAVE_LABELS[type] ?? 'Congé'
}

// Associe chronologiquement les pointages 'entrée'/'sortie' d'UN employé sur
// UN jour donné. Une 'entrée' non suivie d'une 'sortie' (ou l'inverse) reste
// orpheline : conforme à la demande de calculer les heures "par jour", sans
// chaînage entre deux jours différents.
export function pairSessions(pointagesForDay) {
  const sorted = [...pointagesForDay].sort((a, b) => new Date(a.time) - new Date(b.time))
  const pairs = []
  let pendingEntry = null
  let orphanExit = null

  for (const p of sorted) {
    if (p.type === 'entrée') {
      pendingEntry = p
    } else if (p.type === 'sortie') {
      if (pendingEntry) {
        pairs.push({ start: pendingEntry, end: p })
        pendingEntry = null
      } else {
        orphanExit = p
      }
    }
  }

  return { pairs, openEntry: pendingEntry, orphanExit }
}

export function hoursForPairs(pairs) {
  return pairs.reduce((sum, p) => sum + (new Date(p.end.time) - new Date(p.start.time)) / MS_PER_HOUR, 0)
}

export function hoursForDay(pointagesForDay) {
  return hoursForPairs(pairSessions(pointagesForDay).pairs)
}

function groupByDay(pointages) {
  const byDay = new Map()
  for (const p of pointages) {
    const key = dateKey(new Date(p.time))
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(p)
  }
  return byDay
}

// Congé approuvé couvrant ce jour pour cet employé, s'il existe.
function approvedLeaveOn(leaves, employeeId, day) {
  return leaves.find(
    (l) => l.employee_id === employeeId && l.status === 'approved' && l.start_date <= day && day >= l.start_date && day <= l.end_date
  )
}

// Rapport journalier : une ligne par employé pour le jour demandé.
export function buildDailyReport({ employees, pointages, leaves, day }) {
  return employees.map((emp) => {
    const dayPointages = pointages.filter((p) => p.employee_id === emp.id && dateKey(new Date(p.time)) === day)
    const { pairs, openEntry } = pairSessions(dayPointages)
    const hours = hoursForPairs(pairs)
    const leave = approvedLeaveOn(leaves, emp.id, day)

    let status = 'Absent'
    let arrival = null
    let departure = null

    if (pairs.length > 0 || openEntry) {
      status = 'Présent'
      arrival = pairs[0]?.start ?? openEntry ?? null
      departure = pairs.length > 0 ? pairs[pairs.length - 1].end : null
    } else if (leave) {
      status = leaveLabel(leave.type)
    }

    const photoUrl = arrival?.photo_url ?? departure?.photo_url ?? null

    return {
      employee: emp,
      arrivalTime: arrival?.time ?? null,
      departureTime: departure?.time ?? null,
      hours,
      status,
      photoUrl,
    }
  })
}

function isWeekday(date) {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function daysInMonthUpTo(monthKeyValue) {
  const [year, month] = monthKeyValue.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const upTo = isCurrentMonth ? today.getDate() : lastDay
  const days = []
  for (let d = 1; d <= upTo; d++) days.push(new Date(year, month - 1, d))
  return days
}

// Rapport mensuel : total d'heures, jours de congé par type, jours d'absence
// non couverts, et estimation de paye selon pay_type.
//
// Hypothèse assumée (aucun contrat/horaire par employé dans le modèle de
// données) : semaine de travail du lundi au vendredi. Les jours ouvrés sans
// pointage ET sans congé approuvé comptent comme absence non couverte.
export function buildMonthlyReport({ employees, pointages, leaves, payrolls, month }) {
  const days = daysInMonthUpTo(month)
  const weekdays = days.filter(isWeekday)

  return employees.map((emp) => {
    const empPointages = pointages.filter((p) => p.employee_id === emp.id)
    const byDay = groupByDay(empPointages)

    // Le total d'heures compte TOUS les jours travaillés, y compris les
    // week-ends (heures supplémentaires) : seule la détection d'absence se
    // limite aux jours ouvrés supposés (lundi-vendredi).
    let totalHours = 0
    for (const d of days) {
      totalHours += hoursForDay(byDay.get(dateKey(d)) ?? [])
    }

    let absentDays = 0
    const leaveDayCounts = { paid: 0, sick: 0, unpaid: 0 }

    for (const d of weekdays) {
      const key = dateKey(d)
      const dayHours = hoursForDay(byDay.get(key) ?? [])
      if (dayHours > 0) continue

      const leave = approvedLeaveOn(leaves, emp.id, key)
      if (leave) {
        leaveDayCounts[leave.type] = (leaveDayCounts[leave.type] ?? 0) + 1
      } else {
        absentDays += 1
      }
    }

    const payroll = payrolls.find((p) => p.employee_id === emp.id)
    let payEstimate = null
    if (payroll) {
      if (payroll.pay_type === 'hourly' && payroll.hourly_rate != null) {
        payEstimate = payroll.hourly_rate * totalHours
      } else if (payroll.pay_type === 'monthly' && payroll.monthly_salary != null) {
        const workingDays = weekdays.length
        const dailyRate = workingDays > 0 ? payroll.monthly_salary / workingDays : 0
        payEstimate = payroll.monthly_salary - absentDays * dailyRate
      }
    }

    return {
      employee: emp,
      totalHours,
      leaveDayCounts,
      absentDays,
      payroll,
      payEstimate,
    }
  })
}
