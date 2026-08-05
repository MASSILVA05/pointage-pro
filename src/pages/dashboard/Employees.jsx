import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { normalizePhone } from '../../lib/phone'
import { formatDateStr, formatIsoDateOnly } from '../../lib/dateFormat'
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, CARD_CLASS, INPUT_CLASS } from '../../lib/ui'
import ExcelImportModal from '../../components/ExcelImportModal'
import EditEmployeeModal from '../../components/EditEmployeeModal'
import { EmployeeFormFields } from '../../components/EmployeeFormFields'

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
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [search, setSearch] = useState('')

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

  const searchNorm = search.trim().toLowerCase()
  const filteredEmployees = searchNorm
    ? employees.filter((emp) =>
        [emp.first_name, emp.last_name, emp.matricule].some((field) => field?.toLowerCase().includes(searchNorm))
      )
    : employees

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
          <EmployeeFormFields form={form} setField={setField} idPrefix="add" />

          {addError && <p className="text-sm text-danger sm:col-span-2">{addError}</p>}

          <div className="sm:col-span-2">
            <button type="submit" disabled={adding || quotaReached} className={BUTTON_PRIMARY_CLASS}>
              {adding ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>

      {employees.length > 0 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, prénom ou matricule…"
          className={`${INPUT_CLASS} max-w-sm`}
        />
      )}

      <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
        {loading ? (
          <p className="p-5 text-sm text-text-muted">Chargement…</p>
        ) : employees.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">Aucun employé pour le moment</p>
        ) : filteredEmployees.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">Aucun employé ne correspond à « {search} »</p>
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
              {filteredEmployees.map((emp) => (
                <tr
                  key={emp.id}
                  onClick={() => setEditingEmployee(emp)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-bg-hover"
                >
                  <td className="px-4 py-3 text-text-muted">{emp.matricule || '—'}</td>
                  <td className="px-4 py-3 font-medium text-text">
                    {emp.first_name} {emp.last_name}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{emp.job_title || '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{emp.phone || '—'}</td>
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

      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          payroll={payrolls.find((p) => p.employee_id === editingEmployee.id)}
          onClose={() => setEditingEmployee(null)}
          onSaved={async () => {
            setEditingEmployee(null)
            await load()
          }}
        />
      )}
    </div>
  )
}
