import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CarteCrise,
  FiltreIncidentsCarte,
  DISCIPLINES,
  disciplineDe,
  LegendeSymboles,
  STATUTS_MOYEN,
  FormulaireObservation,
  FormulaireMoyen,
  FormulaireLocalisation,
  PointsAFlaguer,
  MoyensEngages,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

// Centre de la Belgique — repli quand aucun point n'est encore géolocalisé
// pour ce contexte, pour ne jamais ouvrir sur une carte vide et sans repère.
const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

const COUCHES = [
  { cle: 'incidents', libelle: 'Incidents en cours', couleur: '#b91c1c', symbole: 'sinistre_foyer' },
  { cle: 'objets_a_risque', libelle: 'Objets à risque', couleur: '#dc5a3c', symbole: 'danger_risque' },
  { cle: 'centres_accueil', libelle: "Centres d'accueil", couleur: '#2563eb', symbole: 'infra_ca' },
  { cle: 'sites_qg', libelle: 'Sites CC', couleur: '#7c3aed', symbole: 'pc_ops' },
  { cle: 'infrastructures_critiques', libelle: 'Infrastructures critiques', couleur: '#b45309', symbole: 'sensible_noir' },
  { cle: 'signalements_citoyens', libelle: 'Signalements citoyens (ouverts)', couleur: '#059669' },
  { cle: 'observations', libelle: 'Points terrain (ouverts)', couleur: '#be123c' },
  { cle: 'moyens', libelle: 'Moyens engagés', couleur: '#8e2a8e', symbole: 'moyen_autre' },
]

// Symbole par défaut d'un point terrain posé avant l'arrivée des symboles (même table que Terrain).
const SYMBOLE_PAR_TYPE = {
  danger: 'danger_noir',
  route_coupee: 'route_barree',
  inondation: 'danger_eau',
  degats: 'danger_risque',
  victimes: 'danger_humain',
  besoin: 'point_particulier',
  point_rassemblement: 'infra_pr',
  acces: 'isolement',
  autre: 'point_particulier',
}

const STATUT_MOYEN = STATUTS_MOYEN

