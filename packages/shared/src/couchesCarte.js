import { useEffect, useState } from 'react'

/**
 * Couches cartographiques actives pour une app (C6) : celles de la commune et celles de la plateforme.
 * Liste vide si la table n'existe pas encore (migration C6 non appliquée) : la carte reste utilisable.
 */
export function useCouchesCarte(supabase, contexteId, app) {
  const [couches, setCouches] = useState([])
  useEffect(() => {
    if (!contexteId) return undefined
    let actif = true
    supabase
      .from('couches_carte')
      .select('id, nom, type, url, couches, format, transparent, attribution, opacite, zoom_max, visible_par_defaut, ordre')
      .or(`contexte_id.is.null,contexte_id.eq.${contexteId}`)
      .eq('actif', true)
      .contains('apps', [app])
      .order('ordre')
      .then(({ data, error }) => {
        if (actif) setCouches(error ? [] : data ?? [])
      })
    return () => {
      actif = false
    }
  }, [supabase, contexteId, app])
  return couches
}
