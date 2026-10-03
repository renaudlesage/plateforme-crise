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

  const chargerIncident = useCallback(async () => {
    setChargementIncident(true)
    const { data } = await supabase
      .from('incidents')
      .select('*, niveaux_escalade(id, libelle)')
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

  if (chargementIncident) return <p className="text-sm text-slate-400">Chargement…</p>
  if (!incident) return <p className="text-sm text-red-600">Incident introuvable.</p>

  return (
    <div>
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-800">← retour aux incidents</Link>

      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{incident.nom}</h1>
          <p className="text-sm text-slate-500">
            {incident.type_evenement && <>{incident.type_evenement} · </>}
            {incident.niveaux_escalade?.libelle} · statut : {incident.statut}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <label className="text-xs text-slate-500">Degré de criticité :</label>
            <select
              value={incident.degre_criticite ?? ''}
              onChange={(e) => changerDegreCriticite(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
            >
              <option value="">—</option>
              <option value="1">1 — faible</option>
              <option value="2">2 — modéré</option>
              <option value="3">3 — sérieux</option>
              <option value="4">4 — majeur</option>
            </select>
          </div>
        </div>
        {incident.statut !== 'cloture' && (
          <BoutonDiscret onClick={cloturer}>Clôturer l'incident</BoutonDiscret>
        )}
      </div>

      <div className="mb-6">
        <SectionChecklist incidentId={id} contexteId={contexteId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SectionSitReps incidentId={id} contexteId={contexteId} />
        <SectionLivreDeBord incidentId={id} contexteId={contexteId} />
      </div>

      <div className="mb-6">
        <SectionSuiviIntervenants incidentId={id} contexteId={contexteId} />
      </div>

      <div className="mb-6">
        <SectionPhaseTransitoire incidentId={id} />
      </div>

      <div>
        <SectionRex incidentId={id} />
      </div>
    </div>
  )
}

const INDICATEURS_INTERVENANT = [
  { valeur: 'intoxication_co', libelle: 'Intoxication CO' },
  { valeur: 'fatigue', libelle: 'Fatigue' },
  { valeur: 'blessure', libelle: 'Blessure' },
  { valeur: 'exposition_chaleur', libelle: 'Exposition chaleur' },
  { valeur: 'exposition_froid', libelle: 'Exposition froid' },
  { valeur: 'autre', libelle: 'Autre' },
]

function SectionSuiviIntervenants({ incidentId, contexteId }) {
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [suivis, setSuivis] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('suivi_intervenants')
      .select('*, contacts(id, nom, prenom)')
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
        <h2 className="font-medium text-slate-900">Suivi santé/sécurité des intervenants</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Signaler</BoutonPrincipal>}
      </div>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSuiviIntervenant
          incidentId={incidentId}
          contacts={contacts}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : suivis.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-4 text-center">
          Aucun signalement pour cet incident.
        </p>
      ) : (
        <ul className="space-y-2">
          {suivis.map((s) => (
            <li key={s.id} className={`bg-white border rounded-lg p-3 ${s.necessite_relai ? 'border-amber-300' : 'border-slate-200'}`}>
              <p className="text-sm font-medium text-slate-900">
                {INDICATEURS_INTERVENANT.find((i) => i.valeur === s.indicateur)?.libelle ?? s.indicateur}
                {s.necessite_relai && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">relai nécessaire</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {s.contacts && <>{s.contacts.prenom} {s.contacts.nom} · </>}
                {new Date(s.horodatage).toLocaleString('fr-BE')}
              </p>
              {s.valeur && <p className="text-xs text-slate-500 mt-0.5">valeur : {s.valeur}</p>}
              {s.note && <p className="text-xs text-slate-400 mt-0.5 italic">{s.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireSuiviIntervenant({ incidentId, contacts, onValider, onAnnuler }) {
  const [contactId, setContactId] = useState('')
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
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-3 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Intervenant</label>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Indicateur</label>
          <select value={indicateur} onChange={(e) => setIndicateur(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            {INDICATEURS_INTERVENANT.map((i) => (
              <option key={i.valeur} value={i.valeur}>{i.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Valeur mesurée (optionnel)</label>
        <input value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="ex. 180 ppm CO" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={necessiteRelai} onChange={(e) => setNecessiteRelai(e.target.checked)} />
        Nécessite un relai immédiat
      </label>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

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

function SectionPhaseTransitoire({ incidentId }) {
  const [secteurs, setSecteurs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('phase_transitoire_secteurs')
      .select('*')
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
        <h2 className="font-medium text-slate-900">Phase transitoire post-crise (7 secteurs)</h2>
        {secteurs.length < SECTEURS_TRANSITOIRES.length && (
          <BoutonDiscret onClick={initialiser}>Initialiser les secteurs manquants</BoutonDiscret>
        )}
      </div>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : secteurs.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-4 text-center">
          Phase transitoire pas encore initialisée pour cet incident.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-white">
          {secteurs.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-slate-900">
                {SECTEURS_TRANSITOIRES.find((x) => x.valeur === s.secteur)?.libelle ?? s.secteur}
              </span>
              <select
                value={s.statut}
                onChange={(e) => maj(s.id, { statut: e.target.value })}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
              >
                {STATUTS_SECTEUR.map((st) => (
                  <option key={st.valeur} value={st.valeur}>{st.libelle}</option>
                ))}
              </select>
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

function SectionRex({ incidentId }) {
  const [evaluation, setEvaluation] = useState(null)
  const [recommandations, setRecommandations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjoutRecommandation, setEnAjoutRecommandation] = useState(false)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data: evalData, error: evalError } = await supabase
      .from('evaluations_crise')
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle()
    if (evalError) setErreur(evalError.message)
    setEvaluation(evalData ?? null)

    if (evalData) {
      const { data: recoData, error: recoError } = await supabase
        .from('rex_recommandations')
        .select('*')
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

  return (
    <div>
      <h2 className="font-medium text-slate-900 mb-2">REX — évaluation post-crise</h2>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : !evaluation ? (
        <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center">
          <p className="text-sm text-slate-500 mb-2">Aucun REX formel démarré pour cet incident.</p>
          <BoutonDiscret onClick={demarrerRex}>Démarrer le REX (échéance à 3 mois)</BoutonDiscret>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-700">
              Échéance : <strong>{evaluation.echeance_rex}</strong>
            </p>
            <select
              value={evaluation.statut}
              onChange={(e) => majEvaluation({ statut: e.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
            >
              {STATUTS_EVALUATION_CRISE.map((s) => (
                <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
              ))}
            </select>
          </div>

          <textarea
            value={evaluation.synthese ?? ''}
            onChange={(e) => setEvaluation({ ...evaluation, synthese: e.target.value })}
            onBlur={(e) => majEvaluation({ synthese: e.target.value.trim() || null })}
            placeholder="Synthèse du REX…"
            rows={3}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-600">Recommandations</p>
              {!enAjoutRecommandation && (
                <button type="button" onClick={() => setEnAjoutRecommandation(true)} className="text-xs text-institution-700 hover:underline">
                  + ajouter
                </button>
              )}
            </div>

            {enAjoutRecommandation && (
              <FormulaireRecommandation
                evaluationCriseId={evaluation.id}
                onAnnuler={() => setEnAjoutRecommandation(false)}
                onValider={async () => {
                  setEnAjoutRecommandation(false)
                  await rafraichir()
                }}
              />
            )}

            {recommandations.length === 0 ? (
              <p className="text-xs text-slate-400">Aucune recommandation pour l'instant.</p>
            ) : (
              <ul className="space-y-1">
                {recommandations.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2 text-xs bg-slate-50 rounded px-2.5 py-1.5 border border-slate-200">
                    <div>
                      <p className="text-slate-800">{r.recommandation}</p>
                      <p className="text-slate-400">
                        constat : {r.constat}{r.echeance && <> · échéance : {r.echeance}</>} · {r.statut}
                      </p>
                    </div>
                    <button type="button" onClick={() => retirerRecommandation(r.id)} className="text-slate-400 hover:text-red-600 flex-shrink-0">✕</button>
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

function FormulaireRecommandation({ evaluationCriseId, onValider, onAnnuler }) {
  const [constat, setConstat] = useState('')
  const [recommandation, setRecommandation] = useState('')
  const [echeance, setEcheance] = useState('')
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
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-2 space-y-2">
      <input required value={constat} onChange={(e) => setConstat(e.target.value)} placeholder="Constat" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
      <input required value={recommandation} onChange={(e) => setRecommandation(e.target.value)} placeholder="Recommandation" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
      <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
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

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('sitreps')
      .select('*')
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
        <h2 className="font-medium text-slate-900">SitRep</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Nouveau SitRep</BoutonPrincipal>}
      </div>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireSitRep
          incidentId={incidentId}
          niveaux={niveaux}
          prochainNumero={sitreps.length > 0 ? Math.max(...sitreps.map((s) => s.numero)) + 1 : 1}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : sitreps.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-4 text-center">
          Aucun SitRep pour cet incident.
        </p>
      ) : (
        <ul className="space-y-2">
          {sitreps.map((s) => (
            <li key={s.id} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-sm font-medium text-slate-900">
                SitRep n°{s.numero}
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(s.horodatage).toLocaleString('fr-BE')}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                U0:{s.victimes_u0 ?? 0} · U1:{s.victimes_u1 ?? 0} · U2:{s.victimes_u2 ?? 0} · U3:{s.victimes_u3 ?? 0}
              </p>
              {s.localisation_incident && (
                <p className="text-xs text-slate-500">lieu : {s.localisation_incident}</p>
              )}
              {s.mesures_reflexes && (
                <p className="text-xs text-slate-400 italic mt-1">{s.mesures_reflexes}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireSitRep({ incidentId, niveaux, prochainNumero, onValider, onAnnuler }) {
  const [niveauId, setNiveauId] = useState('')
  const [typeIncident, setTypeIncident] = useState('')
  const [u0, setU0] = useState(0)
  const [u1, setU1] = useState(0)
  const [u2, setU2] = useState(0)
  const [u3, setU3] = useState(0)
  const [localisationIncident, setLocalisationIncident] = useState('')
  const [localisationPcOps, setLocalisationPcOps] = useState('')
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
      mesures_reflexes: mesuresReflexes.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-3 bg-slate-50 space-y-3">
      <p className="text-xs text-slate-500">SitRep n°{prochainNumero}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <input value={typeIncident} onChange={(e) => setTypeIncident(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Niveau</label>
          <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Victimes par catégorie de tri</label>
        <div className="grid grid-cols-4 gap-2">
          {[['U0', u0, setU0], ['U1', u1, setU1], ['U2', u2, setU2], ['U3', u3, setU3]].map(([label, val, setVal]) => (
            <div key={label}>
              <span className="text-xs text-slate-500">{label}</span>
              <input type="number" min="0" value={val} onChange={(e) => setVal(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Localisation incident</label>
        <input value={localisationIncident} onChange={(e) => setLocalisationIncident(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Localisation PC-Ops</label>
        <input value={localisationPcOps} onChange={(e) => setLocalisationPcOps(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Mesures réflexes</label>
        <textarea value={mesuresReflexes} onChange={(e) => setMesuresReflexes(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

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
        <h2 className="font-medium text-slate-900">Checklist</h2>
        {total > 0 && (
          <span className="text-xs text-slate-500">{faits} / {total} actions faites</span>
        )}
      </div>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      <div className="mb-3">
        <select
          value={filtreRole}
          onChange={(e) => setFiltreRole(e.target.value)}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          <option value="">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.libelle}</option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-4 text-center">
          Aucune checklist type définie pour ce contexte (à créer dans l'app Admin).
        </p>
      ) : (
        <div className="space-y-4">
          {groupes.map((g) => (
            <div key={g.declencheur}>
              <h3 className="text-xs font-semibold text-slate-500 mb-1.5">{g.declencheur}</h3>
              <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden bg-white">
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
                        <span className={`text-sm ${fait ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                          {t.libelle}
                        </span>
                        {t.roles?.libelle && (
                          <span className="text-xs text-slate-400 flex-shrink-0">({t.roles.libelle})</span>
                        )}
                      </label>
                      {fait && exec.horodatage_execution && (
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
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

function SectionLivreDeBord({ incidentId }) {
  const [entrees, setEntrees] = useState([])
  const [chargement, setChargement] = useState(true)
  const [message, setMessage] = useState('')
  const [decision, setDecision] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('livre_de_bord')
      .select('*')
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
    })
    setEnCours(false)
    if (error) {
      setErreur(error.message)
    } else {
      setMessage('')
      setDecision('')
      await rafraichir()
    }
  }

  return (
    <div>
      <h2 className="font-medium text-slate-900 mb-2">Livre de bord</h2>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      <form onSubmit={ajouterEntree} className="border border-slate-200 rounded-lg p-3 mb-3 bg-slate-50 space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message / événement…"
          rows={2}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
        <input
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          placeholder="Décision associée (optionnel)"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
        <BoutonPrincipal type="submit" disabled={enCours || !message.trim()}>
          {enCours ? 'Ajout…' : 'Ajouter au livre de bord'}
        </BoutonPrincipal>
      </form>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : entrees.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-4 text-center">
          Aucune entrée pour l'instant.
        </p>
      ) : (
        <ul className="space-y-2">
          {entrees.map((e) => (
            <li key={e.id} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-400">
                #{e.numero_ordre} · {new Date(e.horodatage).toLocaleString('fr-BE')}
              </p>
              <p className="text-sm text-slate-900 mt-0.5">{e.message}</p>
              {e.decision && <p className="text-xs text-slate-500 mt-1">décision : {e.decision}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
