import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../lib/ui'

// Volontairement limité à ces 4 champs : adresse, lieu de naissance,
// situation familiale, date de naissance. Toute autre colonne de
// "employees" (statut, org_id, téléphone, matricule, poste, contrat...) est
// figée à sa valeur précédente par le trigger SQL
// protect_employee_restricted_fields (schema.sql V7), quoi que ce
// formulaire envoie — donc même un bug ici ne pourrait pas faire fuiter la
// possibilité de modifier autre chose. Le salaire/la sécu/le RIB sont sur
// employee_payroll, une table à laquelle l'employé n'a aucun accès RLS.
export default function EmployeeProfile() {
  const { employee, refreshRole } = useAuth()
  const [form, setForm] = useState({
    address: employee.address ?? '',
    birth_place: employee.birth_place ?? '',
    family_status: employee.family_status ?? '',
    birthdate: employee.birthdate ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveError('')
    setSaving(true)
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          address: form.address || null,
          birth_place: form.birth_place || null,
          family_status: form.family_status || null,
          birthdate: form.birthdate || null,
        })
        .eq('id', employee.id)
      if (error) throw error
      await refreshRole()
      setSaved(true)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text">Mon profil</h1>
        <p className="mt-1 text-sm text-text-muted">
          Complétez vos coordonnées. Votre manager voit ces informations dans votre fiche.
        </p>
      </div>

      <form onSubmit={handleSave} className={`${CARD_CLASS} flex flex-col gap-3`}>
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

        {saveError && <p className="text-sm text-danger">{saveError}</p>}
        {saved && <p className="text-sm text-success">Enregistré ✓</p>}

        <button type="submit" disabled={saving} className={BUTTON_PRIMARY_CLASS}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
