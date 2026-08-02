import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizePhone, phoneToEmail } from '../lib/phone'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../lib/ui'

export default function Login() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const email = phoneToEmail(normalizePhone(phone))
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      const userId = data.session.user.id
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_user_id', userId)
        .maybeSingle()

      if (org) {
        navigate('/dashboard')
        return
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (employee) {
        navigate('/pointer')
        return
      }

      setError('Compte introuvable')
      await supabase.auth.signOut()
    } catch {
      setError('Numéro ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-bg-subtle px-4">
      <div className={`${CARD_CLASS} w-full max-w-md`}>
        <h1 className="mb-1 text-xl font-semibold text-text">Connexion</h1>
        <p className="mb-6 text-sm text-text-muted">Accédez à votre espace pointage.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="phone" className={LABEL_CLASS}>
              Téléphone
            </label>
            <input
              id="phone"
              type="tel"
              required
              autoFocus
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
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-text-muted">
          Nouvelle entreprise ?{' '}
          <Link to="/signup" className="font-medium text-accent hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
