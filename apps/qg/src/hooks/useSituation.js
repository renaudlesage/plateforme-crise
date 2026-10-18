import { useCallback, useEffect, useRef, useState } from 'react'
import { estEpinglee, texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'

const RAFRAICHISSEMENT_MS = 60000

/**
 * Données de la page Situation et du bloc « Sources utiles » d'un incident :
 *  - les sources actives (référentiel national + sources de la commune),
 *  - les épingles de l'utilisateur (strictement personnelles),
 *  - la dernière vérification de chaque source pour ce contexte (partagée par tous les membres),
 *  - le droit de « marquer vu » (capacité Situation › créer).
 * Rien n'est lu hors de la base : les sources ne sont que des liens sortants.
 */
export function useSituation(contexteId) {
  const [sources, setSources] = useState(null) // null tant que le chargement n'a pas répondu
  const [epingles, setEpingles] = useState({}) // source_id -> { epingle }
  const [verifications, setVerifications] = useState({}) // source_id -> dernière vérification
  const [peutVerifier, setPeutVerifier] = useState(false)
  const [erreur, setErreur] = useState(null)
  const verrous = useRef(new Set()) // un clic à la fois par source : un double clic n'écrit qu'une fois
  const generation = useRef(0)

  const chargerVerifications = useCallback(async () => {
    if (!contexteId) return
    const { data, error } = await supabase
      .from('derniere_verification_situation')
      .select('source_id, incident_id, verifie_le, constat')
      .eq('contexte_id', contexteId)
    if (error) return // une vérification manquée ne doit pas masquer le reste de la page
    setVerifications(Object.fromEntries((data ?? []).map((v) => [v.source_id, v])))
  }, [contexteId])

  const charger = useCallback(async () => {
    if (!contexteId) return
    const g = ++generation.current
    const [src, pin, cap] = await Promise.all([
      supabase
        .from('sources_situation')
        .select('*')
        .or(`contexte_id.is.null,contexte_id.eq.${contexteId}`)
        .eq('actif', true)
        .order('categorie')
        .order('ordre_affichage')
        .order('nom'),
      supabase.from('epingles_situation').select('source_id, epingle'),
      supabase.rpc('a_capacite', { p_contexte_id: contexteId, p_ressource: 'situation', p_action: 'creer' }),
    ])
    if (g !== generation.current) return // le contexte a changé entre-temps
    if (src.error) setErreur(texteErreur(src.error))
    else setErreur(null)
    setSources(src.data ?? [])
    setEpingles(Object.fromEntries((pin.data ?? []).map((p) => [p.source_id, { epingle: p.epingle }])))
    setPeutVerifier(cap.data === true)
    await chargerVerifications()
  }, [contexteId, chargerVerifications])

  useEffect(() => {
    charger()
  }, [charger])

  // Les vérifications des autres membres apparaissent sans recharger la page.
  useEffect(() => {
    if (!contexteId) return undefined
    const t = setInterval(chargerVerifications, RAFRAICHISSEMENT_MS)
    return () => clearInterval(t)
  }, [contexteId, chargerVerifications])

  const epinglee = useCallback((source) => estEpinglee(source, epingles[source.id]), [epingles])

  async function basculerEpingle(source) {
    if (verrous.current.has('pin:' + source.id)) return
    verrous.current.add('pin:' + source.id)
    const avant = epingles[source.id]
    const nouveau = !estEpinglee(source, avant)
    setErreur(null)
    setEpingles((e) => ({ ...e, [source.id]: { epingle: nouveau } }))
    try {
      // Pas d'upsert : la base n'autorise que la mise à jour de « epingle », pas celle de la clé.
      let r = await supabase.from('epingles_situation').update({ epingle: nouveau }).eq('source_id', source.id).select('source_id')
      let err = r.error
      if (!err && (!r.data || r.data.length === 0)) {
        r = await supabase.from('epingles_situation').insert({ source_id: source.id, epingle: nouveau })
        err = r.error
        if (err && /duplicate key/i.test(err.message ?? '')) {
          // Une autre fenêtre a créé la ligne entre-temps : on la met à jour.
          r = await supabase.from('epingles_situation').update({ epingle: nouveau }).eq('source_id', source.id).select('source_id')
          err = r.error
        }
      }
      if (err) throw err
    } catch (e) {
      setEpingles((prec) => {
        const suite = { ...prec }
        if (avant) suite[source.id] = avant
        else delete suite[source.id]
        return suite
      })
      setErreur(texteErreur(e))
    } finally {
      verrous.current.delete('pin:' + source.id)
    }
  }

  /** « Marquer vu » : ajoute une vérification (heure et auteur fixés par le serveur). Retourne { error }. */
  async function marquerVu(source, { incidentId = null, constat = null } = {}) {
    if (verrous.current.has('vu:' + source.id)) return { error: null }
    verrous.current.add('vu:' + source.id)
    try {
      const { error } = await supabase.from('verifications_situation').insert({
        contexte_id: contexteId,
        source_id: source.id,
        incident_id: incidentId,
        constat: constat?.trim() || null,
      })
      if (error) return { error: { message: texteErreur(error) } }
      await chargerVerifications()
      return { error: null }
    } finally {
      verrous.current.delete('vu:' + source.id)
    }
  }

  return { sources, epingles, epinglee, verifications, peutVerifier, erreur, basculerEpingle, marquerVu, recharger: charger }
}
