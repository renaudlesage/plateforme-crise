import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { etatGeoBarriere, lisserSortieZone, transitionGeoBarriere } from '@plateforme-crise/shared'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { lireCache, ecrireCache } from '../lib/cacheLocal'
import { useIncidentsEnCours } from '../hooks/useIncidentsEnCours'

const CLE_ACTIF = 'terrain.position_active'
const CLE_PARTAGE = 'terrain.position_partagee'
const CLE_ROLE_LIBELLE = 'terrain_role_libelle'
const PERIODE_PARTAGE_MS = 20000 // une écriture toutes les 20 s au plus
const PERIODE_ZONES_MS = 60000 // zones rouges rechargées chaque minute
const DELAI_CONFIRMATION_MS = 8000 // une sortie de zone doit tenir 8 s avant d'être crue (bruit GPS au bord)

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

/** Vibration selon la gravité ; silencieux si l'appareil ne le permet pas. */
function vibrer(motif) {
  try {
    navigator.vibrate?.(motif)
  } catch {
    /* vibration non disponible */
  }
}

/**
 * Bip court, en plus de la vibration : sur un téléphone posé sur le tableau de bord, on entend avant de sentir.
 * Le contexte audio n'est créé qu'après un geste de l'utilisateur (activation de la position) ; s'il est
 * bloqué par le navigateur, on ne fait rien.
 */
let contexteAudio = null
function biper(repetitions = 1, frequence = 880) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    contexteAudio = contexteAudio || new Ctx()
    if (contexteAudio.state === 'suspended') contexteAudio.resume().catch(() => {})
    const debut = contexteAudio.currentTime
    for (let i = 0; i < repetitions; i++) {
      const osc = contexteAudio.createOscillator()
      const gain = contexteAudio.createGain()
      osc.type = 'square'
      osc.frequency.value = frequence
      gain.gain.setValueAtTime(0.0001, debut + i * 0.35)
      gain.gain.exponentialRampToValueAtTime(0.2, debut + i * 0.35 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, debut + i * 0.35 + 0.25)
      osc.connect(gain).connect(contexteAudio.destination)
      osc.start(debut + i * 0.35)
      osc.stop(debut + i * 0.35 + 0.3)
    }
  } catch {
    /* audio bloqué : la vibration et le bandeau suffisent */
  }
}

const PositionContext = createContext(null)

/**
 * Position de l'appareil, partagée par toute l'app Terrain :
 *  - « active » : on suit la position pour « Autour de moi », la carte et la géo-barrière ;
 *  - « partagée » : en plus, on la transmet au CC (une ligne par personne et par incident,
 *    mise à jour toutes les 20 s, supprimée à l'arrêt). Jamais activé sans choix explicite.
 * Limite : un navigateur suspend la géolocalisation quand l'écran est éteint ou l'app en
 * arrière-plan ; ce n'est pas un suivi continu.
 *
 * Géo-barrière (zones ROUGES de l'incident suivi) :
 *  - « approche » (à moins de 150 m du bord) : bandeau orange, vibration courte, un bip ;
 *  - « dedans » : bandeau rouge, vibration longue, trois bips ;
 *  - entrées et sorties journalisées au CC (`franchissements_zone`) UNIQUEMENT si la position est partagée,
 *    via la file hors ligne (l'heure de l'appareil est conservée si l'envoi est différé).
 * Les zones sont gardées en cache local : l'alerte fonctionne encore quand le réseau tombe, sur les
 * dernières zones connues (l'écran dit depuis quand).
 * C'est un rappel d'organisation, pas un contrôle d'accès : le droit d'entrer se décide sur place.
 */
