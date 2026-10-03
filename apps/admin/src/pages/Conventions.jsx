import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

export default function Conventions() {
  const { contexteId } = useAuth()
  const {
    lignes: conventions,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('conventions', contexteId, { tri: 'partenaire' })

  const [enAjout, setEnAjout] = useState(false)
  const [ligneEnEdition, setLigneEnEdition] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-xl font-semibold text-slate-900">Conventions</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter une convention</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Accords formalisés avec des partenaires publics ou privés — base juridique des ressources
        mobilisables sous convention.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireConvention
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
      ) : conventions.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucune convention enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {conventions.map((c) =>
            ligneEnEdition === c.id ? (
              <li key={c.id} className="bg-slate-50 p-3">
                <FormulaireConvention
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
              <li key={c.id} className="flex items-start justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {c.partenaire}
                    {c.fichier_url && (
                      <a href={c.fichier_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-institution-700 hover:underline">
                        document
                      </a>
                    )}
                  </p>
                  {c.objet && <p className="text-xs text-slate-500">{c.objet}</p>}
                  {(c.date_debut || c.date_fin) && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {c.date_debut ?? '?'} → {c.date_fin ?? '?'}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <BoutonDiscret onClick={() => setLigneEnEdition(c.id)}>Modifier</BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm(`Supprimer la convention avec "${c.partenaire}" ?`)) supprimer(c.id)
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

function FormulaireConvention({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [partenaire, setPartenaire] = useState(valeursInitiales.partenaire ?? '')
  const [objet, setObjet] = useState(valeursInitiales.objet ?? '')
  const [dateDebut, setDateDebut] = useState(valeursInitiales.date_debut ?? '')
  const [dateFin, setDateFin] = useState(valeursInitiales.date_fin ?? '')
  const [fichierUrl, setFichierUrl] = useState(valeursInitiales.fichier_url ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      partenaire: partenaire.trim(),
      objet: objet.trim() || null,
      date_debut: dateDebut || null,
      date_fin: dateFin || null,
      fichier_url: fichierUrl.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Partenaire</label>
        <input
          required
          value={partenaire}
          onChange={(e) => setPartenaire(e.target.value)}
          placeholder="ex. Croix-Rouge de Belgique"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Objet de la convention</label>
        <textarea value={objet} onChange={(e) => setObjet(e.target.value)} rows={2} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date de début</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date de fin</label>
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Lien vers le document (URL)</label>
        <input value={fichierUrl} onChange={(e) => setFichierUrl(e.target.value)} placeholder="https://…" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
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
