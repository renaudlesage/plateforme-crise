import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const LIBELLE_STATUT = {
  pre_alerte: 'Pré-alerte',
  en_cours: 'En cours',
  cloture: 'Clôturé',
}

export default function Incidents() {
  const { contexteId } = useAuth()
  const {
    lignes: incidents,
    chargement,
    erreur,
    creer,
  } = useTableContexte('incidents', contexteId, {
    colonnes: '*, niveaux_escalade(id, libelle)',
    tri: 'date_debut',
  })
  const { lignes: niveaux } = useTableContexte('niveaux_escalade', contexteId, { tri: 'ordre' })

  const [enAjout, setEnAjout] = useState(false)

  const incidentsTries = [...incidents].sort((a, b) => new Date(b.date_debut) - new Date(a.date_debut))

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-slate-900">Incidents</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Déclencher un incident</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Vue d'ensemble des incidents en cours et clôturés pour ce contexte.
      </p>

      {erreur && <p className="text-sm text-red-600 mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireIncident
          niveaux={niveaux}
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
      ) : incidentsTries.length === 0 && !enAjout ? (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-lg p-6 text-center">
          Aucun incident enregistré pour ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
          {incidentsTries.map((i) => (
            <li key={i.id}>
              <Link
                to={`/incidents/${i.id}`}
                className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {i.nom}
                    <span
                      className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        i.statut === 'en_cours'
                          ? 'bg-red-50 text-red-700'
                          : i.statut === 'pre_alerte'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {LIBELLE_STATUT[i.statut] ?? i.statut}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {i.type_evenement && <>{i.type_evenement} · </>}
                    {i.niveaux_escalade?.libelle}
                    {' · '}
                    {new Date(i.date_debut).toLocaleString('fr-BE')}
                  </p>
                </div>
                <span className="text-slate-400 text-sm">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireIncident({ niveaux, onValider, onAnnuler }) {
  const [nom, setNom] = useState('')
  const [typeEvenement, setTypeEvenement] = useState('')
  const [niveauId, setNiveauId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      nom: nom.trim(),
      type_evenement: typeEvenement.trim() || null,
      statut: 'en_cours',
      niveau_actuel_id: niveauId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Nom de l'incident</label>
        <input
          required
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="ex. Inondation Rue du Centre"
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type d'événement</label>
          <input value={typeEvenement} onChange={(e) => setTypeEvenement(e.target.value)} placeholder="ex. inondation" className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Niveau déclenché</label>
          <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white">
            <option value="">—</option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Déclenchement…' : 'Déclencher'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
