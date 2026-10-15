import { useCallback, useEffect, useRef, useState } from 'react'
import { DISCIPLINES, SelecteurLocalisation, disciplineDe, ilYA, lienItineraire } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { useChargementPeriodique, useEnLigne } from '../hooks/useChargementPeriodique'

/**
 * Outils du Dir PC-Ops sur le terrain : ce qui lui revient (appels d'aide de ses équipes, demandes des
 * disciplines), ce qu'il décide (zones d'intervention) et la vue d'ensemble de son incident.
 *
 * Doctrine : un état ancien n'est jamais présenté comme à jour (bannière de fraîcheur) ; une écriture hors
 * réseau se met en file et se dit ; une réquisition est un acte légal du bourgmestre ou du gouverneur — ici on
 * en DEMANDE une (le CC la reçoit dans son livre de bord), on n'en crée pas.
 */

const heure = (d) => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

const verifier = (...reponses) => {
  const e = reponses.find((r) => r?.error)
  if (e) throw new Error(e.error.message)
}

function Retour({ res }) {
  if (!res) return null
  if (res.statut === 'refus') return <p className="message erreur">{res.message}</p>
  if (res.statut === 'enfile') return <p className="message">Enregistré : part dès que le réseau revient.</p>
  return null
}

/* ------------------------------------------------------------------ */
/* Fraîcheur des données                                               */

/** Dit toujours depuis quand l'état affiché date ; rouge dès qu'il est périmé. */
export function BandeauFraicheur({ majLe, echec }) {
  const enLigne = useEnLigne()
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [])
  const perime = !!echec || !enLigne || (majLe != null && Date.now() - majLe > 90000)
  if (perime) {
    return (
      <p role="alert" className="text-sm rounded p-2" style={{ background: '#b91c1c', color: '#fff' }}>
        {majLe ? `⚠ Données non rafraîchies depuis ${heure(majLe)}` : '⚠ Données indisponibles'}
        {!enLigne ? ' (pas de réseau)' : echec ? ` (${echec})` : ''}
        {majLe ? ' : dernier état connu, ne vous y fiez pas pour décider.' : ' : ne concluez rien de l’absence d’information.'}
      </p>
    )
  }
  return <p className="text-xs text-sourdine">{majLe ? `À jour à ${heure(majLe)}` : 'Chargement…'}</p>
}

/* ------------------------------------------------------------------ */
/* Appels d'aide des équipes                                           */

const LIBELLE_NIVEAU = { attention: "Besoin d'aide", urgent: 'URGENT', mayday: 'MAYDAY' }
const COULEUR_NIVEAU = { attention: '#d97706', urgent: '#b91c1c', mayday: '#7f1d1d' }
const SUITE_STATUT = { ouverte: 'vue', vue: 'prise_en_charge', prise_en_charge: 'close' }
const ACTION_STATUT = { ouverte: 'Marquer comme vu', vue: 'Prendre en charge', prise_en_charge: 'Clore' }
const LIBELLE_STATUT = { ouverte: 'pas encore vu', vue: 'vu', prise_en_charge: 'pris en charge' }
const RAPPEL_VIBRATION_MS = 60000

function vibrer() {
  try {
    navigator.vibrate?.([400, 200, 400, 200, 400])
  } catch {
    /* appareil sans vibreur */
  }
}

/**
 * Appels d'aide ouverts des autres intervenants, en tête de l'écran : bandeau rouge, vibration à l'arrivée
 * d'un nouvel appel puis rappel chaque minute tant qu'un appel n'est pas marqué « vu ». N'affiche rien
 * quand il n'y a rien. (Le navigateur peut refuser de vibrer tant que l'écran n'a pas été touché.)
 */
