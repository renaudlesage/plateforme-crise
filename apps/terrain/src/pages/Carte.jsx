import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarteCrise, FiltreIncidentsCarte, DISCIPLINES, disciplineDe, symboleDe, Symbole, PaletteSymboles, LegendeSymboles } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { useIncidentsEnCours } from '../hooks/useIncidentsEnCours'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

export const TYPES_OBSERVATION = [
  { valeur: 'danger', libelle: 'Danger', couleur: '#b91c1c', symbole: 'danger_noir' },
  { valeur: 'route_coupee', libelle: 'Route coupée', couleur: '#ea580c', symbole: 'route_barree' },
  { valeur: 'inondation', libelle: 'Inondation', couleur: '#0284c7', symbole: 'danger_eau' },
  { valeur: 'degats', libelle: 'Dégâts', couleur: '#a16207', symbole: 'danger_risque' },
  { valeur: 'victimes', libelle: 'Victimes / personnes en danger', couleur: '#be123c', symbole: 'danger_humain' },
  { valeur: 'besoin', libelle: 'Besoin (aide, matériel)', couleur: '#7c3aed', symbole: 'point_particulier' },
  { valeur: 'point_rassemblement', libelle: 'Point de rassemblement', couleur: '#059669', symbole: 'infra_pr' },
  { valeur: 'acces', libelle: 'Accès / barrage', couleur: '#475569', symbole: 'isolement' },
  { valeur: 'autre', libelle: 'Autre', couleur: '#64748b', symbole: 'point_particulier' },
]

