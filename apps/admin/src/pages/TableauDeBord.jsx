import { useAuth } from '../context/AuthContext'

export default function TableauDeBord() {
  const { contexteActuel } = useAuth()

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Tableau de bord</h1>
      <p className="mt-1 text-sm text-slate-500">
        Contexte actif : <strong>{contexteActuel?.contextes?.nom}</strong> · niveau d'accès :{' '}
        <strong>{contexteActuel?.niveau_acces}</strong>
      </p>

      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
        Les modules Référentiels, Gouvernance et Accès viendront ici, module par module.
      </div>
    </div>
  )
}
