import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STORAGE_KEY_CONTEXTE = 'citoyen_contexte_id_selectionne'
const STORAGE_KEY_JETON = 'citoyen_jeton_plan_urgence'

export default function PlanUrgence() {
  const contexteId = localStorage.getItem(STORAGE_KEY_CONTEXTE) || ''
  const [jeton, setJeton] = useState(() => localStorage.getItem(STORAGE_KEY_JETON) || '')
  const [plan, setPlan] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [saisieCode, setSaisieCode] = useState(false)
  const [codeSaisi, setCodeSaisi] = useState('')

  const charger = useCallback(async (j) => {
    setChargement(true)
    setErreur(null)
    const { data, error } = await supabase.rpc('plan_urgence_menage_par_jeton', { p_jeton: j })
    if (error) {
      setErreur(error.message)
    } else if (!data || data.length === 0) {
      // code invalide : on efface la trace locale et on revient à l'accueil du plan
      localStorage.removeItem(STORAGE_KEY_JETON)
      setJeton('')
      setPlan(null)
    } else {
      setPlan(data[0])
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    if (jeton) charger(jeton)
    else setChargement(false)
  }, [jeton, charger])

  function recupererCode() {
    const j = codeSaisi.trim()
    if (!j) return
    localStorage.setItem(STORAGE_KEY_JETON, j)
    setJeton(j)
    setSaisieCode(false)
    setCodeSaisi('')
  }

  if (!contexteId) return <Navigate to="/" replace />

  return (
    <div className="participant">
      <div className="bandeau">
        <Link to="/" className="lien">← retour</Link>
      </div>

      <h1 className="text-lg font-semibold text-encre mb-1">Mon plan d'urgence personnel</h1>
      <p className="text-sm text-sourdine mb-5">
        Le gabarit officiel du Centre de Crise National ("Prêts. Ensemble.") sous forme
        numérique : vos coordonnées utiles en cas de crise, enregistrées uniquement sur
        votre appareil via un code d'accès personnel — aucun compte à créer.
      </p>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : erreur ? (
        <p className="message erreur">{erreur}</p>
      ) : jeton && plan ? (
        <FormulairePlan
          plan={plan}
          jeton={jeton}
          onEnregistre={(p) => setPlan(p)}
          onReinitialiser={() => {
            localStorage.removeItem(STORAGE_KEY_JETON)
            setJeton('')
            setPlan(null)
          }}
        />
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            className="principal bouton-terrain"
            onClick={() => setPlan('nouveau')}
          >
            Créer mon plan d'urgence
          </button>

          {plan === 'nouveau' ? (
            <FormulaireCreation
              contexteId={contexteId}
              onCree={(j, p) => {
                localStorage.setItem(STORAGE_KEY_JETON, j)
                setJeton(j)
                setPlan(p)
              }}
            />
          ) : saisieCode ? (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-sourdine mb-1">
                Mon code d'accès (reçu à la création, sur un autre appareil)
              </label>
              <input
                value={codeSaisi}
                onChange={(e) => setCodeSaisi(e.target.value)}
                className="w-full"
                placeholder="code à 32 caractères"
              />
              <div className="flex gap-2">
                <button type="button" className="principal bouton-terrain" onClick={recupererCode}>
                  Récupérer mon plan
                </button>
                <button type="button" className="lien" onClick={() => setSaisieCode(false)}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="lien" onClick={() => setSaisieCode(true)}>
              J'ai déjà créé un plan sur un autre appareil
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FormulaireCreation({ contexteId, onCree }) {
  const [adresse, setAdresse] = useState('')
  const [consentement, setConsentement] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    if (!consentement) {
      setErreur('Le consentement est requis pour créer votre plan.')
      return
    }
    setEnCours(true)
    setErreur(null)
    const { data, error } = await supabase
      .from('plans_urgence_menages')
      .insert({ contexte_id: contexteId, adresse: adresse.trim(), consentement_rgpd: true })
      .select()
      .single()
    setEnCours(false)
    if (error) setErreur(error.message)
    else onCree(data.jeton_acces, data)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 bg-fond space-y-3">
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Adresse du domicile</label>
        <input required value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full" />
      </div>
      <label className="flex items-start gap-2 text-xs text-sourdine">
        <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} className="mt-0.5" />
        <span>
          J'accepte que ces informations soient conservées, accessibles uniquement via mon
          code d'accès personnel, conformément au RGPD.
        </span>
      </label>
      {erreur && <p className="message erreur">{erreur}</p>}
      <button type="submit" disabled={enCours} className="principal bouton-terrain">
        {enCours ? 'Création…' : 'Continuer'}
      </button>
    </form>
  )
}

function FormulairePlan({ plan, jeton, onEnregistre, onReinitialiser }) {
  const [adresse, setAdresse] = useState(plan.adresse ?? '')
  const [nbOccupants, setNbOccupants] = useState(plan.nb_occupants ?? '')
  const [contactsUrgence, setContactsUrgence] = useState(plan.contacts_urgence ?? [])
  const [personnesAide, setPersonnesAide] = useState(plan.personnes_aide_particuliere ?? '')
  const [animaux, setAnimaux] = useState(plan.animaux_compagnie ?? [])
  const [itineraire, setItineraire] = useState(plan.itineraire_evacuation ?? '')
  const [pointRdv, setPointRdv] = useState(plan.point_rdv_exterieur ?? '')
  const [medecin, setMedecin] = useState(plan.medecin_famille ?? '')
  const [coupures, setCoupures] = useState(plan.emplacements_coupures ?? '')
  const [enCours, setEnCours] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [codeVisible, setCodeVisible] = useState(false)

  function ajouterContact() {
    setContactsUrgence((prev) => [...prev, { nom: '', telephone: '', lien: '' }])
  }
  function majContact(i, champ, valeur) {
    setContactsUrgence((prev) => prev.map((c, idx) => (idx === i ? { ...c, [champ]: valeur } : c)))
  }
  function retirerContact(i) {
    setContactsUrgence((prev) => prev.filter((_, idx) => idx !== i))
  }

  function ajouterAnimal() {
    setAnimaux((prev) => [...prev, { espece: '', nom: '', veterinaire: '', puce_id: '' }])
  }
  function majAnimal(i, champ, valeur) {
    setAnimaux((prev) => prev.map((a, idx) => (idx === i ? { ...a, [champ]: valeur } : a)))
  }
  function retirerAnimal(i) {
    setAnimaux((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    setEnregistre(false)
    const { data, error } = await supabase.rpc('maj_plan_urgence_menage', {
      p_jeton: jeton,
      p_adresse: adresse.trim(),
      p_nb_occupants: nbOccupants === '' ? null : Number(nbOccupants),
      p_contacts_urgence: contactsUrgence,
      p_personnes_aide_particuliere: personnesAide.trim() || null,
      p_animaux_compagnie: animaux,
      p_itineraire_evacuation: itineraire.trim() || null,
      p_point_rdv_exterieur: pointRdv.trim() || null,
      p_medecin_famille: medecin.trim() || null,
      p_emplacements_coupures: coupures.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
    else if (!data) setErreur('Code d\'accès invalide.')
    else {
      setEnregistre(true)
      onEnregistre({
        ...plan,
        adresse,
        nb_occupants: nbOccupants === '' ? null : Number(nbOccupants),
        contacts_urgence: contactsUrgence,
        personnes_aide_particuliere: personnesAide,
        animaux_compagnie: animaux,
        itineraire_evacuation: itineraire,
        point_rdv_exterieur: pointRdv,
        medecin_famille: medecin,
        emplacements_coupures: coupures,
      })
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <div className="border border-trait rounded p-3 bg-fond text-xs text-sourdine">
        <p className="mb-1">
          Votre code d'accès personnel (notez-le pour le retrouver sur un autre appareil) :
        </p>
        <div className="flex items-center gap-2">
          <code className="jeton">{codeVisible ? jeton : '•'.repeat(32)}</code>
          <button type="button" className="lien" onClick={() => setCodeVisible((v) => !v)}>
            {codeVisible ? 'cacher' : 'afficher'}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Adresse du domicile</label>
        <input required value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Nombre d'occupants</label>
        <input type="number" min="0" value={nbOccupants} onChange={(e) => setNbOccupants(e.target.value)} className="w-full sm:w-32" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-2">Contacts d'urgence à prévenir</label>
        <div className="space-y-2">
          {contactsUrgence.map((c, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-start">
              <input placeholder="Nom" value={c.nom} onChange={(e) => majContact(i, 'nom', e.target.value)} />
              <input placeholder="Téléphone" value={c.telephone} onChange={(e) => majContact(i, 'telephone', e.target.value)} />
              <input placeholder="Lien (ex. voisin, fils…)" value={c.lien} onChange={(e) => majContact(i, 'lien', e.target.value)} />
              <button type="button" className="lien" onClick={() => retirerContact(i)}>Retirer</button>
            </div>
          ))}
        </div>
        <button type="button" className="lien mt-2" onClick={ajouterContact}>+ Ajouter un contact</button>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">
          Personnes nécessitant une aide particulière
        </label>
        <textarea value={personnesAide} onChange={(e) => setPersonnesAide(e.target.value)} rows={2} className="w-full" placeholder="ex. personne à mobilité réduite, enfant en bas âge…" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-2">Animaux de compagnie</label>
        <div className="space-y-2">
          {animaux.map((a, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-start">
              <input placeholder="Espèce" value={a.espece} onChange={(e) => majAnimal(i, 'espece', e.target.value)} />
              <input placeholder="Nom" value={a.nom} onChange={(e) => majAnimal(i, 'nom', e.target.value)} />
              <input placeholder="Vétérinaire" value={a.veterinaire} onChange={(e) => majAnimal(i, 'veterinaire', e.target.value)} />
              <button type="button" className="lien" onClick={() => retirerAnimal(i)}>Retirer</button>
            </div>
          ))}
        </div>
        <button type="button" className="lien mt-2" onClick={ajouterAnimal}>+ Ajouter un animal</button>
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Itinéraire d'évacuation prévu</label>
        <textarea value={itineraire} onChange={(e) => setItineraire(e.target.value)} rows={2} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Point de rendez-vous extérieur</label>
        <input value={pointRdv} onChange={(e) => setPointRdv(e.target.value)} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Médecin de famille</label>
        <input value={medecin} onChange={(e) => setMedecin(e.target.value)} className="w-full" />
      </div>

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">
          Emplacement des coupures (gaz, eau, électricité)
        </label>
        <textarea value={coupures} onChange={(e) => setCoupures(e.target.value)} rows={2} className="w-full" />
      </div>

      {erreur && <p className="message erreur">{erreur}</p>}
      {enregistre && <p className="text-sm text-info">Plan enregistré.</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={enCours} className="principal bouton-terrain">
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" className="lien" onClick={onReinitialiser}>
          Oublier ce plan sur cet appareil
        </button>
      </div>
    </form>
  )
}
