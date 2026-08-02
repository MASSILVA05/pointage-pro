import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { normalizePhone, phoneToEmail } from '../lib/phone'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../lib/ui'

export default function Signup() {
  const navigate = useNavigate()
  const { refreshRole } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const normalizedPhone = normalizePhone(phone)
    if (normalizedPhone.length < 8) {
      setError('Numéro de téléphone invalide')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setLoading(true)
    try {
      const email = phoneToEmail(normalizedPhone)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError

      let session = signUpData.session
      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        session = signInData.session
      }

      const { error: orgError } = await supabase.from('organizations').insert({
        name: orgName,
        owner_name: ownerName,
        owner_phone: normalizedPhone,
        owner_user_id: session.user.id,
      })
      if (orgError) throw orgError

      await refreshRole()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message === 'User already registered' ? 'Ce numéro est déjà utilisé' : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-bg-subtle px-4">
      <div className={`${CARD_CLASS} w-full max-w-md`}>
        <h1 className="mb-1 text-xl font-semibold text-text">Créer votre organisation</h1>
        <p className="mb-6 text-sm text-text-muted">Gérez le pointage de vos employés en quelques minutes.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="orgName" className={LABEL_CLASS}>
              Nom de l'entreprise
            </label>
            <input
              id="orgName"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="ownerName" className={LABEL_CLASS}>
              Votre nom
            </label>
            <input
              id="ownerName"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="phone" className={LABEL_CLASS}>
              Téléphone
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={INPUT_CLASS}
              placeholder="0555 12 34 56"
            />
          </div>

          <div>
            <label htmlFor="password" className={LABEL_CLASS}>
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button type="submit" disabled={loading} className={BUTTON_PRIMARY_CLASS}>
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-text-muted">
          Déjà un compte ?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
