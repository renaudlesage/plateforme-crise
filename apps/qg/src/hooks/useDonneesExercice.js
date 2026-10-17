import { useCallback, useEffect, useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'

/**
 * Données vivantes d'un exercice : stimuli, actions attendues, observations, objectifs, écarts.
 * `complet` = false pour un membre qui n'est pas animateur : la base ne lui montre que les écarts
 * (et seulement une fois l'exercice terminé) — on ne demande donc rien d'autre.
 *
 * En cas d'échec on renvoie l'erreur et AUCUNE donnée : un écran vide ne doit jamais passer pour « rien à signaler ».
 */
export function useDonneesExercice(exerciceId, complet) {
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState(null)

  const recharger = useCallback(async () => {
    const requetes = [supabase.from('exercice_ecarts').select('*').eq('exercice_id', exerciceId).order('created_at')]
    if (complet) {
      requetes.push(
        supabase.from('exercice_stimuli').select('*').eq('exercice_id', exerciceId).order('heure_scenario_min').order('ordre'),
        supabase.from('exercice_actions_attendues').select('*').eq('exercice_id', exerciceId).order('ordre'),
        supabase.from('exercice_observations').select('*').eq('exercice_id', exerciceId).order('horodatage'),
        supabase.from('exercice_objectifs').select('*').eq('exercice_id', exerciceId).order('ordre')
      )
    }
    const res = await Promise.all(requetes)
    const echec = res.find((r) => r.error)
    if (echec) {
      setErreur(texteErreur(echec.error))
      return false
    }
    setErreur(null)
    setD({
      ecarts: res[0].data ?? [],
      stimuli: res[1]?.data ?? [],
      actions: res[2]?.data ?? [],
      observations: res[3]?.data ?? [],
      objectifs: res[4]?.data ?? [],
    })
    return true
  }, [exerciceId, complet])

  useEffect(() => {
    recharger()
  }, [recharger])

  return { d, erreur, recharger }
}
