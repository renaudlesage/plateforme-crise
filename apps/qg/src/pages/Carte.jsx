import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarteCrise, FiltreIncidentsCarte } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret } from '../components/Boutons'

// Centre de la Belgique — repli quand aucun point n'est encore géolocalisé
// pour ce contexte, pour ne jamais ouvrir sur une carte vide et sans repère.
const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

const COUCHES = [
  { cle: 'incidents', libelle: 'Incidents en cours', couleur: '#b91c1c' },
  { cle: 'objets_a_risque', libelle: 'Objets à risque', couleur: '#dc5a3c' },
  { cle: 'centres_accueil', libelle: "Centres d'accueil", couleur: '#2563eb' },
  { cle: 'sites_qg', libelle: 'Sites QG', couleur: '#7c3aed' },
  { cle: 'infrastructures_critiques', libelle: 'Infrastructures critiques', couleur: '#b45309' },
  { cle: 'signalements_citoyens', libelle: 'Signalements citoyens (ouverts)', couleur: '#059669' },
  { cle: 'observations', libelle: 'Points terrain (ouverts)', couleur: '#be123c' },
]

const LIBELLE_OBSERVATION = {
  danger: 'Danger',
  route_coupee: 'Route coupée',
  inondation: 'Inondation',
  degats: 'Dégâts',
  victimes: 'Victimes / personnes en danger',
  besoin: 'Besoin (aide, matériel)',
  point_rassemblement: 'Point de rassemblement',
  acces: 'Accès / barrage',
  autre: 'Point terrain',
}

/**
 * Carte tactique QG. Les couches de référentiel (objets à risque, centres,
 * sites, infrastructures) concernent tout le contexte ; les couches
 * « incident » (position, zones d'intervention, points terrain, signalements
 * rattachés) suivent les incidents cochés. Par défaut : le plus récent
 * seulement — « Tous » pour une catastrophe à plusieurs incidents.
 */