export function PositionProvider({ children }) {
  const { contexteId, utilisateur } = useAuth()
  const { incident } = useIncidentsEnCours(contexteId)
  const [actif, setActifEtat] = useState(() => lire(CLE_ACTIF))
  const [partage, setPartageEtat] = useState(() => lire(CLE_PARTAGE))
  const [position, setPosition] = useState(null) // { lat, lon, precision_m, ts }
  const [erreur, setErreur] = useState(null)
  const [zonesRouges, setZonesRouges] = useState([])
  // Incident auquel appartiennent les zones chargées : évite d'évaluer les zones d'un incident avec un autre
  const [zonesIncidentId, setZonesIncidentId] = useState(null)
  const [zonesDepuis, setZonesDepuis] = useState(null) // horodatage du dernier chargement réussi (ou du cache)
  const [zonesHorsLigne, setZonesHorsLigne] = useState(false)
  const [geoBarriere, setGeoBarriere] = useState({ etat: 'hors', zone: null, distanceBord: null })
  const [journalisation, setJournalisation] = useState(null) // { statut: 'ok'|'enfile'|'refus', nature, ts }
  const dernierEnvoi = useRef(0)
  const etatPrecedent = useRef({ etat: 'hors', zone: null, distanceBord: null })
  const sortieEnAttente = useRef(null) // début (ms) d'une sortie de zone pas encore confirmée
  const minuterieSortie = useRef(null)
  const [reevaluation, setReevaluation] = useState(0) // relance l'évaluation à l'échéance d'une sortie en attente

  const setActif = useCallback((v) => {
    setActifEtat(v)
    ecrire(CLE_ACTIF, v)
    if (!v) {
      setPartageEtat(false)
      ecrire(CLE_PARTAGE, false)
    } else {
      // Geste utilisateur : on débloque l'audio pour les bips à venir.
      biper(0)
    }
  }, [])
  const setPartage = useCallback((v) => {
    setPartageEtat(v)
    ecrire(CLE_PARTAGE, v)
    if (v) {
      setActifEtat(true)
      ecrire(CLE_ACTIF, true)
      biper(0)
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

  // Zones rouges de l'incident suivi : rechargées chaque minute, gardées en cache pour le hors-ligne
  useEffect(() => {
    if (!actif || !incident) {
      setZonesRouges([])
      setZonesIncidentId(null)
      setZonesDepuis(null)
      setZonesHorsLigne(false)
      return undefined
    }
    let annule = false
    const cleCache = `zones_rouges.${incident.id}`
    const enCache = lireCache(cleCache)
    if (enCache?.zones) {
      setZonesRouges(enCache.zones)
      setZonesDepuis(enCache.depuis)
      setZonesHorsLigne(true)
    } else {
      setZonesRouges([])
      setZonesDepuis(null)
    }
    setZonesIncidentId(incident.id)
    const charger = async () => {
      const { data, error } = await supabase
        .from('zones_intervention')
        .select('id, centre_latitude, centre_longitude, rayon_metres, contour')
        .eq('incident_id', incident.id)
        .eq('type_zone', 'rouge')
        .is('date_levee', null)
        .not('centre_latitude', 'is', null)
        .not('rayon_metres', 'is', null)
      if (annule) return
      if (error) {
        // Réseau tombé : on garde les dernières zones connues et on le dit.
        setZonesHorsLigne(true)
        return
      }
      const depuis = Date.now()
      setZonesRouges(data ?? [])
      setZonesIncidentId(incident.id)
      setZonesDepuis(depuis)
      setZonesHorsLigne(false)
      ecrireCache(cleCache, { zones: data ?? [], depuis })
    }
    charger()
    const t = setInterval(charger, PERIODE_ZONES_MS)
    return () => {
      annule = true
      clearInterval(t)
    }
  }, [actif, incident?.id])

  // Géo-barrière : état courant, alertes locales, journalisation des franchissements
  useEffect(() => {
    const incidentId = incident?.id ?? null
    // Zones d'un autre incident (changement d'incident, rechargement en cours) : on ne les évalue pas.
    const zones = zonesIncidentId && zonesIncidentId === incidentId ? zonesRouges : []
    const brut = etatGeoBarriere(position, zones)

    // Changement d'incident : l'état retenu portait sur les zones de l'ancien incident. On repart d'un état
    // neutre, sans journaliser de « sortie » : l'intervenant n'est pas sorti, on a changé d'incident suivi
    // (même règle qu'à l'arrêt de la position). Une entrée dans une zone du nouvel incident sera journalisée.
    if (etatPrecedent.current.incidentId !== incidentId) {
      etatPrecedent.current = { etat: 'hors', zone: null, distanceBord: null, incidentId }
      sortieEnAttente.current = null
    }
    const avant = etatPrecedent.current

    // Lissage de la sortie (voir lisserSortieZone). À l'échéance, on réévalue même sans nouvelle position :
    // sinon un appareil immobile ou écran éteint resterait « dedans » et la sortie ne serait jamais transmise.
    const lisse = lisserSortieZone(avant, brut, sortieEnAttente.current, Date.now(), DELAI_CONFIRMATION_MS)
    const apres = { ...lisse.apres, incidentId }
    sortieEnAttente.current = lisse.attente
    clearTimeout(minuterieSortie.current)
    minuterieSortie.current = null
    if (lisse.echeance) {
      minuterieSortie.current = setTimeout(() => setReevaluation((n) => n + 1), Math.max(0, lisse.echeance - Date.now()) + 50)
    }

    const transition = transitionGeoBarriere(avant, apres)
    etatPrecedent.current = apres
    setGeoBarriere(apres)
    if (!transition) return

    if (transition === 'approche') {
      vibrer([200])
      biper(1, 660)
    } else if (transition === 'entree') {
      vibrer([300, 150, 300, 150, 300])
      biper(3, 880)
    }

    // Journalisation au CC : seulement entrée/sortie, seulement si la position est partagée.
    if ((transition === 'entree' || transition === 'sortie') && partage && incident && utilisateur && position) {
      const zone = transition === 'entree' ? apres.zone : avant.zone
      if (!zone?.id) return
      let libelle = null
      try {
        libelle = localStorage.getItem(CLE_ROLE_LIBELLE)
      } catch {
        /* ignore */
      }
      fileEcritures
        .ecrireOuEmpiler({
          nature: 'insert',
          table: 'franchissements_zone',
          libelle: transition === 'entree' ? 'Entrée en zone rouge' : 'Sortie de zone rouge',
          champs: {
            contexte_id: contexteId,
            incident_id: incident.id,
            zone_id: zone.id,
            libelle,
            nature: transition,
            latitude: position.lat,
            longitude: position.lon,
            precision_m: position.precision_m ?? null,
            horodatage_appareil: new Date().toISOString(),
          },
        })
        .then((r) => setJournalisation({ statut: r.statut, nature: transition, ts: Date.now(), message: r.message }))
        .catch(() => setJournalisation({ statut: 'refus', nature: transition, ts: Date.now() }))
    }
  }, [position, zonesRouges, zonesIncidentId, reevaluation, partage, incident?.id, utilisateur?.id, contexteId])

  useEffect(() => () => clearTimeout(minuterieSortie.current), [])

  // Si la position s'arrête, on repart d'un état neutre (pas de « sortie » fantôme à la réactivation)
  useEffect(() => {
    if (!actif) {
      etatPrecedent.current = { etat: 'hors', zone: null, distanceBord: null, incidentId: null }
      sortieEnAttente.current = null
      clearTimeout(minuterieSortie.current)
      minuterieSortie.current = null
      setGeoBarriere({ etat: 'hors', zone: null, distanceBord: null })
    }
  }, [actif])

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

  const dansZoneRouge = geoBarriere.etat === 'dedans'
  const valeur = useMemo(
    () => ({
      actif,
      partage,
      position,
      erreur,
      dansZoneRouge,
      geoBarriere,
      zonesRouges,
      zonesDepuis,
      zonesHorsLigne,
      journalisation,
      setActif,
      setPartage,
      incident,
    }),
    [actif, partage, position, erreur, dansZoneRouge, geoBarriere, zonesRouges, zonesDepuis, zonesHorsLigne, journalisation, setActif, setPartage, incident]
  )
  return <PositionContext.Provider value={valeur}>{children}</PositionContext.Provider>
}

export function usePosition() {
  const c = useContext(PositionContext)
  if (!c) throw new Error('usePosition doit être utilisé dans PositionProvider')
  return c
}

export const CLE_STOCKAGE_ROLE_LIBELLE = CLE_ROLE_LIBELLE
