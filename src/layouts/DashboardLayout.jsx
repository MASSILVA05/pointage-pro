import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tableau de bord', end: true },
  { to: '/dashboard/employees', label: 'Employés' },
  { to: '/dashboard/pointages', label: 'Pointages' },
  { to: '/dashboard/leaves', label: 'Congés' },
  { to: '/dashboard/reports', label: 'Rapports' },
]

export default function DashboardLayout() {
  const { org, employee, signOut } = useAuth()

  if (!org.active) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg-subtle px-4">
        <div className="w-full max-w-md rounded-lg border border-danger bg-white p-6 text-center">
          <h1 className="mb-2 text-lg font-semibold text-text">Compte désactivé</h1>
          <p className="mb-4 text-sm text-text-muted">
            L'accès de "{org.name}" a été désactivé. Contactez votre fournisseur pour plus d'informations.
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
    <div className="flex min-h-svh bg-bg-subtle">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-medium tracking-wide text-text-faint uppercase">Organisation</p>
          <p className="truncate text-sm font-semibold text-text">{org.name}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-bg-hover hover:text-text'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {employee && (
          <div className="border-t border-border p-3">
            <NavLink
              to="/pointer"
              className="flex items-center justify-center rounded-md bg-accent-soft px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft/80"
            >
              Pointer mes heures
            </NavLink>
          </div>
        )}

        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={signOut}
            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-text-muted hover:bg-bg-hover hover:text-text"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
