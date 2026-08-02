import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireEmployee, RequireOwner } from './lib/auth'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Invite from './pages/Invite'
import EmployeePointer from './pages/EmployeePointer'
import DashboardLayout from './layouts/DashboardLayout'
import Overview from './pages/dashboard/Overview'
import Employees from './pages/dashboard/Employees'
import Pointages from './pages/dashboard/Pointages'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/invite/:token" element={<Invite />} />

        <Route
          path="/pointer"
          element={
            <RequireEmployee>
              <EmployeePointer />
            </RequireEmployee>
          }
        />

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
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
