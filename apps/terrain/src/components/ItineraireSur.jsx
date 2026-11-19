import { useCallback, useEffect, useState } from 'react'
import { libelleDistance, libelleDuree, libelleEvites, lienGoogleMapsVia, lienItineraire, messageErreurFonction } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { usePosition } from '../context/PositionContext'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'

/**
 * Itinéraire sûr (palier 2 de la géo-barrière) : demande à l'Edge Function `itineraire-sur` un trajet qui
 * évite les zones rouges de l'incident (les oranges sur demande) et les routes coupées / inondées ouvertes.
 *
 * Retour : { etat: 'repos'|'calcul'|'ok'|'erreur', resultat, erreur, calculer(arrivee, options), effacer }.
 * Le départ est la position de l'appareil (position active requise).
 * Le guidage reste une aide : le conducteur reste responsable, et la zone peut bouger pendant le trajet.
 */
export function useItineraireSur() {
  const { position, incident } = usePosition()
  const [etat, setEtat] = useState('repos')
  const [resultat, setResultat] = useState(null)
  const [erreur, setErreur] = useState(null)

  const calculer = useCallback(
    async (arrivee, { profil = 'driving-car', inclureOrange = false, libelle = null } = {}) => {
      if (!incident) {
        setEtat('erreur')
        setErreur({ message: 'Aucun incident suivi : choisissez un incident pour connaître ses zones.', code: 'incident' })
        return null
      }
      if (!position) {
        setEtat('erreur')
        setErreur({ message: 'Position inconnue : activez votre position (onglet Outils) pour calculer le départ.', code: 'position' })
        return null
      }
      setEtat('calcul')
      setErreur(null)
      const depart = { lat: position.lat, lon: position.lon }
      const { data, error } = await supabase.functions.invoke('itineraire-sur', {
        body: { incident_id: incident.id, depart, arrivee: { lat: Number(arrivee.lat), lon: Number(arrivee.lon) }, profil, inclure_orange: inclureOrange },
      })
      if (error || !data?.trace) {
        const e = await messageErreurFonction(error, data)
        setErreur(e)
        setEtat('erreur')
        return null
      }
      const r = {
        ...data,
        depart,
        arrivee: { lat: Number(arrivee.lat), lon: Number(arrivee.lon) },
        libelle,
        lien_google: lienGoogleMapsVia(depart, arrivee, data.points_passage ?? [], profil === 'foot-walking' ? 'walking' : 'driving'),
      }
      setResultat(r)
      setEtat('ok')
      return r
    },
    [incident?.id, position?.lat, position?.lon]
  )

  const effacer = useCallback(() => {
    setEtat('repos')
    setResultat(null)
    setErreur(null)
  }, [])

  return { etat, resultat, erreur, calculer, effacer }
}

/** Résumé d'un itinéraire calculé : distance, durée, zones évitées, avertissements, liens. */
export function ResumeItineraire({ resultat, erreur, etat, compact = false }) {
  if (etat === 'calcul') return <p className="text-xs text-sourdine">Calcul de l'itinéraire…</p>
  if (etat === 'erreur' && erreur) {
    return (
      <p className="text-xs text-chaud">
        {erreur.message}
        {erreur.code === 'non_configure' && " L'administrateur de la plateforme doit poser la clé OpenRouteService."}
      </p>
    )
  }
  if (etat !== 'ok' || !resultat) return null
  const traverse = resultat.traverse?.length > 0
  return (
    <div className={`space-y-1 ${compact ? 'text-xs' : 'text-sm'}`}>
      <p className="text-encre">
        <strong>{libelleDistance(resultat.distance_m)}</strong> · {libelleDuree(resultat.duree_s)}
        {resultat.profil === 'foot-walking' ? ' à pied' : ' en voiture'} · évite : {libelleEvites(resultat.evites)}
      </p>
      {(resultat.avertissements ?? []).map((a, i) => (
        <p key={i} className={`text-xs ${traverse && i === 0 ? 'text-chaud font-semibold' : 'text-sourdine'}`}>
          ⚠ {a}
        </p>
      ))}
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        <a href={resultat.lien_google} target="_blank" rel="noreferrer" className="lien text-xs">
          Ouvrir dans Google Maps (points de passage) ↗
        </a>
        <a href={lienItineraire(resultat.arrivee.lat, resultat.arrivee.lon)} target="_blank" rel="noreferrer" className="lien text-xs text-sourdine">
          Google Maps direct ↗
        </a>
      </p>
      <p className="text-xs text-sourdine">
        Google Maps traite les points de passage comme des arrêts et peut recalculer : gardez l'œil sur les zones. Le conducteur reste responsable.
      </p>
    </div>
  )
}

