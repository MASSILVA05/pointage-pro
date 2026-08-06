import { useEffect, useState } from 'react'
import CameraCapture from '../components/CameraCapture'
import { getCurrentPosition } from '../lib/geolocation'
import { uploadPointagePhoto } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { dateKey } from '../lib/dateFormat'

export default function EmployeePointer() {
  const { employee } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const [position, setPosition] = useState(null)

  const [recent, setRecent] = useState([])
  const [pendingType, setPendingType] = useState(null)
  const [confirmDoubleEntry, setConfirmDoubleEntry] = useState(false)

  useEffect(() => {
    let active = true
    async function loadRecent() {
      const { data } = await supabase
        .from('pointages')
        .select('type, time')
        .eq('employee_id', employee.id)
        .order('time', { ascending: false })
        .limit(20)
      if (!active) return
      setRecent(data ?? [])
    }
    loadRecent()
    return () => {
      active = false
    }
  }, [employee.id])

  // Dérivé de `recent` à chaque rendu (plutôt qu'un state séparé) pour rester
  // à jour immédiatement après l'ajout d'un nouveau pointage.
  const today = dateKey(new Date())
  const lastToday = recent.find((p) => dateKey(new Date(p.time)) === today)
  const suggestion = lastToday?.type === 'entrée' ? 'sortie' : 'entrée'

  function selectType(type) {
    setError('')
    const lastOverall = recent[0]
    if (type === 'entrée' && lastOverall?.type === 'entrée') {
      setPendingType(type)
      setConfirmDoubleEntry(true)
      return
    }
    startPointer(type)
  }

  function confirmAnyway() {
    setConfirmDoubleEntry(false)
    if (pendingType) startPointer(pendingType)
  }

  async function startPointer(type) {
    setPendingType(type)
    setConfirmDoubleEntry(false)
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
        type: pendingType,
        time,
        lat: position.lat,
        lon: position.lon,
        photo_url: photoUrl,
      })
      if (insertError) throw insertError

      setRecent((current) => [{ type: pendingType, time }, ...current])
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
    <div className="mx-auto flex w-full max-w-sm flex-col">
      <div className="flex flex-1 flex-col justify-center gap-5">
        {error && (
            <p className="rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger">{error}</p>
          )}

          {status === 'success' && (
            <p className="rounded-lg border border-success bg-success-soft p-3 text-sm text-success">
              Pointage enregistré ✓
            </p>
          )}

          {confirmDoubleEntry && (
            <div className="rounded-lg border border-danger bg-danger-soft p-4 text-sm text-danger">
              <p className="mb-3">
                Vous avez déjà pointé une entrée sans avoir pointé de sortie depuis. Continuer quand même ?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmAnyway}
                  className="min-h-10 flex-1 rounded-md bg-danger px-3 text-sm font-medium text-white"
                >
                  Continuer quand même
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDoubleEntry(false)}
                  className="min-h-10 flex-1 rounded-md border border-danger px-3 text-sm font-medium text-danger"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {!confirmDoubleEntry && (status === 'idle' || status === 'success') && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => selectType('entrée')}
                className={`min-h-16 rounded-xl text-lg font-semibold shadow-sm ${
                  suggestion === 'entrée'
                    ? 'bg-accent text-white hover:bg-accent-hover'
                    : 'border border-border bg-white text-text hover:bg-bg-hover'
                }`}
              >
                Entrée
                {suggestion === 'entrée' && <span className="block text-xs font-normal opacity-80">Suggéré</span>}
              </button>
              <button
                type="button"
                onClick={() => selectType('sortie')}
                className={`min-h-16 rounded-xl text-lg font-semibold shadow-sm ${
                  suggestion === 'sortie'
                    ? 'bg-accent text-white hover:bg-accent-hover'
                    : 'border border-border bg-white text-text hover:bg-bg-hover'
                }`}
              >
                Sortie
                {suggestion === 'sortie' && <span className="block text-xs font-normal opacity-80">Suggéré</span>}
              </button>
            </div>
          )}

          {busy && (
            <div className="min-h-16 w-full rounded-xl bg-accent/60 text-center text-xl font-semibold text-white shadow-sm">
              <span className="flex h-16 items-center justify-center">
                {status === 'locating' && 'Localisation…'}
                {status === 'uploading' && 'Envoi en cours…'}
              </span>
            </div>
          )}
        </div>

      {showCamera && <CameraCapture onCapture={handleCapture} onCancel={handleCancelCamera} />}
    </div>
  )
}
