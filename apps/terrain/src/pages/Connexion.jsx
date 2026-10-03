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
    <div className="acces">
      <div className="acces-carte">
        <div className="marque">
          <span className="marque-nom">Plateforme de gestion de crise</span>
        </div>
        <p className="acces-role">Espace Terrain</p>

        <form onSubmit={gererSoumission}>
          <div>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="mot-de-passe">Mot de passe</label>
            <input
              id="mot-de-passe"
              type="password"
              required
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </div>

          {erreur && (
            <p role="alert" className="message erreur">
              {erreur}
            </p>
          )}

          <button type="submit" disabled={enCours} className="principal bouton-terrain">
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-sourdine">
          Accès réservé — comptes créés manuellement par l'administrateur.
        </p>
      </div>
    </div>
  )
}
