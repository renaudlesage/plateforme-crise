import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STORAGE_KEY_CONTEXTE = 'citoyen_contexte_id_selectionne'

const COMPETENCES_DISPONIBLES = [
  'Premiers secours',
  'Logistique / transport',
  'Hébergement / accueil',
  'Communication',
  'Informatique / réseaux',
  'Bricolage / travaux',
  'Cuisine / restauration',
]

export default function Benevole() {
  const contexteId = localStorage.getItem(STORAGE_KEY_CONTEXTE) || ''
  const [contexteNom, setContexteNom] = useState('')
  const [chargementContexte, setChargementContexte] = useState(true)

  useEffect(() => {
    if (!contexteId) {
      setChargementContexte(false)
      return
    }
    supabase.rpc('contextes_publics').then(({ data }) => {
      const trouve = (data ?? []).find((c) => c.id === contexteId)
      setContexteNom(trouve?.nom ?? '')
      setChargementContexte(false)
    })
  }, [contexteId])

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresse, setAdresse] = useState('')
  const [competences, setCompetences] = useState([])
  const [competencesAutre, setCompetencesAutre] = useState('')
  const [disponibilite, setDisponibilite] = useState('')
  const [consentement, setConsentement] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [envoye, setEnvoye] = useState(false)
  const [erreur, setErreur] = useState(null)

  function basculerCompetence(c) {
    setCompetences((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function soumettre(e) {
    e.preventDefault()
    if (!consentement) {
      setErreur('Le consentement est requis pour finaliser l\'inscription.')
      return
    }
    setEnCours(true)
    setErreur(null)

    const { error } = await supabase.from('benevoles_entraide').insert({
      contexte_id: contexteId,
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: email.trim(),
      telephone: telephone.trim() || null,
      adresse: adresse.trim() || null,
      competences,
      competences_autre: competencesAutre.trim() || null,
      disponibilite: disponibilite.trim() || null,
      consentement_rgpd: true,
    })

    setEnCours(false)
    if (error) {
      setErreur(error.message)
    } else {
      setEnvoye(true)
    }
  }

  if (chargementContexte) {
    return <p className="text-sm text-slate-400 text-center mt-10">Chargement…</p>
  }

  if (!contexteId) {
    return <Navigate to="/" replace />
  }

  if (envoye) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-3xl mb-3">🙏</p>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Merci !</h1>
          <p className="text-sm text-slate-600">
            Votre inscription a bien été enregistrée pour {contexteNom}. La commune vous
            recontactera si votre profil correspond à un besoin.
          </p>
          <Link to="/" className="inline-block mt-6 text-sm text-slate-500 underline">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <Link to="/" className="text-sm text-slate-500">← retour</Link>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-lg font-semibold text-slate-900 mb-1">Devenir bénévole</h1>
        <p className="text-sm text-slate-500 mb-5">
          Rejoignez le réseau d'entraide citoyenne de {contexteNom}. Vos coordonnées ne
          seront utilisées que par la commune, en cas de besoin réel.
        </p>

        <form onSubmit={soumettre} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prénom</label>
              <input required value={prenom} onChange={(e) => setPrenom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
              <input required value={nom} onChange={(e) => setNom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Adresse (optionnel)</label>
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Compétences / moyens que vous pouvez mettre à disposition</label>
            <div className="space-y-2">
              {COMPETENCES_DISPONIBLES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={competences.includes(c)} onChange={() => basculerCompetence(c)} />
                  {c}
                </label>
              ))}
            </div>
            <input
              value={competencesAutre}
              onChange={(e) => setCompetencesAutre(e.target.value)}
              placeholder="Autre (précisez)"
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Disponibilité</label>
            <input
              value={disponibilite}
              onChange={(e) => setDisponibilite(e.target.value)}
              placeholder="ex. week-ends, soirées, sur demande…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} className="mt-0.5" />
            <span>
              J'accepte que mes coordonnées soient conservées par la commune dans le seul but
              de me contacter en cas de besoin d'entraide, conformément au RGPD.
            </span>
          </label>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours || !consentement}
            className="w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2.5 disabled:opacity-50"
          >
            {enCours ? 'Envoi…' : "S'inscrire"}
          </button>
        </form>
      </main>
    </div>
  )
}
