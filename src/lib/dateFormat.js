function pad(n) {
  return String(n).padStart(2, '0')
}

export function formatDateStr(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

export function formatTimeStr(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatDateTimeStr(date) {
  return `${formatDateStr(date)} ${formatTimeStr(date)}`
}

// Clé locale AAAA-MM-JJ, comparable aux <input type="date">
export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Clé locale AAAA-MM, comparable aux <input type="month">
export function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

// Formate une colonne DATE Postgres (AAAA-MM-JJ) sans passer par un fuseau
// horaire, pour éviter tout décalage de jour.
export function formatIsoDateOnly(isoDate) {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}
