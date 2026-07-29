import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RoutePrivee({ children, exigeContexte = true }) {
  const { session, chargementSession, contexteId, chargementAcces } = useAuth()

  if (chargementSession || (session && chargementAcces)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500">Chargement…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/connexion" replace />
  }

  if (exigeContexte && !contexteId) {
    return <Navigate to="/selection-contexte" replace />
  }

  return children
}