export default function Carte() {
  const { contexteId } = useAuth()
  const [couches, setCouches] = useState(() => Object.fromEntries(COUCHES.map((c) => [c.cle, true])))
  const [points, setPoints] = useState({})
  const [incidents, setIncidents] = useState([])
  const [zonesIntervention, setZonesIntervention] = useState([])
  const [affiches, setAffiches] = useState(null) // null = pas encore initialisé
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [cleRecentrage, setCleRecentrage] = useState(0)

  const charger = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    setErreur(null)

    const [objets, centres, sites, infra, signalements, incidentsActifs, observations] = await Promise.all([
      supabase.from('objets_a_risque').select('id, identification, categorie, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('centres_accueil').select('id, nom, type_lieu, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('sites_qg').select('id, nom, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('infrastructures_critiques').select('id, nom, type, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('signalements_citoyens').select('id, reference, type, statut, incident_id, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null).not('statut', 'in', '(clos,sans_suite)'),
      supabase.from('incidents').select('id, nom, type_evenement, latitude, longitude').eq('contexte_id', contexteId).eq('statut', 'en_cours').order('date_debut', { ascending: false }),
      supabase.from('observations_terrain').select('id, type, description, incident_id, latitude, longitude').eq('contexte_id', contexteId).eq('statut', 'ouvert'),
    ])

    const premierErreur = [objets, centres, sites, infra, signalements, incidentsActifs, observations].find((r) => r.error)
    if (premierErreur) {
      setErreur(premierErreur.error.message)
      setChargement(false)
      return
    }

    const liste = incidentsActifs.data ?? []
    setIncidents(liste)
    setPoints({
      objets_a_risque: objets.data ?? [],
      centres_accueil: centres.data ?? [],
      sites_qg: sites.data ?? [],
      infrastructures_critiques: infra.data ?? [],
      signalements_citoyens: signalements.data ?? [],
      observations: observations.data ?? [],
    })

    if (liste.length > 0) {
      const { data: zones } = await supabase
        .from('zones_intervention')
        .select('id, incident_id, type_zone, centre_latitude, centre_longitude, rayon_metres')
        .in('incident_id', liste.map((i) => i.id))
        .not('centre_latitude', 'is', null)
        .is('date_levee', null)
      setZonesIntervention(zones ?? [])
    } else {
      setZonesIntervention([])
    }

    // Premier chargement : l'incident le plus récent (géolocalisé de préférence).
    setAffiches((precedent) => {
      if (precedent !== null) return precedent.filter((id) => liste.some((i) => i.id === id))
      const premier = liste.find((i) => i.latitude != null) ?? liste[0]
      return premier ? [premier.id] : []
    })
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  const ids = useMemo(() => new Set(affiches ?? []), [affiches])
  const incidentsAffiches = useMemo(() => incidents.filter((i) => ids.has(i.id)), [incidents, ids])
  // Un point rattaché à un incident n'apparaît que si cet incident est coché ;
  // un point sans incident (signalement non encore rattaché…) reste visible.
  const visible = (p) => !p.incident_id || ids.has(p.incident_id)

  const marqueurs = useMemo(() => {
    const tous = []
    for (const c of COUCHES) {
      if (!couches[c.cle]) continue
      const source =
        c.cle === 'incidents'
          ? incidentsAffiches.filter((i) => i.latitude != null)
          : (points[c.cle] ?? []).filter((p) => c.cle !== 'signalements_citoyens' && c.cle !== 'observations' ? true : visible(p))
      for (const p of source) {
        tous.push({
          id: `${c.cle}-${p.id}`,
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          titre: c.cle === 'observations' ? LIBELLE_OBSERVATION[p.type] ?? c.libelle : p.identification ?? p.nom ?? p.reference ?? c.libelle,
          sousTitre: c.cle === 'observations' ? p.description ?? undefined : p.categorie ?? p.type_lieu ?? p.type ?? p.type_evenement ?? LIBELLE_TYPE_SIGNALEMENT[p.type] ?? undefined,
          couleur: c.couleur,
        })
      }
    }
    return tous
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, couches, incidentsAffiches, ids])

  const cercles = useMemo(
    () =>
      couches.incidents
        ? zonesIntervention
            .filter((z) => ids.has(z.incident_id))
            .map((z) => ({
              id: z.id,
              lat: Number(z.centre_latitude),
              lon: Number(z.centre_longitude),
              rayonM: Number(z.rayon_metres) || 100,
              libelle: z.type_zone,
            }))
        : [],
    [zonesIntervention, ids, couches.incidents]
  )

  // Cadrage : sur les incidents cochés (leur position, à défaut le centre de
  // leurs zones) — pas sur la moyenne de tout ce qui est géolocalisé.
  const pointsIncidents = useMemo(() => {
    const pts = []
    for (const i of incidentsAffiches) {
      if (i.latitude != null) pts.push({ lat: Number(i.latitude), lon: Number(i.longitude) })
      else {
        const z = zonesIntervention.find((x) => x.incident_id === i.id)
        if (z) pts.push({ lat: Number(z.centre_latitude), lon: Number(z.centre_longitude) })
      }
    }
    return pts
  }, [incidentsAffiches, zonesIntervention])

  const centre = useMemo(() => {
    if (pointsIncidents.length > 0) {
      return {
        lat: pointsIncidents.reduce((s, p) => s + p.lat, 0) / pointsIncidents.length,
        lon: pointsIncidents.reduce((s, p) => s + p.lon, 0) / pointsIncidents.length,
      }
    }
    if (marqueurs.length === 0) return CENTRE_BELGIQUE
    return {
      lat: marqueurs.reduce((s, m) => s + m.lat, 0) / marqueurs.length,
      lon: marqueurs.reduce((s, m) => s + m.lon, 0) / marqueurs.length,
    }
  }, [pointsIncidents, marqueurs])

  return (
    <div>
      <h1 className="text-lg font-semibold text-encre mb-1">Carte</h1>
      <p className="text-sm text-sourdine mb-3">
        Cochez les incidents à voir : un seul pour le suivre de près, tous pour une catastrophe à plusieurs
        incidents. Les référentiels du contexte restent affichés dans les deux cas.
      </p>

      <FiltreIncidentsCarte
        incidents={incidents.map((i) => ({ id: i.id, nom: i.nom, geolocalise: i.latitude != null }))}
        selectionnes={affiches ?? []}
        onChange={(liste) => {
          setAffiches(liste)
          setCleRecentrage((n) => n + 1)
        }}
      />

      <div className="flex flex-wrap gap-3 mb-3">
        {COUCHES.map((c) => (
          <label key={c.cle} className="flex items-center gap-1.5 text-xs text-sourdine">
            <input
              type="checkbox"
              checked={couches[c.cle]}
              onChange={() => setCouches((prev) => ({ ...prev, [c.cle]: !prev[c.cle] }))}
            />
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c.couleur }} />
            {c.libelle}
          </label>
        ))}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : (
        <>
          {pointsIncidents.length > 0 && (
            <div className="mb-2">
              <BoutonDiscret onClick={() => setCleRecentrage((n) => n + 1)}>
                {pointsIncidents.length > 1 ? 'Recadrer sur les incidents affichés' : "Recentrer sur l'incident"}
              </BoutonDiscret>
            </div>
          )}
          <CarteCrise
            centre={centre}
            zoom={pointsIncidents.length ? 15 : marqueurs.length ? 13 : 8}
            zoomRecentrage={pointsIncidents.length === 1 ? 15 : null}
            ajusterSur={pointsIncidents.length > 1 ? pointsIncidents : null}
            cleRecentrage={cleRecentrage}
            marqueurs={marqueurs}
            cercles={cercles}
            hauteur="65vh"
          />
        </>
      )}
    </div>
  )
}

const LIBELLE_TYPE_SIGNALEMENT = {
  route_coupee: 'Route coupée / inondée',
  inondation: 'Inondation',
  degats_materiels: 'Dégâts matériels',
  personne_isolee: 'Personne isolée / en danger',
  danger: 'Danger immédiat',
  autre: 'Signalement citoyen',
}
