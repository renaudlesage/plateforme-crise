import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BasculeTheme from './BasculeTheme'
import IndicateurFile from './IndicateurFile'

export default function MisEnPageTerrain() {
  const { contexteActuel, deconnexion, selectionnerContexte } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function changerDeContexte() {
    selectionnerContexte(null)
    navigate('/selection-contexte')
  }

  return (
    <div className="poste" style={{ maxWidth: 520 }}>
      <header className="tete">
        <div className="barre-haut">
          <button type="button" className="lien" onClick={changerDeContexte}>
            {contexteActuel?.contextes?.nom ?? 'Aucun contexte'}
          </button>
          <div className="pousse" />
          <BasculeTheme />
          <button type="button" className="sortie discret" onClick={deconnexion}>
            Déconnexion
          </button>
        </div>

        <div className="barre-bas plaques">
          <Link to="/" className={`plaque-nav${pathname === '/' ? ' actif' : ''}`}>
            Intervention
          </Link>
          <Link to="/situation" className={`plaque-nav${pathname.startsWith('/situation') ? ' actif' : ''}`}>
            Situation
          </Link>
          <Link to="/carte" className={`plaque-nav${pathname.startsWith('/carte') ? ' actif' : ''}`}>
            Carte
          </Link>
        </div>
      </header>

      <IndicateurFile />

      <main>
        <Outlet />
      </main>
    </div>
  )
}
