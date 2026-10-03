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
        <h1 className="text-lg font-semibold text-encre">Incidents</h1>
        {!enAjout && (
          <BoutonPrincipal onClick={() => setEnAjout(true)}>Déclencher un incident</BoutonPrincipal>
        )}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Vue d'ensemble des incidents en cours et clôturés pour ce contexte.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

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
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : incidentsTries.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun incident enregistré pour ce contexte.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden">
          {incidentsTries.map((i) => (
            <li key={i.id}>
              <Link
                to={`/incidents/${i.id}`}
                className="flex items-center justify-between px-4 py-3 bg-surface hover:bg-fond transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-encre">
                    {i.nom}
                    <span
                      className={`jeton ml-2 ${
                        i.statut === 'en_cours'
                          ? 'text-chaud'
                          : i.statut === 'pre_alerte'
                          ? 'text-veille'
                          : 'text-sourdine'
                      }`}
                    >
                      {LIBELLE_STATUT[i.statut] ?? i.statut}
                    </span>
                    {i.degre_criticite != null && (
                      <span className="jeton ml-2 bg-encre text-fond">
                        degré {i.degre_criticite}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-sourdine">
                    {i.type_evenement && <>{i.type_evenement} · </>}
                    {i.niveaux_escalade?.libelle}
                    {' · '}
                    {new Date(i.date_debut).toLocaleString('fr-BE')}
                  </p>
                </div>
                <span className="text-sourdine text-sm">→</span>
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
  const [degreCriticite, setDegreCriticite] = useState('')
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
      degre_criticite: degreCriticite === '' ? null : Number(degreCriticite),
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Nom de l'incident</label>
        <input
          required
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="ex. Inondation Rue du Centre"
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Type d'événement</label>
          <input value={typeEvenement} onChange={(e) => setTypeEvenement(e.target.value)} placeholder="ex. inondation" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau déclenché</label>
          <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className="w-full">
            <option value="">—</option>
            {niveaux.map((n) => (
              <option key={n.id} value={n.id}>{n.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Degré de criticité (1-4, PRGC)</label>
        <p className="text-xs text-sourdine mb-1">Axe indépendant du niveau d'escalade — à ajuster au fil de l'incident.</p>
        <select value={degreCriticite} onChange={(e) => setDegreCriticite(e.target.value)} className="w-full sm:w-48">
          <option value="">—</option>
          <option value="1">1 — faible</option>
          <option value="2">2 — modéré</option>
          <option value="3">3 — sérieux</option>
          <option value="4">4 — majeur</option>
        </select>
      </div>

      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Déclenchement…' : 'Déclencher'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
