const EMAIL_DOMAIN = 'phone.pointage-pro.internal'

// Convertit les chiffres arabo-indiens (٠-٩, U+0660-0669) et arabo-indiens
// étendus (۰-۹ persan/ourdou, U+06F0-06F9) vers leurs équivalents ASCII.
// Sans ça, un numéro tapé avec un clavier arabe (courant en Algérie) est
// silencieusement tronqué : /\D/g ne reconnaît que 0-9 ASCII comme des
// chiffres et supprime les autres comme n'importe quel caractère non
// numérique, sans erreur visible pour l'utilisateur.
function toAsciiDigits(str) {
  return str.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.codePointAt(0)
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660)
  })
}

// Supabase Auth n'a pas d'auth téléphone+mot de passe sans fournisseur SMS.
// On simule ça avec un email interne dérivé du téléphone (jamais affiché à
// l'utilisateur), et on garde le vrai numéro dans nos propres tables.
//
// Fonction unique utilisée à tous les points d'entrée (ajout manuel,
// édition manager, import Excel, page d'invitation employé) : ne pas
// dupliquer cette logique ailleurs, un écart entre deux implémentations
// romprait la comparaison exacte faite par check_pending_employee côté SQL.
export function normalizePhone(phone) {
  return toAsciiDigits(String(phone ?? '')).replace(/\D/g, '')
}

export function phoneToEmail(phone) {
  return `${normalizePhone(phone)}@${EMAIL_DOMAIN}`
}
