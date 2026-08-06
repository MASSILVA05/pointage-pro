import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireEmployee, RequireOwner, RequireSuperAdmin } from './lib/auth'
import Login from './pages/Login'
import Invite from './pages/Invite'
import EmployeePointer from './pages/EmployeePointer'
import EmployeeHistory from './pages/EmployeeHistory'
import EmployeeLeaves from './pages/EmployeeLeaves'
import EmployeeProfile from './pages/EmployeeProfile'
import EmployeeReport from './pages/EmployeeReport'
import EmployeeLayout from './layouts/EmployeeLayout'
import DashboardLayout from './layouts/DashboardLayout'
import Overview from './pages/dashboard/Overview'
import Employees from './pages/dashboard/Employees'
import Pointages from './pages/dashboard/Pointages'
import Leaves from './pages/dashboard/Leaves'
import Reports from './pages/dashboard/Reports'
import Admin from './pages/Admin'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<Invite />} />

        <Route
          path="/admin"
          element={
            <RequireSuperAdmin>
              <Admin />
            </RequireSuperAdmin>
          }
        />

        <Route
          path="/pointer"
          element={
            <RequireEmployee>
              <EmployeeLayout />
            </RequireEmployee>
          }
        >
          <Route index element={<EmployeePointer />} />
          <Route path="history" element={<EmployeeHistory />} />
          <Route path="leaves" element={<EmployeeLeaves />} />
          <Route path="profile" element={<EmployeeProfile />} />
          <Route path="report" element={<EmployeeReport />} />
        </Route>

        <Route
          path="/dashboard"
          element={
            <RequireOwner>
              <DashboardLayout />
            </RequireOwner>
          }
        >
          <Route index element={<Overview />} />
          <Route path="employees" element={<Employees />} />
          <Route path="pointages" element={<Pointages />} />
          <Route path="leaves" element={<Leaves />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
