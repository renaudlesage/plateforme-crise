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
  veille: { activation_30min: false, checklist: false, organes: false, suivi_operationnel: false, suivi_intervenants: false, phase_transitoire: false, rex: false },
  vigilance: { activation_30min: false, checklist: false, organes: false, suivi_operationnel: false, suivi_intervenants: false, phase_transitoire: false, rex: false },
  pre_alerte: { suivi_intervenants: false, phase_transitoire: false, rex: false },
  alerte: { phase_transitoire: false, rex: false },
  phase_active: {},
  levee: { activation_30min: false, checklist: false, rex: false },
  post_crise: { activation_30min: false, escalade: false, checklist: false, organes: false, suivi_operationnel: false, suivi_intervenants: false },
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
    })
    setEnCours(false)
    if (error) {
      setErreur(error.message)
    } else {
      setMessage('')
      setDecision('')
      setExpediteurContactId('')
      setDestinataireContactId('')
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
