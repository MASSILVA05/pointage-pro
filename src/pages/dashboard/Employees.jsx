import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { normalizePhone } from '../../lib/phone'
import { formatDateStr, formatIsoDateOnly } from '../../lib/dateFormat'
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../../lib/ui'
import ExcelImportModal from '../../components/ExcelImportModal'

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

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  birthdate: '',
  phone: '',
  matricule: '',
  family_status: '',
  address: '',
  birth_place: '',
  job_title: '',
  contract_type: '',
  contract_start_date: '',
  contract_end_date: '',
  hire_date: '',
  termination_date: '',
  termination_reason: '',
  ssn: '',
  pay_type: 'hourly',
  hourly_rate: '',
  monthly_salary: '',
  cnas_fund: '',
  bank_account: '',
  bank_name: '',
  bank_branch: '',
  loan_balance: '',
}

function SectionTitle({ children }) {
  return (
    <div className="sm:col-span-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="mb-3 text-xs font-medium tracking-wide text-text-faint uppercase">{children}</p>
    </div>
  )
}

export default function Employees() {
  const { org } = useAuth()
  const [employees, setEmployees] = useState([])
  const [payrolls, setPayrolls] = useState([])
  const [seatsTotal, setSeatsTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [showImport, setShowImport] = useState(false)

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

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
      setAddError('Quota de places atteint. Achetez un pack supplémentaire depuis le tableau de bord.')
      return
    }

    const normalizedPhone = normalizePhone(form.phone)
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
          first_name: form.first_name,
          last_name: form.last_name,
          birthdate: form.birthdate || null,
          phone: normalizedPhone,
          status: 'pending',
          matricule: form.matricule || null,
          family_status: form.family_status || null,
          address: form.address || null,
          birth_place: form.birth_place || null,
          job_title: form.job_title || null,
          contract_type: form.contract_type || null,
          contract_start_date: form.contract_start_date || null,
          contract_end_date: form.contract_end_date || null,
          hire_date: form.hire_date || null,
          termination_date: form.termination_date || null,
          termination_reason: form.termination_reason || null,
        })
        .select()
        .single()
      if (error) throw error

      const { error: payrollError } = await supabase.from('employee_payroll').insert({
        employee_id: newEmployee.id,
        org_id: org.id,
        social_security_number: form.ssn || null,
        pay_type: form.pay_type,
        hourly_rate: form.pay_type === 'hourly' && form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        monthly_salary: form.pay_type === 'monthly' && form.monthly_salary ? parseFloat(form.monthly_salary) : null,
        cnas_fund: form.cnas_fund || null,
        bank_account: form.bank_account || null,
        bank_name: form.bank_name || null,
        bank_branch: form.bank_branch || null,
        loan_balance: form.loan_balance ? parseFloat(form.loan_balance) : null,
      })
      if (payrollError) throw payrollError

      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      if (err.message?.includes('matricule')) {
        setAddError('Ce matricule est déjà utilisé par un autre employé de votre organisation.')
      } else if (err.message?.includes('duplicate') || err.code === '23505') {
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Employés</h1>
          <p className="mt-1 text-sm text-text-muted">
            {employees.length} / {seatsTotal} places utilisées
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowImport(true)}
          disabled={loading}
          className={BUTTON_SECONDARY_CLASS}
        >
          Importer depuis Excel
        </button>
      </div>

      <div className={CARD_CLASS}>
        <h2 className="mb-3 text-sm font-semibold text-text">Ajouter un employé</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SectionTitle>Identité</SectionTitle>

          <div>
            <label htmlFor="firstName" className={LABEL_CLASS}>
              Prénom
            </label>
            <input
              id="firstName"
              required
              value={form.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
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
              value={form.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
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
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="0555 12 34 56"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="matricule" className={LABEL_CLASS}>
              Matricule
            </label>
            <input
              id="matricule"
              value={form.matricule}
              onChange={(e) => setField('matricule', e.target.value)}
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
              value={form.birthdate}
              onChange={(e) => setField('birthdate', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="birthPlace" className={LABEL_CLASS}>
              Lieu de naissance
            </label>
            <input
              id="birthPlace"
              value={form.birth_place}
              onChange={(e) => setField('birth_place', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="familyStatus" className={LABEL_CLASS}>
              Situation familiale
            </label>
            <select
              id="familyStatus"
              value={form.family_status}
              onChange={(e) => setField('family_status', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">—</option>
              <option value="Célibataire">Célibataire</option>
              <option value="Marié">Marié</option>
              <option value="Divorcé">Divorcé</option>
              <option value="Veuf">Veuf</option>
            </select>
          </div>
          <div>
            <label htmlFor="address" className={LABEL_CLASS}>
              Adresse
            </label>
            <input
              id="address"
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <SectionTitle>Contrat</SectionTitle>

          <div>
            <label htmlFor="jobTitle" className={LABEL_CLASS}>
              Poste / Fonction
            </label>
            <input
              id="jobTitle"
              value={form.job_title}
              onChange={(e) => setField('job_title', e.target.value)}
              placeholder="Ouvrier de conditionnement"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="contractType" className={LABEL_CLASS}>
              Type de contrat
            </label>
            <select
              id="contractType"
              value={form.contract_type}
              onChange={(e) => setField('contract_type', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">—</option>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="Permanent">Permanent</option>
              <option value="Contractuel">Contractuel</option>
            </select>
          </div>
          <div>
            <label htmlFor="hireDate" className={LABEL_CLASS}>
              Date d'entrée
            </label>
            <input
              id="hireDate"
              type="date"
              value={form.hire_date}
              onChange={(e) => setField('hire_date', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="contractStart" className={LABEL_CLASS}>
              Début de contrat
            </label>
            <input
              id="contractStart"
              type="date"
              value={form.contract_start_date}
              onChange={(e) => setField('contract_start_date', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="contractEnd" className={LABEL_CLASS}>
              Fin de contrat
            </label>
            <input
              id="contractEnd"
              type="date"
              value={form.contract_end_date}
              onChange={(e) => setField('contract_end_date', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="terminationDate" className={LABEL_CLASS}>
              Date de sortie
            </label>
            <input
              id="terminationDate"
              type="date"
              value={form.termination_date}
              onChange={(e) => setField('termination_date', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="terminationReason" className={LABEL_CLASS}>
              Motif de sortie
            </label>
            <input
              id="terminationReason"
              value={form.termination_reason}
              onChange={(e) => setField('termination_reason', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <SectionTitle>Administratif &amp; paye (visible par vous uniquement)</SectionTitle>

          <div>
            <label htmlFor="ssn" className={LABEL_CLASS}>
              Numéro de sécurité sociale
            </label>
            <input id="ssn" value={form.ssn} onChange={(e) => setField('ssn', e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="cnasFund" className={LABEL_CLASS}>
              Caisse CNAS
            </label>
            <input
              id="cnasFund"
              value={form.cnas_fund}
              onChange={(e) => setField('cnas_fund', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="payType" className={LABEL_CLASS}>
              Type de paye
            </label>
            <select
              id="payType"
              value={form.pay_type}
              onChange={(e) => setField('pay_type', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="hourly">Horaire</option>
              <option value="monthly">Mensuelle</option>
            </select>
          </div>
          {form.pay_type === 'hourly' ? (
            <div>
              <label htmlFor="hourlyRate" className={LABEL_CLASS}>
                Taux horaire
              </label>
              <input
                id="hourlyRate"
                type="number"
                min="0"
                step="0.01"
                value={form.hourly_rate}
                onChange={(e) => setField('hourly_rate', e.target.value)}
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
                value={form.monthly_salary}
                onChange={(e) => setField('monthly_salary', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          )}
          <div>
            <label htmlFor="bankAccount" className={LABEL_CLASS}>
              RIB / Compte bancaire
            </label>
            <input
              id="bankAccount"
              value={form.bank_account}
              onChange={(e) => setField('bank_account', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="bankName" className={LABEL_CLASS}>
              Banque
            </label>
            <input
              id="bankName"
              value={form.bank_name}
              onChange={(e) => setField('bank_name', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="bankBranch" className={LABEL_CLASS}>
              Agence
            </label>
            <input
              id="bankBranch"
              value={form.bank_branch}
              onChange={(e) => setField('bank_branch', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label htmlFor="loanBalance" className={LABEL_CLASS}>
              Prêt en cours (solde à rembourser)
            </label>
            <input
              id="loanBalance"
              type="number"
              min="0"
              step="0.01"
              value={form.loan_balance}
              onChange={(e) => setField('loan_balance', e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

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
                <th className="px-4 py-3 font-medium">Matricule</th>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Poste</th>
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
                  <td className="px-4 py-3 text-text-muted">{emp.matricule || '—'}</td>
                  <td className="px-4 py-3 font-medium text-text">
                    {emp.first_name} {emp.last_name}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{emp.job_title || '—'}</td>
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

      {showImport && (
        <ExcelImportModal
          orgId={org.id}
          existingEmployees={employees}
          seatsRemaining={Math.max(0, seatsTotal - employees.length)}
          onClose={() => setShowImport(false)}
          onImported={async () => {
            setShowImport(false)
            await load()
          }}
        />
      )}
    </div>
  )
}
