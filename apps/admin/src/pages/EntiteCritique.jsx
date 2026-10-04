import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const STATUTS_DESIGNATION = [
  { valeur: 'en_evaluation', libelle: 'En évaluation' },
  { valeur: 'designee', libelle: 'Désignée' },
  { valeur: 'non_retenue', libelle: 'Non retenue' },
  { valeur: 'cepes', libelle: 'CEPES (portée européenne, ≥6 États membres)' },
]

const STATUTS_PLAN = [
  { valeur: 'brouillon', libelle: 'Brouillon' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'archive', libelle: 'Archivé' },
]

const STATUTS_VERIFICATION = [
  { valeur: 'demandee', libelle: 'Demandée' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'validee', libelle: 'Validée' },
  { valeur: 'refusee', libelle: 'Refusée' },
]

const STATUTS_NOTIFICATION = [
  { valeur: 'notifiee', libelle: 'Notifiée' },
  { valeur: 'en_analyse', libelle: 'En analyse' },
  { valeur: 'cloturee', libelle: 'Clôturée' },
]

export default function EntiteCritique() {
  const { contexteId } = useAuth()
  const [entite, setEntite] = useState(null)
  const [secteurs, setSecteurs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    const [{ data: ec, error: errEc }, { data: sec }] = await Promise.all([
      supabase
        .from('entites_critiques')
        .select('*, secteurs_cer(id, secteur, sous_secteur, autorite_sectorielle)')
        .eq('contexte_id', contexteId)
        .maybeSingle(),
      supabase.from('secteurs_cer').select('*').order('secteur'),
    ])
    if (errEc) setErreur(errEc.message)
    else setEntite(ec)
    setSecteurs(sec ?? [])
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  if (chargement) return <p className="text-sm text-sourdine">Chargement…</p>

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Conformité CER</h1>
      <p className="text-sm text-sourdine mb-4">
        Loi du 19/12/2025 (résilience des entités critiques, transposition Directive (UE)
        2022/2557) — point de contact 24/7, analyse des risques, plan de résilience,
        exercices, contrôles de sécurité du personnel et notification d'incident sous 24h
        (SICAD), pour cette entité.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {!entite ? (
        <FormulaireEntite
          contexteId={contexteId}
          secteurs={secteurs}
          onValider={async (valeurs) => {
            const { error } = await supabase.from('entites_critiques').insert({ ...valeurs, contexte_id: contexteId })
            if (!error) await charger()
            return { error }
          }}
        />
      ) : (
        <TableauDeBordEntite entite={entite} secteurs={secteurs} onChangement={charger} />
      )}
    </div>
  )
}

