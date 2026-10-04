import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

export default function IncidentDetail() {
  const { id } = useParams()
  const { contexteId } = useAuth()
  const [incident, setIncident] = useState(null)
  const [chargementIncident, setChargementIncident] = useState(true)
  const { lignes: sitesQG } = useTableContexte('sites_qg', contexteId, { tri: 'priorite' })

  const chargerIncident = useCallback(async () => {
    setChargementIncident(true)
    const { data } = await supabase
      .from('incidents')
      .select('*, niveaux_escalade(id, libelle), sites_qg(id, nom)')
      .eq('id', id)
      .single()
    setIncident(data)
    setChargementIncident(false)
  }, [id])

  useEffect(() => {
    chargerIncident()
  }, [chargerIncident])

  async function cloturer() {
    if (!confirm('Clôturer cet incident ?')) return
    await supabase.from('incidents').update({ statut: 'cloture', date_fin: new Date().toISOString() }).eq('id', id)
    chargerIncident()
  }

  async function changerDegreCriticite(valeur) {
    await supabase.from('incidents').update({ degre_criticite: valeur === '' ? null : Number(valeur) }).eq('id', id)
    chargerIncident()
  }

  async function changerSiteQG(valeur) {
    await supabase.from('incidents').update({ site_qg_actuel_id: valeur || null }).eq('id', id)
    chargerIncident()
  }

  async function changerComplexiteType(valeur) {
    await supabase.from('incidents').update({ complexite_type: valeur || null }).eq('id', id)
    chargerIncident()
  }

  async function changerDynamiqueEvenement(valeur) {
    await supabase.from('incidents').update({ dynamique_evenement: valeur || null }).eq('id', id)
    chargerIncident()
  }

  if (chargementIncident) return <p className="text-sm text-sourdine">Chargement…</p>
  if (!incident) return <p className="text-sm text-chaud">Incident introuvable.</p>

  return (
    <div>
      <Link to="/" className="text-sm text-sourdine hover:text-encre">← retour aux incidents</Link>

      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-encre">{incident.nom}</h1>
          <p className="text-sm text-sourdine">
            {incident.type_evenement && <>{incident.type_evenement} · </>}
            {incident.niveaux_escalade?.libelle} · statut : {incident.statut}
            {' · '}phase : {PHASES_CYCLE_VIE.find((p) => p.valeur === incident.phase_cycle_vie)?.libelle ?? incident.phase_cycle_vie}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <label className="text-xs text-sourdine">Degré de criticité :</label>
            <select
              value={incident.degre_criticite ?? ''}
              onChange={(e) => changerDegreCriticite(e.target.value)}
              className=""
            >
              <option value="">—</option>
              <option value="1">1 — faible</option>
              <option value="2">2 — modéré</option>
              <option value="3">3 — sérieux</option>
              <option value="4">4 — majeur</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <label className="text-xs text-sourdine">Site QG actuel :</label>
            <select
              value={incident.site_qg_actuel_id ?? ''}
              onChange={(e) => changerSiteQG(e.target.value)}
              className=""
            >
              <option value="">—</option>
              {sitesQG.map((s) => (
                <option key={s.id} value={s.id}>{s.nom}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <label className="text-xs text-sourdine" title="Commission Schmitz : A = problème unique, B = cascade multisectorielle">Complexité :</label>
            <select
              value={incident.complexite_type ?? ''}
              onChange={(e) => changerComplexiteType(e.target.value)}
              className=""
            >
              <option value="">—</option>
              <option value="A">Type A — problème unique</option>
              <option value="B">Type B — cascade multisectorielle</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <label className="text-xs text-sourdine" title="Guide bourgmestre : flash = sans préavis, évolutif = aggravation progressive, prévisible = anticipable (météo, etc.)">Dynamique :</label>
            <select
              value={incident.dynamique_evenement ?? ''}
              onChange={(e) => changerDynamiqueEvenement(e.target.value)}
              className=""
            >
              <option value="">—</option>
              <option value="flash">Flash</option>
              <option value="evolutif">Évolutif</option>
              <option value="previsible">Prévisible</option>
            </select>
          </div>
        </div>
        {incident.statut !== 'cloture' && (
          <BoutonDiscret onClick={cloturer}>Clôturer l'incident</BoutonDiscret>
        )}
      </div>

      {PHASES_MODULES[incident.phase_cycle_vie]?.activation_30min !== false && (
        <div className="mb-6">
          <SectionActivation30Minutes incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.seuils_action !== false && (
        <div className="mb-6">
          <SectionSeuilsAction incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.requisitions !== false && (
        <div className="mb-6">
          <SectionRequisitions incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.retablissement !== false && (
        <div className="mb-6">
          <SectionSuiviRetablissement incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.zones !== false && (
        <div className="mb-6">
          <SectionZonesIntervention incidentId={id} />
        </div>
      )}

      <div className="mb-6">
        <SectionPhaseCycleVie
          incidentId={id}
          contexteId={contexteId}
          phaseActuelle={incident.phase_cycle_vie}
          onChangement={chargerIncident}
        />
      </div>

      {PHASES_MODULES[incident.phase_cycle_vie]?.escalade !== false && (
        <div className="mb-6">
          <SectionPhasesEscalade incidentId={id} contexteId={contexteId} niveauActuelId={incident.niveau_actuel_id} onChangement={chargerIncident} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.checklist !== false && (
        <div className="mb-6">
          <SectionChecklist incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.organes !== false && (
        <div className="mb-6">
          <SectionOrganesCrise incidentId={id} contexteId={contexteId} degreCriticiteIncident={incident.degre_criticite} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.suivi_operationnel !== false && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <SectionSitReps incidentId={id} contexteId={contexteId} />
          <SectionLivreDeBord incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.suivi_intervenants !== false && (
        <div className="mb-6">
          <SectionSuiviIntervenants incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.phase_transitoire !== false && (
        <div className="mb-6">
          <SectionPhaseTransitoire incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.rex !== false && (
        <div>
          <SectionRex incidentId={id} contexteId={contexteId} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.pc_ops !== false && (
        <div className="mt-6">
          <SectionPcOpsRoles incidentId={id} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.communication_d5 !== false && (
        <div className="mt-6">
          <SectionCommunicationD5 incidentId={id} />
        </div>
      )}

      {PHASES_MODULES[incident.phase_cycle_vie]?.psychosocial_d2 !== false && (
        <div className="mt-6">
          <SectionPsychosocialD2 incidentId={id} />
        </div>
      )}
    </div>
  )
}

// Quelles sections de la fiche incident sont pertinentes selon la phase du
// cycle de vie — une section non listée pour une phase est masquée plutôt
// que simplement vide, pour réduire la charge cognitive ("chaque écran
// doit réduire les décisions", cf. principes de design du produit).
// Toutes les sections restent accessibles en 'phase_active' (le gros du
// travail opérationnel) ; seules certaines sont retirées en amont
// (veille/vigilance/pré-alerte, pas encore de gestion de crise active) ou
// en aval (levée/post-crise, où le travail devient REX plutôt
// qu'opérationnel).
const PHASES_MODULES = {
  veille: { activation_30min: false, checklist: false, organes: false, suivi_operationnel: false, suivi_intervenants: false, phase_transitoire: false, rex: false, requisitions: false, retablissement: false, zones: false, pc_ops: false, communication_d5: false, psychosocial_d2: false },
  vigilance: { activation_30min: false, checklist: false, organes: false, suivi_operationnel: false, suivi_intervenants: false, phase_transitoire: false, rex: false, requisitions: false, retablissement: false, zones: false, pc_ops: false, communication_d5: false, psychosocial_d2: false },
  pre_alerte: { suivi_intervenants: false, phase_transitoire: false, rex: false, requisitions: false, retablissement: false, zones: false, pc_ops: false, psychosocial_d2: false },
  alerte: { phase_transitoire: false, rex: false },
  phase_active: {},
  levee: { activation_30min: false, checklist: false, rex: false, seuils_action: false, pc_ops: false },
  post_crise: { activation_30min: false, escalade: false, checklist: false, organes: false, suivi_operationnel: false, suivi_intervenants: false, seuils_action: false, requisitions: false, zones: false, pc_ops: false, communication_d5: false },
}

const TYPES_ZONE = [
  { valeur: 'rouge', libelle: 'Rouge — exclusion', perimetre: 'exclusion' },
  { valeur: 'orange', libelle: 'Orange — isolation', perimetre: 'isolation' },
  { valeur: 'jaune', libelle: 'Jaune — dissuasion', perimetre: 'dissuasion' },
]

const ACCES_PAR_TYPE_ZONE = {
  rouge: "Exclusivement services d'intervention, experts, techniciens. Population évacuée ou consignes spécifiques (fermer portes/fenêtres).",
  orange: "Services d'intervention + résidents/travailleurs sur accord explicite du Dir-PC-Ops. PC-Ops positionné juste à l'intérieur du périmètre.",
  jaune: 'Accès déconseillé aux non-résidents/non-travailleurs sauf décision PC-Ops. Trafic de transit détourné, "touristes de catastrophe" écartés.',
}

const TYPES_POINT_LOGISTIQUE = [
  { valeur: 'ppd', libelle: 'PPD — Point de Première Destination' },
  { valeur: 'parking_ambulances', libelle: 'Parking ambulances' },
  { valeur: 'parking_evacues', libelle: 'Parking évacués / victimes non blessées' },
  { valeur: 'pma', libelle: 'PMA — Poste Médical Avancé' },
  { valeur: 'pc_ops', libelle: 'PC-Ops' },
]

const ETAPES_RETABLISSEMENT = [
  { valeur: 'retablissement_post_crise', libelle: 'Rétablissement post-crise (services essentiels)' },
  { valeur: 'rehabilitation', libelle: 'Réhabilitation (biens endommagés réparés)' },
  { valeur: 'reconstruction', libelle: 'Reconstruction (biens détruits remplacés)' },
  { valeur: 'developpement_resilience', libelle: 'Développement / résilience (Build Back Better)' },
]

const STATUTS_RETABLISSEMENT = [
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'termine', libelle: 'Terminé' },
  { valeur: 'suspendu', libelle: 'Suspendu' },
  { valeur: 'abandonne', libelle: 'Abandonné' },
]

const STATUTS_DECLENCHEMENT_SEUIL = [
  { valeur: 'en_attente', libelle: 'En attente de décision' },
  { valeur: 'confirme', libelle: 'Confirmé — action lancée' },
  { valeur: 'refuse', libelle: 'Refusé' },
  { valeur: 'reporte', libelle: 'Reporté' },
]

const TYPES_REQUISITION = [
  { valeur: 'civile', libelle: 'Civile (art. 181, L. 15/05/2007)' },
  { valeur: 'militaire', libelle: 'Militaire (AR 03/03/1934)' },
]

const AUTORITES_DECRETANTES = [
  { valeur: 'bourgmestre', libelle: 'Bourgmestre' },
  { valeur: 'gouverneur', libelle: 'Gouverneur' },
]

const STATUTS_REQUISITION = [
  { valeur: 'actif', libelle: 'Active' },
  { valeur: 'leve', libelle: 'Levée' },
  { valeur: 'conteste', libelle: 'Contestée' },
]

const BASE_LEGALE_PAR_TYPE = {
  civile: 'L. 15/05/2007 relative à la sécurité civile, art. 181',
  militaire: 'AR du 03/03/1934',
}

const INDICATEURS_INTERVENANT = [
  { valeur: 'intoxication_co', libelle: 'Intoxication CO' },
  { valeur: 'fatigue', libelle: 'Fatigue' },
  { valeur: 'blessure', libelle: 'Blessure' },
  { valeur: 'exposition_chaleur', libelle: 'Exposition chaleur' },
  { valeur: 'exposition_froid', libelle: 'Exposition froid' },
  { valeur: 'autre', libelle: 'Autre' },
]

const STATUTS_ORGANE_LOG = [
  { valeur: 'active', libelle: 'Activé' },
  { valeur: 'desactivee', libelle: 'Désactivé' },
]

const PHASES_CYCLE_VIE = [
  { valeur: 'veille', libelle: 'Veille' },
  { valeur: 'vigilance', libelle: 'Vigilance' },
  { valeur: 'pre_alerte', libelle: 'Pré-alerte' },
  { valeur: 'alerte', libelle: 'Alerte' },
  { valeur: 'phase_active', libelle: 'Phase active' },
  { valeur: 'levee', libelle: 'Levée' },
  { valeur: 'post_crise', libelle: 'Post-crise / REX' },
]

const STATUTS_PHASE = [
  { valeur: 'active', libelle: 'Active' },
  { valeur: 'relais', libelle: 'Relais (passation vers un autre niveau)' },
  { valeur: 'levee', libelle: 'Levée' },
]

const HORIZONS_TEMPOREL = [
  { valeur: 'immediat', libelle: 'Immédiat' },
  { valeur: 'h0_24', libelle: '0-24h' },
  { valeur: 'h24_72', libelle: '24-72h' },
  { valeur: 'semaines', libelle: 'Semaines' },
  { valeur: 'mois', libelle: 'Mois' },
  { valeur: 'residuel', libelle: 'Résiduel' },
]

function SectionPhasesEscalade({ incidentId, contexteId, niveauActuelId, onChangement }) {
  const { lignes: niveaux } = useTableContexte('niveaux_escalade', contexteId, { tri: 'ordre' })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [phases, setPhases] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('phases_incident')
      .select('*, niveaux_escalade(id, libelle), contacts(id, nom, prenom)')
      .eq('incident_id', incidentId)
      .order('date_declenchement', { ascending: false })
    if (error) setErreur(error.message)
    else setPhases(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-encre">Niveau d'escalade — historique</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Consigner un changement de niveau</BoutonPrincipal>}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulairePhaseEscalade
          incidentId={incidentId}
          niveaux={niveaux}
          contacts={contacts}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
            await onChangement?.()
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : phases.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Aucun changement de niveau consigné pour cet incident.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {phases.map((p) => (
            <li key={p.id} className="px-4 py-2.5">
              <p className="text-sm text-encre">
                {p.niveaux_escalade?.libelle ?? '—'}
                {p.statut === 'active' && p.niveau_id === niveauActuelId && (
                  <span className="jeton text-ok ml-2">niveau actuel</span>
                )}
                <span className="jeton text-sourdine ml-2">
                  {STATUTS_PHASE.find((s) => s.valeur === p.statut)?.libelle ?? p.statut}
                </span>
                <span className="jeton text-info ml-2">
                  {HORIZONS_TEMPOREL.find((h) => h.valeur === p.horizon_temporel)?.libelle ?? p.horizon_temporel}
                </span>
              </p>
              <p className="text-xs text-sourdine">
                déclenché le {new Date(p.date_declenchement).toLocaleString('fr-BE')}
                {p.date_levee && <> · levé le {new Date(p.date_levee).toLocaleString('fr-BE')}</>}
                {p.contacts && <> · autorité : {p.contacts.prenom} {p.contacts.nom}</>}
              </p>
              {p.motif && <p className="text-xs text-sourdine italic mt-0.5">{p.motif}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulairePhaseEscalade({ incidentId, niveaux, contacts, onValider, onAnnuler }) {
  const [niveauId, setNiveauId] = useState('')
  const [statut, setStatut] = useState('active')
  const [horizonTemporel, setHorizonTemporel] = useState('immediat')
  const [autoriteContactId, setAutoriteContactId] = useState('')
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    if (!niveauId) return
    setEnCours(true)
    const { error } = await supabase.from('phases_incident').insert({
      incident_id: incidentId,
      niveau_id: niveauId,
      statut,
      horizon_temporel: horizonTemporel,
      date_levee: statut === 'levee' ? new Date().toISOString() : null,
      autorite_contact_id: autoriteContactId || null,
      motif: motif.trim() || null,
    })
    if (!error && statut === 'active') {
      await supabase.from('incidents').update({ niveau_actuel_id: niveauId }).eq('id', incidentId)
    }
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-3 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau d'escalade</label>
          <select required value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full">
            <option value="">—</option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>{n.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Statut de la phase</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full">
            {STATUTS_PHASE.map((s) => (
              <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Horizon temporel</label>
          <select value={horizonTemporel} onChange={(e) => setHorizonTemporel(e.target.value)} className="w-full">
            {HORIZONS_TEMPOREL.map((h) => (
              <option key={h.valeur} value={h.valeur}>{h.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Autorité (contact)</label>
          <select value={autoriteContactId} onChange={(e) => setAutoriteContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Motif</label>
        <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className="w-full" />
      </div>

      {statut === 'active' && (
        <p className="text-xs text-sourdine italic">
          Enregistrer ce changement en statut "Active" mettra à jour le niveau d'escalade affiché pour l'incident.
        </p>
      )}

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function SectionActivation30Minutes({ incidentId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [activation, setActivation] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('activation_incident')
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle()
    if (error) setErreur(error.message)
    else setActivation(data ?? { incident_id: incidentId })
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function patch(champs) {
    const valeurs = { ...activation, ...champs, incident_id: incidentId }
    setActivation(valeurs)
    const { error } = await supabase.from('activation_incident').upsert(valeurs, { onConflict: 'incident_id' })
    if (error) setErreur(error.message)
  }

  if (chargement || !activation) return <p className="text-sm text-sourdine">Chargement…</p>

  const etapes = [
    activation.notification_autorite_fait,
    activation.be_alert_decide,
    activation.comite_convoque_fait,
    activation.journal_ouvert_fait,
    activation.porte_parole_designe_fait,
  ]
  const nbFaites = etapes.filter(Boolean).length

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Activation — 30 premières minutes</h2>
        <span className="jeton text-info">{nbFaites} / 5</span>
      </div>
      <p className="text-xs text-sourdine mb-3">
        Les réflexes d'ouverture de crise. Cocher une étape horodate automatiquement le moment où elle a été faite.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
        <li className="px-4 py-3">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={activation.notification_autorite_fait}
              onChange={(e) =>
                patch({
                  notification_autorite_fait: e.target.checked,
                  notification_autorite_horodatage: e.target.checked
                    ? activation.notification_autorite_horodatage ?? new Date().toISOString()
                    : activation.notification_autorite_horodatage,
                })
              }
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="text-sm text-encre">Notification de l'autorité (bourgmestre/gouverneur)</span>
              {activation.notification_autorite_horodatage && (
                <span className="text-xs text-sourdine ml-2">
                  {new Date(activation.notification_autorite_horodatage).toLocaleString('fr-BE')}
                </span>
              )}
              <select
                value={activation.notification_autorite_contact_id ?? ''}
                onChange={(e) => patch({ notification_autorite_contact_id: e.target.value || null })}
                className="block mt-1 text-xs"
              >
                <option value="">Qui a été notifié —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
              </select>
            </span>
          </label>
        </li>

        <li className="px-4 py-3">
          <p className="text-sm text-encre mb-1.5">Décision BE-Alert</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-encre">
              <input
                type="radio"
                name={`be-alert-${incidentId}`}
                checked={activation.be_alert_decide === true && activation.be_alert_envoye === true}
                onChange={() =>
                  patch({
                    be_alert_decide: true,
                    be_alert_envoye: true,
                    be_alert_horodatage: activation.be_alert_horodatage ?? new Date().toISOString(),
                    be_alert_motif: null,
                  })
                }
              />
              Envoyé
            </label>
            <label className="flex items-center gap-1.5 text-sm text-encre">
              <input
                type="radio"
                name={`be-alert-${incidentId}`}
                checked={activation.be_alert_decide === true && activation.be_alert_envoye === false}
                onChange={() =>
                  patch({
                    be_alert_decide: true,
                    be_alert_envoye: false,
                    be_alert_horodatage: activation.be_alert_horodatage ?? new Date().toISOString(),
                  })
                }
              />
              Non envoyé
            </label>
            {activation.be_alert_horodatage && (
              <span className="text-xs text-sourdine">
                {new Date(activation.be_alert_horodatage).toLocaleString('fr-BE')}
              </span>
            )}
          </div>
          {activation.be_alert_decide && activation.be_alert_envoye === false && (
            <input
              value={activation.be_alert_motif ?? ''}
              onChange={(e) => patch({ be_alert_motif: e.target.value })}
              placeholder="Motif de non-envoi"
              className="mt-1.5 text-xs w-full"
            />
          )}
        </li>

        <li className="px-4 py-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={activation.comite_convoque_fait}
              onChange={(e) =>
                patch({
                  comite_convoque_fait: e.target.checked,
                  comite_convoque_horodatage: e.target.checked
                    ? activation.comite_convoque_horodatage ?? new Date().toISOString()
                    : activation.comite_convoque_horodatage,
                })
              }
            />
            <span className="text-sm text-encre">Convocation du comité de coordination</span>
            {activation.comite_convoque_horodatage && (
              <span className="text-xs text-sourdine">
                {new Date(activation.comite_convoque_horodatage).toLocaleString('fr-BE')}
              </span>
            )}
          </label>
        </li>

        <li className="px-4 py-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={activation.journal_ouvert_fait}
              onChange={(e) =>
                patch({
                  journal_ouvert_fait: e.target.checked,
                  journal_ouvert_horodatage: e.target.checked
                    ? activation.journal_ouvert_horodatage ?? new Date().toISOString()
                    : activation.journal_ouvert_horodatage,
                })
              }
            />
            <span className="text-sm text-encre">Ouverture du journal de bord</span>
            {activation.journal_ouvert_horodatage && (
              <span className="text-xs text-sourdine">
                {new Date(activation.journal_ouvert_horodatage).toLocaleString('fr-BE')}
              </span>
            )}
          </label>
        </li>

        <li className="px-4 py-3">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={activation.porte_parole_designe_fait}
              onChange={(e) =>
                patch({
                  porte_parole_designe_fait: e.target.checked,
                  porte_parole_horodatage: e.target.checked
                    ? activation.porte_parole_horodatage ?? new Date().toISOString()
                    : activation.porte_parole_horodatage,
                })
              }
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="text-sm text-encre">Désignation d'un porte-parole</span>
              {activation.porte_parole_horodatage && (
                <span className="text-xs text-sourdine ml-2">
                  {new Date(activation.porte_parole_horodatage).toLocaleString('fr-BE')}
                </span>
              )}
              <select
                value={activation.porte_parole_contact_id ?? ''}
                onChange={(e) => patch({ porte_parole_contact_id: e.target.value || null })}
                className="block mt-1 text-xs"
              >
                <option value="">Porte-parole —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
              </select>
            </span>
          </label>
        </li>
      </ul>
    </div>
  )
}

function SectionSeuilsAction({ incidentId, contexteId }) {
  const { lignes: seuilsBruts, chargement: chargementSeuils } = useTableContexte('seuils_action', contexteId, {
    colonnes: '*, roles(id, libelle)',
    tri: 'ordre',
  })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [declenchements, setDeclenchements] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [contactParSeuil, setContactParSeuil] = useState({})
  const [historiquesOuverts, setHistoriquesOuverts] = useState({})

  const seuils = seuilsBruts.filter((s) => s.actif)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('declenchements_seuils_action')
      .select('*, declenche_par:contacts!declenchements_seuils_action_declenche_par_contact_id_fkey(id, nom, prenom), repondu_par:contacts!declenchements_seuils_action_repondu_par_contact_id_fkey(id, nom, prenom)')
      .eq('incident_id', incidentId)
      .order('horodatage_declenchement', { ascending: false })
    if (error) setErreur(error.message)
    else setDeclenchements(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function declencher(seuil) {
    const { error } = await supabase.from('declenchements_seuils_action').insert({
      incident_id: incidentId,
      seuil_action_id: seuil.id,
      declenche_par_contact_id: contactParSeuil[seuil.id] || null,
    })
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function repondre(declenchement, statut, champsSupplementaires = {}) {
    const { error } = await supabase
      .from('declenchements_seuils_action')
      .update({
        statut,
        horodatage_reponse: new Date().toISOString(),
        repondu_par_contact_id: contactParSeuil[`reponse-${declenchement.id}`] || null,
        ...champsSupplementaires,
      })
      .eq('id', declenchement.id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function reporter(declenchement) {
    const { error } = await supabase
      .from('declenchements_seuils_action')
      .update({
        statut: 'reporte',
        horodatage_reponse: new Date().toISOString(),
        repondu_par_contact_id: contactParSeuil[`reponse-${declenchement.id}`] || null,
        reporte_jusqu_a: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        nombre_reports: (declenchement.nombre_reports ?? 0) + 1,
      })
      .eq('id', declenchement.id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  if (chargementSeuils || chargement) return <p className="text-sm text-sourdine">Chargement…</p>

  const declenchementsParSeuil = {}
  for (const d of declenchements) {
    if (!declenchementsParSeuil[d.seuil_action_id]) declenchementsParSeuil[d.seuil_action_id] = []
    declenchementsParSeuil[d.seuil_action_id].push(d)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Seuils d'action — déclenchement réflexe</h2>
      </div>
      <p className="text-xs text-sourdine mb-3">
        Quand un seuil est franchi, la notification de l'action à mener est pré-remplie : il reste à confirmer,
        refuser ou reporter 15 minutes — jamais à improviser l'action elle-même.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {seuils.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">
          Aucun seuil d'action actif configuré pour ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {seuils.map((s) => {
            const historique = declenchementsParSeuil[s.id] ?? []
            const courant = historique.find((d) => d.statut === 'en_attente' || d.statut === 'reporte')
            const passes = historique.filter((d) => d !== courant)
            const enRetard = courant?.statut === 'reporte' && courant.reporte_jusqu_a && new Date(courant.reporte_jusqu_a) <= new Date()

            return (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-encre">
                      {s.libelle}
                      {s.roles?.libelle && <span className="text-xs text-sourdine ml-2">responsable : {s.roles.libelle}</span>}
                    </p>
                    <p className="text-xs text-sourdine mt-0.5"><strong>Seuil :</strong> {s.seuil_description}</p>
                    <p className="text-xs text-sourdine mt-0.5"><strong>Action :</strong> {s.action}</p>
                  </div>
                  {!courant && (
                    <div className="flex-shrink-0 text-right">
                      <select
                        value={contactParSeuil[s.id] ?? ''}
                        onChange={(e) => setContactParSeuil((c) => ({ ...c, [s.id]: e.target.value }))}
                        className="block mb-1.5 text-xs"
                      >
                        <option value="">Constaté par —</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                        ))}
                      </select>
                      <BoutonPrincipal onClick={() => declencher(s)}>Seuil franchi</BoutonPrincipal>
                    </div>
                  )}
                </div>

                {courant && (
                  <div className={`mt-2 rounded border p-3 ${enRetard ? 'border-chaud bg-fond' : 'border-info bg-fond'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-encre">
                        Franchi le {new Date(courant.horodatage_declenchement).toLocaleString('fr-BE')}
                        {courant.declenche_par && <> par {courant.declenche_par.prenom} {courant.declenche_par.nom}</>}
                      </p>
                      <span className={`jeton ${enRetard ? 'text-chaud' : 'text-info'}`}>
                        {enRetard ? 'report écoulé — à redécider' : 'en attente de décision'}
                      </span>
                    </div>
                    {courant.statut === 'reporte' && courant.reporte_jusqu_a && (
                      <p className="text-xs text-sourdine mt-1">
                        Reporté jusqu'à {new Date(courant.reporte_jusqu_a).toLocaleTimeString('fr-BE')}
                        {courant.nombre_reports > 0 && <> ({courant.nombre_reports}× report{courant.nombre_reports > 1 ? 's' : ''})</>}
                      </p>
                    )}
                    <select
                      value={contactParSeuil[`reponse-${courant.id}`] ?? ''}
                      onChange={(e) => setContactParSeuil((c) => ({ ...c, [`reponse-${courant.id}`]: e.target.value }))}
                      className="block mt-2 mb-1.5 text-xs"
                    >
                      <option value="">Décidé par —</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <BoutonPrincipal onClick={() => repondre(courant, 'confirme')}>Confirmer</BoutonPrincipal>
                      <BoutonDiscret
                        onClick={() => {
                          const motif = prompt('Motif du refus :')
                          if (motif !== null) repondre(courant, 'refuse', { motif_refus: motif.trim() || null })
                        }}
                      >
                        Refuser
                      </BoutonDiscret>
                      <BoutonDiscret onClick={() => reporter(courant)}>Reporter 15 min</BoutonDiscret>
                    </div>
                  </div>
                )}

                {passes.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setHistoriquesOuverts((h) => ({ ...h, [s.id]: !h[s.id] }))}
                      className="text-xs text-sourdine underline"
                    >
                      {historiquesOuverts[s.id] ? 'Masquer' : 'Voir'} l'historique ({passes.length})
                    </button>
                    {historiquesOuverts[s.id] && (
                      <ul className="mt-1.5 space-y-1">
                        {passes.map((d) => (
                          <li key={d.id} className="text-xs text-sourdine">
                            {new Date(d.horodatage_declenchement).toLocaleString('fr-BE')}
                            {' → '}
                            {STATUTS_DECLENCHEMENT_SEUIL.find((st) => st.valeur === d.statut)?.libelle ?? d.statut}
                            {d.horodatage_reponse && <> le {new Date(d.horodatage_reponse).toLocaleString('fr-BE')}</>}
                            {d.repondu_par && <> par {d.repondu_par.prenom} {d.repondu_par.nom}</>}
                            {d.motif_refus && <> — motif : {d.motif_refus}</>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function SectionRequisitions({ incidentId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [requisitions, setRequisitions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('requisitions')
      .select('*, contacts(id, nom, prenom)')
      .eq('incident_id', incidentId)
      .order('date_decret', { ascending: false })
    if (error) setErreur(error.message)
    else setRequisitions(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('requisitions').insert({ ...valeurs, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(idRequisition, valeurs) {
    const { error } = await supabase.from('requisitions').update(valeurs).eq('id', idRequisition)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function changerStatut(requisition, statut) {
    const { error } = await supabase.from('requisitions').update({ statut }).eq('id', requisition.id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Réquisitions</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Décréter une réquisition</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Réquisition civile (personnes/biens, décrétée par le bourgmestre ou le gouverneur) ou
        militaire (compétence exclusive du gouverneur, subsidiarité — moyens publics insuffisants).
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireRequisition
            contacts={contacts}
            onAnnuler={() => setEnAjout(false)}
            onValider={async (valeurs) => {
              const { error } = await creer(valeurs)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : requisitions.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune réquisition décrétée pour cet incident.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {requisitions.map((r) =>
            ligneEnEdition === r.id ? (
              <li key={r.id} className="p-3 bg-fond">
                <FormulaireRequisition
                  contacts={contacts}
                  valeursInitiales={r}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(r.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-encre">
                      {TYPES_REQUISITION.find((t) => t.valeur === r.type_requisition)?.libelle ?? r.type_requisition}
                      <span
                        className={`jeton ml-2 ${
                          r.statut === 'actif' ? 'text-chaud' : r.statut === 'conteste' ? 'text-veille' : 'text-sourdine'
                        }`}
                      >
                        {STATUTS_REQUISITION.find((s) => s.valeur === r.statut)?.libelle ?? r.statut}
                      </span>
                    </p>
                    <p className="text-xs text-sourdine mt-0.5"><strong>Objet :</strong> {r.objet}</p>
                    {r.beneficiaire && <p className="text-xs text-sourdine mt-0.5"><strong>Bénéficiaire :</strong> {r.beneficiaire}</p>}
                    <p className="text-xs text-sourdine mt-0.5">{r.base_legale}</p>
                    <p className="text-xs text-sourdine mt-1">
                      Décrétée par {AUTORITES_DECRETANTES.find((a) => a.valeur === r.autorite_decretante)?.libelle ?? r.autorite_decretante}
                      {r.contacts && <> ({r.contacts.prenom} {r.contacts.nom})</>}
                      {' '}le {new Date(r.date_decret).toLocaleString('fr-BE')}
                    </p>
                    {r.document_decret_url && (
                      <a href={r.document_decret_url} target="_blank" rel="noreferrer" className="text-xs text-info underline">
                        document du décret
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setLigneEnEdition(r.id)}>Modifier</BoutonDiscret>
                    {r.statut === 'actif' && (
                      <BoutonDiscret onClick={() => changerStatut(r, 'leve')}>Lever</BoutonDiscret>
                    )}
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireRequisition({ contacts, valeursInitiales = {}, onValider, onAnnuler }) {
  const [typeRequisition, setTypeRequisition] = useState(valeursInitiales.type_requisition ?? 'civile')
  const [autoriteDecretante, setAutoriteDecretante] = useState(valeursInitiales.autorite_decretante ?? 'bourgmestre')
  const [baseLegale, setBaseLegale] = useState(valeursInitiales.base_legale ?? BASE_LEGALE_PAR_TYPE.civile)
  const [objet, setObjet] = useState(valeursInitiales.objet ?? '')
  const [beneficiaire, setBeneficiaire] = useState(valeursInitiales.beneficiaire ?? '')
  const [contactDecideurId, setContactDecideurId] = useState(valeursInitiales.contact_decideur_id ?? '')
  const [documentDecretUrl, setDocumentDecretUrl] = useState(valeursInitiales.document_decret_url ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function changerType(valeur) {
    setTypeRequisition(valeur)
    if (valeur === 'militaire') setAutoriteDecretante('gouverneur')
    if (!valeursInitiales.id) setBaseLegale(BASE_LEGALE_PAR_TYPE[valeur])
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_requisition: typeRequisition,
      autorite_decretante: autoriteDecretante,
      base_legale: baseLegale.trim(),
      objet: objet.trim(),
      beneficiaire: beneficiaire.trim() || null,
      contact_decideur_id: contactDecideurId || null,
      document_decret_url: documentDecretUrl.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
          <select value={typeRequisition} onChange={(e) => changerType(e.target.value)} className="w-full">
            {TYPES_REQUISITION.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Autorité décrétante</label>
          <select
            value={autoriteDecretante}
            onChange={(e) => setAutoriteDecretante(e.target.value)}
            className="w-full"
            disabled={typeRequisition === 'militaire'}
          >
            {AUTORITES_DECRETANTES.map((a) => (
              <option key={a.valeur} value={a.valeur}>{a.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Base légale</label>
        <input required value={baseLegale} onChange={(e) => setBaseLegale(e.target.value)} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Objet (personne, bien ou service requis)</label>
        <textarea required value={objet} onChange={(e) => setObjet(e.target.value)} rows={2} className="w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Bénéficiaire</label>
          <input value={beneficiaire} onChange={(e) => setBeneficiaire(e.target.value)} placeholder="entité/service pour qui" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Décidée par</label>
          <select value={contactDecideurId} onChange={(e) => setContactDecideurId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Lien vers le document du décret (URL)</label>
        <input value={documentDecretUrl} onChange={(e) => setDocumentDecretUrl(e.target.value)} placeholder="https://…" className="w-full" />
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function SectionSuiviRetablissement({ incidentId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [etapes, setEtapes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('suivi_retablissement')
      .select('*, contacts(id, nom, prenom)')
      .eq('incident_id', incidentId)
      .order('date_debut', { ascending: true })
    if (error) setErreur(error.message)
    else setEtapes(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('suivi_retablissement').insert({ ...valeurs, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(idEtape, valeurs) {
    const { error } = await supabase.from('suivi_retablissement').update(valeurs).eq('id', idEtape)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Suivi du rétablissement</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une étape</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        L'"escargot du rétablissement" (commission Schmitz) : des étapes qui se chevauchent sur un
        horizon pluriannuel — pas une seule phase post-crise. Reste suivi ici après la levée.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireEtapeRetablissement
            contacts={contacts}
            onAnnuler={() => setEnAjout(false)}
            onValider={async (valeurs) => {
              const { error } = await creer(valeurs)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : etapes.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune étape de rétablissement suivie pour cet incident.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {etapes.map((e) =>
            ligneEnEdition === e.id ? (
              <li key={e.id} className="p-3 bg-fond">
                <FormulaireEtapeRetablissement
                  contacts={contacts}
                  valeursInitiales={e}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(e.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={e.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-encre">
                      {ETAPES_RETABLISSEMENT.find((t) => t.valeur === e.etape)?.libelle ?? e.etape}
                      <span
                        className={`jeton ml-2 ${
                          e.statut === 'termine' ? 'text-chaud' : e.statut === 'abandonne' ? 'text-sourdine' : 'text-info'
                        }`}
                      >
                        {STATUTS_RETABLISSEMENT.find((s) => s.valeur === e.statut)?.libelle ?? e.statut}
                      </span>
                    </p>
                    {e.description && <p className="text-xs text-sourdine mt-0.5">{e.description}</p>}
                    <p className="text-xs text-sourdine mt-1">
                      {e.date_debut && <>début {e.date_debut}</>}
                      {e.date_fin_prevue && <> · prévu {e.date_fin_prevue}</>}
                      {e.date_fin_reelle && <> · terminé {e.date_fin_reelle}</>}
                      {e.contacts && <> · responsable {e.contacts.prenom} {e.contacts.nom}</>}
                    </p>
                    {(e.budget_estime != null || e.budget_depense != null) && (
                      <p className="text-xs text-sourdine mt-0.5">
                        budget : {e.budget_depense ?? 0} € dépensé / {e.budget_estime ?? '?'} € estimé
                      </p>
                    )}
                  </div>
                  <BoutonDiscret onClick={() => setLigneEnEdition(e.id)}>Modifier</BoutonDiscret>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        <GestionVoletsRetablissement incidentId={incidentId} />
        <GestionSuiviPsychosocial incidentId={incidentId} />
      </div>
    </div>
  )
}

const VOLETS_RETABLISSEMENT_DETAIL = [
  { valeur: 'relogement_evacues', libelle: 'Relogement des évacués' },
  { valeur: 'enquete_judiciaire', libelle: 'Enquête judiciaire' },
  { valeur: 'indemnisation_assurances', libelle: 'Indemnisation / assurances' },
  { valeur: 'gestion_dons', libelle: 'Gestion des dons' },
  { valeur: 'commemoration', libelle: 'Commémoration' },
  { valeur: 'nettoyage_terrain', libelle: 'Nettoyage du terrain' },
  { valeur: 'appui_linguistique', libelle: 'Appui linguistique' },
  { valeur: 'besoin_securite', libelle: 'Besoin de sécurité' },
]

function GestionVoletsRetablissement({ incidentId }) {
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useCrudSimpleIncident('retablissement_details', incidentId)
  const [volet, setVolet] = useState('relogement_evacues')
  const [responsable, setResponsable] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    const { error } = await creer({ volet, responsable: responsable.trim() || null })
    if (!error) setResponsable('')
  }

  return (
    <BlocD5 titre="Volets détaillés du rétablissement (P9)" aide="Chaîne du PPUI Seveso, volets concrets au-delà des grandes étapes ci-dessus.">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-2">
        <select value={volet} onChange={(e) => setVolet(e.target.value)} className="text-xs">
          {VOLETS_RETABLISSEMENT_DETAIL.map((v) => <option key={v.valeur} value={v.valeur}>{v.libelle}</option>)}
        </select>
        <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="responsable" className="text-xs flex-1 min-w-[6rem]" />
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {lignes.map((v) => (
            <li key={v.id} className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
              <span>
                {VOLETS_RETABLISSEMENT_DETAIL.find((x) => x.valeur === v.volet)?.libelle ?? v.volet}
                {v.responsable && <> — {v.responsable}</>}
              </span>
              <span className="flex gap-1">
                <select value={v.statut} onChange={(e) => modifier(v.id, { statut: e.target.value })} className="text-xs">
                  <option value="en_cours">En cours</option>
                  <option value="termine">Terminé</option>
                  <option value="suspendu">Suspendu</option>
                </select>
                <BoutonDiscret onClick={() => supprimer(v.id)}>×</BoutonDiscret>
              </span>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

const PHASES_PSYCHOSOCIAL = [
  { valeur: 'pips_aigu', libelle: 'PIPS — phase aiguë' },
  { valeur: 'ccps_coordination', libelle: 'CCPS — coordination' },
  { valeur: 'transition_communale', libelle: 'Transition communale' },
]

function GestionSuiviPsychosocial({ incidentId }) {
  const [ligne, setLigne] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('suivi_psychosocial_crise')
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle()
    if (error) setErreur(error.message)
    else setLigne(data)
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creerOuModifier(valeurs) {
    if (ligne) {
      const { error } = await supabase.from('suivi_psychosocial_crise').update(valeurs).eq('id', ligne.id)
      if (!error) await rafraichir()
      return { error }
    }
    const { error } = await supabase.from('suivi_psychosocial_crise').insert({ ...valeurs, incident_id: incidentId })
    if (!error) await rafraichir()
    return { error }
  }

  if (chargement) {
    return (
      <BlocD5 titre="Chaîne psychosociale (PIPS → PSM → CCPS)">
        <p className="text-xs text-sourdine">Chargement…</p>
      </BlocD5>
    )
  }

  const v = ligne ?? { phase: 'pips_aigu' }

  return (
    <BlocD5 titre="Chaîne psychosociale (PIPS → PSM → CCPS)" aide="Transfert formalisé du PSM vers le coordinateur post-aigu communal, précédé d'un Bilan Post-Crise.">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <select value={v.phase} onChange={(e) => creerOuModifier({ phase: e.target.value })} className="text-xs">
          {PHASES_PSYCHOSOCIAL.map((p) => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
        </select>
        <input
          value={v.psm_responsable ?? ''}
          onChange={(e) => creerOuModifier({ psm_responsable: e.target.value.trim() || null })}
          placeholder="PSM responsable"
          className="text-xs flex-1 min-w-[6rem]"
        />
        <input
          value={v.coordinateur_post_aigu_communal ?? ''}
          onChange={(e) => creerOuModifier({ coordinateur_post_aigu_communal: e.target.value.trim() || null })}
          placeholder="coordinateur communal"
          className="text-xs flex-1 min-w-[6rem]"
        />
      </div>
      <label className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
        <span>Bilan Post-Crise (BPC) réalisé</span>
        <input
          type="checkbox"
          checked={v.bilan_post_crise_realise ?? false}
          onChange={(e) =>
            creerOuModifier({
              bilan_post_crise_realise: e.target.checked,
              bilan_post_crise_date: e.target.checked ? new Date().toISOString().slice(0, 10) : null,
            })
          }
        />
      </label>
    </BlocD5>
  )
}

function FormulaireEtapeRetablissement({ contacts, valeursInitiales = {}, onValider, onAnnuler }) {
  const [etape, setEtape] = useState(valeursInitiales.etape ?? 'retablissement_post_crise')
  const [description, setDescription] = useState(valeursInitiales.description ?? '')
  const [responsableContactId, setResponsableContactId] = useState(valeursInitiales.responsable_contact_id ?? '')
  const [dateDebut, setDateDebut] = useState(valeursInitiales.date_debut ?? '')
  const [dateFinPrevue, setDateFinPrevue] = useState(valeursInitiales.date_fin_prevue ?? '')
  const [dateFinReelle, setDateFinReelle] = useState(valeursInitiales.date_fin_reelle ?? '')
  const [statut, setStatut] = useState(valeursInitiales.statut ?? 'en_cours')
  const [budgetEstime, setBudgetEstime] = useState(valeursInitiales.budget_estime ?? '')
  const [budgetDepense, setBudgetDepense] = useState(valeursInitiales.budget_depense ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      etape,
      description: description.trim() || null,
      responsable_contact_id: responsableContactId || null,
      date_debut: dateDebut || null,
      date_fin_prevue: dateFinPrevue || null,
      date_fin_reelle: dateFinReelle || null,
      statut,
      budget_estime: budgetEstime === '' ? null : Number(budgetEstime),
      budget_depense: budgetDepense === '' ? null : Number(budgetDepense),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Étape</label>
          <select value={etape} onChange={(e) => setEtape(e.target.value)} className="w-full">
            {ETAPES_RETABLISSEMENT.map((t) => (
              <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Statut</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full">
            {STATUTS_RETABLISSEMENT.map((s) => (
              <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Début</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Fin prévue</label>
          <input type="date" value={dateFinPrevue} onChange={(e) => setDateFinPrevue(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Fin réelle</label>
          <input type="date" value={dateFinReelle} onChange={(e) => setDateFinReelle(e.target.value)} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Responsable</label>
          <select value={responsableContactId} onChange={(e) => setResponsableContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Budget estimé (€)</label>
          <input type="number" min="0" step="0.01" value={budgetEstime} onChange={(e) => setBudgetEstime(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Budget dépensé (€)</label>
          <input type="number" min="0" step="0.01" value={budgetDepense} onChange={(e) => setBudgetDepense(e.target.value)} className="w-full" />
        </div>
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function SectionZonesIntervention({ incidentId }) {
  const [zones, setZones] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('zones_intervention')
      .select('*, points_logistique_zone(*)')
      .eq('incident_id', incidentId)
      .order('date_etablissement', { ascending: false })
    if (error) setErreur(error.message)
    else setZones(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from('zones_intervention').insert({ ...valeurs, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function modifier(idZone, valeurs) {
    const { error } = await supabase.from('zones_intervention').update(valeurs).eq('id', idZone)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function lever(zone) {
    await supabase.from('zones_intervention').update({ date_levee: new Date().toISOString() }).eq('id', zone.id)
    await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Zones d'intervention</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Établir une zone</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Zonage opérationnel du terrain (doctrine NCCN) : rouge (exclusion), orange (isolation, PC-Ops
        juste à l'intérieur), jaune (dissuasion — PPD et parking ambulances obligatoires).
        Représenté en cercle (centre + rayon), pas en polygone précis.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireZone
            onAnnuler={() => setEnAjout(false)}
            onValider={async (valeurs) => {
              const { error } = await creer(valeurs)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : zones.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune zone établie pour cet incident.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {zones.map((z) =>
            ligneEnEdition === z.id ? (
              <li key={z.id} className="p-3 bg-fond">
                <FormulaireZone
                  valeursInitiales={z}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(z.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={z.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-encre">
                      {TYPES_ZONE.find((t) => t.valeur === z.type_zone)?.libelle ?? z.type_zone}
                      {z.date_levee ? (
                        <span className="jeton ml-2 text-sourdine">levée</span>
                      ) : (
                        <span className="jeton ml-2 text-chaud">active</span>
                      )}
                    </p>
                    {z.acces_autorise && <p className="text-xs text-sourdine mt-0.5">{z.acces_autorise}</p>}
                    {(z.centre_latitude != null && z.centre_longitude != null) && (
                      <p className="text-xs text-sourdine mt-0.5">
                        centre {z.centre_latitude}, {z.centre_longitude}
                        {z.rayon_metres != null && <> · rayon {z.rayon_metres} m</>}
                      </p>
                    )}
                    <p className="text-xs text-sourdine mt-1">
                      établie le {new Date(z.date_etablissement).toLocaleString('fr-BE')}
                      {z.date_levee && <> · levée le {new Date(z.date_levee).toLocaleString('fr-BE')}</>}
                    </p>
                    <GestionPointsLogistiqueZone zoneId={z.id} points={z.points_logistique_zone ?? []} onChangement={rafraichir} />
                  </div>
                  <div className="flex gap-2 flex-shrink-0 ml-3">
                    <BoutonDiscret onClick={() => setLigneEnEdition(z.id)}>Modifier</BoutonDiscret>
                    {!z.date_levee && <BoutonDiscret onClick={() => lever(z)}>Lever</BoutonDiscret>}
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireZone({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [typeZone, setTypeZone] = useState(valeursInitiales.type_zone ?? 'rouge')
  const [centreLatitude, setCentreLatitude] = useState(valeursInitiales.centre_latitude ?? '')
  const [centreLongitude, setCentreLongitude] = useState(valeursInitiales.centre_longitude ?? '')
  const [rayonMetres, setRayonMetres] = useState(valeursInitiales.rayon_metres ?? '')
  const [accesAutorise, setAccesAutorise] = useState(valeursInitiales.acces_autorise ?? ACCES_PAR_TYPE_ZONE.rouge)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function changerType(valeur) {
    setTypeZone(valeur)
    if (!valeursInitiales.id) setAccesAutorise(ACCES_PAR_TYPE_ZONE[valeur])
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_zone: typeZone,
      perimetre: TYPES_ZONE.find((t) => t.valeur === typeZone)?.perimetre,
      centre_latitude: centreLatitude === '' ? null : Number(centreLatitude),
      centre_longitude: centreLongitude === '' ? null : Number(centreLongitude),
      rayon_metres: rayonMetres === '' ? null : Number(rayonMetres),
      acces_autorise: accesAutorise.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Type de zone</label>
        <select value={typeZone} onChange={(e) => changerType(e.target.value)} className="w-full sm:w-64">
          {TYPES_ZONE.map((t) => (
            <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Latitude centre</label>
          <input type="number" step="any" value={centreLatitude} onChange={(e) => setCentreLatitude(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Longitude centre</label>
          <input type="number" step="any" value={centreLongitude} onChange={(e) => setCentreLongitude(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Rayon (m)</label>
          <input type="number" min="0" value={rayonMetres} onChange={(e) => setRayonMetres(e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Règles d'accès</label>
        <textarea value={accesAutorise} onChange={(e) => setAccesAutorise(e.target.value)} rows={2} className="w-full" />
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionPointsLogistiqueZone({ zoneId, points, onChangement }) {
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function creer(valeurs) {
    const { error } = await supabase.from('points_logistique_zone').insert({ ...valeurs, zone_id: zoneId })
    if (error) { setErreur(error.message); return { error } }
    await onChangement()
    return { error: null }
  }

  async function supprimer(idPoint) {
    const { error } = await supabase.from('points_logistique_zone').delete().eq('id', idPoint)
    if (!error) await onChangement()
  }

  return (
    <div className="mt-2 pt-2 border-t border-trait">
      <div className="flex items-center justify-between mb-1">
        <p className="etiquette">Points logistiques</p>
        {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Ajouter</BoutonDiscret>}
      </div>
      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}
      {enAjout && (
        <FormulairePointLogistique
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}
      {points.length === 0 && !enAjout ? (
        <p className="text-xs text-sourdine">Aucun point logistique défini.</p>
      ) : (
        <ul className="space-y-1">
          {points.map((pt) => (
            <li key={pt.id} className="flex items-center justify-between text-xs text-encre">
              <span>
                <span className="jeton mr-1.5">{TYPES_POINT_LOGISTIQUE.find((t) => t.valeur === pt.type_point)?.libelle ?? pt.type_point}</span>
                {pt.latitude != null && pt.longitude != null && <>{pt.latitude}, {pt.longitude}</>}
                {pt.capacite != null && <> · capacité {pt.capacite}</>}
                {pt.commentaire && <> · {pt.commentaire}</>}
              </span>
              <BoutonDiscret onClick={() => supprimer(pt.id)}>✕</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulairePointLogistique({ onValider, onAnnuler }) {
  const [typePoint, setTypePoint] = useState('ppd')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [capacite, setCapacite] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_point: typePoint,
      latitude: latitude === '' ? null : Number(latitude),
      longitude: longitude === '' ? null : Number(longitude),
      capacite: capacite === '' ? null : Number(capacite),
      commentaire: commentaire.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2 mb-2">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <select value={typePoint} onChange={(e) => setTypePoint(e.target.value)} className="w-full text-xs">
          {TYPES_POINT_LOGISTIQUE.map((t) => (
            <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
          ))}
        </select>
        <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Latitude" className="w-full text-xs" />
        <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Longitude" className="w-full text-xs" />
        <input type="number" min="0" value={capacite} onChange={(e) => setCapacite(e.target.value)} placeholder="Capacité" className="w-full text-xs" />
      </div>
      <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Commentaire" className="w-full text-xs" />
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? '…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function SectionPhaseCycleVie({ incidentId, contexteId, phaseActuelle, onChangement }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [historique, setHistorique] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [phase, setPhase] = useState(phaseActuelle)
  const [contactId, setContactId] = useState('')
  const [motif, setMotif] = useState('')
  const [enCours, setEnCours] = useState(false)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('historique_phases_cycle_vie')
      .select('*, contacts(id, nom, prenom)')
      .eq('incident_id', incidentId)
      .order('horodatage', { ascending: false })
    if (error) setErreur(error.message)
    else setHistorique(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  useEffect(() => {
    setPhase(phaseActuelle)
  }, [phaseActuelle])

  async function changerPhase(e) {
    e.preventDefault()
    if (phase === phaseActuelle) return
    setEnCours(true)
    const { error: erreurIncident } = await supabase
      .from('incidents')
      .update({ phase_cycle_vie: phase })
      .eq('id', incidentId)
    const { error: erreurLog } = erreurIncident
      ? { error: null }
      : await supabase.from('historique_phases_cycle_vie').insert({
          incident_id: incidentId,
          phase,
          declenche_par_contact_id: contactId || null,
          motif: motif.trim() || null,
        })
    setEnCours(false)
    const error = erreurIncident || erreurLog
    if (error) {
      setErreur(error.message)
    } else {
      setMotif('')
      await rafraichir()
      await onChangement?.()
    }
  }

  return (
    <div>
      <h2 className="font-medium text-encre mb-1">Phase du cycle de vie</h2>
      <p className="text-xs text-sourdine mb-3">
        Où en est l'incident dans son cycle de vie — distinct du niveau d'escalade légal ci-dessous.
        Les sections affichées plus bas s'adaptent à cette phase.
      </p>

      <form onSubmit={changerPhase} className="flex flex-wrap items-end gap-2 mb-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Phase actuelle</label>
          <select value={phase} onChange={(e) => setPhase(e.target.value)}>
            {PHASES_CYCLE_VIE.map((p) => (
              <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Déclenché par</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-sourdine mb-1">Motif (optionnel)</label>
          <input value={motif} onChange={(e) => setMotif(e.target.value)} className="w-full" />
        </div>
        <BoutonPrincipal type="submit" disabled={enCours || phase === phaseActuelle}>
          {enCours ? 'Enregistrement…' : 'Changer la phase'}
        </BoutonPrincipal>
      </form>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : historique.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-3 text-center">
          Aucune transition consignée.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {historique.map((h) => (
            <li key={h.id} className="px-4 py-2">
              <p className="text-sm text-encre">
                {PHASES_CYCLE_VIE.find((p) => p.valeur === h.phase)?.libelle ?? h.phase}
              </p>
              <p className="text-xs text-sourdine">
                {new Date(h.horodatage).toLocaleString('fr-BE')}
                {h.contacts && <> · {h.contacts.prenom} {h.contacts.nom}</>}
              </p>
              {h.motif && <p className="text-xs text-sourdine italic mt-0.5">{h.motif}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SectionOrganesCrise({ incidentId, contexteId, degreCriticiteIncident }) {
  const { lignes: instances } = useTableContexte('instances_coordination', contexteId, { tri: 'type' })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [historique, setHistorique] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('organes_crise_log')
      .select('*, instances_coordination(id, type), contacts(id, nom, prenom)')
      .eq('incident_id', incidentId)
      .order('horodatage', { ascending: false })
    if (error) setErreur(error.message)
    else setHistorique(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-encre">Organes de crise activés/désactivés</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Consigner un changement</BoutonPrincipal>}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireOrganeCrise
          incidentId={incidentId}
          instances={instances}
          contacts={contacts}
          degreCriticiteIncident={degreCriticiteIncident}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : historique.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Aucune activation/désactivation consignée pour cet incident.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {historique.map((h) => (
            <li key={h.id} className="px-4 py-2.5">
              <p className="text-sm text-encre">
                {h.instances_coordination?.type} —{' '}
                <span className={h.statut === 'active' ? 'text-ok' : 'text-sourdine'}>
                  {STATUTS_ORGANE_LOG.find((s) => s.valeur === h.statut)?.libelle ?? h.statut}
                </span>
              </p>
              <p className="text-xs text-sourdine">
                {new Date(h.horodatage).toLocaleString('fr-BE')}
                {h.contacts && <> · déclenché par {h.contacts.prenom} {h.contacts.nom}</>}
                {h.degre_criticite != null && <> · criticité {h.degre_criticite}</>}
              </p>
              {h.motif && <p className="text-xs text-sourdine italic mt-0.5">{h.motif}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireOrganeCrise({ incidentId, instances, contacts, degreCriticiteIncident, onValider, onAnnuler }) {
  const [instanceId, setInstanceId] = useState('')
  const [statut, setStatut] = useState('active')
  const [declenchePar, setDeclenchePar] = useState('')
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    if (!instanceId) return
    setEnCours(true)
    const { error } = await supabase.from('organes_crise_log').insert({
      incident_id: incidentId,
      instance_id: instanceId,
      statut,
      degre_criticite: degreCriticiteIncident ?? null,
      declenche_par_contact_id: declenchePar || null,
      motif: motif.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-3 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Organe</label>
          <select required value={instanceId} onChange={(e) => setInstanceId(e.target.value)} className="w-full">
            <option value="">—</option>
            {instances.map((i) => (
              <option key={i.id} value={i.id}>{i.type}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Statut</label>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-full">
            {STATUTS_ORGANE_LOG.map((s) => (
              <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Déclenché par</label>
        <select value={declenchePar} onChange={(e) => setDeclenchePar(e.target.value)} className="w-full">
          <option value="">—</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Motif</label>
        <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className="w-full" />
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || !instanceId}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function SectionSuiviIntervenants({ incidentId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const { lignes: disciplines } = useTableContexte('disciplines', contexteId, { tri: 'libelle' })
  const [suivis, setSuivis] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('suivi_intervenants')
      .select('*, contacts(id, nom, prenom), disciplines(id, libelle)')
      .eq('incident_id', incidentId)
      .order('horodatage', { ascending: false })
    if (error) setErreur(error.message)
    else setSuivis(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-encre">Suivi santé/sécurité des intervenants</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Signaler</BoutonPrincipal>}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSuiviIntervenant
          incidentId={incidentId}
          contacts={contacts}
          disciplines={disciplines}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : suivis.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Aucun signalement pour cet incident.
        </p>
      ) : (
        <ul className="space-y-2">
          {suivis.map((s) => (
            <li key={s.id} className={`bg-surface border rounded p-3 ${s.necessite_relai ? 'border-veille' : 'border-trait'}`}>
              <p className="text-sm font-medium text-encre">
                {INDICATEURS_INTERVENANT.find((i) => i.valeur === s.indicateur)?.libelle ?? s.indicateur}
                {s.necessite_relai && <span className="jeton text-veille ml-2">relai nécessaire</span>}
              </p>
              <p className="text-xs text-sourdine mt-0.5">
                {s.contacts && <>{s.contacts.prenom} {s.contacts.nom} · </>}
                {s.disciplines?.libelle && <>{s.disciplines.libelle} · </>}
                {new Date(s.horodatage).toLocaleString('fr-BE')}
              </p>
              {s.valeur && <p className="text-xs text-sourdine mt-0.5">valeur : {s.valeur}</p>}
              {s.note && <p className="text-xs text-sourdine mt-0.5 italic">{s.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireSuiviIntervenant({ incidentId, contacts, disciplines = [], onValider, onAnnuler }) {
  const [contactId, setContactId] = useState('')
  const [disciplineId, setDisciplineId] = useState('')
  const [indicateur, setIndicateur] = useState(INDICATEURS_INTERVENANT[0].valeur)
  const [valeur, setValeur] = useState('')
  const [necessiteRelai, setNecessiteRelai] = useState(false)
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('suivi_intervenants').insert({
      incident_id: incidentId,
      contact_id: contactId || null,
      discipline_id: disciplineId || null,
      indicateur,
      valeur: valeur.trim() || null,
      necessite_relai: necessiteRelai,
      note: note.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-3 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Intervenant</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Indicateur</label>
          <select value={indicateur} onChange={(e) => setIndicateur(e.target.value)} className="w-full">
            {INDICATEURS_INTERVENANT.map((i) => (
              <option key={i.valeur} value={i.valeur}>{i.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Discipline</label>
        <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} className="w-full">
          <option value="">—</option>
          {disciplines.map((d) => (
            <option key={d.id} value={d.id}>{d.libelle}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Valeur mesurée (optionnel)</label>
        <input value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="ex. 180 ppm CO" className="w-full" />
      </div>

      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={necessiteRelai} onChange={(e) => setNecessiteRelai(e.target.checked)} />
        Nécessite un relai immédiat
      </label>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Note</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full" />
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

const SECTEURS_TRANSITOIRES = [
  { valeur: 'logement', libelle: 'Logement' },
  { valeur: 'social_psychologique', libelle: 'Social / psychologique' },
  { valeur: 'economique', libelle: 'Économique' },
  { valeur: 'environnemental', libelle: 'Environnemental' },
  { valeur: 'infrastructures', libelle: 'Infrastructures' },
  { valeur: 'juridique_assurances', libelle: 'Juridique / assurances' },
  { valeur: 'communication', libelle: 'Communication' },
]

const STATUTS_SECTEUR = [
  { valeur: 'a_demarrer', libelle: 'À démarrer' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'termine', libelle: 'Terminé' },
]

function SectionPhaseTransitoire({ incidentId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [secteurs, setSecteurs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('phase_transitoire_secteurs')
      .select('*, contacts(id, nom, prenom)')
      .eq('incident_id', incidentId)
    if (error) setErreur(error.message)
    else setSecteurs(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function initialiser() {
    const manquants = SECTEURS_TRANSITOIRES.filter((s) => !secteurs.some((x) => x.secteur === s.valeur))
    if (manquants.length === 0) return
    const { error } = await supabase
      .from('phase_transitoire_secteurs')
      .insert(manquants.map((s) => ({ incident_id: incidentId, secteur: s.valeur })))
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function maj(id, champs) {
    const { error } = await supabase.from('phase_transitoire_secteurs').update(champs).eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-encre">Phase transitoire post-crise (7 secteurs)</h2>
        {secteurs.length < SECTEURS_TRANSITOIRES.length && (
          <BoutonDiscret onClick={initialiser}>Initialiser les secteurs manquants</BoutonDiscret>
        )}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : secteurs.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Phase transitoire pas encore initialisée pour cet incident.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {secteurs.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
              <div>
                <span className="text-sm text-encre">
                  {SECTEURS_TRANSITOIRES.find((x) => x.valeur === s.secteur)?.libelle ?? s.secteur}
                </span>
                {s.contacts && (
                  <p className="text-xs text-sourdine">responsable : {s.contacts.prenom} {s.contacts.nom}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={s.responsable_contact_id ?? ''}
                  onChange={(e) => maj(s.id, { responsable_contact_id: e.target.value || null })}
                  className=""
                >
                  <option value="">responsable —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
                <select
                  value={s.statut}
                  onChange={(e) => maj(s.id, { statut: e.target.value })}
                  className=""
                >
                  {STATUTS_SECTEUR.map((st) => (
                    <option key={st.valeur} value={st.valeur}>{st.libelle}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const STATUTS_EVALUATION_CRISE = [
  { valeur: 'a_realiser', libelle: 'À réaliser' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'realise', libelle: 'Réalisé' },
  { valeur: 'en_retard', libelle: 'En retard' },
]

const STATUTS_REX_RECOMMANDATION = [
  { valeur: 'ouverte', libelle: 'Ouverte' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'cloturee', libelle: 'Clôturée' },
  { valeur: 'abandonnee', libelle: 'Abandonnée' },
]

function SectionRex({ incidentId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [evaluation, setEvaluation] = useState(null)
  const [recommandations, setRecommandations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjoutRecommandation, setEnAjoutRecommandation] = useState(false)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data: evalData, error: evalError } = await supabase
      .from('evaluations_crise')
      .select('*, contacts(id, nom, prenom)')
      .eq('incident_id', incidentId)
      .maybeSingle()
    if (evalError) setErreur(evalError.message)
    setEvaluation(evalData ?? null)

    if (evalData) {
      const { data: recoData, error: recoError } = await supabase
        .from('rex_recommandations')
        .select('*, contacts(id, nom, prenom)')
        .eq('evaluation_crise_id', evalData.id)
      if (recoError) setErreur(recoError.message)
      else setRecommandations(recoData ?? [])
    }
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function demarrerRex() {
    const echeance = new Date()
    echeance.setMonth(echeance.getMonth() + 3)
    const { error } = await supabase.from('evaluations_crise').insert({
      incident_id: incidentId,
      date_incident_cloture: new Date().toISOString().slice(0, 10),
      echeance_rex: echeance.toISOString().slice(0, 10),
    })
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function majEvaluation(champs) {
    const { error } = await supabase.from('evaluations_crise').update(champs).eq('id', evaluation.id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function retirerRecommandation(id) {
    await supabase.from('rex_recommandations').delete().eq('id', id)
    await rafraichir()
  }

  async function changerStatutRecommandation(id, statut) {
    const { error } = await supabase.from('rex_recommandations').update({ statut }).eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  return (
    <div>
      <h2 className="font-medium text-encre mb-2">REX — évaluation post-crise</h2>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : !evaluation ? (
        <div className="border border-dashed border-trait rounded p-4 text-center">
          <p className="text-sm text-sourdine mb-2">Aucun REX formel démarré pour cet incident.</p>
          <BoutonDiscret onClick={demarrerRex}>Démarrer le REX (échéance à 3 mois)</BoutonDiscret>
        </div>
      ) : (
        <div className="bg-surface border border-trait rounded p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-sourdine">
              Échéance : <strong>{evaluation.echeance_rex}</strong>
            </p>
            <div className="flex items-center gap-2">
              <select
                value={evaluation.responsable_contact_id ?? ''}
                onChange={(e) => majEvaluation({ responsable_contact_id: e.target.value || null })}
                className=""
              >
                <option value="">responsable —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
              </select>
              <select
                value={evaluation.statut}
                onChange={(e) => majEvaluation({ statut: e.target.value })}
                className=""
              >
                {STATUTS_EVALUATION_CRISE.map((s) => (
                  <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                ))}
              </select>
            </div>
          </div>
          {evaluation.contacts && (
            <p className="text-xs text-sourdine">responsable REX : {evaluation.contacts.prenom} {evaluation.contacts.nom}</p>
          )}

          <textarea
            value={evaluation.synthese ?? ''}
            onChange={(e) => setEvaluation({ ...evaluation, synthese: e.target.value })}
            onBlur={(e) => majEvaluation({ synthese: e.target.value.trim() || null })}
            placeholder="Synthèse du REX…"
            rows={3}
            className="w-full"
          />

          <div className="pt-2 border-t border-trait">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-sourdine">Recommandations</p>
              {!enAjoutRecommandation && (
                <button type="button" onClick={() => setEnAjoutRecommandation(true)} className="text-xs text-info hover:underline">
                  + ajouter
                </button>
              )}
            </div>

            {enAjoutRecommandation && (
              <FormulaireRecommandation
                evaluationCriseId={evaluation.id}
                contacts={contacts}
                onAnnuler={() => setEnAjoutRecommandation(false)}
                onValider={async () => {
                  setEnAjoutRecommandation(false)
                  await rafraichir()
                }}
              />
            )}

            {recommandations.length === 0 ? (
              <p className="text-xs text-sourdine">Aucune recommandation pour l'instant.</p>
            ) : (
              <ul className="space-y-1">
                {recommandations.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2 text-xs bg-fond rounded px-2.5 py-1.5 border border-trait">
                    <div>
                      <p className="text-encre">{r.recommandation}</p>
                      <p className="text-sourdine">
                        constat : {r.constat}{r.echeance && <> · échéance : {r.echeance}</>}
                      </p>
                      {r.contacts && (
                        <p className="text-sourdine">responsable : {r.contacts.prenom} {r.contacts.nom}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <select
                        value={r.statut}
                        onChange={(e) => changerStatutRecommandation(r.id, e.target.value)}
                        className=""
                      >
                        {STATUTS_REX_RECOMMANDATION.map((s) => (
                          <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => retirerRecommandation(r.id)} className="text-sourdine hover:text-chaud">✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FormulaireRecommandation({ evaluationCriseId, contacts = [], onValider, onAnnuler }) {
  const [constat, setConstat] = useState('')
  const [recommandation, setRecommandation] = useState('')
  const [echeance, setEcheance] = useState('')
  const [responsableContactId, setResponsableContactId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('rex_recommandations').insert({
      evaluation_crise_id: evaluationCriseId,
      constat: constat.trim(),
      recommandation: recommandation.trim(),
      echeance: echeance || null,
      responsable_contact_id: responsableContactId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-fond border border-trait rounded p-2.5 mb-2 space-y-2">
      <input required value={constat} onChange={(e) => setConstat(e.target.value)} placeholder="Constat" className="w-full" />
      <input required value={recommandation} onChange={(e) => setRecommandation(e.target.value)} placeholder="Recommandation" className="w-full" />
      <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className="w-full" />
      <select
        value={responsableContactId}
        onChange={(e) => setResponsableContactId(e.target.value)}
        className="w-full"
      >
        <option value="">Responsable — aucun</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
        ))}
      </select>
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter'}</BoutonDiscret>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function SectionSitReps({ incidentId, contexteId }) {
  const [sitreps, setSitreps] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)
  const { lignes: niveaux } = useTableContexte('niveaux_escalade', contexteId, { tri: 'ordre' })
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const { lignes: centresAccueil } = useTableContexte('centres_accueil', contexteId, { tri: 'nom' })

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('sitreps')
      .select('*, contacts(id, nom, prenom), centres_accueil(id, nom)')
      .eq('incident_id', incidentId)
      .order('numero', { ascending: false })
    if (error) setErreur(error.message)
    else setSitreps(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-encre">SitRep</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Nouveau SitRep</BoutonPrincipal>}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSitRep
          incidentId={incidentId}
          niveaux={niveaux}
          contacts={contacts}
          centresAccueil={centresAccueil}
          prochainNumero={sitreps.length > 0 ? Math.max(...sitreps.map((s) => s.numero)) + 1 : 1}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : sitreps.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Aucun SitRep pour cet incident.
        </p>
      ) : (
        <ul className="space-y-2">
          {sitreps.map((s) => (
            <li key={s.id} className="bg-surface border border-trait rounded p-3">
              <p className="text-sm font-medium text-encre">
                SitRep n°{s.numero}
                <span className="ml-2 text-xs text-sourdine">
                  {new Date(s.horodatage).toLocaleString('fr-BE')}
                </span>
              </p>
              <p className="text-xs text-sourdine mt-1">
                U0:{s.victimes_u0 ?? 0} · U1:{s.victimes_u1 ?? 0} · U2:{s.victimes_u2 ?? 0} · U3:{s.victimes_u3 ?? 0}
              </p>
              {s.localisation_incident && (
                <p className="text-xs text-sourdine">lieu : {s.localisation_incident}</p>
              )}
              {s.contacts && (
                <p className="text-xs text-sourdine">Dir. PC-Ops : {s.contacts.prenom} {s.contacts.nom}</p>
              )}
              {s.centres_accueil && (
                <p className="text-xs text-sourdine">centre d'accueil : {s.centres_accueil.nom}</p>
              )}
              {s.mesures_reflexes && (
                <p className="text-xs text-sourdine italic mt-1">{s.mesures_reflexes}</p>
              )}

              <SectionDisciplinesSitrep sitrepId={s.id} contexteId={contexteId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SectionDisciplinesSitrep({ sitrepId, contexteId }) {
  const { lignes: disciplines } = useTableContexte('disciplines', contexteId, { tri: 'libelle' })
  const [lignesDisciplines, setLignesDisciplines] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('sitrep_disciplines')
      .select('*, disciplines(id, libelle)')
      .eq('sitrep_id', sitrepId)
    if (error) setErreur(error.message)
    else setLignesDisciplines(data ?? [])
    setChargement(false)
  }, [sitrepId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function retirer(id) {
    if (!confirm('Supprimer ce point de situation par discipline ?')) return
    await supabase.from('sitrep_disciplines').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="mt-2 pt-2 border-t border-trait">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-sourdine">Point par discipline</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-info hover:underline">
            + ajouter
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-chaud mt-1">{erreur}</p>}

      {enAjout && (
        <FormulaireDisciplineSitrep
          sitrepId={sitrepId}
          disciplines={disciplines}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-sourdine mt-1">Chargement…</p>
      ) : lignesDisciplines.length === 0 ? (
        !enAjout && <p className="text-xs text-sourdine mt-1">Aucun point par discipline.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {lignesDisciplines.map((d) => (
            <li key={d.id} className="bg-fond rounded px-2 py-1.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sourdine">{d.disciplines?.libelle ?? '—'}</p>
                  {Array.isArray(d.personnes_presentes) && d.personnes_presentes.length > 0 && (
                    <p className="text-sourdine">présents : {d.personnes_presentes.join(', ')}</p>
                  )}
                  {d.actions_en_cours && <p className="text-sourdine">actions : {d.actions_en_cours}</p>}
                  {d.besoins_internes && <p className="text-sourdine">besoins : {d.besoins_internes}</p>}
                  {d.demandes_vers_autres_disciplines && (
                    <p className="text-sourdine">demandes vers autres disciplines : {d.demandes_vers_autres_disciplines}</p>
                  )}
                  {d.remarques && <p className="text-sourdine italic">{d.remarques}</p>}
                </div>
                <button type="button" onClick={() => retirer(d.id)} className="text-sourdine hover:text-chaud flex-shrink-0">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireDisciplineSitrep({ sitrepId, disciplines = [], onValider, onAnnuler }) {
  const [disciplineId, setDisciplineId] = useState('')
  const [personnesPresentes, setPersonnesPresentes] = useState('')
  const [actionsEnCours, setActionsEnCours] = useState('')
  const [besoinsInternes, setBesoinsInternes] = useState('')
  const [demandesVersAutresDisciplines, setDemandesVersAutresDisciplines] = useState('')
  const [remarques, setRemarques] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('sitrep_disciplines').insert({
      sitrep_id: sitrepId,
      discipline_id: disciplineId,
      personnes_presentes: personnesPresentes.trim()
        ? personnesPresentes.split(',').map((p) => p.trim()).filter(Boolean)
        : [],
      actions_en_cours: actionsEnCours.trim() || null,
      besoins_internes: besoinsInternes.trim() || null,
      demandes_vers_autres_disciplines: demandesVersAutresDisciplines.trim() || null,
      remarques: remarques.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-trait rounded p-2.5 mt-1 space-y-2">
      <select
        required
        value={disciplineId}
        onChange={(e) => setDisciplineId(e.target.value)}
        className="w-full"
      >
        <option value="">Discipline — choisir</option>
        {disciplines.map((d) => (
          <option key={d.id} value={d.id}>{d.libelle}</option>
        ))}
      </select>
      <input
        value={personnesPresentes}
        onChange={(e) => setPersonnesPresentes(e.target.value)}
        placeholder="Personnes présentes (séparées par des virgules)"
        className="w-full"
      />
      <textarea
        value={actionsEnCours}
        onChange={(e) => setActionsEnCours(e.target.value)}
        placeholder="Actions en cours"
        rows={2}
        className="w-full"
      />
      <textarea
        value={besoinsInternes}
        onChange={(e) => setBesoinsInternes(e.target.value)}
        placeholder="Besoins internes"
        rows={2}
        className="w-full"
      />
      <textarea
        value={demandesVersAutresDisciplines}
        onChange={(e) => setDemandesVersAutresDisciplines(e.target.value)}
        placeholder="Demandes vers autres disciplines"
        rows={2}
        className="w-full"
      />
      <textarea
        value={remarques}
        onChange={(e) => setRemarques(e.target.value)}
        placeholder="Remarques"
        rows={2}
        className="w-full"
      />
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter'}</BoutonDiscret>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function FormulaireSitRep({ incidentId, niveaux, contacts = [], centresAccueil = [], prochainNumero, onValider, onAnnuler }) {
  const [niveauId, setNiveauId] = useState('')
  const [typeIncident, setTypeIncident] = useState('')
  const [u0, setU0] = useState(0)
  const [u1, setU1] = useState(0)
  const [u2, setU2] = useState(0)
  const [u3, setU3] = useState(0)
  const [localisationIncident, setLocalisationIncident] = useState('')
  const [localisationPcOps, setLocalisationPcOps] = useState('')
  const [dirPcOpsContactId, setDirPcOpsContactId] = useState('')
  const [localisationCentreAccueilId, setLocalisationCentreAccueilId] = useState('')
  const [mesuresReflexes, setMesuresReflexes] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('sitreps').insert({
      incident_id: incidentId,
      numero: prochainNumero,
      niveau_id: niveauId || null,
      type_incident: typeIncident.trim() || null,
      victimes_u0: Number(u0) || 0,
      victimes_u1: Number(u1) || 0,
      victimes_u2: Number(u2) || 0,
      victimes_u3: Number(u3) || 0,
      localisation_incident: localisationIncident.trim() || null,
      localisation_pc_ops: localisationPcOps.trim() || null,
      dir_pc_ops_contact_id: dirPcOpsContactId || null,
      localisation_centre_accueil_id: localisationCentreAccueilId || null,
      mesures_reflexes: mesuresReflexes.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-3 bg-fond space-y-3">
      <p className="text-xs text-sourdine">SitRep n°{prochainNumero}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type</label>
          <input value={typeIncident} onChange={(e) => setTypeIncident(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau</label>
          <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full">
            <option value="">—</option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Victimes par catégorie de tri</label>
        <div className="grid grid-cols-4 gap-2">
          {[['U0', u0, setU0], ['U1', u1, setU1], ['U2', u2, setU2], ['U3', u3, setU3]].map(([label, val, setVal]) => (
            <div key={label}>
              <span className="text-xs text-sourdine">{label}</span>
              <input type="number" min="0" value={val} onChange={(e) => setVal(e.target.value)} className="w-full" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Localisation incident</label>
        <input value={localisationIncident} onChange={(e) => setLocalisationIncident(e.target.value)} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Localisation PC-Ops</label>
        <input value={localisationPcOps} onChange={(e) => setLocalisationPcOps(e.target.value)} className="w-full" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Dir. PC-Ops</label>
          <select value={dirPcOpsContactId} onChange={(e) => setDirPcOpsContactId(e.target.value)} className="w-full">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Centre d'accueil concerné</label>
          <select value={localisationCentreAccueilId} onChange={(e) => setLocalisationCentreAccueilId(e.target.value)} className="w-full">
            <option value="">—</option>
            {centresAccueil.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Mesures réflexes</label>
        <textarea value={mesuresReflexes} onChange={(e) => setMesuresReflexes(e.target.value)} rows={2} className="w-full" />
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer le SitRep'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function SectionChecklist({ incidentId, contexteId }) {
  const [templates, setTemplates] = useState([])
  const [executions, setExecutions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [filtreRole, setFiltreRole] = useState('')
  const { lignes: roles } = useTableContexte('roles', contexteId, { tri: 'libelle' })

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const [tplRes, execRes] = await Promise.all([
      supabase
        .from('checklist_templates')
        .select('*, roles(id, libelle), niveaux_escalade(id, libelle)')
        .eq('contexte_id', contexteId)
        .order('ordre'),
      supabase
        .from('checklist_executions')
        .select('*')
        .eq('incident_id', incidentId),
    ])
    if (tplRes.error) setErreur(tplRes.error.message)
    else setTemplates(tplRes.data ?? [])
    if (execRes.error) setErreur(execRes.error.message)
    else setExecutions(execRes.data ?? [])
    setChargement(false)
  }, [contexteId, incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function basculerExecution(template) {
    const existante = executions.find((e) => e.template_id === template.id)
    if (existante) {
      const { error } = await supabase
        .from('checklist_executions')
        .update({
          execute: !existante.execute,
          horodatage_execution: !existante.execute ? new Date().toISOString() : null,
        })
        .eq('id', existante.id)
      if (error) setErreur(error.message)
    } else {
      const { error } = await supabase.from('checklist_executions').insert({
        incident_id: incidentId,
        template_id: template.id,
        execute: true,
        horodatage_execution: new Date().toISOString(),
      })
      if (error) setErreur(error.message)
    }
    await rafraichir()
  }

  const templatesFiltres = filtreRole ? templates.filter((t) => t.role_id === filtreRole) : templates

  // Regroupement par déclencheur
  const groupes = []
  for (const t of templatesFiltres) {
    let g = groupes.find((x) => x.declencheur === t.declencheur)
    if (!g) {
      g = { declencheur: t.declencheur, items: [] }
      groupes.push(g)
    }
    g.items.push(t)
  }

  const executionParTemplate = Object.fromEntries(executions.map((e) => [e.template_id, e]))
  const total = templatesFiltres.length
  const faits = templatesFiltres.filter((t) => executionParTemplate[t.id]?.execute).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-encre">Checklist</h2>
        {total > 0 && (
          <span className="text-xs text-sourdine">{faits} / {total} actions faites</span>
        )}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      <div className="mb-3">
        <select
          value={filtreRole}
          onChange={(e) => setFiltreRole(e.target.value)}
          className=""
        >
          <option value="">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.libelle}</option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Aucune checklist type définie pour ce contexte (à créer dans l'app Admin).
        </p>
      ) : (
        <div className="space-y-4">
          {groupes.map((g) => (
            <div key={g.declencheur}>
              <h3 className="text-xs font-semibold text-sourdine mb-1.5">{g.declencheur}</h3>
              <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
                {g.items.map((t) => {
                  const exec = executionParTemplate[t.id]
                  const fait = exec?.execute ?? false
                  return (
                    <li key={t.id} className="flex items-center justify-between px-4 py-2">
                      <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fait}
                          onChange={() => basculerExecution(t)}
                          className="w-4 h-4"
                        />
                        <span className={`text-sm ${fait ? 'text-sourdine line-through' : 'text-encre'}`}>
                          {t.libelle}
                        </span>
                        {t.roles?.libelle && (
                          <span className="text-xs text-sourdine flex-shrink-0">({t.roles.libelle})</span>
                        )}
                      </label>
                      {fait && exec.horodatage_execution && (
                        <span className="text-xs text-sourdine flex-shrink-0 ml-2">
                          {new Date(exec.horodatage_execution).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionLivreDeBord({ incidentId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [entrees, setEntrees] = useState([])
  const [chargement, setChargement] = useState(true)
  const [message, setMessage] = useState('')
  const [decision, setDecision] = useState('')
  const [expediteurContactId, setExpediteurContactId] = useState('')
  const [destinataireContactId, setDestinataireContactId] = useState('')
  const [justificationPrevoyance, setJustificationPrevoyance] = useState('')
  const [informerPopulation, setInformerPopulation] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('livre_de_bord')
      .select('*, expediteur:expediteur_contact_id(id, nom, prenom), destinataire:destinataire_contact_id(id, nom, prenom)')
      .eq('incident_id', incidentId)
      .order('numero_ordre', { ascending: false })
    if (error) setErreur(error.message)
    else setEntrees(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouterEntree(e) {
    e.preventDefault()
    if (!message.trim()) return
    setEnCours(true)
    const prochainNumero = entrees.length > 0 ? Math.max(...entrees.map((x) => x.numero_ordre)) + 1 : 1
    const { error } = await supabase.from('livre_de_bord').insert({
      incident_id: incidentId,
      numero_ordre: prochainNumero,
      message: message.trim(),
      decision: decision.trim() || null,
      expediteur_contact_id: expediteurContactId || null,
      destinataire_contact_id: destinataireContactId || null,
      justification_prevoyance: justificationPrevoyance.trim() || null,
      information_population_horodatage: informerPopulation ? new Date().toISOString() : null,
    })
    setEnCours(false)
    if (error) {
      setErreur(error.message)
    } else {
      setMessage('')
      setDecision('')
      setExpediteurContactId('')
      setDestinataireContactId('')
      setJustificationPrevoyance('')
      setInformerPopulation(false)
      await rafraichir()
    }
  }

  return (
    <div>
      <h2 className="font-medium text-encre mb-2">Livre de bord</h2>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      <form onSubmit={ajouterEntree} className="border border-trait rounded p-3 mb-3 bg-fond space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message / événement…"
          rows={2}
          className="w-full"
        />
        <input
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          placeholder="Décision associée (optionnel)"
          className="w-full"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            value={expediteurContactId}
            onChange={(e) => setExpediteurContactId(e.target.value)}
            className="w-full"
          >
            <option value="">Expéditeur — aucun</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
          <select
            value={destinataireContactId}
            onChange={(e) => setDestinataireContactId(e.target.value)}
            className="w-full"
          >
            <option value="">Destinataire — aucun</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">
            Justification de prévoyance (réforme resp. civile 2025, art. 6.15 — pourquoi cette décision était raisonnable au moment où elle a été prise)
          </label>
          <textarea
            value={justificationPrevoyance}
            onChange={(e) => setJustificationPrevoyance(e.target.value)}
            rows={2}
            className="w-full"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-sourdine">
          <input type="checkbox" checked={informerPopulation} onChange={(e) => setInformerPopulation(e.target.checked)} />
          Information de la population horodatée à cette entrée (le défaut d'information est une circonstance aggravante retenue par la jurisprudence — Xynthia 2010)
        </label>
        <BoutonPrincipal type="submit" disabled={enCours || !message.trim()}>
          {enCours ? 'Ajout…' : 'Ajouter au livre de bord'}
        </BoutonPrincipal>
      </form>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : entrees.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Aucune entrée pour l'instant.
        </p>
      ) : (
        <ul className="space-y-2">
          {entrees.map((e) => (
            <li key={e.id} className="bg-surface border border-trait rounded p-3">
              <p className="text-xs text-sourdine">
                #{e.numero_ordre} · {new Date(e.horodatage).toLocaleString('fr-BE')}
              </p>
              <p className="text-sm text-encre mt-0.5">{e.message}</p>
              {e.decision && <p className="text-xs text-sourdine mt-1">décision : {e.decision}</p>}
              {e.justification_prevoyance && (
                <p className="text-xs text-sourdine mt-0.5">prévoyance : {e.justification_prevoyance}</p>
              )}
              {e.information_population_horodatage && (
                <p className="text-xs text-ok mt-0.5">
                  population informée le {new Date(e.information_population_horodatage).toLocaleString('fr-BE')}
                </p>
              )}
              {(e.expediteur || e.destinataire) && (
                <p className="text-xs text-sourdine mt-0.5">
                  {e.expediteur && <>de {e.expediteur.prenom} {e.expediteur.nom}</>}
                  {e.expediteur && e.destinataire && <> → </>}
                  {e.destinataire && <>à {e.destinataire.prenom} {e.destinataire.nom}</>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Hook générique pour une table enfant simple scopée par incident_id (pattern
// repris de EntiteCritique.jsx côté admin, adapté ici à incident_id).
function useCrudSimpleIncident(table, incidentId) {
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase.from(table).select('*').eq('incident_id', incidentId)
    if (error) setErreur(error.message)
    else setLignes(data ?? [])
    setChargement(false)
  }, [table, incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from(table).insert({ ...valeurs, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }
  async function modifier(id, valeurs) {
    const { error } = await supabase.from(table).update(valeurs).eq('id', id)
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }
  async function supprimer(id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (!error) await rafraichir()
  }

  return { lignes, chargement, erreur, creer, modifier, supprimer }
}

function BlocD5({ titre, aide, children }) {
  return (
    <div className="border border-trait rounded p-4 bg-surface">
      <p className="etiquette mb-1">{titre}</p>
      {aide && <p className="text-xs text-sourdine mb-2">{aide}</p>}
      {children}
    </div>
  )
}

const ROLES_POCC = [
  { valeur: 'analyste', libelle: 'Analyste (méthode IBS)' },
  { valeur: 'teamleader', libelle: 'Teamleader' },
  { valeur: 'redacteur', libelle: 'Rédacteur / D5 terrain' },
  { valeur: 'strategue', libelle: 'Stratège (Dir-D5)' },
  { valeur: 'porte_parole', libelle: 'Porte-parole' },
]

const ROLES_PC_OPS = [
  { valeur: 'cpu', libelle: 'CPU' },
  { valeur: 'ihf', libelle: 'IHF' },
  { valeur: 'psim', libelle: 'PSIM' },
  { valeur: 'expert', libelle: 'Expert' },
  { valeur: 'dir_si', libelle: 'Dir-Si (D1 secours)' },
  { valeur: 'dir_med', libelle: 'Dir-Med (D2 médical)' },
  { valeur: 'dir_pol', libelle: 'Dir-Pol (D3 police)' },
  { valeur: 'dir_log', libelle: 'Dir-Log (D4 logistique)' },
  { valeur: 'dir_info', libelle: 'Dir-Info (D5 information)' },
]

const PILIERS_MESSAGE_REFLEXE = [
  { valeur: 'we_know', libelle: 'WE KNOW!' },
  { valeur: 'we_do', libelle: 'WE DO!' },
  { valeur: 'we_care', libelle: 'WE CARE!' },
  { valeur: 'we_ll_be_back', libelle: "WE'LL BE BACK!" },
]

const STATUTS_MESSAGE_REFLEXE = [
  { valeur: 'brouillon', libelle: 'Brouillon' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'publie', libelle: 'Publié' },
]

const TONALITES_WEBCARE = [
  { valeur: 'positif', libelle: 'Positif' },
  { valeur: 'neutre', libelle: 'Neutre' },
  { valeur: 'critique', libelle: 'Critique' },
  { valeur: 'injurieux', libelle: 'Injurieux' },
  { valeur: 'panique', libelle: 'Panique' },
  { valeur: 'menacant', libelle: 'Menaçant' },
  { valeur: 'phishing', libelle: 'Phishing' },
]

const ACTIONS_WEBCARE = [
  { valeur: 'repondu', libelle: 'Répondu' },
  { valeur: 'redirige', libelle: 'Redirigé' },
  { valeur: 'bloque', libelle: 'Bloqué' },
  { valeur: 'signale_police', libelle: 'Signalé à la police' },
  { valeur: 'ignore', libelle: 'Ignoré' },
  { valeur: 'supprime', libelle: 'Supprimé' },
  { valeur: 'like_favori', libelle: 'Like / favori' },
]

function SectionCommunicationD5({ incidentId }) {
  return (
    <div>
      <h2 className="font-medium text-encre mb-1">Communication de crise (POCC)</h2>
      <p className="text-xs text-sourdine mb-3">
        Processus Opérationnel en Communication de Crise (D5) : flux Analyste → Teamleader →
        Rédacteur → Stratège → Effet. Les messages réflexes couvrent les 4 piliers WE KNOW! / WE
        DO! / WE CARE! / WE'LL BE BACK!.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <GestionPoccRoles incidentId={incidentId} />
        <GestionNumerosInformation incidentId={incidentId} />
        <GestionMessagesReflexes incidentId={incidentId} />
        <GestionStrategieCommunication incidentId={incidentId} />
        <GestionAnalysesIbs incidentId={incidentId} />
        <GestionWebcare incidentId={incidentId} />
      </div>
    </div>
  )
}

function GestionPoccRoles({ incidentId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useCrudSimpleIncident('pocc_roles', incidentId)
  const [role, setRole] = useState('analyste')
  const [personne, setPersonne] = useState('')
  const [contact, setContact] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    if (!personne.trim()) return
    const { error } = await creer({ role, personne: personne.trim(), contact: contact.trim() || null })
    if (!error) {
      setPersonne('')
      setContact('')
    }
  }

  return (
    <BlocD5 titre="Rôles POCC">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-2">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="text-xs">
          {ROLES_POCC.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
        </select>
        <input value={personne} onChange={(e) => setPersonne(e.target.value)} placeholder="personne" className="text-xs flex-1 min-w-[6rem]" />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="contact" className="text-xs flex-1 min-w-[6rem]" />
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {lignes.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
              <span>{ROLES_POCC.find((x) => x.valeur === r.role)?.libelle ?? r.role} — {r.personne}{r.contact && <> ({r.contact})</>}</span>
              <BoutonDiscret onClick={() => supprimer(r.id)}>×</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

function GestionNumerosInformation({ incidentId }) {
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useCrudSimpleIncident('numeros_information_crise', incidentId)
  const [niveau, setNiveau] = useState('local')
  const [numero, setNumero] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    const { error } = await creer({ niveau, numero: numero.trim() || null, statut: 'pre_alerte' })
    if (!error) setNumero('')
  }

  return (
    <BlocD5 titre="Numéros d'information de crise">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-2">
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="text-xs">
          <option value="local">Local</option>
          <option value="national">National</option>
        </select>
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="numéro" className="text-xs flex-1 min-w-[6rem]" />
        <BoutonDiscret type="submit">Activer</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {lignes.map((n) => (
            <li key={n.id} className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
              <span>
                {n.niveau} {n.numero && <>· {n.numero}</>}
                {n.faq_prete && <> · FAQ prête</>}
              </span>
              <span className="flex gap-1">
                <select value={n.statut} onChange={(e) => modifier(n.id, { statut: e.target.value })} className="text-xs">
                  <option value="inactif">Inactif</option>
                  <option value="pre_alerte">Pré-alerte</option>
                  <option value="actif">Actif</option>
                </select>
                <BoutonDiscret onClick={() => modifier(n.id, { faq_prete: !n.faq_prete })}>FAQ</BoutonDiscret>
                <BoutonDiscret onClick={() => supprimer(n.id)}>×</BoutonDiscret>
              </span>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

function GestionMessagesReflexes({ incidentId }) {
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useCrudSimpleIncident('pocc_messages_reflexes', incidentId)
  const [pilier, setPilier] = useState('we_know')
  const [contenu, setContenu] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    if (!contenu.trim()) return
    const { error } = await creer({ pilier, contenu: contenu.trim() })
    if (!error) setContenu('')
  }

  return (
    <BlocD5 titre="Messages réflexes">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="space-y-1.5 mb-2">
        <select value={pilier} onChange={(e) => setPilier(e.target.value)} className="text-xs w-full">
          {PILIERS_MESSAGE_REFLEXE.map((p) => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
        </select>
        <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={2} placeholder="contenu du message" className="text-xs w-full" />
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {lignes.map((m) => (
            <li key={m.id} className="text-xs bg-fond border border-trait rounded px-2 py-1">
              <div className="flex items-center justify-between">
                <span className="jeton text-info">{PILIERS_MESSAGE_REFLEXE.find((p) => p.valeur === m.pilier)?.libelle}</span>
                <span className="flex gap-1">
                  <select value={m.statut} onChange={(e) => modifier(m.id, { statut: e.target.value, publie_a: e.target.value === 'publie' ? new Date().toISOString() : m.publie_a })} className="text-xs">
                    {STATUTS_MESSAGE_REFLEXE.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
                  </select>
                  <BoutonDiscret onClick={() => supprimer(m.id)}>×</BoutonDiscret>
                </span>
              </div>
              <p className="mt-1">{m.contenu}</p>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

function GestionStrategieCommunication({ incidentId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useCrudSimpleIncident('pocc_strategie_communication', incidentId)
  const [objectif, setObjectif] = useState('')
  const [cercleVictimes, setCercleVictimes] = useState('')
  const [strategie, setStrategie] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    if (!objectif.trim()) return
    const { error } = await creer({
      objectif: objectif.trim(),
      cercle_victimes_niveau: cercleVictimes || null,
      strategie: strategie || null,
    })
    if (!error) {
      setObjectif('')
      setCercleVictimes('')
      setStrategie('')
    }
  }

  return (
    <BlocD5 titre="Stratégie de communication (Dir-D5)" aide="Objectif/Contenu/Tonalité/Canal + cercle des victimes.">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="space-y-1.5 mb-2">
        <input value={objectif} onChange={(e) => setObjectif(e.target.value)} placeholder="objectif" className="text-xs w-full" />
        <div className="flex gap-1.5">
          <select value={cercleVictimes} onChange={(e) => setCercleVictimes(e.target.value)} className="text-xs flex-1">
            <option value="">cercle des victimes —</option>
            <option value="victimes_survivants_famille">Victimes/survivants/famille</option>
            <option value="concerne_proche">Concerné proche</option>
            <option value="concerne_large">Concerné large</option>
          </select>
          <select value={strategie} onChange={(e) => setStrategie(e.target.value)} className="text-xs flex-1">
            <option value="">stratégie —</option>
            <option value="stealing_thunder">Stealing thunder</option>
            <option value="framing_rationnel">Framing rationnel</option>
            <option value="framing_emotionnel">Framing émotionnel</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {[...lignes].reverse().map((s) => (
            <li key={s.id} className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
              <span>{s.objectif}{s.strategie && <> · {s.strategie}</>}</span>
              <BoutonDiscret onClick={() => supprimer(s.id)}>×</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

function GestionAnalysesIbs({ incidentId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useCrudSimpleIncident('pocc_analyses_ibs', incidentId)
  const [information, setInformation] = useState('')
  const [behavior, setBehavior] = useState('')
  const [sensemaking, setSensemaking] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    if (!information.trim() && !behavior.trim() && !sensemaking.trim()) return
    const { error } = await creer({
      information: information.trim() || null,
      behavior: behavior.trim() || null,
      sensemaking: sensemaking.trim() || null,
    })
    if (!error) {
      setInformation('')
      setBehavior('')
      setSensemaking('')
    }
  }

  return (
    <BlocD5 titre="Analyses IBS (Analyste)" aide="Information / Behavior / Sensemaking.">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="space-y-1.5 mb-2">
        <input value={information} onChange={(e) => setInformation(e.target.value)} placeholder="information" className="text-xs w-full" />
        <input value={behavior} onChange={(e) => setBehavior(e.target.value)} placeholder="behavior" className="text-xs w-full" />
        <input value={sensemaking} onChange={(e) => setSensemaking(e.target.value)} placeholder="sensemaking" className="text-xs w-full" />
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {[...lignes].reverse().map((a) => (
            <li key={a.id} className="text-xs bg-fond border border-trait rounded px-2 py-1">
              <div className="flex items-center justify-between">
                <span>{new Date(a.horodatage).toLocaleString('fr-BE')}</span>
                <BoutonDiscret onClick={() => supprimer(a.id)}>×</BoutonDiscret>
              </div>
              {a.information && <p>I: {a.information}</p>}
              {a.behavior && <p>B: {a.behavior}</p>}
              {a.sensemaking && <p>S: {a.sensemaking}</p>}
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

function GestionWebcare({ incidentId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useCrudSimpleIncident('webcare_messages', incidentId)
  const [messageOriginal, setMessageOriginal] = useState('')
  const [tonalite, setTonalite] = useState('neutre')
  const [actionPrise, setActionPrise] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    if (!messageOriginal.trim()) return
    const { error } = await creer({
      message_original: messageOriginal.trim(),
      tonalite,
      action_prise: actionPrise || null,
    })
    if (!error) {
      setMessageOriginal('')
      setActionPrise('')
    }
  }

  return (
    <BlocD5 titre="Webcare (modération réseaux sociaux)">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="space-y-1.5 mb-2">
        <textarea value={messageOriginal} onChange={(e) => setMessageOriginal(e.target.value)} rows={2} placeholder="message original" className="text-xs w-full" />
        <div className="flex gap-1.5">
          <select value={tonalite} onChange={(e) => setTonalite(e.target.value)} className="text-xs flex-1">
            {TONALITES_WEBCARE.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
          </select>
          <select value={actionPrise} onChange={(e) => setActionPrise(e.target.value)} className="text-xs flex-1">
            <option value="">action —</option>
            {ACTIONS_WEBCARE.map((a) => <option key={a.valeur} value={a.valeur}>{a.libelle}</option>)}
          </select>
        </div>
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {[...lignes].reverse().map((w) => (
            <li key={w.id} className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
              <span>
                <span className={`jeton ${['menacant', 'phishing', 'injurieux'].includes(w.tonalite) ? 'text-chaud' : 'text-sourdine'}`}>{w.tonalite}</span>
                {' '}{w.message_original?.slice(0, 40)}{w.action_prise && <> · {w.action_prise}</>}
              </span>
              <BoutonDiscret onClick={() => supprimer(w.id)}>×</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

function SectionPcOpsRoles({ incidentId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useCrudSimpleIncident('pc_ops_roles', incidentId)
  const [role, setRole] = useState('dir_si')
  const [personne, setPersonne] = useState('')
  const [contact, setContact] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    if (!personne.trim()) return
    const { error } = await creer({ role, personne: personne.trim(), contact: contact.trim() || null })
    if (!error) {
      setPersonne('')
      setContact('')
    }
  }

  return (
    <div>
      <h2 className="font-medium text-encre mb-1">Rôles PC-OPS (terrain)</h2>
      <p className="text-xs text-sourdine mb-3">
        Directeurs de discipline (D1-D5) et fonctions clés sur le poste de commandement opérationnel.
      </p>
      {erreur && <p className="text-xs text-chaud mb-2">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-3">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="text-sm">
          {ROLES_PC_OPS.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
        </select>
        <input value={personne} onChange={(e) => setPersonne(e.target.value)} placeholder="personne" className="text-sm flex-1 min-w-[8rem]" />
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="contact" className="text-sm flex-1 min-w-[8rem]" />
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun rôle PC-OPS attribué.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {lignes.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>
                {ROLES_PC_OPS.find((x) => x.valeur === r.role)?.libelle ?? r.role} — {r.personne}
                {r.contact && <span className="text-xs text-sourdine"> ({r.contact})</span>}
              </span>
              <BoutonDiscret onClick={() => supprimer(r.id)}>Retirer</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const NIVEAUX_IMPLIQUES = [
  { valeur: 'primaire', libelle: 'Primaire' },
  { valeur: 'secondaire', libelle: 'Secondaire' },
  { valeur: 'tertiaire', libelle: 'Tertiaire' },
]

const SOUS_CATEGORIES_IMPLIQUES = [
  { valeur: 'decede', libelle: 'Décédé' },
  { valeur: 'blesse', libelle: 'Blessé' },
  { valeur: 'indemne', libelle: 'Indemne' },
  { valeur: 'evacue', libelle: 'Évacué' },
  { valeur: 'temoin_direct', libelle: 'Témoin direct' },
  { valeur: 'proche_famille', libelle: 'Proche / famille' },
  { valeur: 'reseau_social', libelle: 'Réseau social' },
  { valeur: 'first_responder', libelle: 'First responder' },
  { valeur: 'intervenant', libelle: 'Intervenant' },
]

const TYPES_STRUCTURE_PIPS = [
  { valeur: 'ca', libelle: "CA — Centre d'Accueil" },
  { valeur: 'cap', libelle: "CAP — Centre d'Accueil des Proches" },
  { valeur: 'cat', libelle: "CAT — Centre d'Appel Téléphonique" },
  { valeur: 'ctd', libelle: 'CTD — Centre de Traitement des Données' },
  { valeur: 'ch', libelle: "CH — Centre d'Hébergement" },
]

const ORGANISMES_GESTIONNAIRES_PIPS = [
  { valeur: 'reseau_pips_local', libelle: 'Réseau PIPS local' },
  { valeur: 'sisu_croix_rouge', libelle: 'SISU / Croix-Rouge' },
  { valeur: 'dsi_flandre', libelle: 'DSI (Flandre)' },
]

const STATUTS_STRUCTURE_PIPS = [
  { valeur: 'inactif', libelle: 'Inactif' },
  { valeur: 'actif', libelle: 'Actif' },
  { valeur: 'ferme', libelle: 'Fermé' },
]

function SectionPsychosocialD2({ incidentId }) {
  return (
    <div>
      <h2 className="font-medium text-encre mb-1">Psychosocial (D2) — coordination D2-D5</h2>
      <p className="text-xs text-sourdine mb-3">
        Catégorisation des personnes impliquées (cercle primaire/secondaire/tertiaire), structures
        PIPS déployées, communication sur les victimes décédées et commémorations — guide D2-D5
        (NCCN / SPF Santé publique).
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <GestionCategorisationImpliques incidentId={incidentId} />
        <GestionStructuresPips incidentId={incidentId} />
        <GestionCommunicationVictimesDeces incidentId={incidentId} />
        <GestionCommemorations incidentId={incidentId} />
      </div>
    </div>
  )
}

function GestionCategorisationImpliques({ incidentId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useCrudSimpleIncident('categorisation_impliques', incidentId)
  const [personneRef, setPersonneRef] = useState('')
  const [niveau, setNiveau] = useState('primaire')
  const [sousCategorie, setSousCategorie] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    if (!personneRef.trim()) return
    const { error } = await creer({
      personne_ref: personneRef.trim(),
      niveau,
      sous_categorie: sousCategorie || null,
    })
    if (!error) {
      setPersonneRef('')
      setSousCategorie('')
    }
  }

  return (
    <BlocD5 titre="Personnes impliquées" aide="Toujours communiquer de l'intérieur du cercle vers l'extérieur (Ina Strating).">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-2">
        <input value={personneRef} onChange={(e) => setPersonneRef(e.target.value)} placeholder="personne / référence" className="text-xs flex-1 min-w-[8rem]" />
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="text-xs">
          {NIVEAUX_IMPLIQUES.map((n) => <option key={n.valeur} value={n.valeur}>{n.libelle}</option>)}
        </select>
        <select value={sousCategorie} onChange={(e) => setSousCategorie(e.target.value)} className="text-xs">
          <option value="">sous-catégorie —</option>
          {SOUS_CATEGORIES_IMPLIQUES.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
        </select>
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {lignes.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
              <span>
                <span className="jeton mr-1.5">{NIVEAUX_IMPLIQUES.find((n) => n.valeur === p.niveau)?.libelle ?? p.niveau}</span>
                {p.personne_ref}
                {p.sous_categorie && <> — {SOUS_CATEGORIES_IMPLIQUES.find((s) => s.valeur === p.sous_categorie)?.libelle ?? p.sous_categorie}</>}
              </span>
              <BoutonDiscret onClick={() => supprimer(p.id)}>×</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

function GestionStructuresPips({ incidentId }) {
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useCrudSimpleIncident('structures_pips', incidentId)
  const [typeStructure, setTypeStructure] = useState('ca')
  const [responsable, setResponsable] = useState('')
  const [organismeGestionnaire, setOrganismeGestionnaire] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    const { error } = await creer({
      type_structure: typeStructure,
      responsable: responsable.trim() || null,
      organisme_gestionnaire: organismeGestionnaire || null,
      statut: 'actif',
      date_ouverture: new Date().toISOString(),
    })
    if (!error) setResponsable('')
  }

  return (
    <BlocD5 titre="Structures PIPS">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-2">
        <select value={typeStructure} onChange={(e) => setTypeStructure(e.target.value)} className="text-xs">
          {TYPES_STRUCTURE_PIPS.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </select>
        <select value={organismeGestionnaire} onChange={(e) => setOrganismeGestionnaire(e.target.value)} className="text-xs">
          <option value="">organisme —</option>
          {ORGANISMES_GESTIONNAIRES_PIPS.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
        </select>
        <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="responsable" className="text-xs flex-1 min-w-[6rem]" />
        <BoutonDiscret type="submit">Ouvrir</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {lignes.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
              <span>
                {TYPES_STRUCTURE_PIPS.find((t) => t.valeur === s.type_structure)?.libelle ?? s.type_structure}
                {s.responsable && <> — {s.responsable}</>}
              </span>
              <span className="flex gap-1">
                <select value={s.statut} onChange={(e) => modifier(s.id, { statut: e.target.value, date_fermeture: e.target.value === 'ferme' ? new Date().toISOString() : null })} className="text-xs">
                  {STATUTS_STRUCTURE_PIPS.map((st) => <option key={st.valeur} value={st.valeur}>{st.libelle}</option>)}
                </select>
                <BoutonDiscret onClick={() => supprimer(s.id)}>×</BoutonDiscret>
              </span>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}

function GestionCommunicationVictimesDeces({ incidentId }) {
  const [ligne, setLigne] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('communication_victimes_deces')
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle()
    if (error) setErreur(error.message)
    else setLigne(data)
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creerOuModifier(valeurs) {
    if (ligne) {
      const { error } = await supabase.from('communication_victimes_deces').update(valeurs).eq('id', ligne.id)
      if (!error) await rafraichir()
      return { error }
    }
    const { error } = await supabase.from('communication_victimes_deces').insert({ ...valeurs, incident_id: incidentId })
    if (!error) await rafraichir()
    return { error }
  }

  if (chargement) {
    return (
      <BlocD5 titre="Communication — victimes décédées">
        <p className="text-xs text-sourdine">Chargement…</p>
      </BlocD5>
    )
  }

  const v = ligne ?? {}

  return (
    <BlocD5
      titre="Communication — victimes décédées"
      aide="Distinction stricte : le fait (à communiquer) ≠ l'identité (famille informée en premier, jamais par les autorités). Concertation parquet obligatoire."
    >
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <input
          type="number"
          min="0"
          value={v.nombre_victimes_estime ?? ''}
          onChange={(e) => creerOuModifier({ nombre_victimes_estime: e.target.value === '' ? null : Number(e.target.value) })}
          placeholder="victimes estimées"
          className="text-xs"
        />
        <input
          type="number"
          min="0"
          value={v.nombre_victimes_confirme ?? ''}
          onChange={(e) => creerOuModifier({ nombre_victimes_confirme: e.target.value === '' ? null : Number(e.target.value) })}
          placeholder="victimes confirmées"
          className="text-xs"
        />
      </div>
      <ul className="space-y-1">
        <li className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
          <span>Fait communiqué</span>
          <input
            type="checkbox"
            checked={v.fait_communique ?? false}
            onChange={(e) => creerOuModifier({ fait_communique: e.target.checked, date_communication_fait: e.target.checked ? new Date().toISOString() : null })}
          />
        </li>
        <li className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
          <span>Identité communiquée à la famille</span>
          <input
            type="checkbox"
            checked={v.identite_communiquee_famille ?? false}
            onChange={(e) => creerOuModifier({ identite_communiquee_famille: e.target.checked, date_information_famille: e.target.checked ? new Date().toISOString() : null })}
          />
        </li>
        <li className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
          <span>Concertation parquet effectuée</span>
          <input
            type="checkbox"
            checked={v.concertation_parquet ?? false}
            onChange={(e) => creerOuModifier({ concertation_parquet: e.target.checked })}
          />
        </li>
        <li className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
          <span>DVI impliqué (identification non connue)</span>
          <input
            type="checkbox"
            checked={v.dvi_implique ?? false}
            onChange={(e) => creerOuModifier({ dvi_implique: e.target.checked })}
          />
        </li>
      </ul>
    </BlocD5>
  )
}

function GestionCommemorations({ incidentId }) {
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useCrudSimpleIncident('commemorations', incidentId)
  const [datePrevue, setDatePrevue] = useState('')
  const [lieu, setLieu] = useState('')

  async function ajouter(e) {
    e.preventDefault()
    if (!datePrevue) return
    const { error } = await creer({ date_prevue: datePrevue, lieu: lieu.trim() || null })
    if (!error) {
      setDatePrevue('')
      setLieu('')
    }
  }

  return (
    <BlocD5 titre="Commémorations" aide="Facteurs de décision : souhaits des impliqués, impact, proximité, période, appréciation sociale, attention médiatique.">
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-2">
        <input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} className="text-xs" />
        <input value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="lieu" className="text-xs flex-1 min-w-[6rem]" />
        <BoutonDiscret type="submit">Planifier</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {lignes.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-xs bg-fond border border-trait rounded px-2 py-1">
              <span>
                {c.date_prevue}
                {c.lieu && <> — {c.lieu}</>}
              </span>
              <span className="flex gap-1">
                <select value={c.statut} onChange={(e) => modifier(c.id, { statut: e.target.value })} className="text-xs">
                  <option value="planifiee">Planifiée</option>
                  <option value="realisee">Réalisée</option>
                  <option value="annulee">Annulée</option>
                </select>
                <BoutonDiscret onClick={() => supprimer(c.id)}>×</BoutonDiscret>
              </span>
            </li>
          ))}
        </ul>
      )}
    </BlocD5>
  )
}
