/**
 * Dernier état connu, gardé sur l'appareil pour que l'écran ne soit pas vide quand le réseau tombe.
 * Ce n'est JAMAIS présenté comme à jour : l'écran dit toujours depuis quand l'état date.
 * Effacé à la déconnexion (appareil possiblement partagé).
 */
const PREFIXE = 'crisiware.terrain.cache.'

export function lireCache(cle) {
  try {
    const brut = localStorage.getItem(PREFIXE + cle)
    return brut ? JSON.parse(brut) : null
  } catch {
    return null
  }
}

export function ecrireCache(cle, valeur) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur))
  } catch {
    /* stockage plein ou indisponible : on s'en passe */
  }
}

export function viderCaches() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIXE)) localStorage.removeItem(k)
  } catch {
    /* rien à faire */
  }
}
