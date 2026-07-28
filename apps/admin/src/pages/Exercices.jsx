import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

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
        <h1 className="text-lg font-semibold text-slate-900">Exercices</h1>
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
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
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
                    {ex.type_exercice}
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
  const [typeExercice, setTypeExercice] = useState(valeursInitiales.type_exercice ?? '')
  const [datePlanifiee, setDatePlanifiee] = useState(valeursInitiales.date_planifiee ?? '')
  const [dateRealisee, setDateRealisee] = useState(valeursInitiales.date_realisee ?? '')
  const [objectifs, setObjectifs] = useState(valeursInitiales.objectifs ?? '')
  const [evaluation, setEvaluation] = useState(valeursInitiales.evaluation ?? '')
  const [valide, setValide] = useState(valeursInitiales.valide_par_niveau_superieur ?? false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      type_exercice: typeExercice.trim(),
      date_planifiee: datePlanifiee || null,
      date_realisee: dateRealisee || null,
      objectifs: objectifs.trim() || null,
      evaluation: evaluation.trim() || null,
      valide_par_niveau_superieur: valide,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Type d'exercice</label>
        <input
          required
          value={typeExercice}
          onChange={(e) => setTypeExercice(e.target.value)}
          placeholder="ex. Exercice cadre inondation"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
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
        <label className="block text-xs font-medium text-slate-600 mb-1">Objectifs</label>
        <textarea value={objectifs} onChange={(e) => setObjectifs(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Évaluation</label>
        <textarea value={evaluation} onChange={(e) => setEvaluation(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={valide} onChange={(e) => setValide(e.target.checked)} />
        Validé par le niveau supérieur
      </label>

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
