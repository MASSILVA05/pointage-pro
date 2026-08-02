import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tableau de bord', end: true },
  { to: '/dashboard/employees', label: 'Employés' },
  { to: '/dashboard/pointages', label: 'Pointages' },
]

export default function DashboardLayout() {
  const { org, signOut } = useAuth()

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
