/** Fait télécharger un texte au navigateur (export CSV, modèle de chronogramme). */
export function telecharger(nomFichier, contenu, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** « Exercice inondation 2026 » → « exercice-inondation-2026 », pour un nom de fichier. */
export function nomDeFichier(s) {
  return (
    String(s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'exercice'
  )
}
