import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { distanceM } from '@plateforme-crise/shared'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { useIncidentsEnCours } from '../hooks/useIncidentsEnCours'

const CLE_ACTIF = 'terrain.position_active'
const CLE_PARTAGE = 'terrain.position_partagee'
const CLE_ROLE_LIBELLE = 'terrain_role_libelle'
const PERIODE_PARTAGE_MS = 20000 // une écriture toutes les 20 s au plus

const lire = (cle) => {
  try {
    return localStorage.getItem(cle) === '1'
  } catch {
    return false
  }
}
const ecrire = (cle, v) => {
  try {
    localStorage.setItem(cle, v ? '1' : '0')
  } catch {
    /* stockage indisponible : le choix vaut pour cette session */
  }
}

const PositionContext = createContext(null)

/**
 * Position de l'appareil, partagée par toute l'app Terrain :
 *  - « active » : on suit la position pour « Autour de moi », la carte et l'alerte de zone ;
 *  - « partagée » : en plus, on la transmet au CC (une ligne par personne et par incident,
 *    mise à jour toutes les 20 s, supprimée à l'arrêt). Jamais activé sans choix explicite.
 * Limite : un navigateur suspend la géolocalisation quand l'écran est éteint ou l'app en
 * arrière-plan ; ce n'est pas un suivi continu.
 *
 * L'alerte de zone prévient (bandeau + vibration) quand on entre dans une zone ROUGE
 * (exclusion) de l'incident suivi — rappel d'organisation, pas un contrôle d'accès.
 */
export function PositionProvider({ children }) {
  const { contexteId, utilisateur } = useAuth()
  const { incident } = useIncidentsEnCours(contexteId)
  const [actif, setActifEtat] = useState(() => lire(CLE_ACTIF))
  const [partage, setPartageEtat] = useState(() => lire(CLE_PARTAGE))
  const [position, setPosition] = useState(null) // { lat, lon, precision_m, ts }
  const [erreur, setErreur] = useState(null)
  const [zonesRouges, setZonesRouges] = useState([])
  const [dansZoneRouge, setDansZoneRouge] = useState(false)
  const dernierEnvoi = useRef(0)
  const etaitDedans = useRef(false)

  const setActif = useCallback((v) => {
    setActifEtat(v)
    ecrire(CLE_ACTIF, v)
    if (!v) {
      setPartageEtat(false)
      ecrire(CLE_PARTAGE, false)
    }
  }, [])
  const setPartage = useCallback((v) => {
    setPartageEtat(v)
    ecrire(CLE_PARTAGE, v)
    if (v) {
      setActifEtat(true)
      ecrire(CLE_ACTIF, true)
    }
  }, [])

  // Suivi de la position
  useEffect(() => {
    if (!actif) {
      setPosition(null)
      return undefined
    }
    if (!navigator.geolocation) {
      setErreur('Ce navigateur ne fournit pas de géolocalisation.')
      return undefined
    }
    setErreur(null)
    const id = navigator.geolocation.watchPosition(
      (p) => setPosition({ lat: p.coords.latitude, lon: p.coords.longitude, precision_m: p.coords.accuracy, ts: Date.now() }),
      (e) => setErreur(e.code === 1 ? 'Position refusée : autorisez la localisation pour ce site.' : 'Position indisponible pour le moment.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [actif])

  // Zones rouges de l'incident suivi (rechargées chaque minute)
  useEffect(() => {
    if (!actif || !incident) {
      setZonesRouges([])
      return undefined
    }
    let annule = false
    const charger = async () => {
      const { data } = await supabase
        .from('zones_intervention')
        .select('id, centre_latitude, centre_longitude, rayon_metres')
        .eq('incident_id', incident.id)
        .eq('type_zone', 'rouge')
        .is('date_levee', null)
        .not('centre_latitude', 'is', null)
        .not('rayon_metres', 'is', null)
      if (!annule) setZonesRouges(data ?? [])
    }
    charger()
    const t = setInterval(charger, 60000)
    return () => {
      annule = true
      clearInterval(t)
    }
  }, [actif, incident?.id])

  // Entrée en zone rouge
  useEffect(() => {
    if (!position || zonesRouges.length === 0) {
      setDansZoneRouge(false)
      etaitDedans.current = false
      return
    }
    const dedans = zonesRouges.some(
      (z) => distanceM(position, { lat: Number(z.centre_latitude), lon: Number(z.centre_longitude) }) <= Number(z.rayon_metres)
    )
    setDansZoneRouge(dedans)
    if (dedans && !etaitDedans.current) {
      try {
        navigator.vibrate?.([300, 150, 300])
      } catch {
        /* vibration non disponible */
      }
    }
    etaitDedans.current = dedans
  }, [position, zonesRouges])

  // Partage avec le CC
  useEffect(() => {
    if (!partage || !position || !incident || !utilisateur) return
    if (Date.now() - dernierEnvoi.current < PERIODE_PARTAGE_MS) return
    dernierEnvoi.current = Date.now()
    let libelle = null
    try {
      libelle = localStorage.getItem(CLE_ROLE_LIBELLE)
    } catch {
      /* ignore */
    }
    supabase
      .from('positions_equipes')
      .upsert(
        {
          contexte_id: contexteId,
          incident_id: incident.id,
          auteur_id: utilisateur.id,
          libelle,
          latitude: position.lat,
          longitude: position.lon,
          precision_m: position.precision_m,
          maj_le: new Date().toISOString(),
        },
        { onConflict: 'incident_id,auteur_id' }
      )
      .then(({ error }) => {
        if (error) setErreur(`Partage impossible : ${error.message}`)
      })
  }, [partage, position, incident?.id, utilisateur?.id, contexteId])

  // Arrêt du partage : on retire sa ligne
  useEffect(() => {
    if (partage || !utilisateur || !incident) return
    supabase.from('positions_equipes').delete().eq('incident_id', incident.id).eq('auteur_id', utilisateur.id).then(() => {})
  }, [partage, incident?.id, utilisateur?.id])

  const valeur = useMemo(
    () => ({ actif, partage, position, erreur, dansZoneRouge, setActif, setPartage, incident }),
    [actif, partage, position, erreur, dansZoneRouge, setActif, setPartage, incident]
  )
  return <PositionContext.Provider value={valeur}>{children}</PositionContext.Provider>
}

export function usePosition() {
  const c = useContext(PositionContext)
  if (!c) throw new Error('usePosition doit être utilisé dans PositionProvider')
  return c
}

export const CLE_STOCKAGE_ROLE_LIBELLE = CLE_ROLE_LIBELLE
