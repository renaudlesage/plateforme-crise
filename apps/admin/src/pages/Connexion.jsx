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
    <div className="min-h-screen flex items-center justify-center px-4 bg-nuit-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">
            Plateforme de gestion de crise
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">Espace Admin</p>
        </div>

        <form onSubmit={gererSoumission} className="space-y-4 bg-stone-50 p-7 rounded-lg shadow-xl">
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-institution-600 focus:ring-1 focus:ring-institution-600"
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-institution-600 focus:ring-1 focus:ring-institution-600"
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
            className="w-full rounded-md bg-institution-600 text-white text-sm font-medium py-2.5 hover:bg-institution-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-slate-500">
          Accès réservé — comptes créés manuellement par l'administrateur.
        </p>
      </div>
    </div>
  )
}
