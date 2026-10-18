import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ORDRE_NIVEAU = { attention: 1, urgent: 2, mayday: 3 }

/**
 * Compteurs affichés dans la barre de navigation du CC, quelle que soit la page :
 * incidents à suivre, signalements citoyens pas encore vus, appels d'aide non clos.
 * Rafraîchis toutes les 30 s.
 */
export function useCompteursCC(contexteId) {
  const [c, setC] = useState({ incidents: 0, signalements: 0, evenements: 0, aides: [] })

  const charger = useCallback(async () => {
    if (!contexteId) return
    const [inc, sig, aid, evt] = await Promise.all([
      // Un incident d'exercice n'est pas un événement à suivre : il ne gonfle pas le compteur.
      supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('contexte_id', contexteId).eq('est_exercice', false).in('statut', ['en_cours', 'pre_alerte']),
      supabase.from('signalements_citoyens').select('id', { count: 'exact', head: true }).eq('contexte_id', contexteId).eq('statut', 'recu').is('deleted_at', null),
      supabase.from('alertes_aide').select('id, incident_id, niveau, role_libelle, created_at').eq('contexte_id', contexteId).neq('statut', 'close').gte('created_at', new Date(Date.now() - 6 * 3600000).toISOString()).order('created_at', { ascending: false }),
      // Messages aux organisateurs d'événements qui attendent la décision du CC (à valider, ou envoi en échec).
      supabase.from('emissions_evenements').select('id', { count: 'exact', head: true }).eq('contexte_id', contexteId).in('statut', ['a_valider', 'echec']),
    ])
    setC({ incidents: inc.count ?? 0, signalements: sig.count ?? 0, evenements: evt.count ?? 0, aides: aid.data ?? [] })
  }, [contexteId])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  const pire = [...c.aides].sort((a, b) => (ORDRE_NIVEAU[b.niveau] ?? 0) - (ORDRE_NIVEAU[a.niveau] ?? 0))[0] ?? null
  return { ...c, pire }
}
