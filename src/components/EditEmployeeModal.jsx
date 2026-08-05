import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizePhone } from '../lib/phone'
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS } from '../lib/ui'
import { EmployeeFormFields } from './EmployeeFormFields'

function toForm(employee, payroll) {
  return {
    first_name: employee.first_name ?? '',
    last_name: employee.last_name ?? '',
    birthdate: employee.birthdate ?? '',
    phone: employee.phone ?? '',
    matricule: employee.matricule ?? '',
    family_status: employee.family_status ?? '',
    address: employee.address ?? '',
    birth_place: employee.birth_place ?? '',
    job_title: employee.job_title ?? '',
    contract_type: employee.contract_type ?? '',
    contract_start_date: employee.contract_start_date ?? '',
    contract_end_date: employee.contract_end_date ?? '',
    hire_date: employee.hire_date ?? '',
    termination_date: employee.termination_date ?? '',
    termination_reason: employee.termination_reason ?? '',
    ssn: payroll?.social_security_number ?? '',
    pay_type: payroll?.pay_type ?? 'hourly',
    hourly_rate: payroll?.hourly_rate ?? '',
    monthly_salary: payroll?.monthly_salary ?? '',
    cnas_fund: payroll?.cnas_fund ?? '',
    bank_account: payroll?.bank_account ?? '',
    bank_name: payroll?.bank_name ?? '',
    bank_branch: payroll?.bank_branch ?? '',
    loan_balance: payroll?.loan_balance ?? '',
  }
}

export default function EditEmployeeModal({ employee, payroll, onClose, onSaved }) {
  const [form, setForm] = useState(() => toForm(employee, payroll))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveError('')

    const normalizedPhone = form.phone ? normalizePhone(form.phone) : ''
    if (normalizedPhone && normalizedPhone.length < 8) {
      setSaveError('Numéro de téléphone invalide')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          birthdate: form.birthdate || null,
          phone: normalizedPhone || null,
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
        .eq('id', employee.id)
      if (error) throw error

      const { error: payrollError } = await supabase
        .from('employee_payroll')
        .update({
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
        .eq('employee_id', employee.id)
      if (payrollError) throw payrollError

      onSaved()
    } catch (err) {
      if (err.message?.includes('matricule')) {
        setSaveError('Ce matricule est déjà utilisé par un autre employé de votre organisation.')
      } else if (err.code === '23505') {
        setSaveError('Ce numéro de téléphone est déjà utilisé par un autre employé.')
      } else {
        setSaveError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text">
            Modifier {employee.first_name} {employee.last_name}
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text">
            Fermer
          </button>
        </div>

        <form onSubmit={handleSave} className="overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EmployeeFormFields form={form} setField={setField} idPrefix="edit" phoneRequired={false} />
          </div>

          {saveError && <p className="mt-3 text-sm text-danger">{saveError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={BUTTON_SECONDARY_CLASS}>
              Annuler
            </button>
            <button type="submit" disabled={saving} className={BUTTON_PRIMARY_CLASS}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
