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
    <div className="min-h-screen flex flex-col bg-stone-50">
      <header className="bg-nuit-900 border-b border-nuit-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-display font-semibold text-white tracking-tight">Admin</span>
            <span className="text-nuit-700">/</span>
            <button
              onClick={changerDeContexte}
              className="text-sm text-slate-300 hover:text-white underline decoration-dotted decoration-slate-500"
            >
              {contexteActuel?.contextes?.nom ?? 'Aucun contexte'}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:inline font-mono">{utilisateur?.email}</span>
            <button onClick={deconnexion} className="text-sm text-slate-300 hover:text-white transition-colors">
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-6xl w-full mx-auto flex">
        <aside className="w-56 flex-shrink-0 bg-nuit-900 py-5 pr-2 hidden sm:block">
          <nav className="space-y-5">
            {SECTIONS.map((section, i) => (
              <div key={i}>
                {section.titre && (
                  <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
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
                        className={`block px-3 py-1.5 text-sm transition-colors border-l-2 ${
                          actif
                            ? 'border-institution-600 bg-nuit-800 text-white font-medium'
                            : 'border-transparent text-slate-400 hover:bg-nuit-800 hover:text-slate-100'
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

        <main className="flex-1 px-4 sm:px-8 py-8 min-w-0 bg-stone-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
