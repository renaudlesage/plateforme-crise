import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const LIBELLE_NIVEAU = {
  lecture: 'Lecture seule',
  ecriture: 'Édition',
  admin: 'Administrateur',
}

const LIBELLE_TYPE = {
  commune: 'Commune',
  province: 'Province',
  federal: 'Fédéral',
  evenement: 'Événement',
  autre: 'Autre',
}

export default function SelectionContexte() {
  const { acces, chargementAcces, selectionnerContexte, deconnexion } = useAuth()
  const navigate = useNavigate()

  function choisir(id) {
    selectionnerContexte(id)
    navigate('/')
  }

  if (chargementAcces) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-sourdine">Chargement de vos accès…</p>
      </div>
    )
  }

  if (acces.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-encre">Aucun accès configuré</h1>
          <p className="mt-2 text-sm text-sourdine">
            Ce compte n'est rattaché à aucun contexte pour l'instant. Contactez l'administrateur
            de la plateforme pour qu'il vous ajoute à une commune ou un événement.
          </p>
          <button
            onClick={deconnexion}
            className="mt-6 text-sm text-sourdine underline hover:text-encre"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-lg font-semibold text-encre mb-1">Choisir un contexte</h1>
        <p className="text-sm text-sourdine mb-6">
          Sélectionnez la commune, province ou l'événement sur lequel vous voulez travailler.
        </p>

        <ul className="space-y-2">
          {acces.map((a) => (
            <li key={a.contexte_id}>
              <button
                onClick={() => choisir(a.contexte_id)}
                className="w-full text-left bg-surface border border-trait rounded px-4 py-3 hover:border-trait-fort transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-encre">{a.contextes?.nom ?? 'Contexte sans nom'}</p>
                  <p className="text-xs text-sourdine">
                    {LIBELLE_TYPE[a.contextes?.type] ?? a.contextes?.type}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-surface-2 text-sourdine">
                  {LIBELLE_NIVEAU[a.niveau_acces] ?? a.niveau_acces}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={deconnexion}
          className="mt-6 text-sm text-sourdine underline hover:text-encre"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
