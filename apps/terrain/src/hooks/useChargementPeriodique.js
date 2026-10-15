import { useCallback, useEffect, useRef, useState } from 'react'
import { ecrireCache, lireCache } from '../lib/cacheLocal'

/** true tant que le navigateur se croit en ligne ; suit les événements online/offline. */
export function useEnLigne() {
  const [enLigne, setEnLigne] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const haut = () => setEnLigne(true)
    const bas = () => setEnLigne(false)
    window.addEventListener('online', haut)
    window.addEventListener('offline', bas)
    return () => {
      window.removeEventListener('online', haut)
      window.removeEventListener('offline', bas)
    }
  }, [])
  return enLigne
}

/**
 * Charge des données à intervalle régulier et garde le dernier état réussi (mémoire + appareil).
 * `charger` doit LEVER une erreur au moindre échec : un chargement partiel ne remplace jamais le dernier
 * état complet (sinon « aucun moyen engagé » pourrait n'être qu'une requête perdue).
 */
export function useChargementPeriodique({ cle, charger, intervalle = 30000 }) {
  const [etat, setEtat] = useState(() => {
    const c = cle ? lireCache(cle) : null
    return { donnees: c?.donnees ?? null, majLe: c?.majLe ?? null, echec: null, depuisCache: !!c }
  })
  const chargerRef = useRef(charger)
  chargerRef.current = charger

  const lancer = useCallback(async () => {
    if (!cle) return
    try {
      const donnees = await chargerRef.current()
      const majLe = Date.now()
      setEtat({ donnees, majLe, echec: null, depuisCache: false })
      ecrireCache(cle, { donnees, majLe })
    } catch (e) {
      setEtat((p) => ({ ...p, echec: e?.message === 'Failed to fetch' ? 'pas de réseau' : (e?.message ?? 'erreur') }))
    }
  }, [cle])

  useEffect(() => {
    const c = cle ? lireCache(cle) : null
    setEtat({ donnees: c?.donnees ?? null, majLe: c?.majLe ?? null, echec: null, depuisCache: !!c })
    lancer()
    const t = setInterval(lancer, intervalle)
    return () => clearInterval(t)
  }, [cle, lancer, intervalle])

  return { ...etat, recharger: lancer }
}
