import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const STATUTS = [
  { valeur: 'en_attente', libelle: 'En attente', classe: 'bg-amber-50 text-amber-700' },
  { valeur: 'valide', libelle: 'Validé', classe: 'bg-emerald-50 text-emerald-700' },
  { valeur: 'refuse', libelle: 'Refusé', classe: 'bg-slate-100 text-slate-500' },
]

export default function BenevolesEntraide() {
  const { contexteId } = useAuth()
  const { lignes: benevoles, chargement, erreur, modifier } = useTableContexte(
    'benevoles_entraide',
    contexteId,
    { tri: 'date_inscription' }
  )

  const [filtreStatut, setFiltreStatut] = useState('en_attente')

  const benevolesTries = [...benevoles].sort(
    (a, b) => new Date(b.date_inscription) - new Date(a.date_inscription)
  )
  const benevolesFiltres = filtreStatut
    ? benevolesTries.filter((b) => b.statut === filtreStatut)
    : benevolesTries

  async function changerStatut(id, statut) {
    await modifier(id, { statut })
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Réseau d'entraide citoyenne</h1>
      <p className="text-sm text-slate-500 mb-4">
        Candidatures reçues via l'app Citoyen. Les coordonnées ne sont visibles que par les
        membres de ce contexte.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      <div className="flex gap-2 mb-3">
        {STATUTS.map((s) => (
          <button
            key={s.valeur}
            onClick={() => setFiltreStatut(filtreStatut === s.valeur ? '' : s.valeur)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              filtreStatut === s.valeur ? 'border-slate-900' : 'border-transparent'
            } ${s.classe}`}
          >
            {s.libelle} ({benevolesTries.filter((b) => b.statut === s.valeur).length})
          </button>
        ))}
      </div>

      {chargement ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : benevolesFiltres.length === 0 ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucune candidature dans cette catégorie.
        </p>
      ) : (
        <ul className="space-y-2">
          {benevolesFiltres.map((b) => (
            <li key={b.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {b.prenom} {b.nom}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${STATUTS.find((s) => s.valeur === b.statut)?.classe}`}>
                      {STATUTS.find((s) => s.valeur === b.statut)?.libelle}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {b.email}
                    {b.telephone && <> · {b.telephone}</>}
                    {b.adresse && <> · {b.adresse}</>}
                  </p>
                  {(b.competences?.length > 0 || b.competences_autre) && (
                    <p className="text-xs text-slate-500 mt-1">
                      Compétences : {[...(b.competences ?? []), b.competences_autre].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {b.disponibilite && (
                    <p className="text-xs text-slate-500 mt-0.5">Disponibilité : {b.disponibilite}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    inscrit le {new Date(b.date_inscription).toLocaleDateString('fr-BE')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  {b.statut !== 'valide' && (
                    <BoutonDiscret onClick={() => changerStatut(b.id, 'valide')}>Valider</BoutonDiscret>
                  )}
                  {b.statut !== 'refuse' && (
                    <BoutonDiscret onClick={() => changerStatut(b.id, 'refuse')}>Refuser</BoutonDiscret>
                  )}
                  {b.statut !== 'en_attente' && (
                    <BoutonDiscret onClick={() => changerStatut(b.id, 'en_attente')}>Remettre en attente</BoutonDiscret>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
