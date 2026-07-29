import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Connexion() {
  const { connexion, session, chargementSession } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  // Si une session existe déjà (retour sur /connexion alors que connecté,
  // ou juste après un login réussi), on quitte cette page.
  useEffect(() => {
    if (!chargementSession && session) {
      navigate('/', { replace: true })
    }
  }, [session, chargementSession, navigate])

  async function gererSoumission(e) {
    e.preventDefault()
    setErreur(null)
    setEnCours(true)
    const { error } = await connexion(email, motDePasse)
    setEnCours(false)
    if (error) {
      setErreur(
        error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect.'
          : error.message
      )
    }
    // Pas besoin de naviguer ici : le useEffect ci-dessus le fait dès que
    // la session devient disponible.
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Plateforme de gestion de crise
          </h1>
          <p className="mt-1 text-sm text-slate-500">Espace Admin</p>
        </div>

        <form onSubmit={gererSoumission} className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="mot-de-passe" className="block text-sm font-medium text-slate-700 mb-1">
              Mot de passe
            </label>
            <input
              id="mot-de-passe"
              type="password"
              required
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {erreur && (
            <p role="alert" className="text-sm text-red-600">
              {erreur}
            </p>
          )}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2 hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-slate-400">
          Accès réservé — comptes créés manuellement par l'administrateur.
        </p>
      </div>
    </div>
  )
}