export function BandeauAppelsAide({ incidentId }) {
  const { utilisateur } = useAuth()
  const charger = useCallback(async () => {
    const r = await supabase
      .from('alertes_aide')
      .select('id, auteur_id, role_libelle, niveau, message, latitude, longitude, precision_m, statut, created_at')
      .eq('incident_id', incidentId)
      .neq('statut', 'close')
      .order('created_at', { ascending: false })
    verifier(r)
    return r.data ?? []
  }, [incidentId])
  const { donnees, majLe, echec, depuisCache, recharger } = useChargementPeriodique({ cle: `aides.${incidentId}`, charger, intervalle: 15000 })
  const [surcharge, setSurcharge] = useState({})
  const [res, setRes] = useState(null)
  const dejaVus = useRef(new Set())

  const appels = (donnees ?? [])
    .filter((a) => a.auteur_id !== utilisateur?.id)
    .map((a) => ({ ...a, statut: surcharge[a.id] ?? a.statut }))
    .filter((a) => a.statut !== 'close')
  const appelsRef = useRef(appels)
  appelsRef.current = appels

  // Vibration : une fois par nouvel appel (pas pour un état simplement relu depuis l'appareil)
  useEffect(() => {
    if (depuisCache) return
    const nouveaux = appelsRef.current.filter((a) => a.statut === 'ouverte' && !dejaVus.current.has(a.id))
    if (nouveaux.length > 0) {
      nouveaux.forEach((a) => dejaVus.current.add(a.id))
      vibrer()
    }
  }, [donnees, depuisCache])

  // Rappel tant qu'un appel reste « pas encore vu »
  useEffect(() => {
    const t = setInterval(() => {
      if (appelsRef.current.some((a) => a.statut === 'ouverte')) vibrer()
    }, RAPPEL_VIBRATION_MS)
    return () => clearInterval(t)
  }, [])

  async function avancer(a) {
    const suite = SUITE_STATUT[a.statut]
    if (!suite) return
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'update',
      table: 'alertes_aide',
      id: a.id,
      champs: { statut: suite, maj_le: new Date().toISOString() },
      libelle: `Appel d'aide · ${suite}`,
    })
    setRes(r)
    if (r.statut !== 'refus') {
      setSurcharge((p) => ({ ...p, [a.id]: suite }))
      recharger()
    }
  }

  if (appels.length === 0) return null

  return (
    <div className="space-y-2" role="alert" aria-live="assertive">
      {echec && <p className="text-xs text-chaud">Liste non rafraîchie depuis {majLe ? heure(majLe) : '…'} ({echec}) : d&apos;autres appels ont pu arriver.</p>}
      {appels.map((a) => (
        <div key={a.id} className="rounded p-3" style={{ background: COULEUR_NIVEAU[a.niveau] ?? '#b91c1c', color: '#fff' }}>
          <p className="text-sm font-semibold">
            🆘 {LIBELLE_NIVEAU[a.niveau] ?? a.niveau} · {a.role_libelle ?? 'intervenant'} · {ilYA(a.created_at)}
          </p>
          {a.message && <p className="text-sm mt-1">{a.message}</p>}
          <p className="text-xs mt-1" style={{ opacity: 0.9 }}>
            {LIBELLE_STATUT[a.statut] ?? a.statut}
            {a.latitude != null ? (
              <>
                {' · '}
                <a href={lienItineraire(a.latitude, a.longitude)} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>
                  position ±{Math.round(a.precision_m ?? 0)} m ↗
                </a>
              </>
            ) : (
              ' · position inconnue'
            )}
          </p>
          <div className="mt-2">
            <button type="button" onClick={() => avancer(a)} style={{ background: '#fff', color: '#7f1d1d', border: 0, borderRadius: 6, padding: '10px 14px', fontSize: 14, fontWeight: 600, minHeight: 44 }}>
              {ACTION_STATUT[a.statut]}
            </button>
          </div>
        </div>
      ))}
      <Retour res={res} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Demandes des disciplines (« je demande » des rapports C.A.N.)        */

const LIBELLE_SUITE = { a_traiter: 'à traiter', prise_en_compte: 'prise en compte' }

/**
 * Les « je demande » des rapports C.A.N. non encore traités, avec leur suite : à traiter → prise en compte →
 * satisfaite (ou écartée). Le CC voit le même statut. `masquerSiVide` : n'occupe aucune place quand il n'y a rien.
 */
export function DemandesATraiter({ incidentId, masquerSiVide = false }) {
  const { utilisateur } = useAuth()
  const charger = useCallback(async () => {
    const r = await supabase
      .from('rapports_can')
      .select('id, role_libelle, auteur_id, je_demande, suite_statut, created_at, latitude, longitude')
      .eq('incident_id', incidentId)
      .not('je_demande', 'is', null)
      .in('suite_statut', ['a_traiter', 'prise_en_compte'])
      .order('created_at', { ascending: false })
      .limit(30)
    verifier(r)
    return (r.data ?? []).filter((d) => d.je_demande?.trim())
  }, [incidentId])
  const { donnees, majLe, echec, recharger } = useChargementPeriodique({ cle: `demandes.${incidentId}`, charger, intervalle: 20000 })
  const [surcharge, setSurcharge] = useState({})
  const [res, setRes] = useState(null)

  const lignes = (donnees ?? [])
    .map((d) => ({ ...d, suite_statut: surcharge[d.id] ?? d.suite_statut }))
    .filter((d) => d.suite_statut === 'a_traiter' || d.suite_statut === 'prise_en_compte')

  async function traiter(d, statut) {
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'update',
      table: 'rapports_can',
      id: d.id,
      champs: { suite_statut: statut },
      libelle: `Demande · ${statut}`,
    })
    setRes(r)
    if (r.statut !== 'refus') {
      setSurcharge((p) => ({ ...p, [d.id]: statut }))
      recharger()
    }
  }

  if (masquerSiVide && lignes.length === 0 && !echec) return null

  return (
    <div className="space-y-2">
      <h2>Demandes à traiter{lignes.length > 0 ? ` (${lignes.length})` : ''}</h2>
      <p className="text-xs text-sourdine">Ce que les équipes demandent dans leurs rapports C.A.N. Le CC voit la même suite.</p>
      {echec && <p className="text-xs text-chaud">Liste non rafraîchie depuis {majLe ? heure(majLe) : '…'} ({echec}).</p>}
      {lignes.length === 0 ? (
        !echec && <p className="vide border border-dashed border-trait text-center p-3">Aucune demande en attente.</p>
      ) : (
        <ul className="space-y-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {lignes.map((d) => (
            <li key={d.id} className="carte">
              <p className="text-sm text-encre">{d.je_demande}</p>
              <p className="text-xs text-sourdine mt-1">
                {d.role_libelle ?? 'intervenant'}
                {d.auteur_id === utilisateur?.id ? ' (vous)' : ''} · {ilYA(d.created_at)} · {LIBELLE_SUITE[d.suite_statut]}
                {d.latitude != null && (
                  <>
                    {' · '}
                    <a href={lienItineraire(d.latitude, d.longitude)} target="_blank" rel="noreferrer" className="underline">position ↗</a>
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {d.suite_statut === 'a_traiter' && (
                  <button type="button" className="discret" onClick={() => traiter(d, 'prise_en_compte')}>Prise en compte</button>
                )}
                <button type="button" className="principal" onClick={() => traiter(d, 'satisfaite')}>Satisfaite</button>
                <button type="button" className="discret" onClick={() => traiter(d, 'ecartee')}>Écarter</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Retour res={res} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Zones d'intervention                                                */

const TYPES_ZONE = [
  { valeur: 'rouge', libelle: 'Rouge — exclusion', perimetre: 'exclusion', couleur: '#c0392b' },
  { valeur: 'orange', libelle: 'Orange — isolation', perimetre: 'isolation', couleur: '#e67e22' },
  { valeur: 'jaune', libelle: 'Jaune — dissuasion', perimetre: 'dissuasion', couleur: '#d4ac0d' },
]
const ACCES_PAR_TYPE_ZONE = {
  rouge: "Exclusivement services d'intervention, experts, techniciens. Population évacuée ou consignes spécifiques (fermer portes/fenêtres).",
  orange: "Services d'intervention + résidents/travailleurs sur accord explicite du Dir-PC-Ops. PC-Ops positionné juste à l'intérieur du périmètre.",
  jaune: 'Accès déconseillé aux non-résidents/non-travailleurs sauf décision PC-Ops. Trafic de transit détourné, "touristes de catastrophe" écartés.',
}

/** Zones actives de l'incident : en créer une (position sur la carte ou position actuelle), la lever. Passe par la file hors ligne. */
export function ZonesIntervention({ incident }) {
  const charger = useCallback(async () => {
    const r = await supabase
      .from('zones_intervention')
      .select('id, type_zone, perimetre, centre_latitude, centre_longitude, rayon_metres, acces_autorise, date_etablissement')
      .eq('incident_id', incident.id)
      .is('date_levee', null)
      .order('date_etablissement', { ascending: true })
    verifier(r)
    return r.data ?? []
  }, [incident.id])
  const { donnees, majLe, echec, recharger } = useChargementPeriodique({ cle: `zones.${incident.id}`, charger, intervalle: 30000 })
  const [ouvert, setOuvert] = useState(false)
  const [type, setType] = useState('rouge')
  const [rayon, setRayon] = useState('')
  const [acces, setAcces] = useState(ACCES_PAR_TYPE_ZONE.rouge)
  const [lat, setLat] = useState(null)
  const [lon, setLon] = useState(null)
  const [levees, setLevees] = useState({})
  const [enCours, setEnCours] = useState(false)
  const [res, setRes] = useState(null)
  const [invalide, setInvalide] = useState(null)

  const zones = (donnees ?? []).filter((z) => !levees[z.id])
  const centreIncident = incident.latitude != null && incident.longitude != null ? { lat: Number(incident.latitude), lon: Number(incident.longitude) } : undefined

  function changerType(v) {
    setType(v)
    setAcces(ACCES_PAR_TYPE_ZONE[v])
  }

  async function creer(e) {
    e.preventDefault()
    if (lat == null || lon == null) return setInvalide('Placez le centre de la zone sur la carte (ou utilisez votre position).')
    if (!(Number(rayon) > 0)) return setInvalide('Indiquez un rayon en mètres.')
    setInvalide(null)
    setEnCours(true)
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'zones_intervention',
      champs: {
        incident_id: incident.id,
        type_zone: type,
        perimetre: TYPES_ZONE.find((t) => t.valeur === type).perimetre,
        centre_latitude: Number(lat),
        centre_longitude: Number(lon),
        rayon_metres: Number(rayon),
        acces_autorise: acces.trim() || null,
      },
      libelle: `Zone ${type}`,
    })
    setEnCours(false)
    setRes(r)
    if (r.statut !== 'refus') {
      setOuvert(false)
      setRayon('')
      setLat(null)
      setLon(null)
      recharger()
    }
  }

  async function lever(z) {
    if (!window.confirm(`Lever la zone ${z.type_zone} ?`)) return
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'update',
      table: 'zones_intervention',
      id: z.id,
      champs: { date_levee: new Date().toISOString() },
      libelle: `Lever zone ${z.type_zone}`,
    })
    setRes(r)
    if (r.statut !== 'refus') {
      setLevees((p) => ({ ...p, [z.id]: true }))
      recharger()
    }
  }

  const cercles = zones
    .filter((z) => z.centre_latitude != null && z.rayon_metres)
    .map((z) => ({ id: z.id, lat: Number(z.centre_latitude), lon: Number(z.centre_longitude), rayonM: Number(z.rayon_metres), couleur: TYPES_ZONE.find((t) => t.valeur === z.type_zone)?.couleur, libelle: z.type_zone }))

  return (
    <div className="space-y-2">
      <h2>Zones d&apos;intervention</h2>
      {echec && <p className="text-xs text-chaud">Liste non rafraîchie depuis {majLe ? heure(majLe) : '…'} ({echec}).</p>}
      {zones.length === 0 ? (
        !echec && <p className="vide border border-dashed border-trait text-center p-3">Aucune zone active.</p>
      ) : (
        <ul className="space-y-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {zones.map((z) => (
            <li key={z.id} className="carte">
              <p className="text-sm font-medium text-encre">
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: TYPES_ZONE.find((t) => t.valeur === z.type_zone)?.couleur, marginRight: 6 }} />
                {TYPES_ZONE.find((t) => t.valeur === z.type_zone)?.libelle ?? z.type_zone}
                {z.rayon_metres ? ` · rayon ${Math.round(z.rayon_metres)} m` : ''}
              </p>
              {z.acces_autorise && <p className="text-xs text-sourdine mt-1">{z.acces_autorise}</p>}
              <div className="mt-2">
                <button type="button" className="discret" onClick={() => lever(z)}>Lever la zone</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!ouvert ? (
        <button type="button" className="bouton-terrain discret" onClick={() => setOuvert(true)}>+ Nouvelle zone</button>
      ) : (
        <form onSubmit={creer} className="carte space-y-3">
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Type de zone</label>
            <select value={type} onChange={(e) => changerType(e.target.value)} className="w-full">
              {TYPES_ZONE.map((t) => (
                <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Centre — touchez la carte ou utilisez votre position</label>
            <SelecteurLocalisation
              lat={lat}
              lon={lon}
              onChange={(la, lo) => { setLat(la); setLon(lo) }}
              centreDefaut={centreIncident}
              zoomDefaut={centreIncident ? 15 : 8}
              cercles={[
                ...cercles,
                ...(lat != null && Number(rayon) > 0
                  ? [{ id: 'apercu', lat: Number(lat), lon: Number(lon), rayonM: Number(rayon), couleur: TYPES_ZONE.find((t) => t.valeur === type).couleur, libelle: 'Cette zone' }]
                  : []),
              ]}
              hauteur="260px"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Rayon (m)</label>
            <input type="number" min="0" inputMode="numeric" value={rayon} onChange={(e) => setRayon(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Règles d&apos;accès</label>
            <textarea value={acces} onChange={(e) => setAcces(e.target.value)} rows={3} className="w-full" />
          </div>
          {invalide && <p className="message erreur">{invalide}</p>}
          <div className="flex gap-2">
            <button type="submit" className="principal" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Établir la zone'}</button>
            <button type="button" className="discret" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
          </div>
        </form>
      )}
      <Retour res={res} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Réquisitions : on en demande, on n'en crée pas                       */

function RequisitionsEtDemande({ incidentId, requisitions }) {
  const [ouvert, setOuvert] = useState(false)
  const [objet, setObjet] = useState('')
  const [beneficiaire, setBeneficiaire] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [res, setRes] = useState(null)

  async function demander(e) {
    e.preventDefault()
    if (!objet.trim()) return
    setEnCours(true)
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'livre_de_bord',
      champs: {
        incident_id: incidentId,
        message: `[Terrain] [Demande de réquisition] ${objet.trim()}${beneficiaire.trim() ? ` — bénéficiaire : ${beneficiaire.trim()}` : ''}`,
      },
      libelle: 'Demande de réquisition',
    })
    setEnCours(false)
    setRes(r)
    if (r.statut !== 'refus') {
      setObjet('')
      setBeneficiaire('')
      setOuvert(false)
    }
  }

  return (
    <div className="space-y-2">
      <h2>Réquisitions</h2>
      {requisitions.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-3">Aucune réquisition active.</p>
      ) : (
        <ul className="space-y-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {requisitions.map((r) => (
            <li key={r.id} className="carte text-sm">
              <p className="text-encre">{r.objet}</p>
              <p className="text-xs text-sourdine mt-1">
                {r.type_requisition} · décrétée par {r.autorite_decretante}{r.beneficiaire ? ` · pour ${r.beneficiaire}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-sourdine">
        Une réquisition est décrétée par le bourgmestre ou le gouverneur. Ici, vous la demandez : la demande arrive dans le livre de bord du CC.
      </p>
      {!ouvert ? (
        <button type="button" className="bouton-terrain discret" onClick={() => setOuvert(true)}>Demander une réquisition</button>
      ) : (
        <form onSubmit={demander} className="carte space-y-2">
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Que faut-il requérir ?</label>
            <textarea value={objet} onChange={(e) => setObjet(e.target.value)} rows={3} className="w-full" placeholder="ex. 2 camions-citernes, engins de terrassement…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Pour qui / où (facultatif)</label>
            <input value={beneficiaire} onChange={(e) => setBeneficiaire(e.target.value)} className="w-full" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="principal" disabled={enCours || !objet.trim()}>{enCours ? 'Envoi…' : 'Envoyer la demande au CC'}</button>
            <button type="button" className="discret" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
          </div>
        </form>
      )}
      <Retour res={res} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Vue d'ensemble                                                      */

const CATEGORIES_COMPTAGE = [
  ['evacues', 'Évacués'],
  ['accueillis', 'Accueillis'],
  ['blesses', 'Blessés'],
  ['personnes_a_risque', 'Personnes à risque'],
  ['introuvables', 'Introuvables'],
]
const SEUIL_RELEVE_H = 4 // repère d'organisation, pas une règle

function Tuile({ valeur, libelle, sous, alerte = false }) {
  return (
    <div className={`border rounded p-3 text-center bg-surface ${alerte ? 'border-chaud' : 'border-trait'}`}>
      <p className={`text-2xl font-semibold ${alerte ? 'text-chaud' : 'text-encre'}`}>{valeur}</p>
      <p className="text-xs text-sourdine">{libelle}</p>
      {sous && <p className="text-xs text-sourdine mt-0.5">{sous}</p>}
    </div>
  )
}

function duree(depuis) {
  const min = Math.max(0, Math.round((Date.now() - new Date(depuis).getTime()) / 60000))
  const j = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  return `${j ? `${j} j ` : ''}${h || j ? `${h} h ` : ''}${String(min % 60).padStart(2, '0')} min`.trim()
}

/** Pour chaque déclarant et chaque catégorie on retient le dernier chiffre (lignes de la plus récente à la plus ancienne), puis on additionne. */
function totauxComptages(lignes) {
  const vus = new Set()
  const totaux = Object.fromEntries(CATEGORIES_COMPTAGE.map(([c]) => [c, 0]))
  for (const l of lignes) {
    const k = `${l.categorie}|${l.auteur_id}`
    if (vus.has(k)) continue
    vus.add(k)
    totaux[l.categorie] = (totaux[l.categorie] ?? 0) + l.nombre
  }
  return totaux
}

/** Onglet « Commandement » : l'incident d'un coup d'œil, puis ce qu'il y a à traiter et à décider. */
export function VueCommandement({ incident }) {
  const { utilisateur } = useAuth()
  const charger = useCallback(async () => {
    const id = incident.id
    const [sitrep, moyens, aides, demandes, comptages, requisitions] = await Promise.all([
      supabase.from('sitreps').select('numero, horodatage').eq('incident_id', id).order('numero', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('moyens_engages').select('id, discipline, statut, effectif, created_at').eq('incident_id', id).neq('statut', 'retire'),
      supabase.from('alertes_aide').select('id, auteur_id').eq('incident_id', id).neq('statut', 'close'),
      supabase.from('rapports_can').select('id, je_demande').eq('incident_id', id).in('suite_statut', ['a_traiter', 'prise_en_compte']).not('je_demande', 'is', null),
      supabase.from('comptages_personnes').select('categorie, nombre, auteur_id, created_at').eq('incident_id', id).order('created_at', { ascending: false }),
      supabase.from('requisitions').select('id, objet, type_requisition, autorite_decretante, beneficiaire').eq('incident_id', id).eq('statut', 'actif'),
    ])
    verifier(sitrep, moyens, aides, demandes, comptages, requisitions)
    return {
      sitrep: sitrep.data,
      moyens: moyens.data ?? [],
      aides: (aides.data ?? []).filter((a) => a.auteur_id !== utilisateur?.id).length,
      demandes: (demandes.data ?? []).filter((d) => d.je_demande?.trim()).length,
      comptages: comptages.data ?? [],
      requisitions: requisitions.data ?? [],
    }
  }, [incident.id, utilisateur?.id])
  const { donnees: d, majLe, echec, recharger } = useChargementPeriodique({ cle: `commandement.${incident.id}`, charger, intervalle: 30000 })

  const totaux = d ? totauxComptages(d.comptages) : null
  const effectifTotal = d ? d.moyens.reduce((s, m) => s + (m.effectif ?? 0), 0) : 0
  const parDiscipline = d
    ? [...DISCIPLINES.map((x) => x.valeur), null]
        .map((v) => {
          const lignes = d.moyens.filter((m) => (disciplineDe(m.discipline) ? m.discipline : null) === v)
          return { v, lignes, effectif: lignes.reduce((s, m) => s + (m.effectif ?? 0), 0) }
        })
        .filter((x) => x.lignes.length > 0)
    : []
  const aRelever = d ? d.moyens.filter((m) => (m.statut === 'sur_place' || m.statut === 'en_route') && m.created_at && (Date.now() - new Date(m.created_at).getTime()) / 3600000 >= SEUIL_RELEVE_H).length : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <BandeauFraicheur majLe={majLe} echec={echec} />
        <button type="button" className="discret" onClick={recharger}>Actualiser</button>
      </div>

      {d && (
        <>
          <div>
            <p className="text-sm text-encre">
              Depuis {incident.date_debut ? <><strong>{duree(incident.date_debut)}</strong> ({heure(incident.date_debut)})</> : '—'}
            </p>
            <p className="text-sm text-sourdine">
              {d.sitrep ? `Dernier SitRep n°${d.sitrep.numero} · ${ilYA(d.sitrep.horodatage)}` : 'Aucun SitRep établi pour l’instant.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Tuile valeur={d.moyens.length} libelle="moyens engagés" sous={`${effectifTotal} personnes${aRelever ? ` · ${aRelever} à relever ?` : ''}`} />
            <Tuile valeur={d.demandes} libelle="demandes à traiter" alerte={d.demandes > 0} />
            <Tuile valeur={d.aides} libelle="appels d’aide ouverts" alerte={d.aides > 0} />
            <Tuile valeur={d.requisitions.length} libelle="réquisitions actives" />
          </div>
        </>
      )}

      <DemandesATraiter incidentId={incident.id} />

      {d && parDiscipline.length > 0 && (
        <div className="space-y-2">
          <h2>Moyens par discipline</h2>
          <ul className="carte divide-y divide-trait">
            {parDiscipline.map((x) => {
              const disc = disciplineDe(x.v)
              const surPlace = x.lignes.filter((m) => m.statut === 'sur_place').length
              const enRoute = x.lignes.filter((m) => m.statut === 'en_route').length
              return (
                <li key={x.v ?? 'autre'} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <span className="text-encre">
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: disc?.couleur ?? '#7f8c8d', marginRight: 6 }} />
                    {disc?.libelle ?? 'Sans discipline'}
                  </span>
                  <span className="text-sourdine text-xs text-right">
                    {x.lignes.length} moyen{x.lignes.length > 1 ? 's' : ''} · {x.effectif} pers.
                    {surPlace || enRoute ? ` · ${surPlace} sur place, ${enRoute} en route` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {totaux && d.comptages.length > 0 && (
        <div className="space-y-2">
          <h2>Personnes comptées par le terrain</h2>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES_COMPTAGE.filter(([c]) => c !== 'personnes_a_risque' || totaux[c] > 0).map(([cle, lib]) => (
              <Tuile key={cle} valeur={totaux[cle]} libelle={lib} alerte={cle === 'introuvables' && totaux[cle] > 0} />
            ))}
          </div>
          <p className="text-xs text-sourdine">Déclarations de terrain : deux équipes peuvent compter les mêmes personnes.</p>
        </div>
      )}

      <ZonesIntervention incident={incident} />

      {d && <RequisitionsEtDemande incidentId={incident.id} requisitions={d.requisitions} />}
    </div>
  )
}
