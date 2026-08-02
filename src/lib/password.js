// Reflète les règles imposées côté serveur (Supabase Auth : password_min_length
// et password_required_characters). Validation client = confort utilisateur ;
// la règle qui compte reste celle appliquée par le serveur d'auth lui-même.
export function passwordError(password) {
  if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères'
  if (!/[a-z]/.test(password)) return 'Le mot de passe doit contenir au moins une minuscule'
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule'
  if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre'
  return ''
}
