/**
 * Quand retenter un envoi qui n'est pas passé.
 *
 * Porté du module `reessai.js` d'Eventware 2.0. Trois déclencheurs
 * coexistent, par ordre de fiabilité décroissante :
 *
 *   visibilitychange — l'écran revient au premier plan. Sur un
 *     téléphone qu'on sort de sa poche, c'est le signal le plus sûr
 *     que le réseau est réellement là, bien plus que `online`.
 *
 *   online — l'interface réseau est remontée. Nécessaire mais pas
 *     suffisant : un wifi sans route vers Internet déclenche `online`.
 *
 *   intervalle — le filet. Les deux précédents se manquent tous les
 *     deux quand le téléphone reste allumé, posé sur une table,
 *     pendant que la couverture revient d'elle-même.
 */

const INTERVALLE_DEFAUT = 60000

/**
 * Installe les trois déclencheurs et lance un premier essai.
 * Retourne la fonction de désinstallation, à appeler au démontage.
 */
export function surRetourReseau(rejouer, intervalle = INTERVALLE_DEFAUT) {
  const auPremierPlan = () => {
    if (!document.hidden) rejouer()
  }
  window.addEventListener('online', rejouer)
  document.addEventListener('visibilitychange', auPremierPlan)
  const minuteur = setInterval(rejouer, intervalle)
  rejouer()

  return () => {
    window.removeEventListener('online', rejouer)
    document.removeEventListener('visibilitychange', auPremierPlan)
    clearInterval(minuteur)
  }
}

/**
 * Clé d'idempotence, générée AVANT le premier envoi et jamais modifiée.
 * C'est elle qui garantit qu'un renvoi ne crée pas de doublon en base.
 */
export function nouvelleCle() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Repli pour les contextes non sécurisés (http://), où randomUUID
  // n'est pas exposé.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
