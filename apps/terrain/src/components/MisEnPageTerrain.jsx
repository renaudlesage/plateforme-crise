import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function MisEnPageTerrain() {
  const { contexteActuel, deconnexion, selectionnerContexte } = useAuth()
  const navigate = useNavigate()

  function changerDeContexte() {
    selectionnerContexte(null)
    navigate('/selection-contexte')
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={changerDeContexte} className="text-sm font-medium text-slate-900">
          {contexteActuel?.contextes?.nom ?? 'Aucun contexte'}
        </button>
        <button onClick={deconnexion} className="text-xs text-slate-500">
          Déconnexion
        </button>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg w-full mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
