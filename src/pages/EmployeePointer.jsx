import { useState } from 'react'
import CameraCapture from '../components/CameraCapture'
import { getCurrentPosition } from '../lib/geolocation'
import { uploadPointagePhoto } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { BUTTON_SECONDARY_CLASS } from '../lib/ui'

export default function EmployeePointer() {
  const { employee, signOut } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [position, setPosition] = useState(null)

  async function handlePointer() {
    setError('')
    setStatus('locating')
    try {
      const pos = await getCurrentPosition()
      setPosition(pos)
      setStatus('camera')
      setShowCamera(true)
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  async function handleCapture(blob) {
    setShowCamera(false)
    setStatus('uploading')
    try {
      const time = new Date().toISOString()
      const photoUrl = await uploadPointagePhoto(blob, employee.id)

      const { error: insertError } = await supabase.from('pointages').insert({
        employee_id: employee.id,
        time,
        lat: position.lat,
        lon: position.lon,
        photo_url: photoUrl,
      })
      if (insertError) throw insertError

      setStatus('success')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setError(err.message || "Erreur lors de l'envoi du pointage")
      setStatus('idle')
    }
  }

  function handleCancelCamera() {
    setShowCamera(false)
    setStatus('idle')
  }

  const busy = status === 'locating' || status === 'uploading'

  return (
    <div className="flex min-h-svh flex-col items-center bg-bg-subtle px-4 py-8">
      <div className="flex w-full max-w-sm flex-1 flex-col">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-text-faint uppercase">Pointage</p>
            <h1 className="text-lg font-semibold text-text">
              {employee.first_name} {employee.last_name}
            </h1>
          </div>
          <button type="button" onClick={signOut} className={BUTTON_SECONDARY_CLASS}>
            Déconnexion
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-5">
          {error && (
            <p className="rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger">{error}</p>
          )}

          {status === 'success' && (
            <p className="rounded-lg border border-success bg-success-soft p-3 text-sm text-success">
              Pointage enregistré ✓
            </p>
          )}

          <button
            type="button"
            onClick={handlePointer}
            disabled={busy}
            className="min-h-16 w-full rounded-xl bg-accent text-xl font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60"
          >
            {status === 'locating' && 'Localisation…'}
            {status === 'uploading' && 'Envoi en cours…'}
            {(status === 'idle' || status === 'success') && 'Pointer'}
          </button>
        </div>
      </div>

      {showCamera && <CameraCapture onCapture={handleCapture} onCancel={handleCancelCamera} />}
    </div>
  )
}
