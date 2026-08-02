export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Géolocalisation non disponible sur cet appareil'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
      },
      (err) => {
        reject(new Error(geolocationErrorMessage(err)))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

function geolocationErrorMessage(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Localisation refusée : autorisez l'accès à la position pour pointer"
    case err.POSITION_UNAVAILABLE:
      return 'Position indisponible, réessayez'
    case err.TIMEOUT:
      return 'Délai de localisation dépassé, réessayez'
    default:
      return 'Erreur de géolocalisation'
  }
}
