import { useState } from 'react'
import ListeJournal from '../components/ListeJournal'

/** Journal de la plateforme : toutes les actions des super-admins, en ajout seul. */
export default function Journal() {
  const [limite, setLimite] = useState(100)

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Journal</h1>
      <p className="text-sm text-sourdine mb-4">
        Créations et modifications de clients, suspensions, accès donnés ou retirés, comptes désactivés. Ce journal ne
        peut être ni modifié ni effacé depuis les applications.
      </p>
      <ListeJournal limite={limite} />
      {limite < 500 && (
        <button type="button" className="discret mt-3" onClick={() => setLimite(500)}>
          Afficher plus (jusqu'à 500)
        </button>
      )}
    </div>
  )
}
