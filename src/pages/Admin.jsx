import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { formatDateStr } from '../lib/dateFormat'
import { downloadJson } from '../lib/backup'
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../lib/ui'

function DeleteOrgModal({ org, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('')
  const [step, setStep] = useState('confirm') // confirm -> exporting -> deleting
  const [error, setError] = useState('')

  const canDelete = confirmText === org.name

  async function handleDelete() {
    if (!canDelete) return
    setError('')
    try {
      setStep('exporting')
      const { data: backup, error: exportError } = await supabase.rpc('admin_export_client_data', {
        p_org_id: org.id,
      })
      if (exportError) throw exportError

      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(backup, `backup-${org.name.replace(/[^a-z0-9]+/gi, '_')}-${stamp}.json`)

      setStep('deleting')
      const { error: deleteError } = await supabase.rpc('admin_delete_client', {
        p_org_id: org.id,
        p_confirm_name: confirmText,
      })
      if (deleteError) throw deleteError

      onDeleted()
    } catch (err) {
      setError(err.message)
      setStep('confirm')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <h2 className="text-sm font-semibold text-danger">Supprimer définitivement "{org.name}"</h2>
        <p className="mt-3 text-sm text-text-muted">
          Cette action est <strong>irréversible</strong> : organisation, employés, pointages, congés, paye et
          comptes de connexion (patron et employés) seront effacés définitivement. Une sauvegarde JSON de toutes
          ces données sera téléchargée automatiquement avant la suppression.
        </p>
        <div className="mt-4">
          <label htmlFor="confirmOrgName" className={LABEL_CLASS}>
            Retapez le nom exact de l'organisation pour confirmer : <strong>{org.name}</strong>
          </label>
          <input
            id="confirmOrgName"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={step !== 'confirm'}
            className={INPUT_CLASS}
            autoComplete="off"
          />
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={step !== 'confirm'} className={BUTTON_SECONDARY_CLASS}>
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || step !== 'confirm'}
            className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === 'exporting'
              ? 'Sauvegarde en cours…'
              : step === 'deleting'
                ? 'Suppression en cours…'
                : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
      }`}
    >
      {active ? 'Actif' : 'Inactif'}
    </span>
  )
}

export default function Admin() {
  const { signOut } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)
  const [deletingOrg, setDeletingOrg] = useState(null)

  const [orgName, setOrgName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [seats, setSeats] = useState('')
  const [price, setPrice] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [created, setCreated] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false })
    setOrgs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    const seatsNum = parseInt(seats, 10)
    if (!orgName || !ownerName || !ownerPhone || !seatsNum || seatsNum <= 0) {
      setCreateError('Merci de remplir tous les champs obligatoires')
      return
    }

    setCreating(true)
    try {
      const { data, error } = await supabase.rpc('admin_create_client', {
        p_org_name: orgName,
        p_owner_name: ownerName,
        p_owner_phone: ownerPhone,
        p_seats: seatsNum,
        p_price: price ? parseFloat(price) : null,
      })
      if (error) throw error

      setCreated({ orgName, ownerPhone: data.owner_phone, tempPassword: data.temp_password })
      setOrgName('')
      setOwnerName('')
      setOwnerPhone('')
      setSeats('')
      setPrice('')
      await load()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(org) {
    setActioningId(org.id)
    try {
      await supabase.rpc('admin_set_org_active', { p_org_id: org.id, p_active: !org.active })
      await load()
    } finally {
      setActioningId(null)
    }
  }

  return (
    <div className="min-h-svh bg-bg-subtle px-8 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-text-faint uppercase">Administration</p>
            <h1 className="text-xl font-semibold text-text">Clients Pointage Pro</h1>
          </div>
          <button type="button" onClick={signOut} className="text-sm font-medium text-text-muted hover:text-text">
            Déconnexion
          </button>
        </div>

        {created && (
          <div className={`${CARD_CLASS} border-accent bg-accent-soft`}>
            <h2 className="mb-2 text-sm font-semibold text-text">
              Client "{created.orgName}" créé — notez ce mot de passe, il ne sera plus jamais affiché
            </h2>
            <p className="text-sm text-text">
              Téléphone : <span className="font-mono font-medium">{created.ownerPhone}</span>
            </p>
            <p className="text-sm text-text">
              Mot de passe temporaire : <span className="font-mono font-medium">{created.tempPassword}</span>
            </p>
            <button
              type="button"
              onClick={() => setCreated(null)}
              className="mt-3 text-sm font-medium text-accent hover:underline"
            >
              J'ai noté ce mot de passe
            </button>
          </div>
        )}

        <div className={CARD_CLASS}>
          <h2 className="mb-3 text-sm font-semibold text-text">Créer un client</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="orgName" className={LABEL_CLASS}>
                Nom de l'entreprise
              </label>
              <input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="ownerName" className={LABEL_CLASS}>
                Nom du patron
              </label>
              <input
                id="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="ownerPhone" className={LABEL_CLASS}>
                Téléphone du patron
              </label>
              <input
                id="ownerPhone"
                type="tel"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="0555 12 34 56"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="seats" className={LABEL_CLASS}>
                Places du premier pack
              </label>
              <input
                id="seats"
                type="number"
                min="1"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="price" className={LABEL_CLASS}>
                Prix payé (optionnel)
              </label>
              <input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            {createError && <p className="text-sm text-danger sm:col-span-2">{createError}</p>}

            <div className="sm:col-span-2">
              <button type="submit" disabled={creating} className={BUTTON_PRIMARY_CLASS}>
                {creating ? 'Création…' : 'Créer le client'}
              </button>
            </div>
          </form>
        </div>

        <div className={`${CARD_CLASS} overflow-x-auto p-0`}>
          {loading ? (
            <p className="p-5 text-sm text-text-muted">Chargement…</p>
          ) : orgs.length === 0 ? (
            <p className="p-5 text-sm text-text-muted">Aucun client pour le moment</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="px-4 py-3 font-medium">Entreprise</th>
                  <th className="px-4 py-3 font-medium">Patron</th>
                  <th className="px-4 py-3 font-medium">Téléphone</th>
                  <th className="px-4 py-3 font-medium">Créé le</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-text">{org.name}</td>
                    <td className="px-4 py-3 text-text-muted">{org.owner_name}</td>
                    <td className="px-4 py-3 text-text-muted">{org.owner_phone}</td>
                    <td className="px-4 py-3 text-text-muted">{formatDateStr(new Date(org.created_at))}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={org.active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actioningId === org.id}
                          onClick={() => toggleActive(org)}
                          className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                            org.active
                              ? 'border-danger text-danger hover:bg-danger-soft'
                              : 'border-success text-success hover:bg-success-soft'
                          }`}
                        >
                          {org.active ? 'Désactiver' : 'Réactiver'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingOrg(org)}
                          className="rounded-md border border-danger px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {deletingOrg && (
        <DeleteOrgModal
          org={deletingOrg}
          onClose={() => setDeletingOrg(null)}
          onDeleted={async () => {
            setDeletingOrg(null)
            await load()
          }}
        />
      )}
    </div>
  )
}
