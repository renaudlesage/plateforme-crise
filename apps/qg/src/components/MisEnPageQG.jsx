import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BasculeTheme from './BasculeTheme'
import { useCompteursCC } from '../hooks/useCompteursCC'

const LIBELLE_NIVEAU = { attention: "Besoin d'aide", urgent: 'URGENT', mayday: 'MAYDAY' }

/** Pastille de compteur : n'apparaît que s'il y a quelque chose à voir. */
function Pastille({ n, rouge = false }) {
  if (!n) return null
  return (
    <span
      style={{ marginLeft: 8, minWidth: 20, padding: '0 6px', borderRadius: 10, fontSize: 12, lineHeight: '20px', textAlign: 'center', display: 'inline-block', background: rouge ? '#b91c1c' : 'var(--etat-info, #2563eb)', color: '#fff' }}
    >
      {n}
    </span>
  )
}

export default function MisEnPageQG() {
  const { utilisateur, contexteActuel, contexteId, deconnexion, selectionnerContexte } = useAuth()
  const compteurs = useCompteursCC(contexteId)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const actif = (to) =>
    to === '/' ? pathname === '/' || pathname.startsWith('/incidents') : pathname === to || pathname.startsWith(to + '/')

  function changerDeContexte() {
    selectionnerContexte(null)
    navigate('/selection-contexte')
  }

  return (
    <div className="poste">
      <header className="tete">
        <div className="barre-haut">
          <div className="marque compacte">
            <span className="marque-nom" title="Comité de Coordination" aria-label="Comité de Coordination">CC</span>
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
          <Link to="/" className={`plaque-nav${actif('/') ? ' actif' : ''}`}>
            Incidents<Pastille n={compteurs.incidents} />
          </Link>
          <Link to="/signalements-citoyens" className={`plaque-nav${actif('/signalements-citoyens') ? ' actif' : ''}`}>
            Signalements citoyens<Pastille n={compteurs.signalements} />
          </Link>
          <Link to="/carte" className={`plaque-nav${actif('/carte') ? ' actif' : ''}`}>
            Carte
          </Link>
        </div>
      </header>

      {/* Un appel d'aide prime sur tout : visible depuis n'importe quelle page, sauf sur la fiche de l'incident concerné (elle a son propre bandeau détaillé). */}
      {compteurs.pire && pathname !== `/incidents/${compteurs.pire.incident_id}` && (
        <Link
          to={`/incidents/${compteurs.pire.incident_id}`}
          role="alert"
          style={{ display: 'block', background: '#b91c1c', color: '#fff', padding: '10px 16px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
        >
          🆘 {compteurs.aides.length} appel{compteurs.aides.length > 1 ? 's' : ''} d'aide ouvert{compteurs.aides.length > 1 ? 's' : ''} · {LIBELLE_NIVEAU[compteurs.pire.niveau] ?? compteurs.pire.niveau}
          {compteurs.pire.role_libelle ? ` · ${compteurs.pire.role_libelle}` : ''} → voir
        </Link>
      )}

      <main>
        <Outlet />
      </main>
    </div>
  )
}
