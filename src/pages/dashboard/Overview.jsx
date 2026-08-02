import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../../lib/ui'

export default function Overview() {
  const { org } = useAuth()
  const [seatsTotal, setSeatsTotal] = useState(0)
  const [employeesCount, setEmployeesCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [seats, setSeats] = useState('')
  const [price, setPrice] = useState('')
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState('')
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: packs }, { count }] = await Promise.all([
      supabase.from('packs').select('seats').eq('org_id', org.id),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('org_id', org.id),
    ])
    setSeatsTotal((packs ?? []).reduce((sum, p) => sum + p.seats, 0))
    setEmployeesCount(count ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id])

  async function handleBuyPack(e) {
    e.preventDefault()
    setBuyError('')
    const seatsNum = parseInt(seats, 10)
    if (!seatsNum || seatsNum <= 0) {
      setBuyError('Nombre de places invalide')
      return
    }

    setBuying(true)
    try {
      const { error } = await supabase.from('packs').insert({
        org_id: org.id,
        seats: seatsNum,
        price: price ? parseFloat(price) : null,
        purchased_at: new Date().toISOString(),
      })
      if (error) throw error
      setSeats('')
      setPrice('')
      await load()
    } catch (err) {
      setBuyError(err.message)
    } finally {
      setBuying(false)
    }
  }

  const inviteLink = `${window.location.origin}/invite/${org.invite_token}`

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const percent = seatsTotal > 0 ? Math.min(100, Math.round((employeesCount / seatsTotal) * 100)) : 0

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text">Tableau de bord</h1>
        <p className="mt-1 text-sm text-text-muted">Vue d'ensemble de votre organisation.</p>
      </div>

      <div className={CARD_CLASS}>
        <p className="mb-2 text-sm font-medium text-text-muted">Places utilisées</p>
        {loading ? (
          <p className="text-sm text-text-muted">Chargement…</p>
        ) : (
          <>
            <p className="mb-3 text-2xl font-semibold text-text">
              {employeesCount} <span className="text-text-faint">/ {seatsTotal}</span>
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
              <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
            {seatsTotal === 0 && (
              <p className="mt-2 text-sm text-text-muted">Achetez un pack pour pouvoir ajouter des employés.</p>
            )}
            {seatsTotal > 0 && employeesCount >= seatsTotal && (
              <p className="mt-2 text-sm text-danger">Quota atteint — achetez un pack supplémentaire.</p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className={CARD_CLASS}>
          <h2 className="mb-3 text-sm font-semibold text-text">Acheter un pack</h2>
          <form onSubmit={handleBuyPack} className="flex flex-col gap-3">
            <div>
              <label htmlFor="seats" className={LABEL_CLASS}>
                Nombre de places
              </label>
              <input
                id="seats"
                type="number"
                min="1"
                required
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
            {buyError && <p className="text-sm text-danger">{buyError}</p>}
            <button type="submit" disabled={buying} className={BUTTON_PRIMARY_CLASS}>
              {buying ? 'Achat…' : 'Acheter'}
            </button>
          </form>
        </div>

        <div className={CARD_CLASS}>
          <h2 className="mb-3 text-sm font-semibold text-text">Inviter des employés</h2>
          <p className="mb-3 text-sm text-text-muted">
            Partagez ce lien à vos employés pré-enregistrés pour qu'ils créent leur accès.
          </p>
          <div className="flex items-center gap-2">
            <input readOnly value={inviteLink} className={`${INPUT_CLASS} truncate`} />
            <button type="button" onClick={copyInviteLink} className={BUTTON_PRIMARY_CLASS}>
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
