import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const SECTIONS = [
  {
    titre: null,
    liens: [{ to: '/', libelle: 'Tableau de bord' }],
  },
  {
    titre: 'Configuration',
    liens: [{ to: '/configuration', libelle: 'Rôles, niveaux, disciplines' }],
  },
  {
    titre: 'Référentiels',
    liens: [
      { to: '/annuaire', libelle: 'Annuaire' },
      { to: '/risques', libelle: 'Objets à risque' },
      { to: '/ressources', libelle: 'Ressources' },
      { to: '/sites-qg', libelle: 'Sites QG' },
      { to: '/centres-accueil', libelle: "Centres d'accueil" },
      { to: '/canaux-radio', libelle: 'Canaux radio' },
      { to: '/plans-reference', libelle: 'Plans de référence' },
    ],
  },
  {
    titre: 'Gouvernance',
    liens: [
      { to: '/instances-coordination', libelle: 'Instances' },
      { to: '/checklists', libelle: 'Checklists' },
      { to: '/exercices', libelle: 'Exercices' },
    ],
  },
  {
    titre: 'Communication',
    liens: [
      { to: '/alertes-publiques', libelle: 'Alertes publiques' },
      { to: '/canaux-diffusion', libelle: 'Canaux de diffusion' },
    ],
  },
]

export default function MisEnPage() {
  const { utilisateur, contexteActuel, deconnexion, selectionnerContexte } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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
            <button onClick={deconnexion} className="text-sm text-slate-600 hover:text-slate-900">
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto flex">
        <aside className="w-56 flex-shrink-0 border-r border-slate-200 bg-white py-5 pr-2 hidden sm:block">
          <nav className="space-y-5">
            {SECTIONS.map((section, i) => (
              <div key={i}>
                {section.titre && (
                  <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    {section.titre}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.liens.map((lien) => {
                    const actif = location.pathname === lien.to
                    return (
                      <Link
                        key={lien.to}
                        to={lien.to}
                        className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                          actif
                            ? 'bg-slate-900 text-white font-medium'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {lien.libelle}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 px-4 sm:px-6 py-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
