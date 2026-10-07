import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarteCrise } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

export const TYPES_OBSERVATION = [
  { valeur: 'danger', libelle: 'Danger', couleur: '#b91c1c' },
  { valeur: 'route_coupee', libelle: 'Route coupée', couleur: '#ea580c' },
  { valeur: 'inondation', libelle: 'Inondation', couleur: '#0284c7' },
  { valeur: 'degats', libelle: 'Dégâts', couleur: '#a16207' },
  { valeur: 'victimes', libelle: 'Victimes / personnes en danger', couleur: '#be123c' },
  { valeur: 'besoin', libelle: 'Besoin (aide, matériel)', couleur: '#7c3aed' },
  { valeur: 'point_rassemblement', libelle: 'Point de rassemblement', couleur: '#059669' },
  { valeur: 'acces', libelle: 'Accès / barrage', couleur: '#475569' },
  { valeur: 'autre', libelle: 'Autre', couleur: '#64748b' },
]

// Couches de référentiel : lecture pour tous, et "à localiser" quand
// la fiche existe mais n'a pas encore de coordonnées.
const COUCHES = [
  { cle: 'incidents', libelle: 'Incidents en cours', couleur: '#b91c1c', table: null },
  { cle: 'observations', libelle: 'Points terrain', couleur: '#be123c', table: null },
  { cle: 'objets_a_risque', libelle: 'Objets à risque', couleur: '#dc5a3c', table: 'objets_a_risque', champNom: 'identification', champSous: 'categorie' },
  { cle: 'centres_accueil', libelle: "Centres d'accueil", couleur: '#2563eb', table: 'centres_accueil', champNom: 'nom', champSous: 'type_lieu' },
  { cle: 'sites_qg', libelle: 'Sites QG', couleur: '#7c3aed', table: 'sites_qg', champNom: 'nom' },
  { cle: 'infrastructures_critiques', libelle: 'Infrastructures critiques', couleur: '#b45309', table: 'infrastructures_critiques', champNom: 'nom', champSous: 'type' },
  { cle: 'signalements_citoyens', libelle: 'Signalements citoyens', couleur: '#059669', table: null },
]
const REFERENTIELS = COUCHES.filter((c) => c.table)

/**
 * Carte Terrain : même outil que le QG (composant partagé CarteCrise), avec
 * en plus ce qu'on peut compléter depuis le terrain :
 *  - ajouter un point (danger, route coupée, besoin…) à l'endroit où l'on se trouve
 *    ou touché sur la carte ;
 *  - localiser un élément des référentiels qui n'a pas encore de coordonnées.
 * Les deux passent par la file d'écritures hors ligne : un point saisi sans
 * réseau part tout seul au retour de la couverture.
 */
