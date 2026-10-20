import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret } from './Boutons'
import { supabase } from '../lib/supabase'

/**
 * Sous-blocs d'une fiche — évaluation BNRA/PRGC, plan d'action, suivi des mesures
 * compensatoires, fonctions critiques — communs aux risques du territoire et aux
 * objets à risque. Le parent est désigné par la colonne qui le porte :
 *   { colonne: 'risque_id', id }        pour un risque du territoire
 *   { colonne: 'objet_risque_id', id }  pour un objet à risque
 */

const STATUTS_MESURE = [
  { valeur: 'planifiee', libelle: 'Planifiée' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'realisee', libelle: 'Réalisée' },
  { valeur: 'abandonnee', libelle: 'Abandonnée' },
]

const STATUTS_PLAN_ACTION = [
  { valeur: 'a_faire', libelle: 'À faire' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'fait', libelle: 'Fait' },
  { valeur: 'abandonne', libelle: 'Abandonné' },
]

export function GestionPlansAction({ parent }) {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [etapes, setEtapes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('plans_action_risque')
      .select('*, contacts(id, nom, prenom)')
      .eq(parent.colonne, parent.id)
      .order('ordre', { ascending: true })
    if (error) setErreur(error.message)
    else setEtapes(data ?? [])
    setChargement(false)
  }, [parent.colonne, parent.id])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function changerStatut(id, statut) {
    const { error } = await supabase.from('plans_action_risque').update({ statut }).eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function retirer(id) {
    if (!confirm("Supprimer cette étape du plan d'action ?")) return
    await supabase.from('plans_action_risque').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-sourdine">Plan d'action (étapes ordonnées)</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-info hover:underline">
            + ajouter une étape
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireEtapePlanAction
          parent={parent}
          contacts={contacts}
          ordreSuivant={etapes.length > 0 ? Math.max(...etapes.map((e) => e.ordre)) + 1 : 1}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : etapes.length === 0 ? (
        <p className="text-xs text-sourdine">Aucune étape définie pour l'instant.</p>
      ) : (
        <ul className="space-y-1">
          {etapes.map((e) => (
            <li key={e.id} className="bg-surface rounded px-2.5 py-1.5 border border-trait text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-encre">
                    <span className="text-sourdine mr-1">{e.ordre}.</span>
                    {e.libelle}
                  </p>
                  {e.contacts && (
                    <p className="text-sourdine">responsable : {e.contacts.prenom} {e.contacts.nom}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    value={e.statut ?? 'a_faire'}
                    onChange={(ev) => changerStatut(e.id, ev.target.value)}
                    className=""
                  >
                    {STATUTS_PLAN_ACTION.map((s) => (
                      <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => retirer(e.id)} className="text-sourdine hover:text-chaud">✕</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireEtapePlanAction({ parent, contacts = [], ordreSuivant, onValider, onAnnuler }) {
  const [ordre, setOrdre] = useState(ordreSuivant)
  const [libelle, setLibelle] = useState('')
  const [responsableContactId, setResponsableContactId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('plans_action_risque').insert({
      [parent.colonne]: parent.id,
      ordre: Number(ordre),
      libelle: libelle.trim(),
      responsable_contact_id: responsableContactId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-trait rounded p-2.5 mb-2 space-y-2">
      <div className="grid grid-cols-[4rem_1fr] gap-2">
        <input
          type="number"
          required
          value={ordre}
          onChange={(e) => setOrdre(e.target.value)}
          placeholder="Ordre"
          className="w-full"
        />
        <input
          required
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          placeholder="ex. Évacuer le périmètre immédiat"
          className="w-full"
        />
      </div>
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

const DIMENSIONS_RISQUE = [
  { cle: 'victimes', libelle: 'Victimes / santé publique' },
  { cle: 'infrastructure', libelle: 'Infrastructure / continuité' },
  { cle: 'environnement', libelle: 'Environnement' },
  { cle: 'financier', libelle: 'Financier' },
]

const PROBABILITES = [
  { valeur: 'rare', libelle: 'Rare' },
  { valeur: 'possible', libelle: 'Possible' },
  { valeur: 'probable', libelle: 'Probable' },
  { valeur: 'quasi_certain', libelle: 'Quasi certain' },
]

export function GestionEvaluationsRisque({ parent }) {
  const [evaluations, setEvaluations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('evaluations_risque')
      .select('*')
      .eq(parent.colonne, parent.id)
      .order('date_evaluation', { ascending: false })
    if (error) setErreur(error.message)
    else setEvaluations(data ?? [])
    setChargement(false)
  }, [parent.colonne, parent.id])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function retirer(id) {
    if (!confirm("Supprimer cette évaluation de risque (BNRA/PRGC) ?")) return
    await supabase.from('evaluations_risque').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-sourdine">Évaluation du risque (BNRA/PRGC — 4 dimensions × scénario normal/exceptionnel)</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-info hover:underline">
            + nouvelle évaluation
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireEvaluationRisque
          parent={parent}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : evaluations.length === 0 ? (
        <p className="text-xs text-sourdine">Aucune évaluation enregistrée.</p>
      ) : (
        <ul className="space-y-1.5">
          {evaluations.map((ev) => (
            <li key={ev.id} className="bg-surface rounded px-2.5 py-2 border border-trait text-xs">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-encre font-medium">
                  {ev.date_evaluation}
                  {ev.evaluation_globale && <span className="ml-2 text-sourdine font-normal">— {ev.evaluation_globale}</span>}
                </p>
                <button type="button" onClick={() => retirer(ev.id)} className="text-sourdine hover:text-chaud flex-shrink-0">✕</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-sourdine">
                {DIMENSIONS_RISQUE.map((d) => {
                  const score = ev[`${d.cle}_score`]
                  const proba = ev[`${d.cle}_probabilite`]
                  if (score == null && !proba) return null
                  return (
                    <div key={d.cle}>
                      <span className="text-sourdine">{d.libelle} :</span>{' '}
                      {score != null && <>score {score}</>}
                      {proba && <> ({PROBABILITES.find((p) => p.valeur === proba)?.libelle ?? proba})</>}
                    </div>
                  )
                })}
              </div>
              {(ev.duree_situation || ev.vitesse_developpement) && (
                <p className="text-sourdine mt-1">
                  {ev.duree_situation && <>durée : {ev.duree_situation}</>}
                  {ev.vitesse_developpement && <> · vitesse de développement : {ev.vitesse_developpement}</>}
                </p>
              )}
              {ev.elements_aggravants && <p className="text-sourdine mt-0.5">aggravants : {ev.elements_aggravants}</p>}
              {ev.elements_attenuants && <p className="text-sourdine mt-0.5">atténuants : {ev.elements_attenuants}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireEvaluationRisque({ parent, onValider, onAnnuler }) {
  const [dateEvaluation, setDateEvaluation] = useState(new Date().toISOString().slice(0, 10))
  const [valeurs, setValeurs] = useState(
    Object.fromEntries(
      DIMENSIONS_RISQUE.flatMap((d) => [
        [`${d.cle}_score`, ''],
        [`${d.cle}_probabilite`, ''],
        [`${d.cle}_score_exceptionnel`, ''],
        [`${d.cle}_probabilite_exceptionnel`, ''],
      ])
    )
  )
  const [dureeSituation, setDureeSituation] = useState('')
  const [vitesseDeveloppement, setVitesseDeveloppement] = useState('')
  const [elementsAggravants, setElementsAggravants] = useState('')
  const [elementsAttenuants, setElementsAttenuants] = useState('')
  const [evaluationGlobale, setEvaluationGlobale] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  function majValeur(cle, v) {
    setValeurs((prev) => ({ ...prev, [cle]: v }))
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const scoresEtProbas = Object.fromEntries(
      Object.entries(valeurs).map(([cle, v]) => {
        if (v === '') return [cle, null]
        if (cle.includes('_score')) return [cle, Number(v)]
        return [cle, v]
      })
    )
    const { error } = await supabase.from('evaluations_risque').insert({
      [parent.colonne]: parent.id,
      date_evaluation: dateEvaluation,
      ...scoresEtProbas,
      duree_situation: dureeSituation.trim() || null,
      vitesse_developpement: vitesseDeveloppement.trim() || null,
      elements_aggravants: elementsAggravants.trim() || null,
      elements_attenuants: elementsAttenuants.trim() || null,
      evaluation_globale: evaluationGlobale.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-trait rounded p-3 mb-2 space-y-2.5">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Date de l'évaluation</label>
        <input type="date" required value={dateEvaluation} onChange={(e) => setDateEvaluation(e.target.value)} className="w-full sm:w-48" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-sourdine">
              <th className="text-left font-normal pb-1">Dimension</th>
              <th className="text-left font-normal pb-1" colSpan={2}>Scénario normal</th>
              <th className="text-left font-normal pb-1" colSpan={2}>Scénario exceptionnel</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS_RISQUE.map((d) => (
              <tr key={d.cle} className="border-t border-trait">
                <td className="py-1.5 pr-2 text-sourdine">{d.libelle}</td>
                <td className="py-1.5 pr-1">
                  <input
                    type="number"
                    min="1"
                    max="4"
                    placeholder="score 1-4"
                    value={valeurs[`${d.cle}_score`]}
                    onChange={(e) => majValeur(`${d.cle}_score`, e.target.value)}
                    className="w-16"
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <select
                    value={valeurs[`${d.cle}_probabilite`]}
                    onChange={(e) => majValeur(`${d.cle}_probabilite`, e.target.value)}
                    className=""
                  >
                    <option value="">probabilité —</option>
                    {PROBABILITES.map((p) => (
                      <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5 pr-1">
                  <input
                    type="number"
                    min="1"
                    max="4"
                    placeholder="score 1-4"
                    value={valeurs[`${d.cle}_score_exceptionnel`]}
                    onChange={(e) => majValeur(`${d.cle}_score_exceptionnel`, e.target.value)}
                    className="w-16"
                  />
                </td>
                <td className="py-1.5">
                  <select
                    value={valeurs[`${d.cle}_probabilite_exceptionnel`]}
                    onChange={(e) => majValeur(`${d.cle}_probabilite_exceptionnel`, e.target.value)}
                    className=""
                  >
                    <option value="">probabilité —</option>
                    {PROBABILITES.map((p) => (
                      <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input value={dureeSituation} onChange={(e) => setDureeSituation(e.target.value)} placeholder="Durée de la situation" className="w-full" />
        <input value={vitesseDeveloppement} onChange={(e) => setVitesseDeveloppement(e.target.value)} placeholder="Vitesse de développement" className="w-full" />
      </div>
      <textarea value={elementsAggravants} onChange={(e) => setElementsAggravants(e.target.value)} placeholder="Éléments aggravants" rows={2} className="w-full" />
      <textarea value={elementsAttenuants} onChange={(e) => setElementsAttenuants(e.target.value)} placeholder="Éléments atténuants" rows={2} className="w-full" />
      <input value={evaluationGlobale} onChange={(e) => setEvaluationGlobale(e.target.value)} placeholder="Évaluation globale (synthèse)" className="w-full" />

      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonDiscret>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

export function GestionMesuresCompensatoires({ parent }) {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [mesures, setMesures] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('mesures_compensatoires_suivi')
      .select('*, contacts(id, nom, prenom)')
      .eq(parent.colonne, parent.id)
      .order('created_at', { ascending: false })
    if (error) setErreur(error.message)
    else setMesures(data ?? [])
    setChargement(false)
  }, [parent.colonne, parent.id])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function changerStatut(id, statut) {
    const { error } = await supabase.from('mesures_compensatoires_suivi').update({ statut }).eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function retirer(id) {
    if (!confirm('Supprimer ce suivi de mesure compensatoire ?')) return
    await supabase.from('mesures_compensatoires_suivi').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-sourdine">Suivi quantifié des mesures compensatoires</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-info hover:underline">
            + ajouter
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireMesureCompensatoire
          parent={parent}
          contacts={contacts}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : mesures.length === 0 ? (
        <p className="text-xs text-sourdine">Aucune mesure suivie pour l'instant.</p>
      ) : (
        <ul className="space-y-1">
          {mesures.map((m) => (
            <li key={m.id} className="bg-surface rounded px-2.5 py-1.5 border border-trait text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-encre">{m.mesure}</p>
                  {m.quantification && <p className="text-sourdine">{m.quantification}</p>}
                  {(m.date_cible || m.date_realisation) && (
                    <p className="text-sourdine">
                      {m.date_cible && <>cible : {m.date_cible}</>}
                      {m.date_realisation && <> · réalisée : {m.date_realisation}</>}
                    </p>
                  )}
                  {m.contacts && (
                    <p className="text-sourdine">responsable : {m.contacts.prenom} {m.contacts.nom}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <select
                    value={m.statut}
                    onChange={(e) => changerStatut(m.id, e.target.value)}
                    className=""
                  >
                    {STATUTS_MESURE.map((s) => (
                      <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => retirer(m.id)} className="text-sourdine hover:text-chaud">✕</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireMesureCompensatoire({ parent, contacts = [], onValider, onAnnuler }) {
  const [mesure, setMesure] = useState('')
  const [quantification, setQuantification] = useState('')
  const [dateCible, setDateCible] = useState('')
  const [responsableContactId, setResponsableContactId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('mesures_compensatoires_suivi').insert({
      [parent.colonne]: parent.id,
      mesure: mesure.trim(),
      quantification: quantification.trim() || null,
      date_cible: dateCible || null,
      responsable_contact_id: responsableContactId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-surface border border-trait rounded p-2.5 mb-2 space-y-2">
      <input
        required
        value={mesure}
        onChange={(e) => setMesure(e.target.value)}
        placeholder="ex. Installation de 2 pompes de secours supplémentaires"
        className="w-full"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={quantification}
          onChange={(e) => setQuantification(e.target.value)}
          placeholder="Quantification (ex. 2/4 réalisées)"
          className="w-full"
        />
        <input type="date" value={dateCible} onChange={(e) => setDateCible(e.target.value)} className="w-full" />
      </div>
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

const ROLES_LIEN = [
  { valeur: 'enjeu', libelle: 'Enjeu exposé', aide: "l'objet est exposé au risque" },
  { valeur: 'source', libelle: 'Source du risque', aide: "l'objet génère le risque" },
]

/**
 * Lien objet à risque ↔ risque du territoire, avec le rôle de l'objet (source du
 * risque ou enjeu exposé). Vu depuis l'un ou l'autre côté :
 *   cote = 'objet'  : on est sur un objet, on lui rattache des risques
 *   cote = 'risque' : on est sur un risque, on lui rattache des objets
 */
export function GestionLiensObjetRisque({ cote, id }) {
  const { contexteId } = useAuth()
  const estObjet = cote === 'objet'
  const { lignes: candidats } = useTableContexte(
    estObjet ? 'risques_territoire' : 'objets_a_risque',
    contexteId,
    { tri: estObjet ? 'titre' : 'identification' }
  )
  const [liens, setLiens] = useState([])
  const [chargement, setChargement] = useState(true)
  const [selection, setSelection] = useState('')
  const [role, setRole] = useState('enjeu')
  const [erreur, setErreur] = useState(null)

  const colonneMoi = estObjet ? 'objet_id' : 'risque_id'
  const colonneAutre = estObjet ? 'risque_id' : 'objet_id'
  const libelleAutre = (l) => (estObjet ? l.risques_territoire?.titre : l.objets_a_risque?.identification) ?? '?'

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('objets_a_risque_risques')
      .select(estObjet ? 'risque_id, role, risques_territoire(id, titre, code)' : 'objet_id, role, objets_a_risque(id, identification, code)')
      .eq(colonneMoi, id)
    if (error) setErreur(error.message)
    else setLiens(data ?? [])
    setChargement(false)
  }, [estObjet, colonneMoi, id])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouter() {
    if (!selection) return
    const { error } = await supabase
      .from('objets_a_risque_risques')
      .insert({ [colonneMoi]: id, [colonneAutre]: selection, role })
    if (error) setErreur(error.message)
    else {
      setSelection('')
      await rafraichir()
    }
  }

  async function changerRole(autreId, nouveauRole) {
    const { error } = await supabase
      .from('objets_a_risque_risques')
      .update({ role: nouveauRole })
      .eq(colonneMoi, id)
      .eq(colonneAutre, autreId)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  async function retirer(autreId) {
    await supabase.from('objets_a_risque_risques').delete().eq(colonneMoi, id).eq(colonneAutre, autreId)
    await rafraichir()
  }

  const disponibles = candidats.filter((c) => !liens.some((l) => l[colonneAutre] === c.id))

  return (
    <div className="pt-2 border-t">
      <p className="text-xs font-medium text-sourdine mb-1">{estObjet ? 'Risques liés' : 'Objets à risque liés'}</p>
      <p className="text-xs text-sourdine mb-2">
        Rôle de l'objet : {ROLES_LIEN.map((r) => `${r.libelle.toLowerCase()} (${r.aide})`).join(' ; ')}.
      </p>
      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <>
          {liens.length > 0 && (
            <ul className="space-y-1 mb-2">
              {liens.map((l) => (
                <li key={l[colonneAutre]} className="bg-surface rounded px-2.5 py-1.5 border border-trait text-xs flex items-center justify-between gap-2">
                  <span className="text-encre">{libelleAutre(l)}</span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <select value={l.role} onChange={(e) => changerRole(l[colonneAutre], e.target.value)} className="">
                      {ROLES_LIEN.map((r) => (
                        <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => retirer(l[colonneAutre])} className="text-sourdine hover:text-chaud">✕</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <select value={selection} onChange={(e) => setSelection(e.target.value)} className="flex-1 min-w-[12rem]">
              <option value="">{estObjet ? 'Ajouter un risque…' : 'Ajouter un objet à risque…'}</option>
              {disponibles.map((c) => (
                <option key={c.id} value={c.id}>{estObjet ? c.titre : c.identification}</option>
              ))}
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="">
              {ROLES_LIEN.map((r) => (
                <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
              ))}
            </select>
            <BoutonDiscret type="button" onClick={ajouter} disabled={!selection}>Ajouter</BoutonDiscret>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Fonctions critiques menacées. La table de lien dépend du parent :
 *   { table: 'risques_territoire_fonctions_critiques', colonne: 'risque_id', id }
 *   { table: 'objets_a_risque_fonctions_critiques', colonne: 'objet_id', id }
 */
export function GestionFonctionsCritiques({ parent }) {
  const { contexteId } = useAuth()
  const { lignes: toutesFonctions } = useTableContexte('fonctions_critiques', contexteId, { tri: 'nom' })
  const [liees, setLiees] = useState([])
  const [chargement, setChargement] = useState(true)
  const [selection, setSelection] = useState('')
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from(parent.table)
      .select('fonction_critique_id, fonctions_critiques(id, nom, statut_actuel)')
      .eq(parent.colonne, parent.id)
    if (error) setErreur(error.message)
    else setLiees(data ?? [])
    setChargement(false)
  }, [parent.table, parent.colonne, parent.id])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouter() {
    if (!selection) return
    const { error } = await supabase
      .from(parent.table)
      .insert({ [parent.colonne]: parent.id, fonction_critique_id: selection })
    if (error) setErreur(error.message)
    else {
      setSelection('')
      await rafraichir()
    }
  }

  async function retirer(fonctionId) {
    await supabase
      .from(parent.table)
      .delete()
      .eq(parent.colonne, parent.id)
      .eq('fonction_critique_id', fonctionId)
    await rafraichir()
  }

  const disponibles = toutesFonctions.filter((f) => !liees.some((l) => l.fonction_critique_id === f.id))

  return (
    <div className="pt-2 border-t">
      <p className="text-xs font-medium text-sourdine mb-2">Fonctions critiques impactées</p>
      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <>
          {liees.length > 0 && (
            <ul className="space-y-1 mb-2">
              {liees.map((l) => (
                <li key={l.fonction_critique_id} className="jeton flex items-center justify-between bg-surface border border-trait">
                  <span>{l.fonctions_critiques?.nom} <span className="text-sourdine">({l.fonctions_critiques?.statut_actuel})</span></span>
                  <button type="button" onClick={() => retirer(l.fonction_critique_id)} className="text-sourdine hover:text-chaud">✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <select value={selection} onChange={(e) => setSelection(e.target.value)} className="flex-1">
              <option value="">Ajouter une fonction critique…</option>
              {disponibles.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
            <BoutonDiscret type="button" onClick={ajouter} disabled={!selection}>Ajouter</BoutonDiscret>
          </div>
        </>
      )}
    </div>
  )
}
