import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function CanauxRadio() {
  const { contexteId } = useAuth()
  const {
    lignes: canaux,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('canaux_radio', contexteId, {
    colonnes: '*, niveaux_escalade(id, libelle), disciplines(id, code, libelle)',
    tri: 'code',
  })
  const { lignes: niveaux } = useTableContexte('niveaux_escalade', contexteId, { tri: 'ordre' })
  const { lignes: disciplines } = useTableContexte('disciplines', contexteId, { tri: 'code' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Canaux radio</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un canal</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Plan des groupes de communication, par niveau et par discipline.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireCanal
          niveaux={niveaux}
          disciplines={disciplines}
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
      ) : canaux.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun canal radio enregistré.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {canaux.map((c) =>
            ligneEnEdition === c.id ? (
              <li key={c.id} className="bg-slate-50 p-3">
                <FormulaireCanal
                  niveaux={niveaux}
                  disciplines={disciplines}
                  valeursInitiales={c}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(c.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-start justify-between px-4 py-2.5 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900 font-mono">{c.code}</p>
                  <p className="text-xs text-slate-500">
                    {c.description}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {c.niveaux_escalade?.libelle && <span>{c.niveaux_escalade.libelle}</span>}
                    {c.disciplines?.code && <span> · {c.disciplines.code}</span>}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(c.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer le canal "${c.code}" ?`)) supprimer(c.id)
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

function FormulaireCanal({ niveaux, disciplines, valeursInitiales = {}, onValider, onAnnuler }) {
  const [code, setCode] = useState(valeursInitiales.code ?? '')
  const [description, setDescription] = useState(valeursInitiales.description ?? '')
  const [niveauId, setNiveauId] = useState(valeursInitiales.niveau_id ?? '')
  const [disciplineId, setDisciplineId] = useState(valeursInitiales.discipline_id ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      code: code.trim(),
      description: description.trim() || null,
      niveau_id: niveauId || null,
      discipline_id: disciplineId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ex. M LUX C"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex. Canal PC-Ops principal" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Niveau</label>
          <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>{n.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Discipline</label>
          <select value={disciplineId} onChange={(e) => setDisciplineId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.code} — {d.libelle}</option>
            ))}
          </select>
        </div>
      </div>

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