export default function Carte() {
  const { contexteId } = useAuth()
  const [couches, setCouches] = useState(() => Object.fromEntries(COUCHES.map((c) => [c.cle, true])))
  const [donnees, setDonnees] = useState({})
  const [manquants, setManquants] = useState([])
  const [zones, setZones] = useState([])
  const [incidentId, setIncidentId] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  // mode : null (lecture) | { type: 'observation' } | { type: 'localiser', element }
  const [mode, setMode] = useState(null)
  const [selection, setSelection] = useState(null)
  const [info, setInfo] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    setErreur(null)

    const avecCoord = (table, colonnes) =>
      supabase.from(table).select(colonnes).eq('contexte_id', contexteId).not('latitude', 'is', null)
    const sansCoord = (table, colonnes) =>
      supabase.from(table).select(colonnes).eq('contexte_id', contexteId).is('latitude', null)

    const [obj, cen, sit, inf, sig, inc, obs, objSans, cenSans, sitSans, infSans] = await Promise.all([
      avecCoord('objets_a_risque', 'id, identification, categorie, latitude, longitude'),
      avecCoord('centres_accueil', 'id, nom, type_lieu, latitude, longitude'),
      avecCoord('sites_qg', 'id, nom, latitude, longitude'),
      avecCoord('infrastructures_critiques', 'id, nom, type, latitude, longitude'),
      supabase
        .from('signalements_citoyens')
        .select('id, reference, type, latitude, longitude')
        .eq('contexte_id', contexteId)
        .not('latitude', 'is', null)
        .not('statut', 'in', '(clos,sans_suite)'),
      supabase.from('incidents').select('id, nom, type_evenement, latitude, longitude').eq('contexte_id', contexteId).eq('statut', 'en_cours').order('date_debut', { ascending: false }),
      supabase
        .from('observations_terrain')
        .select('id, type, description, latitude, longitude, created_at')
        .eq('contexte_id', contexteId)
        .eq('statut', 'ouvert'),
      sansCoord('objets_a_risque', 'id, identification'),
      sansCoord('centres_accueil', 'id, nom'),
      sansCoord('sites_qg', 'id, nom'),
      sansCoord('infrastructures_critiques', 'id, nom'),
    ])

    const premiereErreur = [obj, cen, sit, inf, sig, inc, obs, objSans, cenSans, sitSans, infSans].find((r) => r.error)
    if (premiereErreur) {
      setErreur(premiereErreur.error.message)
      setChargement(false)
      return
    }

    const incidents = inc.data ?? []
    setIncidentId(incidents[0]?.id ?? null)
    setDonnees({
      incidents: incidents.filter((i) => i.latitude != null),
      observations: obs.data ?? [],
      objets_a_risque: obj.data ?? [],
      centres_accueil: cen.data ?? [],
      sites_qg: sit.data ?? [],
      infrastructures_critiques: inf.data ?? [],
      signalements_citoyens: sig.data ?? [],
    })
    setManquants([
      ...incidents.filter((i) => i.latitude == null).map((i) => ({ table: 'incidents', id: i.id, libelle: i.nom, genre: 'Incident en cours' })),
      ...(objSans.data ?? []).map((r) => ({ table: 'objets_a_risque', id: r.id, libelle: r.identification, genre: "Objet à risque" })),
      ...(cenSans.data ?? []).map((r) => ({ table: 'centres_accueil', id: r.id, libelle: r.nom, genre: "Centre d'accueil" })),
      ...(sitSans.data ?? []).map((r) => ({ table: 'sites_qg', id: r.id, libelle: r.nom, genre: 'Site QG' })),
      ...(infSans.data ?? []).map((r) => ({ table: 'infrastructures_critiques', id: r.id, libelle: r.nom, genre: 'Infrastructure critique' })),
    ])

    if (incidents.length > 0) {
      const { data: z } = await supabase
        .from('zones_intervention')
        .select('id, type_zone, centre_latitude, centre_longitude, rayon_metres')
        .in('incident_id', incidents.map((i) => i.id))
        .not('centre_latitude', 'is', null)
        .is('date_levee', null)
      setZones(z ?? [])
    } else {
      setZones([])
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
      for (const p of donnees[c.cle] ?? []) {
        if (c.cle === 'observations') {
          const t = TYPES_OBSERVATION.find((x) => x.valeur === p.type)
          tous.push({
            id: `obs-${p.id}`,
            lat: Number(p.latitude),
            lon: Number(p.longitude),
            titre: t?.libelle ?? 'Point terrain',
            sousTitre: p.description ?? undefined,
            couleur: t?.couleur ?? c.couleur,
          })
          continue
        }
        tous.push({
          id: `${c.cle}-${p.id}`,
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          titre: p.identification ?? p.nom ?? p.reference ?? c.libelle,
          sousTitre: p.categorie ?? p.type_lieu ?? p.type ?? p.type_evenement ?? undefined,
          couleur: c.couleur,
        })
      }
    }
    return tous
  }, [donnees, couches])

  const cercles = useMemo(
    () =>
      zones.map((z) => ({
        id: z.id,
        lat: Number(z.centre_latitude),
        lon: Number(z.centre_longitude),
        rayonM: Number(z.rayon_metres) || 100,
        libelle: z.type_zone,
      })),
    [zones]
  )

  // Point d'intérêt : l'incident en cours (le plus récent géolocalisé), sinon le
  // centre de sa zone d'intervention. Cadre la carte à l'ouverture et via le bouton.
  const focusIncident = useMemo(() => {
    const inc = (donnees.incidents ?? [])[0]
    if (inc) return { lat: Number(inc.latitude), lon: Number(inc.longitude) }
    const z = zones[0]
    if (z) return { lat: Number(z.centre_latitude), lon: Number(z.centre_longitude) }
    return null
  }, [donnees, zones])

  const [cleRecentrage, setCleRecentrage] = useState(0)

  const centre = useMemo(() => {
    if (selection) return selection
    if (focusIncident) return focusIncident
    if (marqueurs.length === 0) return CENTRE_BELGIQUE
    return {
      lat: marqueurs.reduce((s, m) => s + m.lat, 0) / marqueurs.length,
      lon: marqueurs.reduce((s, m) => s + m.lon, 0) / marqueurs.length,
    }
  }, [marqueurs, selection, focusIncident])

  function fermer() {
    setMode(null)
    setSelection(null)
  }

  async function apresEcriture(res, message) {
    if (res.statut === 'refus') {
      setErreur(res.message)
      return false
    }
    setErreur(null)
    setInfo(res.statut === 'enfile' ? `${message} — en attente d'envoi (pas de réseau).` : message)
    fermer()
    if (res.statut === 'ok') await charger()
    return true
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-encre mb-1">Carte</h1>

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
      {info && <p className="text-sm text-ok mb-2">{info}</p>}

      {focusIncident && !mode && (
        <div className="mb-2">
          <BoutonDiscret onClick={() => setCleRecentrage((n) => n + 1)}>Recentrer sur l'incident</BoutonDiscret>
        </div>
      )}

      {chargement ? (
        <p className="vide">Chargement…</p>
      ) : (
        <CarteCrise
          centre={centre}
          zoom={selection || focusIncident ? 15 : marqueurs.length ? 13 : 8}
          zoomRecentrage={focusIncident ? 15 : null}
          cleRecentrage={cleRecentrage}
          marqueurs={marqueurs}
          cercles={cercles}
          selection={selection}
          onClicCarte={mode ? (p) => setSelection(p) : null}
          hauteur="52vh"
        />
      )}

      {!mode && (
        <div className="mt-3 space-y-2">
          <BoutonPrincipal className="bouton-terrain" onClick={() => { setInfo(null); setMode({ type: 'observation' }) }}>
            Ajouter un point terrain
          </BoutonPrincipal>
          {manquants.length > 0 && <ALocaliser manquants={manquants} onChoisir={(element) => { setInfo(null); setMode({ type: 'localiser', element }) }} />}
        </div>
      )}

      {mode?.type === 'observation' && (
        <FormulaireObservation
          contexteId={contexteId}
          incidentId={incidentId}
          selection={selection}
          onPosition={setSelection}
          onAnnuler={fermer}
          onEnvoyer={apresEcriture}
        />
      )}

      {mode?.type === 'localiser' && (
        <FormulaireLocalisation
          element={mode.element}
          selection={selection}
          onPosition={setSelection}
          onAnnuler={fermer}
          onEnvoyer={apresEcriture}
        />
      )}
    </div>
  )
}

