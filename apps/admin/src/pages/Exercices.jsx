import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const TYPES_EXERCICE = [
  { valeur: 'visite_guidee', libelle: 'Visite guidée' },
  { valeur: 'etude_cas', libelle: 'Étude de cas' },
  { valeur: 'alerte', libelle: 'Exercice d’alerte' },
  { valeur: 'farex', libelle: 'FarEx (fonctionnel partiel)' },
  { valeur: 'ttx', libelle: 'TTX (table-top)' },
  { valeur: 'cpx', libelle: 'CPX (poste de commandement)' },
  { valeur: 'ftx', libelle: 'FTX (grandeur réelle)' },
]

const LIBELLE_TYPE_EXERCICE = Object.fromEntries(TYPES_EXERCICE.map((t) => [t.valeur, t.libelle]))

function lignesVersJson(texte) {
  const lignes = texte.split('\n').map((l) => l.trim()).filter(Boolean)
  return lignes.length ? lignes : []
}

function jsonVersLignes(valeur) {
  if (!valeur) return ''
  if (Array.isArray(valeur)) return valeur.join('\n')
  return ''
}

export default function Exercices() {
  const { contexteId } = useAuth()
  const {
    lignes: exercices,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('exercices', contexteId, { tri: 'date_planifiee' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Exercices</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un exercice</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Exercices planifiés, réalisés et leur évaluation.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireExercice
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : exercices.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun exercice enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {exercices.map((ex) =>
            ligneEnEdition === ex.id ? (
              <li key={ex.id} className="bg-slate-50 p-3">
                <FormulaireExercice
                  valeursInitiales={ex}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(ex.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={ex.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {LIBELLE_TYPE_EXERCICE[ex.type_exercice] ?? ex.type_exercice}
                    {ex.valide_par_niveau_superieur && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                        validé niveau supérieur
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {ex.date_planifiee && <>planifié : {ex.date_planifiee}</>}
                    {ex.date_realisee && <> · réalisé : {ex.date_realisee}</>}
                  </p>
                  {ex.objectifs && <p className="text-xs text-slate-400 mt-1">objectifs : {ex.objectifs}</p>}
                  {ex.evaluation && <p className="text-xs text-slate-400 mt-0.5">évaluation : {ex.evaluation}</p>}
                  {ex.rapport_final && <p className="text-xs text-slate-400 mt-0.5">rapport final renseigné</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(ex.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm('Supprimer cet exercice ?')) supprimer(ex.id)
                    }}
                  >
                    Supprimer
                  </BoutonDiscret>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function FormulaireExercice({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [typeExercice, setTypeExercice] = useState(valeursInitiales.type_exercice ?? TYPES_EXERCICE[0].valeur)
  const [datePlanifiee, setDatePlanifiee] = useState(valeursInitiales.date_planifiee ?? '')
  const [dateRealisee, setDateRealisee] = useState(valeursInitiales.date_realisee ?? '')
  const [objectifs, setObjectifs] = useState(valeursInitiales.objectifs ?? '')
  const [objectifsStructures, setObjectifsStructures] = useState(jsonVersLignes(valeursInitiales.objectifs_jsonb))
  const [mel, setMel] = useState(jsonVersLignes(valeursInitiales.mel))
  const [consignesSecurite, setConsignesSecurite] = useState(valeursInitiales.consignes_securite ?? '')
  const [evaluation, setEvaluation] = useState(valeursInitiales.evaluation ?? '')
  const [rapportFinal, setRapportFinal] = useState(valeursInitiales.rapport_final ?? '')
  const [valide, setValide] = useState(valeursInitiales.valide_par_niveau_superieur ?? false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_exercice: typeExercice,
      date_planifiee: datePlanifiee || null,
      date_realisee: dateRealisee || null,
      objectifs: objectifs.trim() || null,
      objectifs_jsonb: lignesVersJson(objectifsStructures),
      mel: lignesVersJson(mel),
      consignes_securite: consignesSecurite.trim() || null,
      evaluation: evaluation.trim() || null,
      rapport_final: rapportFinal.trim() || null,
      valide_par_niveau_superieur: valide,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Type d'exercice</label>
        <select
          value={typeExercice}
          onChange={(e) => setTypeExercice(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
        >
          {TYPES_EXERCICE.map((t) => (
            <option key={t.valeur} value={t.valeur}>{t.libelle}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date planifiée</label>
          <input type="date" value={datePlanifiee} onChange={(e) => setDatePlanifiee(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date réalisée</label>
          <input type="date" value={dateRealisee} onChange={(e) => setDateRealisee(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Objectifs (résumé libre)</label>
        <textarea value={objectifs} onChange={(e) => setObjectifs(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Objectifs structurés (un par ligne)</label>
        <textarea value={objectifsStructures} onChange={(e) => setObjectifsStructures(e.target.value)} rows={3} placeholder={'ex.\nTester l’activation du Comité de Coordination\nValider le délai de notification des disciplines'} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">MEL — Main Events List (un événement par ligne)</label>
        <textarea value={mel} onChange={(e) => setMel(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Consignes de sécurité</label>
        <textarea value={consignesSecurite} onChange={(e) => setConsignesSecurite(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Évaluation (synthèse)</label>
        <textarea value={evaluation} onChange={(e) => setEvaluation(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Rapport final</label>
        <p className="text-xs text-slate-400 mb-1">Jugement sur le dispositif uniquement — jamais nominatif sur une personne.</p>
        <textarea value={rapportFinal} onChange={(e) => setRapportFinal(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={valide} onChange={(e) => setValide(e.target.checked)} />
        Validé par le niveau supérieur
      </label>

      {valeursInitiales.id && <GestionRolesExercice exerciceId={valeursInitiales.id} />}
      {valeursInitiales.id && <GestionEvaluationsExercice exerciceId={valeursInitiales.id} />}

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function GestionRolesExercice({ exerciceId }) {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [roles, setRoles] = useState([])
  const [chargement, setChargement] = useState(true)
  const [contactId, setContactId] = useState('')
  const [fonctionJouee, setFonctionJouee] = useState('')
  const [estEvaluateur, setEstEvaluateur] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('exercice_roles')
      .select('*, contacts(id, nom, prenom)')
      .eq('exercice_id', exerciceId)
    if (error) setErreur(error.message)
    else setRoles(data ?? [])
    setChargement(false)
  }, [exerciceId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouter() {
    if (!contactId || !fonctionJouee.trim()) return
    const { error } = await supabase.from('exercice_roles').insert({
      exercice_id: exerciceId,
      contact_id: contactId,
      fonction_jouee: fonctionJouee.trim(),
      est_evaluateur: estEvaluateur,
    })
    if (error) setErreur(error.message)
    else {
      setContactId('')
      setFonctionJouee('')
      setEstEvaluateur(false)
      await rafraichir()
    }
  }

  async function retirer(id) {
    await supabase.from('exercice_roles').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t border-slate-200">
      <p className="text-xs font-medium text-slate-600 mb-2">Rôles tenus durant l'exercice</p>
      {erreur && <p className="text-xs text-red-600 mb-1">{erreur}</p>}
      {chargement ? (
        <p className="text-xs text-slate-400">Chargement…</p>
      ) : (
        <>
          {roles.length > 0 && (
            <ul className="space-y-1 mb-2">
              {roles.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-xs bg-white rounded px-2.5 py-1.5 border border-slate-200">
                  <span>
                    {r.contacts?.prenom} {r.contacts?.nom} — {r.fonction_jouee}
                    {r.est_evaluateur && <span className="ml-1 text-slate-400">(évaluateur)</span>}
                  </span>
                  <button type="button" onClick={() => retirer(r.id)} className="text-slate-400 hover:text-red-600">✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white">
              <option value="">Participant…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
            <input
              value={fonctionJouee}
              onChange={(e) => setFonctionJouee(e.target.value)}
              placeholder="fonction jouée"
              className="rounded-md border border-slate-300 px-2 py-1 text-xs flex-1 min-w-[140px]"
            />
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={estEvaluateur} onChange={(e) => setEstEvaluateur(e.target.checked)} />
              évaluateur
            </label>
            <BoutonDiscret type="button" onClick={ajouter} disabled={!contactId || !fonctionJouee.trim()}>Ajouter</BoutonDiscret>
          </div>
        </>
      )}
    </div>
  )
}

const NIVEAUX_ATTEINTE = [
  { valeur: 'non_atteint', libelle: 'Non atteint' },
  { valeur: 'partiellement_atteint', libelle: 'Partiellement atteint' },
  { valeur: 'atteint', libelle: 'Atteint' },
  { valeur: 'depasse', libelle: 'Dépassé' },
]

function GestionEvaluationsExercice({ exerciceId }) {
  const [evaluations, setEvaluations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [enAjout, setEnAjout] = useState(false)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('exercice_evaluations')
      .select('*')
      .eq('exercice_id', exerciceId)
    if (error) setErreur(error.message)
    else setEvaluations(data ?? [])
    setChargement(false)
  }, [exerciceId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function retirer(id) {
    await supabase.from('exercice_evaluations').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2 border-t border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-600">Évaluation par objectif (sur le dispositif, jamais nominatif)</p>
        {!enAjout && (
          <button type="button" onClick={() => setEnAjout(true)} className="text-xs text-institution-700 hover:underline">
            + ajouter
          </button>
        )}
      </div>

      {erreur && <p className="text-xs text-red-600 mb-1">{erreur}</p>}

      {enAjout && (
        <FormulaireEvaluationExercice
          exerciceId={exerciceId}
          onAnnuler={() => setEnAjout(false)}
          onValider={async () => {
            setEnAjout(false)
            await rafraichir()
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-slate-400">Chargement…</p>
      ) : evaluations.length === 0 ? (
        <p className="text-xs text-slate-400">Aucune évaluation pour l'instant.</p>
      ) : (
        <ul className="space-y-1">
          {evaluations.map((ev) => (
            <li key={ev.id} className="bg-white rounded px-2.5 py-1.5 border border-slate-200 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-slate-800">
                    {ev.objectif_evalue}
                    <span className="ml-2 text-slate-400">
                      ({NIVEAUX_ATTEINTE.find((n) => n.valeur === ev.niveau_atteinte)?.libelle ?? ev.niveau_atteinte})
                    </span>
                  </p>
                  {ev.constat && <p className="text-slate-400">constat : {ev.constat}</p>}
                  {ev.recommandation && <p className="text-slate-400">recommandation : {ev.recommandation}</p>}
                </div>
                <button type="button" onClick={() => retirer(ev.id)} className="text-slate-400 hover:text-red-600 flex-shrink-0">✕</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireEvaluationExercice({ exerciceId, onValider, onAnnuler }) {
  const [objectifEvalue, setObjectifEvalue] = useState('')
  const [niveauAtteinte, setNiveauAtteinte] = useState(NIVEAUX_ATTEINTE[2].valeur)
  const [constat, setConstat] = useState('')
  const [recommandation, setRecommandation] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await supabase.from('exercice_evaluations').insert({
      exercice_id: exerciceId,
      objectif_evalue: objectifEvalue.trim(),
      niveau_atteinte: niveauAtteinte,
      constat: constat.trim() || null,
      recommandation: recommandation.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else onValider()
  }

  return (
    <form onSubmit={soumettre} className="bg-white border border-slate-200 rounded-lg p-2.5 mb-2 space-y-2">
      <input
        required
        value={objectifEvalue}
        onChange={(e) => setObjectifEvalue(e.target.value)}
        placeholder="Objectif évalué"
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      />
      <select value={niveauAtteinte} onChange={(e) => setNiveauAtteinte(e.target.value)} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs bg-white">
        {NIVEAUX_ATTEINTE.map((n) => (
          <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
        ))}
      </select>
      <textarea value={constat} onChange={(e) => setConstat(e.target.value)} placeholder="Constat" rows={2} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
      <textarea value={recommandation} onChange={(e) => setRecommandation(e.target.value)} placeholder="Recommandation" rows={2} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter'}</BoutonDiscret>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