// Au CC on est en ligne : les écritures partent directement (pas de file hors ligne comme sur le terrain).
async function ecrire({ nature, table, champs, id }) {
  const requete = nature === 'insert' ? supabase.from(table).insert(champs) : supabase.from(table).update(champs).eq('id', id)
  const { error } = await requete
  return error ? { statut: 'refus', message: error.message } : { statut: 'ok' }
}

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
 * Carte tactique CC. Les couches de référentiel (objets à risque, centres,
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
  const [disciplinesVues, setDisciplinesVues] = useState(null) // null = toutes
  const [mode, setMode] = useState(null) // null | { type: 'observation'|'moyen', existant? } | { type: 'localiser', element }
  const [selection, setSelection] = useState(null)
  const [info, setInfo] = useState(null)
  const [incidentCible, setIncidentCible] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    setErreur(null)

    const [objets, centres, sites, infra, signalements, incidentsActifs, moyens, observations] = await Promise.all([
      supabase.from('objets_a_risque').select('id, identification, categorie, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('centres_accueil').select('id, nom, type_lieu, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('sites_qg').select('id, nom, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('infrastructures_critiques').select('id, nom, type, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('signalements_citoyens').select('id, reference, type, statut, incident_id, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null).not('statut', 'in', '(clos,sans_suite)'),
      supabase.from('incidents').select('id, nom, type_evenement, latitude, longitude').eq('contexte_id', contexteId).eq('statut', 'en_cours').order('date_debut', { ascending: false }),
      supabase.from('moyens_engages').select('id, symbole, libelle, discipline, effectif, statut, remarque, incident_id, latitude, longitude, maj_le').eq('contexte_id', contexteId).neq('statut', 'retire').order('maj_le', { ascending: false }),
      supabase.from('observations_terrain').select('id, type, description, discipline, symbole, incident_id, latitude, longitude').eq('contexte_id', contexteId).eq('statut', 'ouvert'),
    ])

    const premierErreur = [objets, centres, sites, infra, signalements, incidentsActifs, moyens, observations].find((r) => r.error)
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
      moyens: moyens.data ?? [],
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
        c.cle === 'incidents'
          ? incidentsAffiches.filter((i) => i.latitude != null)
          : (points[c.cle] ?? []).filter((p) => c.cle !== 'signalements_citoyens' && c.cle !== 'observations' && c.cle !== 'moyens' ? true : visible(p) && (c.cle !== 'observations' || disciplineVisible(p.discipline)) && (c.cle !== 'moyens' || p.latitude != null))
      for (const p of source) {
        const d = c.cle === 'observations' || c.cle === 'moyens' ? disciplineDe(p.discipline) : null
        tous.push({
          id: `${c.cle}-${p.id}`,
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          titre: c.cle === 'moyens' ? p.libelle : c.cle === 'observations' ? LIBELLE_OBSERVATION[p.type] ?? c.libelle : p.identification ?? p.nom ?? p.reference ?? c.libelle,
          sousTitre: c.cle === 'moyens' ? [STATUT_MOYEN[p.statut], p.effectif != null ? `${p.effectif} pers.` : null, d?.court, p.remarque].filter(Boolean).join(' · ') : c.cle === 'observations' ? [d?.court, p.description].filter(Boolean).join(' · ') || undefined : p.categorie ?? p.type_lieu ?? p.type ?? p.type_evenement ?? LIBELLE_TYPE_SIGNALEMENT[p.type] ?? undefined,
          couleur: d?.couleur ?? c.couleur,
          symbole: c.cle === 'observations' ? p.symbole ?? SYMBOLE_PAR_TYPE[p.type] ?? 'point_particulier' : c.cle === 'moyens' ? p.symbole : c.symbole,
          badge: d?.couleur,
          onModifier: c.cle === 'observations' ? () => modifierObservation(p) : c.cle === 'moyens' ? () => modifierMoyen(p) : undefined,
        })
      }
    }
    // Le point en cours de modification est remplacé par la pastille de sélection.
    const enEdition = mode?.existant ? `${mode.type === 'moyen' ? 'moyens' : 'observations'}-${mode.existant.id}` : null
    return enEdition ? tous.filter((m) => m.id !== enEdition) : tous
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, couches, incidentsAffiches, ids, disciplinesVues, mode])

  // Incident auquel rattacher un nouveau point : le seul affiché, sinon celui choisi dans la liste.
  const incidentId = incidentsAffiches.length === 1 ? incidentsAffiches[0].id : (incidentsAffiches.find((i) => i.id === incidentCible) ?? incidentsAffiches[0])?.id ?? null

  function fermer() {
    setMode(null)
    setSelection(null)
  }
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
    setInfo(message)
    fermer()
    await charger()
    return true
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h1 className="text-lg font-semibold text-encre">Carte</h1>
        {!mode && (
          <div className="flex flex-wrap gap-2">
            <BoutonPrincipal onClick={() => { setInfo(null); setMode({ type: 'observation' }) }}>+ Point terrain</BoutonPrincipal>
            <BoutonDiscret onClick={() => { setInfo(null); setMode({ type: 'moyen' }) }}>+ Moyen engagé</BoutonDiscret>
          </div>
        )}
      </div>
      <p className="text-sm text-sourdine mb-3">
        Cochez les incidents à voir : un seul pour le suivre de près, tous pour une catastrophe à plusieurs
        incidents. Les référentiels du contexte restent affichés dans les deux cas. On peut aussi poser ou
        corriger un point terrain ou un moyen engagé d'ici.
      </p>

      {info && <p className="text-sm text-ok mb-2">{info}</p>}

      {mode && incidentsAffiches.length > 1 && !mode.existant && mode.type !== 'localiser' && (
        <div className="mb-2 flex items-center gap-2 text-sm">
          <label className="text-xs text-sourdine" htmlFor="incident-cible">Rattacher à l'incident :</label>
          <select id="incident-cible" value={incidentId ?? ''} onChange={(e) => setIncidentCible(e.target.value)} style={{ width: 'auto' }}>
            {incidentsAffiches.map((i) => (
              <option key={i.id} value={i.id}>{i.nom}</option>
            ))}
          </select>
        </div>
      )}

      {mode?.type === 'observation' && (
        <FormulaireObservation
          key={mode.existant?.id ?? 'nouveau'}
          ecrire={ecrire}
          existant={mode.existant ?? null}
          contexteId={contexteId}
          incidentId={mode.existant ? mode.existant.incident_id ?? null : incidentId}
          selection={selection}
          onPosition={setSelection}
          onAnnuler={fermer}
          onEnvoyer={apresEcriture}
        />
      )}
      {mode?.type === 'moyen' && (
        <FormulaireMoyen
          key={mode.existant?.id ?? 'nouveau'}
          ecrire={ecrire}
          existant={mode.existant ?? null}
          contexteId={contexteId}
          incidentId={mode.existant ? mode.existant.incident_id ?? null : incidentId}
          selection={selection}
          onPosition={setSelection}
          onAnnuler={fermer}
          onEnvoyer={apresEcriture}
        />
      )}
      {mode?.type === 'localiser' && (
        <FormulaireLocalisation
          ecrire={ecrire}
          element={mode.element}
          selection={selection}
          onPosition={setSelection}
          onAnnuler={fermer}
          onEnvoyer={apresEcriture}
        />
      )}

      {/* Pendant la pose/modification d'un point : formulaire puis carte, sans filtres entre les deux. */}
      {!mode && (
        <>
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

      {couches.observations && (
        <div className="mb-3">
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
        </>
      )}

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
            selection={selection}
            onClicCarte={mode ? (p) => setSelection(p) : null}
            hauteur={mode ? '50vh' : '65vh'}
          />
          {!mode && (
            <div className="mt-3 space-y-2">
              <MoyensEngages
                moyens={(points.moyens ?? []).filter(visible)}
                onModifier={modifierMoyen}
                onStatut={async (m, statut) => {
                  const res = await ecrire({ nature: 'update', table: 'moyens_engages', id: m.id, champs: { statut, maj_le: new Date().toISOString() } })
                  await apresEcriture(res, `${m.libelle} : ${STATUT_MOYEN[statut].toLowerCase()}`)
                }}
                onDeplacer={(m) => { setInfo(null); setSelection(m.latitude != null ? { lat: Number(m.latitude), lon: Number(m.longitude) } : null); setMode({ type: 'localiser', element: { table: 'moyens_engages', id: m.id, libelle: m.libelle } }) }}
              />
              {(points.observations ?? []).length > 0 && (
                <PointsAFlaguer
                  points={(points.observations ?? []).filter(visible)}
                  onModifier={modifierObservation}
                  onFlaguer={async (p, discipline) => {
                    const res = await ecrire({ nature: 'update', table: 'observations_terrain', id: p.id, champs: { discipline } })
                    await apresEcriture(res, discipline ? `Point flagué ${disciplineDe(discipline).court}` : 'Discipline retirée')
                  }}
                />
              )}
              <LegendeSymboles />
            </div>
          )}
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
