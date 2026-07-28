import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function MisEnPage() {
  const { utilisateur, contexteActuel, deconnexion, selectionnerContexte } = useAuth()
  const navigate = useNavigate()

  function changerDeContexte() {
    selectionnerContexte(null)
    navigate('/selection-contexte')
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900">Admin</span>
            <span className="text-slate-300">/</span>
            <button
              onClick={changerDeContexte}
              className="text-sm text-slate-600 hover:text-slate-900 underline decoration-dotted"
            >
              {contexteActuel?.contextes?.nom ?? 'Aucun contexte'}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:inline">{utilisateur?.email}</span>
            <button
              onClick={deconnexion}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Se déconnecter
            </button>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-4 flex gap-4 text-sm border-t border-slate-100">
          <Link to="/" className="py-2 text-slate-600 hover:text-slate-900">
            Tableau de bord
          </Link>
          <Link to="/configuration" className="py-2 text-slate-600 hover:text-slate-900">
            Configuration
          </Link>
          <Link to="/annuaire" className="py-2 text-slate-600 hover:text-slate-900">
            Annuaire
          </Link>
          <Link to="/risques" className="py-2 text-slate-600 hover:text-slate-900">
            Objets à risque
          </Link>
          <Link to="/ressources" className="py-2 text-slate-600 hover:text-slate-900">
            Ressources
          </Link>
          <Link to="/sites-qg" className="py-2 text-slate-600 hover:text-slate-900">
            Sites QG
          </Link>
          <Link to="/centres-accueil" className="py-2 text-slate-600 hover:text-slate-900">
            Centres d'accueil
          </Link>
          <Link to="/canaux-radio" className="py-2 text-slate-600 hover:text-slate-900">
            Canaux radio
          </Link>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
