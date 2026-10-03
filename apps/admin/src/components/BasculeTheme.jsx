import { useEffect, useState } from 'react'

const CLE_STOCKAGE = 'eventware-theme'

function themeInitial() {
  try {
    const stocke = localStorage.getItem(CLE_STOCKAGE)
    if (stocke === 'clair' || stocke === 'sombre') return stocke
  } catch {
    // stockage indisponible (navigation privée...) — on retombe sur le système
  }
  return null // pas de choix explicite : on suit prefers-color-scheme (géré par tokens.css)
}

/**
 * Bascule clair/sombre. Pose data-theme sur <html> quand l'utilisateur
 * fait un choix explicite ; sans choix, tokens.css suit déjà
 * prefers-color-scheme — on n'écrit donc rien dans ce cas, pour ne pas
 * figer un thème que le système changerait tout seul (nuit tombante,
 * etc.).
 */
export default function BasculeTheme() {
  const [theme, setTheme] = useState(themeInitial)

  useEffect(() => {
    const racine = document.documentElement
    if (theme) {
      racine.setAttribute('data-theme', theme)
      try {
        localStorage.setItem(CLE_STOCKAGE, theme)
      } catch {
        // ignore
      }
    } else {
      racine.removeAttribute('data-theme')
    }
  }, [theme])

  const effectif =
    theme ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair')

  return (
    <button
      type="button"
      onClick={() => setTheme(effectif === 'sombre' ? 'clair' : 'sombre')}
      className="plaque"
      title={effectif === 'sombre' ? 'Passer au thème clair' : 'Passer au thème sombre'}
    >
      {effectif === 'sombre' ? 'Sombre' : 'Clair'}
    </button>
  )
}
