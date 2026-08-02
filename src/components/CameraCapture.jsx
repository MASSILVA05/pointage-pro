import { useEffect, useRef, useState } from 'react'

export default function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState(null)
  const [facingMode, setFacingMode] = useState('user')

  useEffect(() => {
    let active = true

    async function startCamera() {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setError('')
      } catch {
        if (active) setError("Impossible d'accéder à la caméra : autorisez l'accès pour pointer")
      }
    }

    startCamera()

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [facingMode])

  function switchCamera() {
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'))
  }

  function capture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        setPhoto({ blob, url: URL.createObjectURL(blob) })
      },
      'image/jpeg',
      0.85
    )
  }

  function retake() {
    if (photo) URL.revokeObjectURL(photo.url)
    setPhoto(null)
  }

  function confirm() {
    if (photo) onCapture(photo.blob)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white p-4">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <h2 className="mb-3 text-lg font-semibold text-text">Photo de pointage</h2>

        {error && (
          <p className="mb-3 rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="relative mb-4 flex-1 overflow-hidden rounded-xl border border-border bg-bg-subtle">
          {!photo ? (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={switchCamera}
                aria-label="Changer de caméra"
                className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-text/60 text-white backdrop-blur-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 2.1l4 4-4 4" />
                  <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8" />
                  <path d="M7 21.9l-4-4 4-4" />
                  <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
                </svg>
              </button>
            </>
          ) : (
            <img src={photo.url} alt="Photo capturée" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-14 flex-1 rounded-lg border border-border px-4 py-3 font-medium text-text-muted hover:bg-bg-hover"
          >
            Annuler
          </button>
          {!photo ? (
            <button
              type="button"
              onClick={capture}
              disabled={!!error}
              className="min-h-14 flex-[2] rounded-lg bg-accent px-4 py-3 text-lg font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Prendre la photo
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={retake}
                className="min-h-14 flex-1 rounded-lg border border-border px-4 py-3 font-medium text-text hover:bg-bg-hover"
              >
                Reprendre
              </button>
              <button
                type="button"
                onClick={confirm}
                className="min-h-14 flex-[2] rounded-lg bg-accent px-4 py-3 text-lg font-semibold text-white hover:bg-accent-hover"
              >
                Valider
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
