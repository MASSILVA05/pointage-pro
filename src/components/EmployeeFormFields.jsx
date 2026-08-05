import { INPUT_CLASS, LABEL_CLASS } from '../lib/ui'

export function SectionTitle({ children }) {
  return (
    <div className="sm:col-span-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="mb-3 text-xs font-medium tracking-wide text-text-faint uppercase">{children}</p>
    </div>
  )
}

// Champs partagés entre le formulaire d'ajout (Employees.jsx) et le
// formulaire d'édition (EditEmployeeModal.jsx). `phoneRequired` est à false
// en édition : un employé peut ne pas avoir de téléphone (import Excel sans
// téléphone), le manager doit pouvoir enregistrer le reste sans en fournir un.
export function EmployeeFormFields({ form, setField, idPrefix, phoneRequired = true }) {
  const id = (name) => `${idPrefix}-${name}`

  return (
    <>
      <SectionTitle>Identité</SectionTitle>

      <div>
        <label htmlFor={id('firstName')} className={LABEL_CLASS}>
          Prénom
        </label>
        <input
          id={id('firstName')}
          required
          value={form.first_name}
          onChange={(e) => setField('first_name', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('lastName')} className={LABEL_CLASS}>
          Nom
        </label>
        <input
          id={id('lastName')}
          required
          value={form.last_name}
          onChange={(e) => setField('last_name', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('phone')} className={LABEL_CLASS}>
          Téléphone
        </label>
        <input
          id={id('phone')}
          type="tel"
          required={phoneRequired}
          value={form.phone}
          onChange={(e) => setField('phone', e.target.value)}
          placeholder="0555 12 34 56"
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('matricule')} className={LABEL_CLASS}>
          Matricule
        </label>
        <input
          id={id('matricule')}
          value={form.matricule}
          onChange={(e) => setField('matricule', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('birthdate')} className={LABEL_CLASS}>
          Date de naissance
        </label>
        <input
          id={id('birthdate')}
          type="date"
          value={form.birthdate}
          onChange={(e) => setField('birthdate', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('birthPlace')} className={LABEL_CLASS}>
          Lieu de naissance
        </label>
        <input
          id={id('birthPlace')}
          value={form.birth_place}
          onChange={(e) => setField('birth_place', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('familyStatus')} className={LABEL_CLASS}>
          Situation familiale
        </label>
        <select
          id={id('familyStatus')}
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
        <label htmlFor={id('address')} className={LABEL_CLASS}>
          Adresse
        </label>
        <input
          id={id('address')}
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <SectionTitle>Contrat</SectionTitle>

      <div>
        <label htmlFor={id('jobTitle')} className={LABEL_CLASS}>
          Poste / Fonction
        </label>
        <input
          id={id('jobTitle')}
          value={form.job_title}
          onChange={(e) => setField('job_title', e.target.value)}
          placeholder="Ouvrier de conditionnement"
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('contractType')} className={LABEL_CLASS}>
          Type de contrat
        </label>
        <select
          id={id('contractType')}
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
        <label htmlFor={id('hireDate')} className={LABEL_CLASS}>
          Date d'entrée
        </label>
        <input
          id={id('hireDate')}
          type="date"
          value={form.hire_date}
          onChange={(e) => setField('hire_date', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('contractStart')} className={LABEL_CLASS}>
          Début de contrat
        </label>
        <input
          id={id('contractStart')}
          type="date"
          value={form.contract_start_date}
          onChange={(e) => setField('contract_start_date', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('contractEnd')} className={LABEL_CLASS}>
          Fin de contrat
        </label>
        <input
          id={id('contractEnd')}
          type="date"
          value={form.contract_end_date}
          onChange={(e) => setField('contract_end_date', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('terminationDate')} className={LABEL_CLASS}>
          Date de sortie
        </label>
        <input
          id={id('terminationDate')}
          type="date"
          value={form.termination_date}
          onChange={(e) => setField('termination_date', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('terminationReason')} className={LABEL_CLASS}>
          Motif de sortie
        </label>
        <input
          id={id('terminationReason')}
          value={form.termination_reason}
          onChange={(e) => setField('termination_reason', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <SectionTitle>Administratif &amp; paye (visible par vous uniquement)</SectionTitle>

      <div>
        <label htmlFor={id('ssn')} className={LABEL_CLASS}>
          Numéro de sécurité sociale
        </label>
        <input id={id('ssn')} value={form.ssn} onChange={(e) => setField('ssn', e.target.value)} className={INPUT_CLASS} />
      </div>
      <div>
        <label htmlFor={id('cnasFund')} className={LABEL_CLASS}>
          Caisse CNAS
        </label>
        <input
          id={id('cnasFund')}
          value={form.cnas_fund}
          onChange={(e) => setField('cnas_fund', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('payType')} className={LABEL_CLASS}>
          Type de paye
        </label>
        <select
          id={id('payType')}
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
          <label htmlFor={id('hourlyRate')} className={LABEL_CLASS}>
            Taux horaire
          </label>
          <input
            id={id('hourlyRate')}
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
          <label htmlFor={id('monthlySalary')} className={LABEL_CLASS}>
            Salaire mensuel
          </label>
          <input
            id={id('monthlySalary')}
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
        <label htmlFor={id('bankAccount')} className={LABEL_CLASS}>
          RIB / Compte bancaire
        </label>
        <input
          id={id('bankAccount')}
          value={form.bank_account}
          onChange={(e) => setField('bank_account', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('bankName')} className={LABEL_CLASS}>
          Banque
        </label>
        <input
          id={id('bankName')}
          value={form.bank_name}
          onChange={(e) => setField('bank_name', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('bankBranch')} className={LABEL_CLASS}>
          Agence
        </label>
        <input
          id={id('bankBranch')}
          value={form.bank_branch}
          onChange={(e) => setField('bank_branch', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor={id('loanBalance')} className={LABEL_CLASS}>
          Prêt en cours (solde à rembourser)
        </label>
        <input
          id={id('loanBalance')}
          type="number"
          min="0"
          step="0.01"
          value={form.loan_balance}
          onChange={(e) => setField('loan_balance', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </>
  )
}
