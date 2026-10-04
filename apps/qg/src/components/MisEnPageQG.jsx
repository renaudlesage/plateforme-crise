import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BasculeTheme from './BasculeTheme'

export default function MisEnPageQG() {
  const { utilisateur, contexteActuel, deconnexion, selectionnerContexte } = useAuth()
  const navigate = useNavigate()

  function changerDeContexte() {
    selectionnerContexte(null)
    navigate('/selection-contexte')
  }

  return (
    <div className="poste">
      <header className="tete">
        <div className="barre-haut">
          <div className="marque compacte">
            <span className="marque-nom">QG</span>
            <span className="marque-suite">
              {contexteActuel?.contextes?.nom ?? 'Aucun contexte'}
            </span>
          </div>
          <button type="button" className="lien" onClick={changerDeContexte}>
            Changer de contexte
          </button>
          <div className="pousse" />
          <span className="compte">{utilisateur?.email}</span>
          <BasculeTheme />
          <button type="button" className="sortie discret" onClick={deconnexion}>
            Se déconnecter
          </button>
        </div>

        <div className="barre-bas plaques">
          <Link to="/" className="plaque-nav actif">
            Incidents
          </Link>
          <Link to="/signalements-citoyens" className="plaque-nav">
            Signalements citoyens
          </Link>
          <Link to="/carte" className="plaque-nav">
            Carte
          </Link>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  )
}
