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

const MISSIONS_DISPONIBLES = [
  { valeur: 'appui_administratif', libelle: 'Appui administratif' },
  { valeur: 'communication', libelle: 'Communication / information' },
  { valeur: 'evacuation', libelle: 'Aide à l’évacuation' },
  { valeur: 'logistique', libelle: 'Logistique' },
  { valeur: 'accueil', libelle: 'Accueil de sinistrés' },
  { valeur: 'prise_en_charge', libelle: 'Prise en charge de personnes vulnérables' },
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
  const [missionsPossibles, setMissionsPossibles] = useState([])
  const [disponibilite, setDisponibilite] = useState('')
  const [consentement, setConsentement] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [envoye, setEnvoye] = useState(false)
  const [erreur, setErreur] = useState(null)

  function basculerCompetence(c) {
    setCompetences((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  function basculerMission(m) {
    setMissionsPossibles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))
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
      missions_possibles: missionsPossibles,
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
    return <p className="text-sm text-sourdine text-center mt-10">Chargement…</p>
  }

  if (!contexteId) {
    return <Navigate to="/" replace />
  }

  if (envoye) {
    return (
      <div className="participant text-center">
        <p className="text-3xl mb-3">🙏</p>
        <h1 className="text-lg font-semibold text-encre mb-2">Merci !</h1>
        <p className="text-sm text-sourdine">
          Votre inscription a bien été enregistrée pour {contexteNom}. La commune vous
          recontactera si votre profil correspond à un besoin.
        </p>
        <Link to="/" className="lien" style={{ display: 'inline-block', marginTop: 24 }}>
          Retour à l'accueil
        </Link>
      </div>
    )
  }

  return (
    <div className="participant">
      <div className="bandeau">
        <Link to="/" className="lien">← retour</Link>
      </div>

      <h1 className="text-lg font-semibold text-encre mb-1">Devenir bénévole</h1>
      <p className="text-sm text-sourdine mb-5">
        Rejoignez le réseau d'entraide citoyenne de {contexteNom}. Vos coordonnées ne
        seront utilisées que par la commune, en cas de besoin réel.
      </p>

      <form onSubmit={soumettre} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Prénom</label>
              <input required value={prenom} onChange={(e) => setPrenom(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1">Nom</label>
              <input required value={nom} onChange={(e) => setNom(e.target.value)} className="w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Email</label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
          </div>

          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Téléphone</label>
            <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="w-full" />
          </div>

          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Adresse (optionnel)</label>
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full" />
          </div>

          <div>
            <label className="block text-xs font-medium text-sourdine mb-2">Compétences / moyens que vous pouvez mettre à disposition</label>
            <div className="space-y-2">
              {COMPETENCES_DISPONIBLES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-sourdine">
                  <input type="checkbox" checked={competences.includes(c)} onChange={() => basculerCompetence(c)} />
                  {c}
                </label>
              ))}
            </div>
            <input
              value={competencesAutre}
              onChange={(e) => setCompetencesAutre(e.target.value)}
              placeholder="Autre (précisez)"
              className="mt-2 w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-sourdine mb-2">Missions que vous seriez prêt·e à assurer</label>
            <div className="space-y-2">
              {MISSIONS_DISPONIBLES.map((m) => (
                <label key={m.valeur} className="flex items-center gap-2 text-sm text-sourdine">
                  <input type="checkbox" checked={missionsPossibles.includes(m.valeur)} onChange={() => basculerMission(m.valeur)} />
                  {m.libelle}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Disponibilité</label>
            <input
              value={disponibilite}
              onChange={(e) => setDisponibilite(e.target.value)}
              placeholder="ex. week-ends, soirées, sur demande…"
              className="w-full"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-sourdine">
            <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} className="mt-0.5" />
            <span>
              J'accepte que mes coordonnées soient conservées par la commune dans le seul but
              de me contacter en cas de besoin d'entraide, conformément au RGPD.
            </span>
          </label>

          {erreur && <p className="message erreur">{erreur}</p>}

          <button type="submit" disabled={enCours || !consentement} className="principal bouton-terrain">
            {enCours ? 'Envoi…' : "S'inscrire"}
          </button>
        </form>
    </div>
  )
}