function FormulaireEntite({ secteurs, onValider }) {
  const [secteurCerId, setSecteurCerId] = useState('')
  const [statutDesignation, setStatutDesignation] = useState('en_evaluation')
  const [dateDesignation, setDateDesignation] = useState('')
  const [nbEtatsMembresDesservis, setNbEtatsMembresDesservis] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      secteur_cer_id: secteurCerId || null,
      statut_designation: statutDesignation,
      date_designation: dateDesignation || null,
      nb_etats_membres_desservis: nbEtatsMembresDesservis === '' ? null : Number(nbEtatsMembresDesservis),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 bg-fond space-y-3 max-w-xl">
      <p className="text-sm font-medium text-encre">Enregistrer cette entité critique</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Secteur CER</label>
          <select value={secteurCerId} onChange={(e) => setSecteurCerId(e.target.value)} className="w-full">
            <option value="">—</option>
            {secteurs.map((s) => (
              <option key={s.id} value={s.id}>{s.secteur}{s.sous_secteur ? ` / ${s.sous_secteur}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Statut de désignation</label>
          <select value={statutDesignation} onChange={(e) => setStatutDesignation(e.target.value)} className="w-full">
            {STATUTS_DESIGNATION.map((s) => (
              <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de désignation</label>
          <input type="date" value={dateDesignation} onChange={(e) => setDateDesignation(e.target.value)} className="w-full" />
          <p className="text-xs text-sourdine mt-1">Les échéances (POC, analyse des risques, plan de résilience) se calculent automatiquement depuis cette date.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Nb d'États membres desservis</label>
          <input type="number" min="0" value={nbEtatsMembresDesservis} onChange={(e) => setNbEtatsMembresDesservis(e.target.value)} className="w-full" />
          <p className="text-xs text-sourdine mt-1">≥ 6 = qualification CEPES potentielle.</p>
        </div>
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <BoutonPrincipal type="submit" disabled={enCours}>
        {enCours ? 'Enregistrement…' : 'Enregistrer'}
      </BoutonPrincipal>
    </form>
  )
}

function TableauDeBordEntite({ entite, secteurs, onChangement }) {
  const [enEdition, setEnEdition] = useState(false)

  async function sauvegarder(valeurs) {
    const { error } = await supabase.from('entites_critiques').update(valeurs).eq('id', entite.id)
    if (!error) {
      setEnEdition(false)
      await onChangement()
    }
    return { error }
  }

  const echeances = [
    { libelle: 'Point de contact 24/7 opérationnel', date: entite.deadline_poc },
    { libelle: 'Analyse des risques de l\'entité', date: entite.deadline_analyse_risques },
    { libelle: 'Plan de résilience', date: entite.deadline_plan_resilience },
  ]

  return (
    <div className="space-y-6">
      <div className="border border-trait rounded p-4 bg-surface">
        {enEdition ? (
          <FormulaireEntite
            secteurs={secteurs}
            onValider={sauvegarder}
          />
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-encre">
                {entite.secteurs_cer?.secteur ?? 'Secteur non défini'}
                <span className="jeton ml-2 text-info">
                  {STATUTS_DESIGNATION.find((s) => s.valeur === entite.statut_designation)?.libelle}
                </span>
                {entite.nis2_entite_essentielle && <span className="jeton ml-2">NIS2 — entité essentielle</span>}
              </p>
              {entite.date_designation && (
                <p className="text-xs text-sourdine mt-1">Désignée le {entite.date_designation}</p>
              )}
              {entite.nb_etats_membres_desservis != null && (
                <p className="text-xs text-sourdine mt-0.5">
                  {entite.nb_etats_membres_desservis} État(s) membre(s) desservi(s)
                  {entite.nb_etats_membres_desservis >= 6 && <> — qualification CEPES possible</>}
                </p>
              )}
            </div>
            <BoutonDiscret onClick={() => setEnEdition(true)}>Modifier</BoutonDiscret>
          </div>
        )}
      </div>

      {entite.date_designation && (
        <div className="border border-trait rounded p-4 bg-surface">
          <p className="etiquette mb-2">Échéances légales</p>
          <ul className="space-y-1">
            {echeances.map((e) => {
              const enRetard = e.date && new Date(e.date) < new Date()
              return (
                <li key={e.libelle} className="flex items-center justify-between text-sm">
                  <span className="text-encre">{e.libelle}</span>
                  <span className={`jeton ${enRetard ? 'text-chaud' : 'text-info'}`}>{e.date ?? '—'}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <GestionPointsContactEntite entiteId={entite.id} />
      <GestionEvaluationsRisques entiteId={entite.id} />
      <GestionPlansResilience entiteId={entite.id} />
      <GestionExercicesCer entiteId={entite.id} />
      <GestionControlesSecurite entiteId={entite.id} />
      <GestionNotificationsIncident entiteId={entite.id} />
    </div>
  )
}

function useCrudSimple(table, colonneParent, idParent) {
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase.from(table).select('*').eq(colonneParent, idParent)
    if (error) setErreur(error.message)
    else setLignes(data ?? [])
    setChargement(false)
  }, [table, colonneParent, idParent])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creer(valeurs) {
    const { error } = await supabase.from(table).insert({ ...valeurs, [colonneParent]: idParent })
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

function Bloc({ titre, children }) {
  return (
    <div className="border border-trait rounded p-4 bg-surface">
      <p className="etiquette mb-2">{titre}</p>
      {children}
    </div>
  )
}

function GestionPointsContactEntite({ entiteId }) {
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useCrudSimple('points_contact_entite', 'entite_critique_id', entiteId)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <Bloc titre="Point de contact 24/7">
      {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Ajouter</BoutonDiscret>}
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      {enAjout && (
        <div className="border border-trait rounded p-3 mt-2 bg-fond">
          <FormulairePointContactEntite
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const { error } = await creer(v)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}
      {chargement ? (
        <p className="text-xs text-sourdine mt-2">Chargement…</p>
      ) : (
        <ul className="space-y-1.5 mt-2">
          {lignes.map((pc) =>
            ligneEnEdition === pc.id ? (
              <li key={pc.id} className="border border-trait rounded p-3 bg-fond">
                <FormulairePointContactEntite
                  valeursInitiales={pc}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (v) => {
                    const { error } = await modifier(pc.id, v)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={pc.id} className="flex items-center justify-between border border-trait rounded px-3 py-2 bg-fond text-xs">
                <span>
                  {pc.disponible_24_7 && <span className="jeton mr-2 text-info">24/7</span>}
                  {pc.telephone}
                  {pc.email && <> · {pc.email}</>}
                  {pc.date_operationnalite && <> · opérationnel depuis {pc.date_operationnalite}</>}
                </span>
                <span className="flex gap-1.5">
                  <BoutonDiscret onClick={() => setLigneEnEdition(pc.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret onClick={() => supprimer(pc.id)}>Supprimer</BoutonDiscret>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </Bloc>
  )
}

function FormulairePointContactEntite({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [telephone, setTelephone] = useState(valeursInitiales.telephone ?? '')
  const [email, setEmail] = useState(valeursInitiales.email ?? '')
  const [disponible247, setDisponible247] = useState(valeursInitiales.disponible_24_7 ?? false)
  const [dateOperationnalite, setDateOperationnalite] = useState(valeursInitiales.date_operationnalite ?? '')
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    const { error } = await onValider({
      telephone: telephone.trim(),
      email: email.trim() || null,
      disponible_24_7: disponible247,
      date_operationnalite: dateOperationnalite || null,
    })
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input required placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="text-xs" />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="text-xs" />
        <input type="date" value={dateOperationnalite} onChange={(e) => setDateOperationnalite(e.target.value)} className="text-xs" />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-sourdine">
        <input type="checkbox" checked={disponible247} onChange={(e) => setDisponible247(e.target.checked)} />
        Disponible 24h/24, 7j/7
      </label>
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionEvaluationsRisques({ entiteId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useCrudSimple('evaluations_risques_cer', 'entite_critique_id', entiteId)
  const [enAjout, setEnAjout] = useState(false)

  return (
    <Bloc titre="Évaluation des risques de l'entité">
      <p className="text-xs text-sourdine mb-2">
        Niveau "entité" de la cascade BNRA → sectorielle → entité (révision minimale tous les 4 ans).
      </p>
      {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Ajouter</BoutonDiscret>}
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      {enAjout && (
        <div className="border border-trait rounded p-3 mt-2 bg-fond">
          <FormulaireEvaluationRisque
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const { error } = await creer({ ...v, niveau: 'entite' })
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}
      {chargement ? (
        <p className="text-xs text-sourdine mt-2">Chargement…</p>
      ) : (
        <ul className="space-y-1.5 mt-2">
          {lignes.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between border border-trait rounded px-3 py-2 bg-fond text-xs">
              <span>
                {ev.date_evaluation}
                {ev.source && <> · {ev.source}</>}
                {ev.date_prochaine_revision && <> · prochaine révision {ev.date_prochaine_revision}</>}
              </span>
              <BoutonDiscret onClick={() => supprimer(ev.id)}>Supprimer</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </Bloc>
  )
}

function FormulaireEvaluationRisque({ onValider, onAnnuler }) {
  const [dateEvaluation, setDateEvaluation] = useState('')
  const [dateProchaineRevision, setDateProchaineRevision] = useState('')
  const [source, setSource] = useState('')
  const [contenu, setContenu] = useState('')
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    const { error } = await onValider({
      date_evaluation: dateEvaluation,
      date_prochaine_revision: dateProchaineRevision || null,
      source: source.trim() || null,
      contenu: contenu.trim() ? { notes: contenu.trim() } : null,
    })
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input required type="date" value={dateEvaluation} onChange={(e) => setDateEvaluation(e.target.value)} className="text-xs" />
        <input type="date" value={dateProchaineRevision} onChange={(e) => setDateProchaineRevision(e.target.value)} placeholder="prochaine révision" className="text-xs" />
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (ex. OCAM, NCCN)" className="text-xs" />
      </div>
      <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={2} placeholder="Notes" className="w-full text-xs" />
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionPlansResilience({ entiteId }) {
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useCrudSimple('plans_resilience_entite', 'entite_critique_id', entiteId)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <Bloc titre="Plan de résilience">
      {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Ajouter</BoutonDiscret>}
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      {enAjout && (
        <div className="border border-trait rounded p-3 mt-2 bg-fond">
          <FormulairePlanResilience
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const { error } = await creer(v)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}
      {chargement ? (
        <p className="text-xs text-sourdine mt-2">Chargement…</p>
      ) : (
        <ul className="space-y-1.5 mt-2">
          {lignes.map((p) =>
            ligneEnEdition === p.id ? (
              <li key={p.id} className="border border-trait rounded p-3 bg-fond">
                <FormulairePlanResilience
                  valeursInitiales={p}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (v) => {
                    const { error } = await modifier(p.id, v)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={p.id} className="flex items-center justify-between border border-trait rounded px-3 py-2 bg-fond text-xs">
                <span>
                  v{p.version}
                  <span className="jeton ml-2">{STATUTS_PLAN.find((s) => s.valeur === p.statut)?.libelle}</span>
                  {p.date_validation && <> · validé le {p.date_validation}</>}
                </span>
                <span className="flex gap-1.5">
                  <BoutonDiscret onClick={() => setLigneEnEdition(p.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret onClick={() => supprimer(p.id)}>Supprimer</BoutonDiscret>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </Bloc>
  )
}

function FormulairePlanResilience({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [version, setVersion] = useState(valeursInitiales.version ?? '')
  const [dateRedaction, setDateRedaction] = useState(valeursInitiales.date_redaction ?? '')
  const [dateValidation, setDateValidation] = useState(valeursInitiales.date_validation ?? '')
  const [statut, setStatut] = useState(valeursInitiales.statut ?? 'brouillon')
  const [mesures, setMesures] = useState(valeursInitiales.mesures?.notes ?? '')
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    const { error } = await onValider({
      version: version.trim(),
      date_redaction: dateRedaction || null,
      date_validation: dateValidation || null,
      statut,
      mesures: mesures.trim() ? { notes: mesures.trim() } : null,
    })
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input required placeholder="Version" value={version} onChange={(e) => setVersion(e.target.value)} className="text-xs" />
        <input type="date" value={dateRedaction} onChange={(e) => setDateRedaction(e.target.value)} placeholder="rédaction" className="text-xs" />
        <input type="date" value={dateValidation} onChange={(e) => setDateValidation(e.target.value)} placeholder="validation" className="text-xs" />
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className="text-xs">
          {STATUTS_PLAN.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
        </select>
      </div>
      <textarea value={mesures} onChange={(e) => setMesures(e.target.value)} rows={2} placeholder="Mesures de résilience" className="w-full text-xs" />
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionExercicesCer({ entiteId }) {
  const { lignes, chargement, erreur, creer, supprimer } = useCrudSimple('exercices_cer', 'entite_critique_id', entiteId)
  const [enAjout, setEnAjout] = useState(false)

  return (
    <Bloc titre="Exercices">
      {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Ajouter</BoutonDiscret>}
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      {enAjout && (
        <div className="border border-trait rounded p-3 mt-2 bg-fond">
          <FormulaireExercice
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const { error } = await creer(v)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}
      {chargement ? (
        <p className="text-xs text-sourdine mt-2">Chargement…</p>
      ) : (
        <ul className="space-y-1.5 mt-2">
          {lignes.map((ex) => (
            <li key={ex.id} className="flex items-center justify-between border border-trait rounded px-3 py-2 bg-fond text-xs">
              <span>
                {ex.date_exercice}
                {ex.type_exercice && <> · {ex.type_exercice}</>}
                {ex.resultat && <> · {ex.resultat}</>}
              </span>
              <BoutonDiscret onClick={() => supprimer(ex.id)}>Supprimer</BoutonDiscret>
            </li>
          ))}
        </ul>
      )}
    </Bloc>
  )
}

function FormulaireExercice({ onValider, onAnnuler }) {
  const [typeExercice, setTypeExercice] = useState('')
  const [dateExercice, setDateExercice] = useState('')
  const [scenario, setScenario] = useState('')
  const [resultat, setResultat] = useState('')
  const [recommandations, setRecommandations] = useState('')
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    const { error } = await onValider({
      type_exercice: typeExercice.trim() || null,
      date_exercice: dateExercice,
      scenario: scenario.trim() || null,
      resultat: resultat.trim() || null,
      recommandations: recommandations.trim() || null,
    })
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input required type="date" value={dateExercice} onChange={(e) => setDateExercice(e.target.value)} className="text-xs" />
        <input value={typeExercice} onChange={(e) => setTypeExercice(e.target.value)} placeholder="Type d'exercice" className="text-xs" />
        <input value={resultat} onChange={(e) => setResultat(e.target.value)} placeholder="Résultat" className="text-xs" />
      </div>
      <textarea value={scenario} onChange={(e) => setScenario(e.target.value)} rows={2} placeholder="Scénario" className="w-full text-xs" />
      <textarea value={recommandations} onChange={(e) => setRecommandations(e.target.value)} rows={2} placeholder="Recommandations" className="w-full text-xs" />
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionControlesSecurite({ entiteId }) {
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useCrudSimple('controles_securite_personnel', 'entite_critique_id', entiteId)
  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <Bloc titre="Contrôles de sécurité du personnel">
      <p className="text-xs text-sourdine mb-2">
        Statut de vérification par poste/fonction uniquement (loi du 11/12/1998) — jamais de
        donnée pénale nominative.
      </p>
      {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Ajouter</BoutonDiscret>}
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      {enAjout && (
        <div className="border border-trait rounded p-3 mt-2 bg-fond">
          <FormulaireControleSecurite
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const { error } = await creer(v)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}
      {chargement ? (
        <p className="text-xs text-sourdine mt-2">Chargement…</p>
      ) : (
        <ul className="space-y-1.5 mt-2">
          {lignes.map((c) =>
            ligneEnEdition === c.id ? (
              <li key={c.id} className="border border-trait rounded p-3 bg-fond">
                <FormulaireControleSecurite
                  valeursInitiales={c}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (v) => {
                    const { error } = await modifier(c.id, v)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-center justify-between border border-trait rounded px-3 py-2 bg-fond text-xs">
                <span>
                  {c.poste_fonction}
                  <span className="jeton ml-2">{STATUTS_VERIFICATION.find((s) => s.valeur === c.statut_verification)?.libelle ?? c.statut_verification}</span>
                </span>
                <span className="flex gap-1.5">
                  <BoutonDiscret onClick={() => setLigneEnEdition(c.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret onClick={() => supprimer(c.id)}>Supprimer</BoutonDiscret>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </Bloc>
  )
}

function FormulaireControleSecurite({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [posteFonction, setPosteFonction] = useState(valeursInitiales.poste_fonction ?? '')
  const [statutVerification, setStatutVerification] = useState(valeursInitiales.statut_verification ?? 'demandee')
  const [dateDemande, setDateDemande] = useState(valeursInitiales.date_demande ?? '')
  const [dateResultat, setDateResultat] = useState(valeursInitiales.date_resultat ?? '')
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    const { error } = await onValider({
      poste_fonction: posteFonction.trim(),
      statut_verification: statutVerification,
      date_demande: dateDemande || null,
      date_resultat: dateResultat || null,
    })
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input required placeholder="Poste / fonction" value={posteFonction} onChange={(e) => setPosteFonction(e.target.value)} className="text-xs" />
        <select value={statutVerification} onChange={(e) => setStatutVerification(e.target.value)} className="text-xs">
          {STATUTS_VERIFICATION.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
        </select>
        <input type="date" value={dateDemande} onChange={(e) => setDateDemande(e.target.value)} placeholder="demande" className="text-xs" />
        <input type="date" value={dateResultat} onChange={(e) => setDateResultat(e.target.value)} placeholder="résultat" className="text-xs" />
      </div>
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionNotificationsIncident({ entiteId }) {
  const { lignes, chargement, erreur, creer, modifier } = useCrudSimple('notifications_incident_cer', 'entite_critique_id', entiteId)
  const [enAjout, setEnAjout] = useState(false)

  return (
    <Bloc titre="Notifications d'incident (SICAD, sous 24h)">
      <p className="text-xs text-sourdine mb-2">
        Journal d'audit réglementaire — une notification n'est jamais supprimée, seul son
        statut évolue.
      </p>
      {!enAjout && <BoutonDiscret onClick={() => setEnAjout(true)}>Notifier un incident</BoutonDiscret>}
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      {enAjout && (
        <div className="border border-trait rounded p-3 mt-2 bg-fond">
          <FormulaireNotificationIncident
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const { error } = await creer(v)
              if (!error) setEnAjout(false)
              return { error }
            }}
          />
        </div>
      )}
      {chargement ? (
        <p className="text-xs text-sourdine mt-2">Chargement…</p>
      ) : (
        <ul className="space-y-1.5 mt-2">
          {lignes.map((n) => (
            <li key={n.id} className="flex items-center justify-between border border-trait rounded px-3 py-2 bg-fond text-xs">
              <span>
                {n.nature}
                <span className={`jeton ml-2 ${n.delai_respecte ? 'text-info' : 'text-chaud'}`}>
                  {n.delai_respecte ? 'délai 24h respecté' : 'délai 24h dépassé'}
                </span>
                <span className="jeton ml-2">{STATUTS_NOTIFICATION.find((s) => s.valeur === n.statut)?.libelle}</span>
                {n.impact_transfrontalier && <span className="jeton ml-2 text-chaud">impact transfrontalier</span>}
              </span>
              <select
                value={n.statut}
                onChange={(e) => modifier(n.id, { statut: e.target.value })}
                className="text-xs"
              >
                {STATUTS_NOTIFICATION.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </Bloc>
  )
}

function FormulaireNotificationIncident({ onValider, onAnnuler }) {
  const [dateIncident, setDateIncident] = useState('')
  const [nature, setNature] = useState('')
  const [causeProbable, setCauseProbable] = useState('')
  const [consequences, setConsequences] = useState('')
  const [impactTransfrontalier, setImpactTransfrontalier] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    const { error } = await onValider({
      date_incident: dateIncident,
      nature: nature.trim(),
      cause_probable: causeProbable.trim() || null,
      consequences: consequences.trim() || null,
      impact_transfrontalier: impactTransfrontalier,
    })
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input required type="datetime-local" value={dateIncident} onChange={(e) => setDateIncident(e.target.value)} className="text-xs" />
        <input required placeholder="Nature de l'incident" value={nature} onChange={(e) => setNature(e.target.value)} className="text-xs" />
      </div>
      <textarea value={causeProbable} onChange={(e) => setCauseProbable(e.target.value)} rows={2} placeholder="Cause probable" className="w-full text-xs" />
      <textarea value={consequences} onChange={(e) => setConsequences(e.target.value)} rows={2} placeholder="Conséquences" className="w-full text-xs" />
      <label className="flex items-center gap-1.5 text-xs text-sourdine">
        <input type="checkbox" checked={impactTransfrontalier} onChange={(e) => setImpactTransfrontalier(e.target.checked)} />
        Impact transfrontalier
      </label>
      {erreur && <p className="text-xs text-chaud">{erreur}</p>}
      <div className="flex gap-1.5">
        <BoutonPrincipal type="submit">Notifier</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