// Couches de référentiel : lecture pour tous, et "à localiser" quand
// la fiche existe mais n'a pas encore de coordonnées.
const COUCHES = [
  { cle: 'incidents', libelle: 'Incidents en cours', couleur: '#b91c1c', table: null, symbole: 'sinistre_foyer' },
  { cle: 'observations', libelle: 'Points terrain', couleur: '#be123c', table: null },
  { cle: 'moyens', libelle: 'Moyens engagés', couleur: '#8e2a8e', table: null, symbole: 'moyen_autre' },
  { cle: 'objets_a_risque', libelle: 'Objets à risque', couleur: '#dc5a3c', symbole: 'danger_risque', table: 'objets_a_risque', champNom: 'identification', champSous: 'categorie' },
  { cle: 'centres_accueil', libelle: "Centres d'accueil", couleur: '#2563eb', symbole: 'infra_ca', table: 'centres_accueil', champNom: 'nom', champSous: 'type_lieu' },
  { cle: 'sites_qg', libelle: 'Sites QG', couleur: '#7c3aed', symbole: 'pc_ops', table: 'sites_qg', champNom: 'nom' },
  { cle: 'infrastructures_critiques', libelle: 'Infrastructures critiques', couleur: '#b45309', symbole: 'sensible_noir', table: 'infrastructures_critiques', champNom: 'nom', champSous: 'type' },
  { cle: 'signalements_citoyens', libelle: 'Signalements citoyens', couleur: '#059669', table: null },
]
export const STATUTS_MOYEN = {
  en_route: 'En route',
  sur_place: 'Sur place',
  disponible: 'Disponible',
  retire: 'Retiré',
}

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
  const { incident: incidentChoisi, choisir } = useIncidentsEnCours(contexteId)
  const [affiches, setAffiches] = useState(null) // null = pas encore initialisé
  const incidentId = incidentChoisi?.id ?? null
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  // mode : null (lecture) | { type: 'observation' } | { type: 'localiser', element }
  const [mode, setMode] = useState(null)
  const [selection, setSelection] = useState(null)
  const [info, setInfo] = useState(null)
  const [disciplinesVues, setDisciplinesVues] = useState(null) // null = toutes ; sinon tableau de valeurs (+ 'aucune')
  const [filtresOuverts, setFiltresOuverts] = useState(false)

  const charger = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    setErreur(null)

    const avecCoord = (table, colonnes) =>
      supabase.from(table).select(colonnes).eq('contexte_id', contexteId).not('latitude', 'is', null)
    const sansCoord = (table, colonnes) =>
      supabase.from(table).select(colonnes).eq('contexte_id', contexteId).is('latitude', null)

    const [obj, cen, sit, inf, sig, inc, obs, moy, objSans, cenSans, sitSans, infSans] = await Promise.all([
      avecCoord('objets_a_risque', 'id, identification, categorie, latitude, longitude'),
      avecCoord('centres_accueil', 'id, nom, type_lieu, latitude, longitude'),
      avecCoord('sites_qg', 'id, nom, latitude, longitude'),
      avecCoord('infrastructures_critiques', 'id, nom, type, latitude, longitude'),
      supabase
        .from('signalements_citoyens')
        .select('id, reference, type, incident_id, latitude, longitude')
        .eq('contexte_id', contexteId)
        .not('latitude', 'is', null)
        .not('statut', 'in', '(clos,sans_suite)'),
      supabase.from('incidents').select('id, nom, type_evenement, latitude, longitude').eq('contexte_id', contexteId).eq('statut', 'en_cours').order('date_debut', { ascending: false }),
      supabase
        .from('observations_terrain')
        .select('id, type, description, discipline, symbole, incident_id, latitude, longitude, created_at')
        .eq('contexte_id', contexteId)
        .eq('statut', 'ouvert'),
      supabase
        .from('moyens_engages')
        .select('id, symbole, libelle, discipline, effectif, statut, remarque, incident_id, latitude, longitude, maj_le')
        .eq('contexte_id', contexteId)
        .neq('statut', 'retire')
        .order('maj_le', { ascending: false }),
      sansCoord('objets_a_risque', 'id, identification'),
      sansCoord('centres_accueil', 'id, nom'),
      sansCoord('sites_qg', 'id, nom'),
      sansCoord('infrastructures_critiques', 'id, nom'),
    ])

    const premiereErreur = [obj, cen, sit, inf, sig, inc, obs, moy, objSans, cenSans, sitSans, infSans].find((r) => r.error)
    if (premiereErreur) {
      setErreur(premiereErreur.error.message)
      setChargement(false)
      return
    }

    const incidents = inc.data ?? []
    setDonnees({
      incidents,
      observations: obs.data ?? [],
      moyens: moy.data ?? [],
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
        .select('id, incident_id, type_zone, centre_latitude, centre_longitude, rayon_metres')
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

  // Incidents cochés : par défaut celui qui est suivi sur cet appareil.
  useEffect(() => {
    if (affiches === null && incidentChoisi) setAffiches([incidentChoisi.id])
  }, [affiches, incidentChoisi])
  const ids = useMemo(() => new Set(affiches ?? []), [affiches])

  const disciplineVisible = (d) => disciplinesVues === null || disciplinesVues.includes(d ?? 'aucune')
  const basculerDiscipline = (v) =>
    setDisciplinesVues((prev) => {
      const tout = [...DISCIPLINES.map((d) => d.valeur), 'aucune']
      const actuel = prev ?? tout
      const suite = actuel.includes(v) ? actuel.filter((x) => x !== v) : [...actuel, v]
      return suite.length === tout.length ? null : suite
    })

  const marqueurs = useMemo(() => {
    const tous = []
    for (const c of COUCHES) {
      if (!couches[c.cle]) continue
      const source =
        c.cle === 'observations'
          ? (donnees.observations ?? []).filter((p) => (!p.incident_id || ids.has(p.incident_id)) && disciplineVisible(p.discipline))
          : c.cle === 'moyens'
          ? (donnees.moyens ?? []).filter((m) => m.latitude != null && (!m.incident_id || ids.has(m.incident_id)))
          : c.cle === 'incidents'
          ? (donnees.incidents ?? []).filter((i) => i.latitude != null && ids.has(i.id))
          : (donnees[c.cle] ?? []).filter((p) => (c.cle === 'signalements_citoyens' ? !p.incident_id || ids.has(p.incident_id) : true))
      for (const p of source) {
        if (c.cle === 'observations') {
          const t = TYPES_OBSERVATION.find((x) => x.valeur === p.type)
          const d = disciplineDe(p.discipline)
          // La discipline, quand elle est posée, impose sa couleur.
          tous.push({
            id: `obs-${p.id}`,
            lat: Number(p.latitude),
            lon: Number(p.longitude),
            titre: t?.libelle ?? 'Point terrain',
            sousTitre: [d?.court, p.description].filter(Boolean).join(' · ') || undefined,
            couleur: d?.couleur ?? t?.couleur ?? c.couleur,
            symbole: p.symbole ?? t?.symbole ?? 'point_particulier',
            badge: d?.couleur,
            onModifier: () => modifierObservation(p),
          })
          continue
        }
        if (c.cle === 'moyens') {
          const d = disciplineDe(p.discipline)
          tous.push({
            id: `moy-${p.id}`,
            lat: Number(p.latitude),
            lon: Number(p.longitude),
            titre: p.libelle,
            sousTitre: [STATUTS_MOYEN[p.statut], p.effectif != null ? `${p.effectif} pers.` : null, d?.court, p.remarque].filter(Boolean).join(' · '),
            couleur: d?.couleur ?? c.couleur,
            symbole: p.symbole,
            badge: d?.couleur,
            onModifier: () => modifierMoyen(p),
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
          symbole: c.symbole,
        })
      }
    }
    const enEdition = mode?.existant ? `${mode.type === 'moyen' ? 'moy' : 'obs'}-${mode.existant.id}` : null
    return enEdition ? tous.filter((m) => m.id !== enEdition) : tous
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, couches, ids, disciplinesVues, mode])

  const cercles = useMemo(
    () =>
      (couches.incidents ? zones.filter((z) => ids.has(z.incident_id)) : []).map((z) => ({
        id: z.id,
        lat: Number(z.centre_latitude),
        lon: Number(z.centre_longitude),
        rayonM: Number(z.rayon_metres) || 100,
        libelle: z.type_zone,
      })),
    [zones, ids, couches.incidents]
  )

  // Cadrage : sur les incidents cochés (position, à défaut centre de leurs zones).
  const pointsIncidents = useMemo(() => {
    const pts = []
    for (const i of (donnees.incidents ?? []).filter((x) => ids.has(x.id))) {
      if (i.latitude != null) pts.push({ lat: Number(i.latitude), lon: Number(i.longitude) })
      else {
        const z = zones.find((x) => x.incident_id === i.id)
        if (z) pts.push({ lat: Number(z.centre_latitude), lon: Number(z.centre_longitude) })
      }
    }
    return pts
  }, [donnees, zones, ids])

  const [cleRecentrage, setCleRecentrage] = useState(0)

  const centre = useMemo(() => {
    if (selection) return selection
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
  }, [marqueurs, selection, pointsIncidents])

  function fermer() {
    setMode(null)
    setSelection(null)
  }

  // Édition : on ouvre le formulaire prérempli, la pastille de sélection part de la position actuelle.
  function modifierObservation(p) {
    setInfo(null)
    setSelection({ lat: Number(p.latitude), lon: Number(p.longitude) })
    setMode({ type: 'observation', existant: p })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }
  function modifierMoyen(m) {
    setInfo(null)
    setSelection(m.latitude != null ? { lat: Number(m.latitude), lon: Number(m.longitude) } : null)
    setMode({ type: 'moyen', existant: m })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
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

  const formulaire = (
    <>
      {mode?.type === 'observation' && (
        <FormulaireObservation
          key={mode.existant?.id ?? 'nouveau'}
          existant={mode.existant ?? null}
          contexteId={contexteId}
          incidentId={incidentId}
          selection={selection}
          onPosition={setSelection}
          onAnnuler={fermer}
          onEnvoyer={apresEcriture}
        />
      )}

      {mode?.type === 'moyen' && (
        <FormulaireMoyen
          key={mode.existant?.id ?? 'nouveau'}
          existant={mode.existant ?? null}
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
    </>
  )

  return (
    <div>
      {/* Les actions restent en haut : sur un téléphone la carte occupe presque tout l'écran
          et un doigt posé dessus déplace la carte au lieu de faire défiler la page. */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h1 className="text-lg font-semibold text-encre">Carte</h1>
        {!mode && (
          <div className="flex flex-wrap gap-2">
            <BoutonPrincipal onClick={() => { setInfo(null); setMode({ type: 'observation' }) }}>+ Point terrain</BoutonPrincipal>
            <BoutonDiscret onClick={() => { setInfo(null); setMode({ type: 'moyen' }) }}>+ Moyen engagé</BoutonDiscret>
          </div>
        )}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      {info && <p className="text-sm text-ok mb-2">{info}</p>}

      {/* Formulaire AU-DESSUS de la carte : on voit les champs et on touche la carte juste dessous. */}
      {formulaire}

      {!mode && (
        <>
          <FiltreIncidentsCarte
            incidents={(donnees.incidents ?? []).map((i) => ({ id: i.id, nom: i.nom, geolocalise: i.latitude != null }))}
            selectionnes={affiches ?? []}
            onChange={(liste) => {
              setAffiches(liste)
              setCleRecentrage((n) => n + 1)
              // Un seul incident coché = celui qu'on suit (accueil, situation, points terrain).
              if (liste.length === 1) choisir(liste[0])
            }}
          />

          <div className="mb-2">
            <button type="button" className="lien text-sm" onClick={() => setFiltresOuverts((o) => !o)} aria-expanded={filtresOuverts}>
              Couches et filtres {filtresOuverts ? '▴' : '▾'}
            </button>
            {filtresOuverts && (
              <div className="mt-2">
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

                {couches.observations && (
                  <div className="mb-1">
                    <p className="etiquette mb-1">Points terrain par discipline</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...DISCIPLINES, { valeur: 'aucune', court: 'Sans discipline', couleur: '#94a3b8' }].map((d) => {
                        const actif = disciplinesVues === null || disciplinesVues.includes(d.valeur)
                        return (
                          <button
                            key={d.valeur}
                            type="button"
                            onClick={() => basculerDiscipline(d.valeur)}
                            className="discret"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: actif ? 1 : 0.45, padding: '4px 8px', fontSize: 12 }}
                            aria-pressed={actif}
                          >
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.couleur, display: 'inline-block' }} />
                            {d.court}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {pointsIncidents.length > 0 && (
            <div className="mb-2">
              <BoutonDiscret onClick={() => setCleRecentrage((n) => n + 1)}>
                {pointsIncidents.length > 1 ? 'Recadrer sur les incidents affichés' : "Recentrer sur l'incident"}
              </BoutonDiscret>
            </div>
          )}
        </>
      )}

      {chargement ? (
        <p className="vide">Chargement…</p>
      ) : (
        <CarteCrise
          centre={centre}
          zoom={selection || pointsIncidents.length ? 15 : marqueurs.length ? 13 : 8}
          zoomRecentrage={pointsIncidents.length === 1 ? 15 : null}
          ajusterSur={pointsIncidents.length > 1 ? pointsIncidents : null}
          cleRecentrage={cleRecentrage}
          marqueurs={marqueurs}
          cercles={cercles}
          selection={selection}
          onClicCarte={mode ? (p) => setSelection(p) : null}
          hauteur={mode ? '45vh' : '52vh'}
        />
      )}

      {!mode && (
        <div className="mt-3 space-y-2">
          <MoyensEngages
            onModifier={modifierMoyen}
            moyens={(donnees.moyens ?? []).filter((m) => !m.incident_id || ids.has(m.incident_id))}
            onStatut={async (m, statut) => {
              const res = await fileEcritures.ecrireOuEmpiler({
                nature: 'update',
                table: 'moyens_engages',
                id: m.id,
                champs: { statut, maj_le: new Date().toISOString() },
                libelle: `${m.libelle} · ${STATUTS_MOYEN[statut]}`,
              })
              await apresEcriture(res, `${m.libelle} : ${STATUTS_MOYEN[statut].toLowerCase()}`)
            }}
            onDeplacer={(m) => { setInfo(null); setMode({ type: 'localiser', element: { table: 'moyens_engages', id: m.id, libelle: m.libelle } }) }}
          />

          {(donnees.observations ?? []).length > 0 && (
            <PointsAFlaguer
              onModifier={modifierObservation}
              points={(donnees.observations ?? []).filter((p) => !p.incident_id || ids.has(p.incident_id))}
              onFlaguer={async (p, discipline) => {
                const res = await fileEcritures.ecrireOuEmpiler({
                  nature: 'update',
                  table: 'observations_terrain',
                  id: p.id,
                  champs: { discipline },
                  libelle: `Discipline · ${TYPES_OBSERVATION.find((t) => t.valeur === p.type)?.libelle}`,
                })
                await apresEcriture(res, discipline ? `Point flagué ${disciplineDe(discipline).court}` : 'Discipline retirée')
              }}
            />
          )}

          {manquants.length > 0 && <ALocaliser manquants={manquants} onChoisir={(element) => { setInfo(null); setMode({ type: 'localiser', element }) }} />}

          <LegendeSymboles />
        </div>
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

function FormulaireObservation({ contexteId, incidentId, selection, onPosition, onAnnuler, onEnvoyer, existant = null }) {
  const [type, setType] = useState(existant?.type ?? 'danger')
  const [symbole, setSymbole] = useState(existant ? existant.symbole ?? TYPES_OBSERVATION.find((t) => t.valeur === existant.type)?.symbole ?? null : TYPES_OBSERVATION[0].symbole)
  const [discipline, setDiscipline] = useState(existant?.discipline ?? null)
  const [description, setDescription] = useState(existant?.description ?? '')
  const [enCours, setEnCours] = useState(false)

  async function envoyer(e) {
    e.preventDefault()
    if (!selection) return
    setEnCours(true)
    if (existant) {
      const res = await fileEcritures.ecrireOuEmpiler({
        nature: 'update',
        table: 'observations_terrain',
        id: existant.id,
        champs: {
          type,
          symbole,
          discipline,
          description: description.trim() || null,
          latitude: selection.lat,
          longitude: selection.lon,
          precision_m: selection.precision_m ?? null,
        },
        libelle: `Point terrain modifié · ${TYPES_OBSERVATION.find((t) => t.valeur === type)?.libelle}`,
      })
      setEnCours(false)
      await onEnvoyer(res, 'Point terrain modifié')
      return
    }
    const res = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'observations_terrain',
      champs: {
        contexte_id: contexteId,
        incident_id: incidentId,
        type,
        symbole,
        discipline,
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
    <form onSubmit={envoyer} className="mb-3 space-y-3 border border-trait rounded p-3 bg-surface">
      <p className="etiquette">{existant ? 'Modifier le point terrain' : 'Nouveau point terrain'}</p>
      <select
        value={type}
        onChange={(e) => {
          setType(e.target.value)
          // Le symbole suit le type tant qu'on n'en a pas choisi un autre à la main.
          setSymbole(TYPES_OBSERVATION.find((t) => t.valeur === e.target.value)?.symbole ?? null)
        }}
        className="w-full"
      >
        {TYPES_OBSERVATION.map((t) => (
          <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
        ))}
      </select>
      <PaletteSymboles valeur={symbole} onChange={(code) => setSymbole(code ?? TYPES_OBSERVATION.find((t) => t.valeur === type)?.symbole ?? null)} />
      <div>
        <p className="text-xs text-sourdine mb-1">Discipline concernée (facultatif)</p>
        <ChoixDiscipline valeur={discipline} onChange={setDiscipline} />
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ce que vous constatez (facultatif)" className="w-full" />
      <BoutonMaPosition onPosition={onPosition} />
      <p className="text-xs text-sourdine">
        {selection
          ? `Position : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}${selection.precision_m ? ` (±${Math.round(selection.precision_m)} m)` : ''}`
          : 'Touchez la carte à l\'endroit voulu (juste en dessous), ou utilisez votre position.'}
      </p>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={!selection || enCours}>
          {enCours ? 'Envoi…' : existant ? 'Enregistrer les modifications' : 'Enregistrer le point'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
      {existant && (
        <div className="border-t border-trait pt-2">
          <BoutonDiscret
            type="button"
            disabled={enCours}
            onClick={async () => {
              setEnCours(true)
              const res = await fileEcritures.ecrireOuEmpiler({
                nature: 'update',
                table: 'observations_terrain',
                id: existant.id,
                champs: { statut: 'traite' },
                libelle: `Point terrain clos · ${TYPES_OBSERVATION.find((t) => t.valeur === existant.type)?.libelle}`,
              })
              setEnCours(false)
              await onEnvoyer(res, 'Point clos (retiré de la carte)')
            }}
          >
            Clore ce point (traité)
          </BoutonDiscret>
        </div>
      )}
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
    <div className="mb-3 space-y-3 border border-trait rounded p-3 bg-surface">
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

/** Pastilles de discipline : un toucher pose, un second toucher retire. */
function ChoixDiscipline({ valeur, onChange, compact = false }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DISCIPLINES.map((d) => {
        const actif = valeur === d.valeur
        return (
          <button
            key={d.valeur}
            type="button"
            aria-pressed={actif}
            onClick={() => onChange(actif ? null : d.valeur)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: compact ? '3px 8px' : '6px 12px',
              fontSize: 13,
              borderRadius: 999,
              border: `2px solid ${d.couleur}`,
              background: actif ? d.couleur : 'transparent',
              color: actif ? '#fff' : 'inherit',
              fontWeight: 600,
            }}
          >
            {d.court}
          </button>
        )
      })}
    </div>
  )
}

/** Flaguer (ou re-flaguer) un point déjà posé dans une discipline. */
function PointsAFlaguer({ points, onFlaguer, onModifier }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="mt-3 border border-trait rounded p-3 bg-surface">
      <button type="button" className="lien text-sm" onClick={() => setOuvert((o) => !o)}>
        Points terrain : modifier ou flaguer ({points.length}) {ouvert ? '▴' : '▾'}
      </button>
      {ouvert && (
        <ul className="mt-2 space-y-3" style={{ listStyle: 'none', padding: 0 }}>
          {points.map((p) => {
            const t = TYPES_OBSERVATION.find((x) => x.valeur === p.type)
            return (
              <li key={p.id}>
                <p className="text-sm text-encre flex items-center gap-2">
                  <Symbole code={p.symbole ?? t?.symbole ?? 'point_particulier'} taille={22} badge={disciplineDe(p.discipline)?.couleur} />
                  {t?.libelle ?? 'Point terrain'}
                  {p.description && <span className="text-xs text-sourdine"> · {p.description}</span>}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <ChoixDiscipline compact valeur={p.discipline} onChange={(d) => onFlaguer(p, d)} />
                  <BoutonDiscret type="button" onClick={() => onModifier(p)}>Modifier</BoutonDiscret>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Moyens engagés : changer l'état d'un moyen (en route, sur place, disponible, retiré) ou le déplacer. */
function MoyensEngages({ moyens, onStatut, onDeplacer, onModifier }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="border border-trait rounded p-3 bg-surface">
      <button type="button" className="lien text-sm" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        Moyens engagés ({moyens.length}) {ouvert ? '▴' : '▾'}
      </button>
      {ouvert &&
        (moyens.length === 0 ? (
          <p className="text-xs text-sourdine mt-2">Aucun moyen engagé. Utilisez « + Moyen engagé » en haut de la page.</p>
        ) : (
          <ul className="mt-2 space-y-3" style={{ listStyle: 'none', padding: 0 }}>
            {moyens.map((m) => {
              const d = disciplineDe(m.discipline)
              return (
                <li key={m.id}>
                  <p className="text-sm text-encre flex items-center gap-2">
                    <Symbole code={m.symbole} taille={24} badge={d?.couleur} />
                    <span>
                      {m.libelle}
                      <span className="text-xs text-sourdine">
                        {m.effectif != null ? ` · ${m.effectif} pers.` : ''}
                        {d ? ` · ${d.court}` : ''}
                        {m.latitude == null ? ' · sans position' : ''}
                      </span>
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <select value={m.statut} onChange={(e) => onStatut(m, e.target.value)} style={{ width: 'auto', fontSize: 13 }} aria-label={`État de ${m.libelle}`}>
                      {Object.entries(STATUTS_MOYEN).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <BoutonDiscret type="button" onClick={() => onModifier(m)}>Modifier</BoutonDiscret>
                    <BoutonDiscret type="button" onClick={() => onDeplacer(m)}>{m.latitude == null ? 'Positionner' : 'Déplacer'}</BoutonDiscret>
                  </div>
                </li>
              )
            })}
          </ul>
        ))}
    </div>
  )
}

function FormulaireMoyen({ contexteId, incidentId, selection, onPosition, onAnnuler, onEnvoyer, existant = null }) {
  const [symbole, setSymbole] = useState(existant?.symbole ?? 'autopompe')
  const [libelle, setLibelle] = useState(existant?.libelle ?? '')
  const [discipline, setDiscipline] = useState(existant ? existant.discipline ?? null : symboleDe('autopompe')?.discipline ?? null)
  const [effectif, setEffectif] = useState(existant?.effectif != null ? String(existant.effectif) : '')
  const [statut, setStatut] = useState(existant?.statut ?? 'sur_place')
  const [remarque, setRemarque] = useState(existant?.remarque ?? '')
  const [enCours, setEnCours] = useState(false)

  async function envoyer(e) {
    e.preventDefault()
    if (!selection || !libelle.trim()) return
    setEnCours(true)
    if (existant) {
      const res = await fileEcritures.ecrireOuEmpiler({
        nature: 'update',
        table: 'moyens_engages',
        id: existant.id,
        champs: {
          symbole,
          libelle: libelle.trim(),
          discipline,
          effectif: effectif === '' ? null : Math.max(0, Number(effectif) || 0),
          statut,
          remarque: remarque.trim() || null,
          latitude: selection.lat,
          longitude: selection.lon,
          precision_m: selection.precision_m ?? null,
          maj_le: new Date().toISOString(),
        },
        libelle: `Moyen modifié · ${libelle.trim()}`,
      })
      setEnCours(false)
      await onEnvoyer(res, 'Moyen modifié')
      return
    }
    const res = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'moyens_engages',
      champs: {
        contexte_id: contexteId,
        incident_id: incidentId,
        symbole,
        libelle: libelle.trim(),
        discipline,
        effectif: effectif === '' ? null : Math.max(0, Number(effectif) || 0),
        statut,
        remarque: remarque.trim() || null,
        latitude: selection.lat,
        longitude: selection.lon,
        precision_m: selection.precision_m ?? null,
      },
      libelle: `Moyen engagé · ${libelle.trim()}`,
    })
    setEnCours(false)
    await onEnvoyer(res, 'Moyen engagé enregistré')
  }

  return (
    <form onSubmit={envoyer} className="mb-3 space-y-3 border border-trait rounded p-3 bg-surface">
      <p className="etiquette">{existant ? 'Modifier le moyen engagé' : 'Nouveau moyen engagé'}</p>
      <PaletteSymboles
        titre="Symbole"
        categories={['moyen', 'poste']}
        valeur={symbole}
        sansDefaut
        onChange={(code) => {
          const choisi = code ?? 'moyen_autre'
          setSymbole(choisi)
          // La discipline suit le symbole (pompiers D1, médical D2…) tant qu'on ne la change pas à la main.
          const d = symboleDe(choisi)?.discipline
          if (d) setDiscipline(d)
        }}
      />
      <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Nom du moyen (ex. P1 Visé, Amb 12)" className="w-full" required />
      <div>
        <p className="text-xs text-sourdine mb-1">Discipline</p>
        <ChoixDiscipline valeur={discipline} onChange={setDiscipline} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min="0" inputMode="numeric" value={effectif} onChange={(e) => setEffectif(e.target.value)} placeholder="Effectif" />
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="État">
          {Object.entries(STATUTS_MOYEN).filter(([v]) => v !== 'retire').map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <input value={remarque} onChange={(e) => setRemarque(e.target.value)} placeholder="Remarque (facultatif)" className="w-full" />
      <BoutonMaPosition onPosition={onPosition} />
      <p className="text-xs text-sourdine">
        {selection
          ? `Position : ${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}${selection.precision_m ? ` (±${Math.round(selection.precision_m)} m)` : ''}`
          : "Touchez la carte à l'endroit voulu (juste en dessous), ou utilisez votre position."}
      </p>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={!selection || !libelle.trim() || enCours}>
          {enCours ? 'Envoi…' : existant ? 'Enregistrer les modifications' : 'Enregistrer le moyen'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
      {existant && (
        <div className="border-t border-trait pt-2">
          <BoutonDiscret
            type="button"
            disabled={enCours}
            onClick={async () => {
              setEnCours(true)
              const res = await fileEcritures.ecrireOuEmpiler({
                nature: 'update',
                table: 'moyens_engages',
                id: existant.id,
                champs: { statut: 'retire', maj_le: new Date().toISOString() },
                libelle: `Moyen retiré · ${existant.libelle}`,
              })
              setEnCours(false)
              await onEnvoyer(res, 'Moyen retiré de la carte')
            }}
          >
            Retirer ce moyen
          </BoutonDiscret>
        </div>
      )}
    </form>
  )
}
