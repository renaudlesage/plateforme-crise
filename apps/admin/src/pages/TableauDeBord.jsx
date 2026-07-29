import { useAuth } from '../context/AuthContext'

export default function TableauDeBord() {
  const { contexteActuel } = useAuth()

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-slate-900">Tableau de bord</h1>
      <p className="mt-1.5 text-sm text-slate-500">
        Contexte actif : <strong className="text-slate-700">{contexteActuel?.contextes?.nom}</strong>
        <span className="mx-2 text-slate-300">·</span>
        niveau d'accès : <strong className="text-slate-700">{contexteActuel?.niveau_acces}</strong>
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border-l-4 border-institution-600 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Configuration</p>
          <p className="mt-1 text-sm text-slate-600">Rôles, niveaux d'escalade, disciplines actives.</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border-l-4 border-institution-600 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Référentiels</p>
          <p className="mt-1 text-sm text-slate-600">Annuaire, risques, ressources, sites, plans.</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border-l-4 border-institution-600 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gouvernance</p>
          <p className="mt-1 text-sm text-slate-600">Instances, checklists, exercices.</p>
        </div>
      </div>

      <p className="mt-8 text-sm text-slate-400">
        Utilisez le menu à gauche pour accéder à chaque module.
      </p>
    </div>
  )
}
