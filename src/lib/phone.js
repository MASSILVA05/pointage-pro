const EMAIL_DOMAIN = 'phone.pointage-pro.internal'

// Supabase Auth n'a pas d'auth téléphone+mot de passe sans fournisseur SMS.
// On simule ça avec un email interne dérivé du téléphone (jamais affiché à
// l'utilisateur), et on garde le vrai numéro dans nos propres tables.
export function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '')
}

export function phoneToEmail(phone) {
  return `${normalizePhone(phone)}@${EMAIL_DOMAIN}`
}
