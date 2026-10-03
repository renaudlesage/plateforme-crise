import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const STATUTS = [
  { valeur: 'en_attente', libelle: 'En attente', classe: 'text-veille' },
  { valeur: 'valide', libelle: 'Validé', classe: 'text-ok' },
  { valeur: 'refuse', libelle: 'Refusé', classe: 'bg-surface-2 text-sourdine' },
]

const COMPETENCES_CONNUES = [
  'Premiers secours',
  'Logistique / transport',
  'Hébergement / accueil',
  'Communication',
  'Informatique / réseaux',
  'Bricolage / travaux',
  'Cuisine / restauration',
]

const LIBELLE_MISSION = {
  appui_administratif: 'Appui administratif',
  communication: 'Communication',
  evacuation: 'Évacuation',
  logistique: 'Logistique',
  accueil: 'Accueil',
  prise_en_charge: 'Prise en charge',
}

export default function BenevolesEntraide() {
  const { contexteId } = useAuth()
  const { lignes: benevoles, chargement, erreur, modifier } = useTableContexte(
    'benevoles_entraide',
    contexteId,
    { tri: 'date_inscription' }
  )

  const [filtreStatut, setFiltreStatut] = useState('en_attente')
  const [filtreCompetence, setFiltreCompetence] = useState('')

  const benevolesTries = [...benevoles].sort(
    (a, b) => new Date(b.date_inscription) - new Date(a.date_inscription)
  )
  const benevolesFiltres = benevolesTries
    .filter((b) => (filtreStatut ? b.statut === filtreStatut : true))
    .filter((b) => (filtreCompetence ? (b.competences ?? []).includes(filtreCompetence) : true))

  async function changerStatut(id, statut) {
    await modifier(id, { statut })
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Réseau d'entraide citoyenne</h1>
      <p className="text-sm text-sourdine mb-4">
        Candidatures reçues via l'app Citoyen. Les coordonnées ne sont visibles que par les
        membres de ce contexte.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      <div className="flex gap-2 mb-3">
        {STATUTS.map((s) => (
          <button
            key={s.valeur}
            onClick={() => setFiltreStatut(filtreStatut === s.valeur ? '' : s.valeur)}
            className={`text-xs px-2.5 py-1 rounded border ${
              filtreStatut === s.valeur ? 'border-trait-fort' : 'border-transparent'
            } ${s.classe}`}
          >
            {s.libelle} ({benevolesTries.filter((b) => b.statut === s.valeur).length})
          </button>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-sourdine mb-1">Filtrer par compétence</label>
        <select
          value={filtreCompetence}
          onChange={(e) => setFiltreCompetence(e.target.value)}
          className=""
        >
          <option value="">Toutes compétences</option>
          {COMPETENCES_CONNUES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : benevolesFiltres.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune candidature dans cette catégorie.
        </p>
      ) : (
        <ul className="space-y-2">
          {benevolesFiltres.map((b) => (
            <li key={b.id} className="bg-surface border border-trait rounded p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-encre">
                    {b.prenom} {b.nom}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${STATUTS.find((s) => s.valeur === b.statut)?.classe}`}>
                      {STATUTS.find((s) => s.valeur === b.statut)?.libelle}
                    </span>
                  </p>
                  <p className="text-xs text-sourdine mt-0.5">
                    {b.email}
                    {b.telephone && <> · {b.telephone}</>}
                    {b.adresse && <> · {b.adresse}</>}
                  </p>
                  {(b.competences?.length > 0 || b.competences_autre) && (
                    <p className="text-xs text-sourdine mt-1">
                      Compétences : {[...(b.competences ?? []), b.competences_autre].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {b.disponibilite && (
                    <p className="text-xs text-sourdine mt-0.5">Disponibilité : {b.disponibilite}</p>
                  )}
                  {b.missions_possibles?.length > 0 && (
                    <p className="text-xs text-sourdine mt-0.5">
                      Missions possibles : {b.missions_possibles.map((m) => LIBELLE_MISSION[m] ?? m).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-sourdine mt-1">
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
