import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseEmployeesWorkbook } from '../lib/employeeImport'
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS } from '../lib/ui'

function validateRows(rows, existingEmployees, seatsRemaining) {
  const existingPhones = new Set(existingEmployees.map((e) => e.phone))
  const seenPhones = new Set()
  let validCount = 0

  return rows.map((row) => {
    let error = null
    if (!row.phone) error = 'Téléphone manquant'
    else if (!row.first_name || !row.last_name) error = 'Nom ou prénom manquant'
    else if (existingPhones.has(row.phone)) error = 'Téléphone déjà existant dans l\'organisation'
    else if (seenPhones.has(row.phone)) error = 'Téléphone en double dans le fichier'
    else if (validCount >= seatsRemaining) error = 'Quota de places atteint'

    if (!error) {
      seenPhones.add(row.phone)
      validCount += 1
    }
    return { ...row, error, willImport: !error }
  })
}

export default function ExcelImportModal({ orgId, existingEmployees, seatsRemaining, onClose, onImported }) {
  const [step, setStep] = useState('upload')
  const [fileError, setFileError] = useState('')
  const [rows, setRows] = useState([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState([])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')
    try {
      const { rows: parsed } = await parseEmployeesWorkbook(file)
      if (parsed.length === 0) {
        setFileError('Aucune ligne exploitable trouvée dans ce fichier.')
        return
      }
      setRows(validateRows(parsed, existingEmployees, seatsRemaining))
      setStep('preview')
    } catch (err) {
      setFileError("Impossible de lire ce fichier : " + err.message)
    }
  }

  const toImport = rows.filter((r) => r.willImport)

  async function handleConfirm() {
    setStep('importing')
    setProgress({ done: 0, total: toImport.length })
    const outcomes = []

    for (const row of toImport) {
      try {
        const { data: newEmployee, error } = await supabase
          .from('employees')
          .insert({
            org_id: orgId,
            first_name: row.first_name,
            last_name: row.last_name,
            phone: row.phone,
            status: 'pending',
            matricule: row.matricule,
            family_status: row.family_status,
            address: row.address,
            birth_place: row.birth_place,
            job_title: row.job_title,
            contract_type: row.contract_type,
            contract_start_date: row.contract_start_date,
            contract_end_date: row.contract_end_date,
            hire_date: row.hire_date,
            termination_date: row.termination_date,
            termination_reason: row.termination_reason,
            birthdate: row.birthdate,
          })
          .select()
          .single()
        if (error) throw error

        await supabase.from('employee_payroll').insert({
          employee_id: newEmployee.id,
          org_id: orgId,
          social_security_number: row.social_security_number,
          pay_type: row.monthly_salary != null ? 'monthly' : row.hourly_rate != null ? 'hourly' : 'hourly',
          hourly_rate: row.hourly_rate,
          monthly_salary: row.monthly_salary,
          cnas_fund: row.cnas_fund,
          bank_account: row.bank_account,
          bank_name: row.bank_name,
          bank_branch: row.bank_branch,
        })

        outcomes.push({ ...row, imported: true })
      } catch (err) {
        outcomes.push({ ...row, imported: false, importError: err.message })
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    setResults(outcomes)
    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-text">Importer des employés depuis Excel</h2>
          <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text">
            Fermer
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-muted">
                Fichier .xlsx avec des colonnes telles que MATRICULE, NOM, PRENOM, TELEPHONE, N° SECU.SLE., DATE
                NAISSANCE, LIEU DE NAISSANCE, LIB. Fonction, D.ENTREE, etc. Les colonnes non reconnues sont ignorées.
              </p>
              <input type="file" accept=".xlsx" onChange={handleFile} className="text-sm text-text" />
              {fileError && <p className="text-sm text-danger">{fileError}</p>}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-muted">
                {toImport.length} ligne{toImport.length > 1 ? 's' : ''} à importer sur {rows.length}
                {rows.length - toImport.length > 0 && ` (${rows.length - toImport.length} en erreur, ignorée${rows.length - toImport.length > 1 ? 's' : ''})`}
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-subtle text-text-muted">
                      <th className="px-3 py-2 font-medium">Ligne</th>
                      <th className="px-3 py-2 font-medium">Nom</th>
                      <th className="px-3 py-2 font-medium">Téléphone</th>
                      <th className="px-3 py-2 font-medium">Matricule</th>
                      <th className="px-3 py-2 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-text-muted">{row.rowNumber}</td>
                        <td className="px-3 py-2 text-text">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="px-3 py-2 text-text-muted">{row.phone_raw || '—'}</td>
                        <td className="px-3 py-2 text-text-muted">{row.matricule || '—'}</td>
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span className="text-danger">{row.error}</span>
                          ) : (
                            <span className="text-success">À importer</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setStep('upload')} className={BUTTON_SECONDARY_CLASS}>
                  Choisir un autre fichier
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={toImport.length === 0}
                  className={BUTTON_PRIMARY_CLASS}
                >
                  Confirmer l'import ({toImport.length})
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <p className="text-sm text-text-muted">
              Import en cours… {progress.done}/{progress.total}
            </p>
          )}

          {step === 'done' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text">
                {results.filter((r) => r.imported).length} employé{results.filter((r) => r.imported).length > 1 ? 's' : ''}{' '}
                importé{results.filter((r) => r.imported).length > 1 ? 's' : ''} avec succès
                {results.some((r) => !r.imported) &&
                  `, ${results.filter((r) => !r.imported).length} échec${results.filter((r) => !r.imported).length > 1 ? 's' : ''}`}
                .
              </p>
              {results.some((r) => !r.imported) && (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-subtle text-text-muted">
                        <th className="px-3 py-2 font-medium">Ligne</th>
                        <th className="px-3 py-2 font-medium">Nom</th>
                        <th className="px-3 py-2 font-medium">Erreur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results
                        .filter((r) => !r.imported)
                        .map((row) => (
                          <tr key={row.rowNumber} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-text-muted">{row.rowNumber}</td>
                            <td className="px-3 py-2 text-text">
                              {row.first_name} {row.last_name}
                            </td>
                            <td className="px-3 py-2 text-danger">{row.importError}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end">
                <button type="button" onClick={onImported} className={BUTTON_PRIMARY_CLASS}>
                  Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