/**
 * Bouton « Itinéraire sûr » à poser à côté d'un lieu (entité, point terrain, mission). Calcule depuis la
 * position de l'appareil et affiche le résumé sous le bouton ; garde le lien Google Maps direct en repli.
 */
export function BoutonItineraire({ lat, lon, libelle = null, className = '' }) {
  const { etat, resultat, erreur, calculer, effacer } = useItineraireSur()
  const [profil, setProfil] = useState('driving-car')
  if (lat == null || lon == null) return null
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {etat === 'ok' ? (
          <BoutonDiscret type="button" onClick={effacer} className="text-xs">
            Masquer l'itinéraire
          </BoutonDiscret>
        ) : (
          <BoutonDiscret type="button" onClick={() => calculer({ lat, lon }, { profil, libelle })} disabled={etat === 'calcul'} className="text-xs">
            🛡 Itinéraire sûr
          </BoutonDiscret>
        )}
        <label className="text-xs text-sourdine flex items-center gap-1">
          <input type="checkbox" checked={profil === 'foot-walking'} onChange={(e) => setProfil(e.target.checked ? 'foot-walking' : 'driving-car')} /> à pied
        </label>
        <a href={lienItineraire(lat, lon)} target="_blank" rel="noreferrer" className="lien text-xs">
          Itinéraire ↗
        </a>
      </div>
      <ResumeItineraire resultat={resultat} erreur={erreur} etat={etat} compact />
    </div>
  )
}

/**
 * Panneau de la page Carte : la destination est touchée sur la carte ; le tracé est remonté au parent
 * (`onTrace`) pour être dessiné. Recalcul proposé quand les zones de l'incident changent (`cleZones`).
 */
export function PanneauItineraire({ selection, onAnnuler, onTrace, cleZones }) {
  const { etat, resultat, erreur, calculer, effacer } = useItineraireSur()
  const { actif, position } = usePosition()
  const [profil, setProfil] = useState('driving-car')
  const [inclureOrange, setInclureOrange] = useState(false)
  const [zonesChangees, setZonesChangees] = useState(false)
  const [cleAuCalcul, setCleAuCalcul] = useState(cleZones)

  useEffect(() => {
    onTrace(resultat ? { id: 'itineraire', points: resultat.trace.map((p) => [p.lat, p.lon]), couleur: resultat.traverse?.length ? '#b3311d' : '#1d4ed8', libelle: 'Itinéraire sûr' } : null)
  }, [resultat])
  useEffect(() => () => onTrace(null), [])
  useEffect(() => {
    if (resultat && cleZones !== cleAuCalcul) setZonesChangees(true)
  }, [cleZones])

  const lancer = async () => {
    if (!selection) return
    setZonesChangees(false)
    setCleAuCalcul(cleZones)
    await calculer(selection, { profil, inclureOrange })
  }

  return (
    <div className="carte space-y-2 mb-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-encre">🛡 Itinéraire sûr</p>
        <BoutonDiscret type="button" onClick={() => { effacer(); onAnnuler() }} className="text-xs">
          Fermer
        </BoutonDiscret>
      </div>
      {!actif && <p className="text-xs text-chaud">Activez votre position (onglet Outils) : elle sert de départ.</p>}
      {actif && !position && <p className="text-xs text-sourdine">En attente de votre position…</p>}
      <p className="text-xs text-sourdine">
        {selection ? `Destination : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}` : 'Touchez la carte pour choisir la destination.'}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs text-sourdine">
        <label className="flex items-center gap-1">
          <input type="radio" name="profil-itin" checked={profil === 'driving-car'} onChange={() => setProfil('driving-car')} /> en voiture
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name="profil-itin" checked={profil === 'foot-walking'} onChange={() => setProfil('foot-walking')} /> à pied
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={inclureOrange} onChange={(e) => setInclureOrange(e.target.checked)} /> éviter aussi la zone orange
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <BoutonPrincipal type="button" onClick={lancer} disabled={!selection || !position || etat === 'calcul'}>
          {etat === 'ok' ? 'Recalculer' : 'Calculer'}
        </BoutonPrincipal>
      </div>
      {zonesChangees && <p className="text-xs text-chaud font-semibold">Les zones de l'incident ont changé depuis ce calcul : recalculez avant de partir.</p>}
      <ResumeItineraire resultat={resultat} erreur={erreur} etat={etat} />
    </div>
  )
}
