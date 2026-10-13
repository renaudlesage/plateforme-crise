/**
 * Réduit une photo avant envoi : ≈ 1600 px de côté au plus, JPEG.
 * Un téléphone en produit de plusieurs Mo, inutiles sur le terrain. Le passage par un canvas
 * supprime aussi les métadonnées (EXIF : position GPS, modèle de l'appareil) du fichier d'origine.
 * @returns {Promise<Blob>}
 */
export async function reduirePhoto(fichier, cote = 1600, qualite = 0.8) {
  const url = URL.createObjectURL(fichier)
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = ko
      i.src = url
    })
    const echelle = Math.min(1, cote / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * echelle)
    canvas.height = Math.round(img.height * echelle)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Photo illisible'))), 'image/jpeg', qualite))
  } finally {
    URL.revokeObjectURL(url)
  }
}
