import { useState } from 'react'
import Roles from './configuration/Roles'
import NiveauxEscalade from './configuration/NiveauxEscalade'
import Disciplines from './configuration/Disciplines'

const ONGLETS = [
  { id: 'roles', label: 'Rôles', Composant: Roles },
  { id: 'niveaux', label: "Niveaux d'escalade", Composant: NiveauxEscalade },
  { id: 'disciplines', label: 'Disciplines', Composant: Disciplines },
]

export default function Configuration() {
  const [ongletActif, setOngletActif] = useState('roles')
  const { Composant } = ONGLETS.find((o) => o.id === ongletActif)

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Configuration</h1>
      <p className="text-sm text-slate-500 mb-4">
        La base sur laquelle reposent les référentiels, checklists et instances de coordination.
      </p>

      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOngletActif(o.id)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              ongletActif === o.id
                ? 'border-slate-900 text-slate-900 font-medium'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <Composant />
    </div>
  )
}