function ALocaliser({ manquants, onChoisir }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="border border-trait rounded p-3 bg-surface">
      <button type="button" className="lien text-sm" onClick={() => setOuvert((o) => !o)}>
        {manquants.length} élément{manquants.length > 1 ? 's' : ''} sans position à localiser {ouvert ? '▴' : '▾'}
      </button>
      {ouvert && (
        <ul className="mt-2 space-y-1">
          {manquants.map((m) => (
            <li key={`${m.table}-${m.id}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-encre">
                {m.libelle} <span className="text-xs text-sourdine">· {m.genre}</span>
              </span>
              <BoutonDiscret onClick={() => onChoisir(m)}>Localiser</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Position : touché sur la carte (géré par la page) ou position de l'appareil. */
function BoutonMaPosition({ onPosition }) {
  const [recherche, setRecherche] = useState(false)
  const [erreur, setErreur] = useState(null)

  function utiliser() {
    if (!navigator.geolocation) {
      setErreur('Pas de géolocalisation sur cet appareil.')
      return
    }
    setRecherche(true)
    setErreur(null)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onPosition({ lat: p.coords.latitude, lon: p.coords.longitude, precision_m: p.coords.accuracy })
        setRecherche(false)
      },
      () => {
        setErreur('Position refusée ou indisponible — touchez la carte.')
        setRecherche(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  return (
    <div>
      <BoutonDiscret type="button" onClick={utiliser} disabled={recherche}>
        {recherche ? 'Recherche…' : 'Utiliser ma position'}
      </BoutonDiscret>
      {erreur && <p className="text-xs text-chaud mt-1">{erreur}</p>}
    </div>
  )
}

function FormulaireObservation({ contexteId, incidentId, selection, onPosition, onAnnuler, onEnvoyer }) {
  const [type, setType] = useState('danger')
  const [description, setDescription] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function envoyer(e) {
    e.preventDefault()
    if (!selection) return
    setEnCours(true)
    const res = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'observations_terrain',
      champs: {
        contexte_id: contexteId,
        incident_id: incidentId,
        type,
        description: description.trim() || null,
        latitude: selection.lat,
        longitude: selection.lon,
        precision_m: selection.precision_m ?? null,
      },
      libelle: `Point terrain · ${TYPES_OBSERVATION.find((t) => t.valeur === type)?.libelle}`,
    })
    setEnCours(false)
    await onEnvoyer(res, 'Point terrain enregistré')
  }

  return (
    <form onSubmit={envoyer} className="mt-3 space-y-3 border border-trait rounded p-3 bg-surface">
      <p className="etiquette">Nouveau point terrain</p>
      <select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
        {TYPES_OBSERVATION.map((t) => (
          <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
        ))}
      </select>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ce que vous constatez (facultatif)" className="w-full" />
      <BoutonMaPosition onPosition={onPosition} />
      <p className="text-xs text-sourdine">
        {selection
          ? `Position : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}${selection.precision_m ? ` (±${Math.round(selection.precision_m)} m)` : ''}`
          : 'Touchez la carte à l\'endroit voulu, ou utilisez votre position.'}
      </p>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={!selection || enCours}>
          {enCours ? 'Envoi…' : 'Enregistrer le point'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function FormulaireLocalisation({ element, selection, onPosition, onAnnuler, onEnvoyer }) {
  const [enCours, setEnCours] = useState(false)

  async function envoyer() {
    if (!selection) return
    setEnCours(true)
    const res = await fileEcritures.ecrireOuEmpiler({
      nature: 'update',
      table: element.table,
      id: element.id,
      champs: { latitude: selection.lat, longitude: selection.lon },
      libelle: `Position · ${element.libelle}`,
    })
    setEnCours(false)
    await onEnvoyer(res, 'Position enregistrée')
  }

  return (
    <div className="mt-3 space-y-3 border border-trait rounded p-3 bg-surface">
      <p className="etiquette">Localiser : {element.libelle}</p>
      <BoutonMaPosition onPosition={onPosition} />
      <p className="text-xs text-sourdine">
        {selection
          ? `Position : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}`
          : 'Placez-vous sur le site et utilisez votre position, ou touchez la carte.'}
      </p>
      <div className="flex gap-2">
        <BoutonPrincipal onClick={envoyer} disabled={!selection || enCours}>
          {enCours ? 'Envoi…' : 'Enregistrer la position'}
        </BoutonPrincipal>
        <BoutonDiscret onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </div>
  )
}
