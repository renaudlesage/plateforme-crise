import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Réveils automatiques de la commune qui attendent leur « Vu, je prends » (chantier C1), pour le bandeau et l'onglet
 * Avertissements. Rafraîchis toutes les 30 s, comme les compteurs du CC. L'acquittement passe par la fonction serveur
 * `acquitter_reveil` : le premier qui répond est retenu, l'heure et l'auteur vont au journal des décisions.
 * Un réveil dont l'événement a été clôturé ne réclame plus rien : il sort du bandeau.
 */
export function useReveilsEnAttente(contexteId) {
  const [reveils, setReveils] = useState([])

  const charger = useCallback(async () => {
    if (!contexteId) return
    const { data } = await supabase
      .from('reveils')
      .select('id, arme_le, niveau, est_exercice, escalade_le, incident_id, seuils_action(libelle), alertes_externes(type_alerte, source, evenement), incidents!inner(statut)')
      .eq('contexte_id', contexteId)
      .is('acquitte_le', null)
      .neq('incidents.statut', 'cloture')
      .order('arme_le', { ascending: false })
    setReveils(data ?? [])
  }, [contexteId])

  useEffect(() => {
    setReveils([])
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  const acquitter = useCallback(
    async (id) => {
      const { error } = await supabase.rpc('acquitter_reveil', { p_reveil_id: id })
      await charger()
      return { error }
    },
    [charger],
  )

  return { reveils, acquitter, recharger: charger }
}
