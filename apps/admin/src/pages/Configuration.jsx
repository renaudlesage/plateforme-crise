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
      <h1 className="text-xl font-semibold text-encre mb-1">Configuration</h1>
      <p className="text-sm text-sourdine mb-4">
        La base sur laquelle reposent les référentiels, checklists et instances de coordination.
      </p>

      <div className="onglets">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            onClick={() => setOngletActif(o.id)}
            className={`module${ongletActif === o.id ? ' actif' : ''}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <Composant />
    </div>
  )
}
