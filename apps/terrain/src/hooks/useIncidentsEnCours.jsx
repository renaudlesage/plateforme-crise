import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CLE = 'terrain_incident_id_selectionne'

/**
 * Incidents en cours du contexte + incident retenu sur cet appareil.
 * Le choix survit au rechargement (localStorage) ; à défaut, l'incident le
 * plus récent. Partagé par l'accueil, la situation et la carte pour que
 * tout parle du même incident.
 */
export function useIncidentsEnCours(contexteId) {
  const [incidents, setIncidents] = useState([])
  const [chargement, setChargement] = useState(true)
  const [choisiId, setChoisiId] = useState(() => {
    try {
      return localStorage.getItem(CLE) || ''
    } catch {
      return ''
    }
  })

  const charger = useCallback(async () => {
    if (!contexteId) return
    const { data } = await supabase
      .from('incidents')
      .select('id, nom, type_evenement, statut, degre_criticite, phase_cycle_vie, niveau_actuel_id, site_qg_actuel_id, date_debut, latitude, longitude')
      .eq('contexte_id', contexteId)
      .eq('statut', 'en_cours')
      .order('date_debut', { ascending: false })
    setIncidents(data ?? [])
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  function choisir(id) {
    setChoisiId(id)
    try {
      localStorage.setItem(CLE, id)
    } catch {
      /* ignore */
    }
  }

  const incident = incidents.find((i) => i.id === choisiId) ?? incidents[0] ?? null

  return { incidents, incident, choisir, chargement, recharger: charger }
}

export function SelecteurIncident({ incidents, incident, onChoisir }) {
  if (incidents.length < 2) return null
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-sourdine mb-1">Incident suivi</label>
      <select value={incident?.id ?? ''} onChange={(e) => onChoisir(e.target.value)} className="w-full">
        {incidents.map((i) => (
          <option key={i.id} value={i.id}>{i.nom}</option>
        ))}
      </select>
    </div>
  )
}
