import { saveAs } from 'file-saver'

// Déclenche le téléchargement d'un objet JSON (ex : sauvegarde complète
// d'une organisation avant suppression définitive). Même pattern que les
// exports Excel de excel.js (Blob + saveAs), sans dépendance à ExcelJS.
export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  saveAs(blob, filename)
}
