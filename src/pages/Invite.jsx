import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { normalizePhone, phoneToEmail } from '../lib/phone'
import { passwordError } from '../lib/password'
import { BUTTON_PRIMARY_CLASS, CARD_CLASS, INPUT_CLASS, LABEL_CLASS } from '../lib/ui'

export default function Invite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { refreshRole } = useAuth()

  const [org, setOrg] = useState(undefined) // undefined = chargement, null = introuvable
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [matchedEmployee, setMatchedEmployee] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .rpc('get_org_by_invite_token', { p_token: token })
      .then(({ data }) => {
        if (!active) return
        setOrg(data && data.length > 0 ? data[0] : null)
      })
    return () => {
      active = false
    }
  }, [token])

  async function handlePhoneSubmit(e) {
    e.preventDefault()
    setError('')
    const normalizedPhone = normalizePhone(phone)
    if (normalizedPhone.length < 8) {
      setError('Numéro de téléphone invalide')
      return
    }

    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('check_pending_employee', {
        p_org_id: org.id,
        p_phone: normalizedPhone,
      })
      if (rpcError) throw rpcError
      if (!data || data.length === 0) {
        setError("Ce numéro n'est pas enregistré par votre employeur pour cette organisation. Contactez-le.")
        return
      }
      if (data[0].status !== 'pending') {
        setError('Un compte existe déjà pour ce numéro. Essayez de vous connecter, ou contactez votre manager si vous avez oublié votre mot de passe.')
        return
      }
      setMatchedEmployee(data[0])
      setStep('password')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError('')
    const pwError = passwordError(password)
    if (pwError) {
      setError(pwError)
      return
    }

    setLoading(true)
    try {
      const normalizedPhone = normalizePhone(phone)
      const email = phoneToEmail(normalizedPhone)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
      console.log('[Invite] signUp:', { hasSession: !!signUpData?.session, error: signUpError?.message })

      let session = signUpData?.session

      if (signUpError) {
        if (signUpError.message !== 'User already registered') {
          setError(`Impossible de créer le compte (${signUpError.message || 'erreur inconnue du serveur'}). Réessayez, ou contactez votre manager.`)
          return
        }

        // Un compte existe déjà pour ce numéro : probablement une tentative
        // précédente où signUp() a réussi mais où l'étape suivante (activer
        // la fiche employé) a échoué ou a été interrompue, laissant l'employé
        // bloqué sans jamais pouvoir terminer son inscription. On tente de
        // reprendre avec le mot de passe fourni maintenant plutôt que de
        // renvoyer une erreur définitive.
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        console.log('[Invite] signIn (compte existant):', { hasSession: !!signInData?.session, error: signInError?.message })
        if (signInError) {
          setError(
            "Un compte existe déjà pour ce numéro, mais ce mot de passe ne correspond pas à celui utilisé lors de votre première inscription. Retapez le mot de passe d'origine, ou contactez votre manager pour recommencer."
          )
          return
        }
        session = signInData.session
      } else if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        console.log('[Invite] signIn (session absente après signUp):', { hasSession: !!signInData?.session, error: signInError?.message })
        if (signInError) {
          setError(`Compte créé mais connexion impossible (${signInError.message}). Réessayez.`)
          return
        }
        session = signInData.session
      }

      if (!session?.user?.id) {
        setError('Compte créé mais session introuvable. Réessayez, ou contactez votre manager.')
        return
      }

      // .select() est indispensable ici : sans lui, une mise à jour qui ne
      // trouve aucune ligne visible (RLS) renvoie [] avec un HTTP 200, sans
      // aucune erreur — le code continuerait silencieusement comme si la
      // fiche employé avait été liée alors que ce n'est pas le cas (vérifié
      // en reproduisant l'appel réel : PATCH sur une ligne RLS-bloquée →
      // `[]` / 200, pas d'erreur). C'est précisément ce cas silencieux qui
      // manquait de gestion avant ce correctif.
      const { data: updateData, error: updateError } = await supabase
        .from('employees')
        .update({ user_id: session.user.id, status: 'active' })
        .eq('id', matchedEmployee.id)
        .select()
      console.log('[Invite] update employees:', { rowsAffected: updateData?.length ?? 0, error: updateError?.message })

      if (updateError) {
        setError(`Compte créé mais fiche employé non mise à jour (${updateError.message}). Contactez votre manager : votre compte existe mais n'est pas encore lié à votre fiche.`)
        return
      }
      if (!updateData || updateData.length === 0) {
        setError(
          "Compte créé mais votre fiche employé n'a pas pu être liée (elle a peut-être déjà été activée par une tentative précédente, ou le téléphone enregistré diffère légèrement). Contactez votre manager pour vérifier votre fiche."
        )
        return
      }

      await refreshRole()
      navigate('/pointer')
    } catch (err) {
      // Filet de sécurité pour tout ce qui n'est pas déjà couvert par un
      // message spécifique ci-dessus. Certaines erreurs (ex : réponse
      // serveur sans corps JSON exploitable) remontent avec un message vide
      // ou littéralement "{}" — jamais affiché tel quel.
      console.error('[Invite] handlePasswordSubmit, erreur inattendue:', err)
      const message = typeof err?.message === 'string' ? err.message.trim() : ''
      const isUsable = message && message !== '{}' && message !== '[object Object]'
      setError(
        isUsable
          ? `Erreur inattendue (${message}). Contactez votre manager.`
          : 'Erreur inattendue lors de la création du compte. Contactez votre manager en lui indiquant à quel moment vous avez essayé.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (org === undefined) {
    return <div className="flex min-h-svh items-center justify-center text-sm text-text-muted">Chargement…</div>
  }

  if (org === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg-subtle px-4">
        <div className={`${CARD_CLASS} w-full max-w-md text-center`}>
          <h1 className="text-lg font-semibold text-text">Lien d'invitation invalide</h1>
          <p className="mt-2 text-sm text-text-muted">Demandez un nouveau lien à votre employeur.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-bg-subtle px-4">
      <div className={`${CARD_CLASS} w-full max-w-md`}>
        <h1 className="mb-1 text-xl font-semibold text-text">Rejoindre {org.name}</h1>

        {step === 'phone' && (
          <>
            <p className="mb-6 text-sm text-text-muted">
              Entrez le numéro de téléphone fourni à votre employeur.
            </p>
            <form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
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
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading} className={BUTTON_PRIMARY_CLASS}>
                {loading ? 'Vérification…' : 'Continuer'}
              </button>
            </form>
          </>
        )}

        {step === 'password' && (
          <>
            <p className="mb-6 text-sm text-text-muted">
              Bonjour {matchedEmployee.first_name}, choisissez un mot de passe pour votre compte.
            </p>
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="password" className={LABEL_CLASS}>
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
                <p className="mt-1.5 text-xs text-text-faint">
                  Au moins 8 caractères, avec une majuscule, une minuscule et un chiffre.
                </p>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading} className={BUTTON_PRIMARY_CLASS}>
                {loading ? 'Création…' : 'Créer mon compte'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
