import { useAuth } from '../context/AuthContext'

export default function TableauDeBord() {
  const { contexteActuel } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-encre">Tableau de bord</h1>
      <p className="mt-1.5 text-sm text-sourdine">
        Contexte actif : <strong className="text-sourdine">{contexteActuel?.contextes?.nom}</strong>
        <span className="mx-2 text-sourdine">·</span>
        niveau d'accès : <strong className="text-sourdine">{contexteActuel?.niveau_acces}</strong>
      </p>

      <div className="grille-paves mt-8">
        <div className="pave">
          <p className="pave-titre">Configuration</p>
          <p className="text-sm text-sourdine">Rôles, niveaux d'escalade, disciplines actives.</p>
        </div>
        <div className="pave">
          <p className="pave-titre">Référentiels</p>
          <p className="text-sm text-sourdine">Annuaire, risques, ressources, sites, plans.</p>
        </div>
        <div className="pave">
          <p className="pave-titre">Gouvernance</p>
          <p className="text-sm text-sourdine">Instances, checklists, exercices.</p>
        </div>
      </div>

      <p className="mt-8 text-sm text-sourdine">
        Utilisez le menu à gauche pour accéder à chaque module.
      </p>
    </div>
  )
}
