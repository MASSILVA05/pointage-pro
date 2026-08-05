import ExcelJS from 'exceljs'
import { normalizePhone } from './phone'

// Normalise un intitulé de colonne pour le comparer sans se soucier des
// accents, de la casse ou de la ponctuation ("N° Secu.Sle." -> "nsecusle").
const DIACRITICS_RANGE = new RegExp('[̀-ͯ]', 'g')

function normalizeHeader(header) {
  return String(header ?? '')
    .normalize('NFD')
    .replace(DIACRITICS_RANGE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const FIELD_ALIASES = {
  matricule: ['matricule'],
  last_name: ['nom', 'nomfamille', 'nomdefamille'],
  first_name: ['prenom', 'prenoms'],
  phone: ['telephone', 'tel', 'gsm', 'mobile', 'numtel', 'numerotelephone', 'numerodetelephone'],
  social_security_number: [
    'nsecusle', 'numsecu', 'nsecu', 'securitesociale', 'nss',
    'numerosecuritesociale', 'nsecusociale', 'nsecu.sle', 'nsecusle',
  ],
  birthdate: ['datenaissance', 'ddn', 'naissance'],
  birth_place: ['lieudenaissance', 'lieunaissance'],
  job_title: ['libfonction', 'fonction', 'poste', 'libposte', 'libellefonction'],
  hire_date: ['dentree', 'dateentree', 'dembauche', 'dateembauche'],
  termination_date: ['dsortie', 'datesortie'],
  termination_reason: ['motifsortie', 'motif'],
  family_status: ['situationfamiliale', 'etatcivil', 'situation'],
  address: ['adresse'],
  contract_type: ['typecontrat', 'naturecontrat', 'contrat'],
  contract_start_date: ['debutcontrat', 'datedebutcontrat'],
  contract_end_date: ['fincontrat', 'datefincontrat'],
  cnas_fund: ['caissecnas', 'cnas', 'caisse'],
  bank_account: ['rib', 'comptebancaire', 'numerocompte', 'numcompte'],
  bank_name: ['banque'],
  bank_branch: ['agence'],
  monthly_salary: ['salaire', 'salairemensuel', 'salairedebase', 'salairebase'],
  hourly_rate: ['tauxhoraire', 'tauxhoraires'],
}

const FAMILY_STATUS_VALUES = ['Marié', 'Célibataire', 'Divorcé', 'Veuf']
const CONTRACT_TYPE_VALUES = ['Permanent', 'Contractuel', 'CDD', 'CDI']

function matchFamilyStatus(value) {
  const norm = normalizeHeader(value)
  return FAMILY_STATUS_VALUES.find((v) => normalizeHeader(v) === norm) ?? null
}

function matchContractType(value) {
  const norm = normalizeHeader(value)
  return CONTRACT_TYPE_VALUES.find((v) => normalizeHeader(v) === norm) ?? null
}

function buildHeaderMap(headerRow) {
  const map = {}
  headerRow.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    if (!normalized) return
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(normalized) && !(field in map)) {
        map[field] = index
        break
      }
    }
  })
  return map
}

// Accepte un objet Date (ExcelJS convertit les cellules formatées comme
// dates), un numéro de série Excel, ou une chaîne DD/MM/YYYY, DD-MM-YYYY,
// YYYY-MM-DD. Retourne une chaîne AAAA-MM-JJ ou null si non reconnu.
export function parseExcelDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(excelEpoch.getTime() + value * 86400000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  const str = String(value).trim()
  let m = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = str.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return null
}

function cellText(cell) {
  if (cell == null) return ''
  if (typeof cell === 'object' && 'text' in cell) return String(cell.text).trim()
  if (typeof cell === 'object' && 'result' in cell) return String(cell.result).trim()
  return String(cell).trim()
}

function cellNumber(cell) {
  const text = cellText(cell).replace(',', '.').replace(/\s/g, '')
  const num = parseFloat(text)
  return Number.isFinite(num) ? num : null
}

// Lit un fichier .xlsx et retourne { rows, unrecognizedHeaders }. Chaque
// élément de `rows` contient les champs reconnus mappés vers nos colonnes,
// prêts à être validés puis insérés.
export async function parseEmployeesWorkbook(file) {
  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return { rows: [], headerMap: {} }

  const headerRow = []
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headerRow[colNumber - 1] = cellText(cell.value)
  })
  const headerMap = buildHeaderMap(headerRow)

  const rows = []
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    if (row.cellCount === 0) continue

    const get = (field) => {
      const colIndex = headerMap[field]
      if (colIndex == null) return null
      return row.getCell(colIndex + 1).value
    }

    const firstName = cellText(get('first_name'))
    const lastName = cellText(get('last_name'))
    const phoneRaw = cellText(get('phone'))
    if (!firstName && !lastName && !phoneRaw) continue // ligne vide

    rows.push({
      rowNumber: r,
      first_name: firstName,
      last_name: lastName,
      phone: normalizePhone(phoneRaw) || null,
      phone_raw: phoneRaw,
      matricule: cellText(get('matricule')) || null,
      social_security_number: cellText(get('social_security_number')) || null,
      birthdate: parseExcelDate(get('birthdate')),
      birth_place: cellText(get('birth_place')) || null,
      job_title: cellText(get('job_title')) || null,
      hire_date: parseExcelDate(get('hire_date')),
      termination_date: parseExcelDate(get('termination_date')),
      termination_reason: cellText(get('termination_reason')) || null,
      family_status: matchFamilyStatus(cellText(get('family_status'))),
      address: cellText(get('address')) || null,
      contract_type: matchContractType(cellText(get('contract_type'))),
      contract_start_date: parseExcelDate(get('contract_start_date')),
      contract_end_date: parseExcelDate(get('contract_end_date')),
      cnas_fund: cellText(get('cnas_fund')) || null,
      bank_account: cellText(get('bank_account')) || null,
      bank_name: cellText(get('bank_name')) || null,
      bank_branch: cellText(get('bank_branch')) || null,
      monthly_salary: cellNumber(get('monthly_salary')),
      hourly_rate: cellNumber(get('hourly_rate')),
    })
  }

  return { rows, headerMap }
}
