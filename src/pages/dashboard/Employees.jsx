import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { normalizePhone } from '../../lib/phone'
import { formatDateStr, formatIsoDateOnly } from '../../lib/dateFormat'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../../lib/ui'

function StatusBadge({ status }) {
  const isActive = status === 'active'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive ? 'bg-success-soft text-success' : 'bg-bg-subtle text-text-muted'
      }`}
    >
      {isActive ? 'Actif' : 'En attente'}
    </span>
  )
}

function payLabel(payroll) {
  if (!payroll) return '—'
  if (payroll.pay_type === 'hourly') {
    return payroll.hourly_rate != null ? `${payroll.hourly_rate} / h` : 'Horaire'
  }
  return payroll.monthly_salary != null ? `${payroll.monthly_salary} / mois` : 'Mensuel'
}

export default function Employees() {
  const { org } = useAuth()
  const [employees, setEmployees] = useState([])
  const [payrolls, setPayrolls] = useState([])
  const [seatsTotal, setSeatsTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [phone, setPhone] = useState('')
  const [ssn, setSsn] = useState('')
  const [payType, setPayType] = useState('hourly')
  const [hourlyRate, setHourlyRate] = useState('')
  const [monthlySalary, setMonthlySalary] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: emp }, { data: packs }, { data: pay }] = await Promise.all([
      supabase.from('employees').select('*').eq('org_id', org.id).order('created_at', { ascending: false }),
      supabase.from('packs').select('seats').eq('org_id', org.id),
      supabase.from('employee_payroll').select('*').eq('org_id', org.id),
    ])
    setEmployees(emp ?? [])
    setSeatsTotal((packs ?? []).reduce((sum, p) => sum + p.seats, 0))
    setPayrolls(pay ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  const quotaReached = employees.length >= seatsTotal

  async function handleAdd(e) {
    e.preventDefault()
    setAddError('')

    if (quotaReached) {
      setAddError("Quota de places atteint. Achetez un pack supplémentaire depuis le tableau de bord.")
      return
    }

    const normalizedPhone = normalizePhone(phone)
    if (normalizedPhone.length < 8) {
      setAddError('Numéro de téléphone invalide')
      return
    }

    setAdding(true)
    try {
      const { data: newEmployee, error } = await supabase
        .from('employees')
        .insert({
          org_id: org.id,
          first_name: firstName,
          last_name: lastName,
          birthdate: birthdate || null,
          phone: normalizedPhone,
          status: 'pending',
        })
        .select()
        .single()
      if (error) throw error

      const { error: payrollError } = await supabase.from('employee_payroll').insert({
        employee_id: newEmployee.id,
        org_id: org.id,
        social_security_number: ssn || null,
        pay_type: payType,
        hourly_rate: payType === 'hourly' && hourlyRate ? parseFloat(hourlyRate) : null,
        monthly_salary: payType === 'monthly' && monthlySalary ? parseFloat(monthlySalary) : null,
      })
      if (payrollError) throw payrollError

      setFirstName('')
      setLastName('')
      setBirthdate('')
      setPhone('')
      setSsn('')
      setPayType('hourly')
      setHourlyRate('')
      setMonthlySalary('')
      await load()
    } catch (err) {
      if (err.message?.includes('duplicate') || err.code === '23505') {
        setAddError('Ce numéro de téléphone est déjà utilisé par un autre employé.')
      } else if (err.message?.includes('Quota')) {
        setAddError('Quota de places atteint. Achetez un pack supplémentaire.')
      } else {
        setAddError(err.message)
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Employés</h1>
        <p className="mt-1 text-sm text-text-muted">
          {employees.length} / {seatsTotal} places utilisées
        </p>
      </div>

      <div className={CARD_CLASS}>
        <h2 className="mb-3 text-sm font-semibold text-text">Ajouter un employé</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={LABEL_CLASS}>
              Prénom
            </label>
            <input
              id="firstName"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={LABEL_CLASS}>
              Nom
            </label>
            <input
              id="lastName"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="birthdate" className={LABEL_CLASS}>
              Date de naissance
            </label>
            <input
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="empPhone" className={LABEL_CLASS}>
              Téléphone
            </label>
            <input
              id="empPhone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0555 12 34 56"
              className={INPUT_CLASS}
            />
          </div>

          <div className="sm:col-span-2 border-t border-border pt-3">
            <p className="mb-3 text-xs font-medium tracking-wide text-text-faint uppercase">
              Informations confidentielles (visibles par vous uniquement)
            </p>
          </div>

          <div>
            <label htmlFor="ssn" className={LABEL_CLASS}>
              Numéro de sécurité sociale
            </label>
            <input id="ssn" value={ssn} onChange={(e) => setSsn(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="payType" className={LABEL_CLASS}>
              Type de paye
            </label>
            <select
              id="payType"
              value={payType}
              onChange={(e) => setPayType(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="hourly">Horaire</option>
              <option value="monthly">Mensuelle</option>
            </select>
          </div>
          {payType === 'hourly' ? (
            <div>
              <label htmlFor="hourlyRate" className={LABEL_CLASS}>
                Taux horaire
              </label>
              <input
                id="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          ) : (
            <div>
              <label htmlFor="monthlySalary" className={LABEL_CLASS}>
                Salaire mensuel
              </label>
              <input
                id="monthlySalary"
                type="number"
                min="0"
                step="0.01"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          )}

          {addError && <p className="text-sm text-danger sm:col-span-2">{addError}</p>}

          <div className="sm:col-span-2">
            <button type="submit" disabled={adding || quotaReached} className={BUTTON_PRIMARY_CLASS}>
              {adding ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>

      <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
        {loading ? (
          <p className="p-5 text-sm text-text-muted">Chargement…</p>
        ) : employees.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">Aucun employé pour le moment</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Naissance</th>
                <th className="px-4 py-3 font-medium">Paye</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Ajouté le</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-text">
                    {emp.first_name} {emp.last_name}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{emp.phone}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {emp.birthdate ? formatIsoDateOnly(emp.birthdate) : '—'}
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {payLabel(payrolls.find((p) => p.employee_id === emp.id))}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={emp.status} />
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatDateStr(new Date(emp.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
