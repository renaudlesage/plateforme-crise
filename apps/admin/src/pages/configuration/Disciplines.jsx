import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTableContexte } from '../../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../../components/Boutons'

export default function Disciplines() {
  const { contexteId } = useAuth()
  const { lignes: disciplines, chargement, erreur, creer, modifier, supprimer } = useTableContexte(
    'disciplines',
    contexteId,
    { tri: 'code' }
  )

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-medium text-slate-900">Disciplines</h2>
          <p className="text-sm text-slate-500">
            Les ensembles fonctionnels de missions (D1-D5 par défaut), activables ou non selon
            le contexte.
          </p>
        </div>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une discipline</BoutonPrincipal>
        )}
      </div>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireDiscipline
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
      ) : disciplines.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucune discipline définie pour ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {disciplines.map((d) =>
            ligneEnEdition === d.id ? (
              <li key={d.id} className="bg-slate-50 p-3">
                <FormulaireDiscipline
                  valeursInitiales={d}
                  onAnnuler={() => setLigneEnEdition(null)}
                  onValider={async (valeurs) => {
                    const { error } = await modifier(d.id, valeurs)
                    if (!error) setLigneEnEdition(null)
                    return { error }
                  }}
                />
              </li>
            ) : (
              <li key={d.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {d.code}
                  </span>
                  <p className="text-sm font-medium text-slate-900">{d.libelle}</p>
                  {!d.actif && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                      inactive
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <BoutonDiscret onClick={() => setLigneEnEdition(d.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer la discipline "${d.libelle}" ?`)) supprimer(d.id)
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
    </section>
  )
}

function FormulaireDiscipline({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [code, setCode] = useState(valeursInitiales.code ?? '')
  const [libelle, setLibelle] = useState(valeursInitiales.libelle ?? '')
  const [actif, setActif] = useState(valeursInitiales.actif ?? true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      code: code.trim().toUpperCase(),
      libelle: libelle.trim(),
      actif,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-3 bg-slate-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ex. D1"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Libellé</label>
          <input
            required
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="ex. Opérations de secours"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Active
      </label>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>
          Annuler
        </BoutonDiscret>
      </div>
    </form>
  )
}
