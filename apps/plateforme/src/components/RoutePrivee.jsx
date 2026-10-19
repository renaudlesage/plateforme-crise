import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { URL_ADMIN } from '../lib/libelles'

/**
 * Garde d'accès de la console : session requise et, sauf `superAdminRequis={false}`,
 * qualité de super-admin. La vraie barrière reste la base (chaque fonction
 * plateforme_* refuse un appelant qui n'est pas super-admin) : ceci évite
 * seulement d'afficher des écrans vides.
 */
export function RoutePrivee({ children, superAdminRequis = true }) {
  const { session, chargementSession, estSuperAdmin, superAdminVerifie, utilisateur, deconnexion } = useAuth()

  if (chargementSession || (session && superAdminRequis && !superAdminVerifie)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-sourdine">Chargement…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/connexion" replace />
  }

  if (superAdminRequis && !estSuperAdmin) {
    return (
      <div className="acces">
        <div className="acces-carte">
          <div className="marque">
            <span className="marque-nom">Console Plateforme</span>
          </div>
          <p className="acces-role">Accès réservé</p>
          <p className="text-sm text-sourdine mb-4">
            Le compte {utilisateur?.email} n'est pas super-administrateur de la plateforme. La gestion de votre
            organisation se fait dans l'application Admin.
          </p>
          {URL_ADMIN && (
            <p className="mb-3">
              <a className="lien" href={URL_ADMIN}>Ouvrir l'application Admin</a>
            </p>
          )}
          <button type="button" className="discret" onClick={deconnexion}>
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  return children
}
