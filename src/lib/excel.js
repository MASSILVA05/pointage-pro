import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { formatDateStr, formatTimeStr } from './dateFormat'

const HEADER_FILL = 'FF2563EB' // accent

const PHOTO_COL_WIDTH = 12
const PHOTO_ROW_HEIGHT = 50
const PHOTO_WIDTH = 80
const PHOTO_HEIGHT = 60

const COLUMNS = [
  { header: 'Photo', key: 'photo', width: PHOTO_COL_WIDTH },
  { header: 'Nom', key: 'name', width: 24 },
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Heure', key: 'time', width: 10 },
  { header: 'Latitude', key: 'lat', width: 14 },
  { header: 'Longitude', key: 'lon', width: 14 },
  { header: 'Lien Google Maps', key: 'maps', width: 45 },
]

function guessExtension(contentType) {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('gif')) return 'gif'
  return 'jpeg'
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function fetchPhotoAsBase64(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const blob = await resp.blob()
  const base64 = await blobToBase64(blob)
  return { base64, extension: guessExtension(blob.type) }
}

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
}

export async function downloadPointagesExcel(pointages, filename, { onProgress } = {}) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Pointages')
  sheet.columns = COLUMNS
  styleHeaderRow(sheet.getRow(1))
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  let processed = 0
  onProgress?.(0, pointages.length)

  for (const p of pointages) {
    const d = new Date(p.time)
    const mapsUrl = `https://www.google.com/maps?q=${p.lat},${p.lon}`

    const row = sheet.addRow({
      photo: '',
      name: `${p.employees.first_name} ${p.employees.last_name}`,
      date: formatDateStr(d),
      time: formatTimeStr(d),
      lat: p.lat,
      lon: p.lon,
      maps: mapsUrl,
    })
    row.getCell('maps').value = { text: mapsUrl, hyperlink: mapsUrl }
    row.height = PHOTO_ROW_HEIGHT
    row.alignment = { vertical: 'middle', horizontal: 'center' }

    if (p.photo_url) {
      try {
        const { base64, extension } = await fetchPhotoAsBase64(p.photo_url)
        const imageId = workbook.addImage({ base64, extension })
        sheet.addImage(imageId, {
          tl: { col: 0.1, row: row.number - 1 + 0.1 },
          ext: { width: PHOTO_WIDTH, height: PHOTO_HEIGHT },
        })
      } catch {
        row.getCell('photo').value = 'Photo indisponible'
      }
    }

    processed += 1
    onProgress?.(processed, pointages.length)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, filename)
}
