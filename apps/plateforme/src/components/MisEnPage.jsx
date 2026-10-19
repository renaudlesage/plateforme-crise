import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BasculeTheme from './BasculeTheme'

const LIENS = [
  { to: '/', libelle: 'Supervision' },
  { to: '/clients', libelle: 'Clients' },
  { to: '/utilisateurs', libelle: 'Utilisateurs' },
  { to: '/referentiels', libelle: 'Référentiels nationaux' },
  { to: '/journal', libelle: 'Journal' },
]

// Un lien reste actif sur ses sous-pages (/clients/:id garde « Clients »
// allumé), sauf la racine qui ne correspond qu'à elle-même.
function estActif(chemin, to) {
  return to === '/' ? chemin === '/' : chemin === to || chemin.startsWith(to + '/')
}

export default function MisEnPage() {
  const { utilisateur, deconnexion } = useAuth()
  const location = useLocation()
  const [menuOuvert, setMenuOuvert] = useState(false)

  useEffect(() => {
    setMenuOuvert(false)
  }, [location.pathname])

  const pageCourante = LIENS.find((l) => estActif(location.pathname, l.to))

  return (
    <div className="poste">
      <header className="tete">
        <div className="barre-haut">
          <div className="marque compacte">
            <span className="marque-nom">Plateforme</span>
          </div>
          <span className="jeton text-info whitespace-nowrap">super-admin</span>
          <div className="pousse" />
          <span className="compte">{utilisateur?.email}</span>
          <BasculeTheme />
          <button type="button" className="sortie discret" onClick={deconnexion}>
            Se déconnecter
          </button>
        </div>
      </header>

      <div className="corps">
        <nav className="menu" aria-label="Navigation principale">
          <button
            type="button"
            className="menu-bascule"
            aria-expanded={menuOuvert}
            onClick={() => setMenuOuvert((v) => !v)}
          >
            <span>
              Menu{pageCourante && <small> · {pageCourante.libelle}</small>}
            </span>
            <span aria-hidden="true">{menuOuvert ? '▴' : '▾'}</span>
          </button>

          <div className={`menu-corps${menuOuvert ? '' : ' ferme'}`}>
            <div className="menu-groupe-liens menu-groupe-haut">
              {LIENS.map((lien) => (
                <Link
                  key={lien.to}
                  to={lien.to}
                  className={`plaque-nav${estActif(location.pathname, lien.to) ? ' actif' : ''}`}
                >
                  {lien.libelle}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <main className="travail">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
