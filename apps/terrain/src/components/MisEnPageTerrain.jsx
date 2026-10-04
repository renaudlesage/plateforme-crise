import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BasculeTheme from './BasculeTheme'
import IndicateurFile from './IndicateurFile'

export default function MisEnPageTerrain() {
  const { contexteActuel, deconnexion, selectionnerContexte } = useAuth()
  const navigate = useNavigate()

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
      </header>

      <IndicateurFile />

      <main>
        <Outlet />
      </main>
    </div>
  )
}
