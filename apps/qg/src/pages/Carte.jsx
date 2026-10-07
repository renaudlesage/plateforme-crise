import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarteCrise } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

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
 * Carte tactique QG — port du principe de la carte "Situation" d'Eventware
 * (briefing-eventware-pour-crisiware.md §3.1/§3.7), en lecture pour cette
 * première itération : ce qui est déjà saisi en coordonnées dans les
 * référentiels, superposé sur une même carte.
 */
export default function Carte() {
  const { contexteId } = useAuth()
  const [couches, setCouches] = useState(() => Object.fromEntries(COUCHES.map((c) => [c.cle, true])))
  const [points, setPoints] = useState({})
  const [zonesIntervention, setZonesIntervention] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    setErreur(null)

    const [objets, centres, sites, infra, signalements, incidentsActifs, observations] = await Promise.all([
      supabase.from('objets_a_risque').select('id, identification, categorie, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('centres_accueil').select('id, nom, type_lieu, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('sites_qg').select('id, nom, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('infrastructures_critiques').select('id, nom, type, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('signalements_citoyens').select('id, reference, type, statut, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null).not('statut', 'in', '(clos,sans_suite)'),
      supabase.from('incidents').select('id, nom, type_evenement, latitude, longitude').eq('contexte_id', contexteId).eq('statut', 'en_cours'),
      supabase.from('observations_terrain').select('id, type, description, latitude, longitude').eq('contexte_id', contexteId).eq('statut', 'ouvert'),
    ])

    const premierErreur = [objets, centres, sites, infra, signalements, incidentsActifs, observations].find((r) => r.error)
    if (premierErreur) {
      setErreur(premierErreur.error.message)
      setChargement(false)
      return
    }

    setPoints({
      incidents: (incidentsActifs.data ?? []).filter((i) => i.latitude != null),
      objets_a_risque: objets.data ?? [],
      centres_accueil: centres.data ?? [],
      sites_qg: sites.data ?? [],
      infrastructures_critiques: infra.data ?? [],
      signalements_citoyens: signalements.data ?? [],
      observations: observations.data ?? [],
    })

    const idsIncidents = (incidentsActifs.data ?? []).map((i) => i.id)
    if (idsIncidents.length > 0) {
      const { data: zones } = await supabase
        .from('zones_intervention')
        .select('id, type_zone, centre_latitude, centre_longitude, rayon_metres')
        .in('incident_id', idsIncidents)
        .not('centre_latitude', 'is', null)
        .is('date_levee', null)
      setZonesIntervention(zones ?? [])
    } else {
      setZonesIntervention([])
    }

    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  const marqueurs = useMemo(() => {
    const tous = []
    for (const c of COUCHES) {
      if (!couches[c.cle]) continue
      for (const p of points[c.cle] ?? []) {
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
  }, [points, couches])

  const cercles = useMemo(
    () =>
      zonesIntervention.map((z) => ({
        id: z.id,
        lat: Number(z.centre_latitude),
        lon: Number(z.centre_longitude),
        rayonM: Number(z.rayon_metres) || 100,
        libelle: z.type_zone,
      })),
    [zonesIntervention]
  )

  const centre = useMemo(() => {
    if (marqueurs.length === 0) return CENTRE_BELGIQUE
    const lat = marqueurs.reduce((s, m) => s + m.lat, 0) / marqueurs.length
    const lon = marqueurs.reduce((s, m) => s + m.lon, 0) / marqueurs.length
    return { lat, lon }
  }, [marqueurs])

  return (
    <div>
      <h1 className="text-lg font-semibold text-encre mb-1">Carte</h1>
      <p className="text-sm text-sourdine mb-3">
        Ce qui est déjà géolocalisé dans les référentiels de ce contexte, superposé sur une
        même carte — en lecture pour l'instant.
      </p>

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
        <CarteCrise centre={centre} zoom={marqueurs.length ? 13 : 8} marqueurs={marqueurs} cercles={cercles} hauteur="65vh" />
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
