import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BUTTON_SECONDARY_CLASS } from '../lib/ui'

const NAV_ITEMS = [
  { to: '/pointer', label: 'Pointer', end: true },
  { to: '/pointer/history', label: 'Mes pointages' },
  { to: '/pointer/leaves', label: 'Mes congés' },
  { to: '/pointer/profile', label: 'Mon profil' },
  { to: '/pointer/report', label: 'Ma fiche' },
]

export default function EmployeeLayout() {
  const { employee, signOut } = useAuth()
  const [orgStatus, setOrgStatus] = useState(null)

  useEffect(() => {
    let active = true
    supabase.rpc('get_my_org_status').then(({ data }) => {
      if (active) setOrgStatus(data ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  if (orgStatus && orgStatus.active === false) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg-subtle px-4">
        <div className="w-full max-w-sm rounded-lg border border-danger bg-white p-6 text-center">
          <h1 className="mb-2 text-lg font-semibold text-text">Compte désactivé</h1>
          <p className="mb-4 text-sm text-text-muted">
            L'accès de "{orgStatus.name}" a été désactivé. Contactez votre employeur.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text hover:bg-bg-hover"
          >
            Déconnexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-bg-subtle">
      <header className="no-print border-b border-border bg-white px-4 py-3">
        <div className="mx-auto flex max-w-sm items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-text-faint uppercase">Espace employé</p>
            <h1 className="text-sm font-semibold text-text">
              {employee.first_name} {employee.last_name}
            </h1>
          </div>
          <button type="button" onClick={signOut} className={BUTTON_SECONDARY_CLASS}>
            Déconnexion
          </button>
        </div>
        <nav className="mx-auto mt-3 flex max-w-sm gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-bg-hover hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
