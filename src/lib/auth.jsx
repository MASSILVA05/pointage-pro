import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from './supabase'

const AuthContext = createContext(null)

async function loadRole(session) {
  if (!session) return { org: null, employee: null }
  const [{ data: org }, { data: employee }] = await Promise.all([
    supabase.from('organizations').select('*').eq('owner_user_id', session.user.id).maybeSingle(),
    supabase.from('employees').select('*').eq('user_id', session.user.id).maybeSingle(),
  ])
  return { org: org ?? null, employee: employee ?? null }
}

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [org, setOrg] = useState(null)
  const [employee, setEmployee] = useState(null)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const role = await loadRole(data.session)
      if (!active) return
      setSession(data.session)
      setOrg(role.org)
      setEmployee(role.employee)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      const role = await loadRole(newSession)
      if (!active) return
      setSession(newSession)
      setOrg(role.org)
      setEmployee(role.employee)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  // À appeler après avoir créé l'organisation (signup) ou réclamé la fiche
  // employé (invitation) : le contexte a été peuplé juste après le signIn,
  // avant que la ligne organizations/employees n'existe encore.
  async function refreshRole() {
    const { data } = await supabase.auth.getSession()
    const role = await loadRole(data.session)
    setOrg(role.org)
    setEmployee(role.employee)
  }

  return (
    <AuthContext.Provider value={{ loading, session, org, employee, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function RequireOwner({ children }) {
  const { loading, session, org } = useAuth()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!org) return <Navigate to="/login" replace />
  return children
}

export function RequireEmployee({ children }) {
  const { loading, session, employee } = useAuth()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!employee) return <Navigate to="/login" replace />
  return children
}

function FullPageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-text-muted">
      Chargement…
    </div>
  )
}
