import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CarteCrise,
  FiltreIncidentsCarte,
  DISCIPLINES,
  disciplineDe,
  LegendeSymboles,
  TYPES_OBSERVATION,
  STATUTS_MOYEN,
  FormulaireObservation,
  FormulaireMoyen,
  FormulaireLocalisation,
  PointsAFlaguer,
  MoyensEngages,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { useIncidentsEnCours } from '../hooks/useIncidentsEnCours'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

export { TYPES_OBSERVATION, STATUTS_MOYEN }

// Écritures du terrain : d'abord dans le téléphone, envoyées dès qu'il y a du réseau.
const ecrire = (operation) => fileEcritures.ecrireOuEmpiler(operation)

// Couches de référentiel : lecture seule ici. Leur localisation (fiches sans
// coordonnées) se fait dans l'app Admin, page « Carte » — pas sur le terrain.
const COUCHES = [
  { cle: 'incidents', libelle: 'Incidents en cours', couleur: '#b91c1c', table: null, symbole: 'sinistre_foyer' },
  { cle: 'observations', libelle: 'Points terrain', couleur: '#be123c', table: null },
  { cle: 'moyens', libelle: 'Moyens engagés', couleur: '#8e2a8e', table: null, symbole: 'moyen_autre' },
  { cle: 'objets_a_risque', libelle: 'Objets à risque', couleur: '#dc5a3c', symbole: 'danger_risque', table: 'objets_a_risque', champNom: 'identification', champSous: 'categorie' },
  { cle: 'centres_accueil', libelle: "Centres d'accueil", couleur: '#2563eb', symbole: 'infra_ca', table: 'centres_accueil', champNom: 'nom', champSous: 'type_lieu' },
  { cle: 'sites_qg', libelle: 'Sites CC', couleur: '#7c3aed', symbole: 'pc_ops', table: 'sites_qg', champNom: 'nom' },
  { cle: 'infrastructures_critiques', libelle: 'Infrastructures critiques', couleur: '#b45309', symbole: 'sensible_noir', table: 'infrastructures_critiques', champNom: 'nom', champSous: 'type' },
  { cle: 'signalements_citoyens', libelle: 'Signalements citoyens', couleur: '#059669', table: null },
]

/**
 * Carte Terrain : même outil que le CC (composant partagé CarteCrise), avec
 * en plus ce qu'on peut compléter depuis le terrain :
 *  - ajouter un point (danger, route coupée, besoin…) à l'endroit où l'on se trouve
 *    ou touché sur la carte ;
 *  - positionner / déplacer un moyen engagé.
 * Les référentiels (objets à risque, centres d'accueil…) sont en lecture seule :
 * les localiser est un travail d'Admin. Les écritures passent par la file d'écritures hors ligne : un point saisi sans
 * réseau part tout seul au retour de la couverture.
 */
export default function Carte() {
  const { contexteId } = useAuth()
  const [couches, setCouches] = useState(() => Object.fromEntries(COUCHES.map((c) => [c.cle, true])))
  const [donnees, setDonnees] = useState({})
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

    const [obj, cen, sit, inf, sig, inc, obs, moy] = await Promise.all([
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
    ])

    const premiereErreur = [obj, cen, sit, inf, sig, inc, obs, moy].find((r) => r.error)
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
          ecrire={ecrire}
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
          ecrire={ecrire}
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
          ecrire={ecrire}
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

          <LegendeSymboles />
        </div>
      )}
    </div>
  )
}







