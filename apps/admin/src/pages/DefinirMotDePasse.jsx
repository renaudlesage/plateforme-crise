import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function DefinirMotDePasse() {
  const navigate = useNavigate()
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (motDePasse.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (motDePasse !== confirmation) {
      setErreur('Les mots de passe ne correspondent pas.')
      return
    }
    setEnCours(true)
    const { error } = await supabase.auth.updateUser({ password: motDePasse })
    setEnCours(false)
    if (error) {
      setErreur(error.message)
    } else {
      navigate('/selection-contexte', { replace: true })
    }
  }

  return (
    <div className="acces">
      <div className="acces-carte">
        <div className="marque">
          <span className="marque-nom">Plateforme de gestion de crise</span>
        </div>
        <p className="acces-role">Définir votre mot de passe</p>

        <form onSubmit={soumettre}>
          <div>
            <label htmlFor="mdp">Nouveau mot de passe</label>
            <input
              id="mdp"
              type="password"
              required
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="mdp-confirm">Confirmer le mot de passe</label>
            <input
              id="mdp-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>

          {erreur && (
            <p role="alert" className="message erreur">
              {erreur}
            </p>
          )}

          <button type="submit" disabled={enCours} className="principal">
            {enCours ? 'Enregistrement…' : 'Valider'}
          </button>
        </form>

        <p className="mt-4 text-xs text-center text-sourdine">
          Ce mot de passe sera valable sur toutes les applications de la plateforme.
        </p>
      </div>
    </div>
  )
}
