import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CATEGORIES_MOYEN_DECLARABLE,
  COMPETENCES_ENTRAIDE,
  MENTION_CONSIGNES_BENEVOLE,
  MENTION_MOYEN_PRIVE,
  MENTION_RGPD_BENEVOLE_DEFAUT,
  libelleBesoin,
  libelleCompetence,
  libelleStatutPresence,
  messageErreurEntraide,
  nouvelleCle,
  surRetourReseau,
} from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'

const STORAGE_KEY_CONTEXTE = 'citoyen_contexte_id_selectionne'
const CLEF_INSCRIPTION = 'crisiware.entraide.inscription' // en attente d'envoi (pas de réseau)
const CLEF_PRESENCE = 'crisiware.entraide.presence' // { jeton, numero, incident }
const CLEF_MOYEN = 'crisiware.entraide.moyen'

const lire = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null')
  } catch {
    return null
  }
}
const ecrire = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* stockage indisponible : on continue en mémoire */
  }
}
const estReseau = (e) => !navigator.onLine || /fetch|network|réseau|Failed to/i.test(e?.message ?? '')
const heure = (t) => (t ? new Date(t).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) : '')

/* ------------------------------------------------------------------ Accueil par QR */
/**
 * Enregistrement d'un bénévole spontané, sans compte, depuis le QR du point d'accueil.
 * Écrit d'abord dans le téléphone, envoie ensuite ; un renvoi ne crée jamais de doublon (clé client).
 * Le bénévole repart avec un numéro et un lien de suivi ; l'agent valide après le briefing.
 */
export function AccueilBenevole() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const jeton = params.get('j')
  const [pab, setPab] = useState(undefined)
  const [v, setV] = useState({ prenom: '', nom: '', telephone: '', contact_urgence_nom: '', contact_urgence_telephone: '', materiel_apporte: '', email_preinscrit: '', competences: [] })
  const [majeur, setMajeur] = useState(false)
  const [consignes, setConsignes] = useState(false)
  const [rgpd, setRgpd] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const [attente, setAttente] = useState(() => lire(CLEF_INSCRIPTION))
  const presence = lire(CLEF_PRESENCE)

  useEffect(() => {
    if (!jeton) return setPab(null)
    supabase.rpc('point_accueil_par_jeton', { p_jeton: jeton }).then(({ data, error }) => setPab(error ? null : (data?.[0] ?? null)))
  }, [jeton])

  const envoyer = useCallback(
    async (inscription) => {
      const { data, error } = await supabase.rpc('enregistrer_benevole_spontane', inscription)
      if (error) {
        if (estReseau(error)) return { attente: true }
        return { error }
      }
      const r = data?.[0]
      if (!r) return { error: { message: 'Réponse vide' } }
      ecrire(CLEF_PRESENCE, { jeton: r.jeton, numero: r.numero, pab: pab?.nom ?? null, incident: pab?.incident_nom ?? null })
      ecrire(CLEF_INSCRIPTION, null)
      setAttente(null)
      return { ok: r }
    },
    [pab]
  )

  // Un enregistrement resté en attente repart dès que le réseau revient
  useEffect(() => {
    if (!attente) return undefined
    return surRetourReseau(async () => {
      const r = await envoyer(attente)
      if (r.ok) navigate(`/entraide/suivi?j=${r.ok.jeton}`, { replace: true })
      else if (r.error) {
        setErreur(messageErreurEntraide(r.error))
        ecrire(CLEF_INSCRIPTION, null)
        setAttente(null)
      }
    }, 30000)
  }, [attente, envoyer, navigate])

  if (presence?.jeton && !attente) {
    return (
      <div className="participant">
        <p className="message ok">Vous êtes déjà enregistré ({presence.numero}).</p>
        <Link to={`/entraide/suivi?j=${presence.jeton}`} className="bouton-terrain principal" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Voir mon statut</Link>
        <button type="button" className="lien mt-4" onClick={() => { ecrire(CLEF_PRESENCE, null); window.location.reload() }}>Ce n'est pas moi : nouvel enregistrement</button>
      </div>
    )
  }
  if (!jeton || pab === null) {
    return (
      <div className="participant text-center">
        <h1 className="text-lg font-semibold text-encre mb-2">Point d'accueil inconnu</h1>
        <p className="text-sm text-sourdine">Ce QR code n'est pas reconnu. Adressez-vous à l'agent du point d'accueil.</p>
        <Link to="/" className="lien" style={{ display: 'inline-block', marginTop: 24 }}>Retour à l'accueil</Link>
      </div>
    )
  }
  if (pab === undefined) return <p className="vide text-center mt-10">Chargement…</p>
  if (!pab.ouvert && !attente) {
    return (
      <div className="participant text-center">
        <h1 className="text-lg font-semibold text-encre mb-2">{pab.nom}</h1>
        <p className="message erreur">Ce point d'accueil est fermé pour le moment. Adressez-vous à l'agent sur place.</p>
      </div>
    )
  }

  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }))
  const bascule = (c) => setV((x) => ({ ...x, competences: x.competences.includes(c) ? x.competences.filter((y) => y !== c) : [...x.competences, c] }))

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!majeur) return setErreur(`Vous devez avoir au moins ${pab.age_minimum ?? 18} ans pour vous engager.`)
    if (!consignes) return setErreur('Les consignes de sécurité doivent être acceptées.')
    if (!rgpd) return setErreur('Le consentement au traitement de vos données est requis.')
    setEnCours(true)
    const inscription = {
      p_jeton_pab: jeton,
      p_cle_client: nouvelleCle(),
      p_nom: v.nom.trim(),
      p_prenom: v.prenom.trim(),
      p_telephone: v.telephone.trim() || null,
      p_majeur: true,
      p_consignes_acceptees: true,
      p_contact_urgence_nom: v.contact_urgence_nom.trim() || null,
      p_contact_urgence_telephone: v.contact_urgence_telephone.trim() || null,
      p_competences: v.competences,
      p_materiel_apporte: v.materiel_apporte.trim() || null,
      p_email_preinscrit: v.email_preinscrit.trim() || null,
    }
    const r = await envoyer(inscription)
    setEnCours(false)
    if (r.ok) return navigate(`/entraide/suivi?j=${r.ok.jeton}`, { replace: true })
    if (r.attente) {
      ecrire(CLEF_INSCRIPTION, inscription)
      setAttente(inscription)
      return
    }
    setErreur(messageErreurEntraide(r.error))
  }

  if (attente) {
    return (
      <div className="participant text-center" data-attente>
        <h1 className="text-lg font-semibold text-encre mb-2">Enregistrement en attente</h1>
        <p className="message">Pas de réseau pour le moment. Votre enregistrement est gardé sur ce téléphone et partira dès que vous capterez. Présentez-vous quand même à l'agent : {attente.p_prenom} {attente.p_nom}.</p>
        {erreur && <p className="message erreur">{erreur}</p>}
      </div>
    )
  }

  return (
    <div className="participant">
      <h1 className="text-lg font-semibold text-encre mb-1">Je viens aider</h1>
      <p className="text-sm text-sourdine mb-1">{pab.commune} · {pab.incident_nom}</p>
      <p className="text-sm text-sourdine mb-4">Point d'accueil : <b>{pab.nom}</b>{pab.adresse && <> · {pab.adresse}</>}</p>
      {(pab.briefing_texte || pab.consignes_briefing) && (
        <div className="bandeau-alerte niv-vigilance mb-4">
          <div className="niv">Consignes</div>
          <div className="contenu"><p className="consigne">{pab.consignes_briefing || pab.briefing_texte}</p>{pab.briefing_texte && pab.consignes_briefing && <p className="msg">{pab.briefing_texte}</p>}</div>
        </div>
      )}
      <form onSubmit={soumettre} className="space-y-4" aria-label="Enregistrement bénévole">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-sourdine mb-1">Prénom</label><input required value={v.prenom} onChange={set('prenom')} className="w-full" maxLength={80} autoComplete="given-name" /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Nom</label><input required value={v.nom} onChange={set('nom')} className="w-full" maxLength={80} autoComplete="family-name" /></div>
        </div>
        <div><label className="block text-xs font-medium text-sourdine mb-1">Téléphone</label><input type="tel" value={v.telephone} onChange={set('telephone')} className="w-full" maxLength={30} autoComplete="tel" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-sourdine mb-1">Personne à prévenir</label><input value={v.contact_urgence_nom} onChange={set('contact_urgence_nom')} className="w-full" maxLength={120} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Son téléphone</label><input type="tel" value={v.contact_urgence_telephone} onChange={set('contact_urgence_telephone')} className="w-full" maxLength={30} /></div>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-2">Ce que je sais faire / ce que j'apporte</label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {COMPETENCES_ENTRAIDE.map((c) => (
              <label key={c.valeur} className="flex items-start gap-2 text-sm text-sourdine"><input type="checkbox" checked={v.competences.includes(c.valeur)} onChange={() => bascule(c.valeur)} className="mt-0.5" /><span>{c.libelle}</span></label>
            ))}
          </div>
          <input value={v.materiel_apporte} onChange={set('materiel_apporte')} placeholder="Matériel apporté (tracteur, pompe, bottes…)" className="mt-2 w-full" maxLength={300} />
        </div>
        <div><label className="block text-xs font-medium text-sourdine mb-1">E-mail de pré-inscription (si vous êtes déjà inscrit comme bénévole de la commune)</label><input type="email" value={v.email_preinscrit} onChange={set('email_preinscrit')} className="w-full" /></div>
        {pab.taches_interdites?.length > 0 && (
          <p className="text-xs text-sourdine">Tâches interdites aux bénévoles : {pab.taches_interdites.map((t) => t.replace(/_/g, ' ')).join(', ')}.</p>
        )}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={majeur} onChange={(e) => setMajeur(e.target.checked)} className="mt-0.5" /><span>J'ai au moins {pab.age_minimum ?? 18} ans.</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consignes} onChange={(e) => setConsignes(e.target.checked)} className="mt-0.5" /><span>{MENTION_CONSIGNES_BENEVOLE}</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={rgpd} onChange={(e) => setRgpd(e.target.checked)} className="mt-0.5" /><span>{pab.mention_rgpd || MENTION_RGPD_BENEVOLE_DEFAUT}</span></label>
        {erreur && <p className="message erreur" role="alert">{erreur}</p>}
        <button type="submit" className="bouton-terrain principal" disabled={enCours}>{enCours ? 'Envoi…' : 'M’enregistrer'}</button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ Suivi par le bénévole */
export function SuiviBenevole() {
  const [params] = useSearchParams()
  const jeton = params.get('j') ?? lire(CLEF_PRESENCE)?.jeton ?? null
  const [p, setP] = useState(undefined)
  const [erreur, setErreur] = useState(null)
  const charger = useCallback(async () => {
    if (!jeton) return setP(null)
    const { data, error } = await supabase.rpc('suivre_presence_benevole', { p_jeton: jeton })
    if (error) return setErreur(estReseau(error) ? 'Pas de réseau : dernières informations connues.' : messageErreurEntraide(error))
    setErreur(null)
    setP(data?.[0] ?? null)
  }, [jeton])
  useEffect(() => {
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  if (p === undefined) return <p className="vide text-center mt-10">Chargement…</p>
  if (!p) {
    return (
      <div className="participant text-center">
        <p className="text-sm text-sourdine">Aucun enregistrement trouvé pour ce lien.</p>
        <Link to="/" className="lien" style={{ display: 'inline-block', marginTop: 24 }}>Retour à l'accueil</Link>
      </div>
    )
  }
  const sorti = ['sorti', 'refuse'].includes(p.statut)
  return (
    <div className="participant" data-suivi>
      <h1 className="text-lg font-semibold text-encre mb-1">Mon engagement</h1>
      <p className="text-sm text-sourdine mb-4">Point d'accueil : {p.pab_nom}</p>
      <div className="bandeau-alerte niv-vigilance mb-4">
        <div className="niv">{libelleStatutPresence(p.statut)}</div>
        <div className="contenu">
          <p className="text-2xl font-semibold" style={{ fontFamily: 'var(--mono)' }}>{p.numero}</p>
          <p className="msg">
            {p.statut === 'enregistre' && 'Montrez ce numéro à l’agent du point d’accueil : il vous validera après le briefing.'}
            {p.statut === 'valide' && 'Vous êtes validé. Attendez qu’une équipe se forme ; restez près du point d’accueil.'}
            {p.statut === 'affecte' && `Vous faites partie de ${p.equipe_nom ?? 'une équipe'}. Suivez votre chef d’équipe.`}
            {p.statut === 'en_repos' && 'Vous êtes en pause. Signalez votre retour à l’agent.'}
            {p.statut === 'sorti' && `Merci pour votre aide. Sortie enregistrée à ${heure(p.sorti_le)}.`}
            {p.statut === 'refuse' && 'Votre participation n’a pas été retenue. Merci d’être venu.'}
          </p>
          <p className="meta">arrivé à {heure(p.arrive_le)}{p.valide_le && <> · validé à {heure(p.valide_le)}</>}</p>
        </div>
      </div>
      {p.mission_numero && (
        <div className="bandeau-alerte niv-urgence mb-4">
          <div className="niv">Mission</div>
          <div className="contenu">
            <p className="text-base font-medium">{p.mission_numero} · {p.mission_titre}</p>
            {p.mission_point_rdv && <p className="consigne">Rendez-vous : {p.mission_point_rdv}</p>}
            {p.mission_adresse && <p className="msg">{p.mission_adresse}</p>}
          </div>
        </div>
      )}
      {erreur && <p className="message erreur">{erreur}</p>}
      {!sorti && (
        p.sortie_demandee_le ? (
          <p className="message">Sortie demandée à {heure(p.sortie_demandee_le)} : l'agent la confirme au point d'accueil.</p>
        ) : (
          <button
            type="button"
            className="bouton-terrain"
            onClick={async () => {
              const { error } = await supabase.rpc('demander_sortie_benevole', { p_jeton: jeton })
              if (error) return setErreur(messageErreurEntraide(error))
              charger()
            }}
          >
            Je souhaite quitter le dispositif
          </button>
        )
      )}
      <p className="text-xs text-sourdine mt-4">Gardez ce lien : il montre votre statut et votre mission. Ne le partagez pas.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ Page publique de l'entraide */
export function EntraidePublique() {
  const contexteId = localStorage.getItem(STORAGE_KEY_CONTEXTE) || ''
  const [etat, setEtat] = useState(undefined)
  const charger = useCallback(async () => {
    if (!contexteId) return setEtat(null)
    const { data, error } = await supabase.rpc('etat_public_entraide', { p_contexte: contexteId })
    setEtat(error ? null : data)
  }, [contexteId])
  useEffect(() => {
    charger()
    const t = setInterval(charger, 60000)
    return () => clearInterval(t)
  }, [charger])

  if (etat === undefined) return <p className="vide text-center mt-10">Chargement…</p>
  if (!contexteId) {
    return (
      <div className="participant text-center">
        <p className="text-sm text-sourdine">Choisissez d'abord votre commune sur l'accueil.</p>
        <Link to="/" className="lien" style={{ display: 'inline-block', marginTop: 24 }}>Retour à l'accueil</Link>
      </div>
    )
  }
  if (!etat?.actif) {
    return (
      <div className="participant text-center" data-entraide-inactive>
        <h1 className="text-lg font-semibold text-encre mb-2">Aider ma commune</h1>
        <p className="text-sm text-sourdine mb-4">Aucun dispositif d'entraide n'est ouvert pour le moment. Vous pouvez vous pré-inscrire comme bénévole ou proposer un moyen (tracteur, pompe, salle…) pour les prochaines crises.</p>
        <Link to="/benevole" className="tuile-citoyen"><span className="titre">Devenir bénévole</span><span className="aide">Se pré-inscrire</span></Link>
        <Link to="/ressource" className="tuile-citoyen mt-3"><span className="titre">Proposer un moyen</span><span className="aide">Véhicule, engin, matériel, local</span></Link>
      </div>
    )
  }
  const c = etat.consignes
  return (
    <div className="participant" data-entraide-publique>
      <h1 className="text-lg font-semibold text-encre mb-1">Aider ma commune</h1>
      <p className="text-sm text-sourdine mb-4">{(etat.incidents ?? []).map((i) => i.nom).join(', ')} · mis à jour {heure(etat.maj_le)}</p>
      {c?.message && (
        <div className="bandeau-alerte niv-info mb-4"><div className="niv">Consignes</div><div className="contenu"><p className="consigne">{c.message}</p></div></div>
      )}
      {c?.ne_pas_venir && (
        <div className="bandeau-alerte niv-urgence mb-4"><div className="niv">Ne venez pas à</div><div className="contenu"><p className="consigne">{c.ne_pas_venir}</p></div></div>
      )}
      <h2 className="text-base font-semibold text-encre mb-2">Points d'accueil des bénévoles</h2>
      {etat.points_accueil.length === 0 ? <p className="vide mb-4">Aucun point d'accueil ouvert pour l'instant.</p> : (
        <ul className="space-y-2 mb-4">
          {etat.points_accueil.map((p, i) => (
            <li key={i} className="border border-trait rounded p-3 bg-surface"><b>{p.nom}</b>{p.adresse && <> · {p.adresse}</>}{p.consignes && <p className="text-xs text-sourdine mt-1">{p.consignes}</p>}<p className="text-xs text-sourdine mt-1">Présentez-vous sur place : un QR vous permet de vous enregistrer.</p></li>
          ))}
        </ul>
      )}
      {etat.missions_publiques.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-encre mb-2">On cherche des bras pour</h2>
          <ul className="space-y-2 mb-4">
            {etat.missions_publiques.map((m, i) => (
              <li key={i} className="border border-trait rounded p-3 bg-surface"><b>{m.titre}</b>{m.nb_personnes && <> · {m.nb_personnes} personnes</>}{m.adresse && <> · {m.adresse}</>}{m.competences?.length > 0 && <p className="text-xs text-sourdine mt-1">{m.competences.map(libelleCompetence).join(', ')}</p>}</li>
            ))}
          </ul>
        </>
      )}
      <h2 className="text-base font-semibold text-encre mb-2">Dons en nature</h2>
      {etat.besoins.length === 0 ? <p className="vide mb-4">Aucun besoin publié. N'apportez rien sans demande : trier et stocker coûte du temps aux équipes.</p> : (
        <ul className="space-y-2 mb-4">
          {etat.besoins.map((b, i) => (
            <li key={i} className={`border border-trait rounded p-3 bg-surface${b.statut === 'couvert' ? ' opacity-70' : ''}`}>
              <b>{b.libelle}</b> <span className="jeton">{libelleBesoin(b.categorie)}</span>{b.quantite && <> · {b.quantite}</>}
              <p className="text-xs mt-1">{b.statut === 'couvert' ? '✅ Couvert, merci : n’en apportez plus.' : `À déposer : ${b.point_collecte ?? 'voir points de collecte'}`}</p>
            </li>
          ))}
        </ul>
      )}
      {etat.points_collecte.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-encre mb-2">Points de collecte</h2>
          <ul className="space-y-2 mb-4">
            {etat.points_collecte.map((p, i) => (
              <li key={i} className="border border-trait rounded p-3 bg-surface"><b>{p.nom}</b>{p.adresse && <> · {p.adresse}</>}{p.horaires && <> · {p.horaires}</>}{p.consignes && <p className="text-xs text-sourdine mt-1">{p.consignes}</p>}</li>
            ))}
          </ul>
        </>
      )}
      <Link to="/ressource" className="tuile-citoyen"><span className="titre">Proposer un moyen</span><span className="aide">Tracteur, pompe, bateau, local, camion…</span></Link>
    </div>
  )
}

/* ------------------------------------------------------------------ Déclaration d'un moyen privé */
export function ProposerMoyen() {
  const contexteId = localStorage.getItem(STORAGE_KEY_CONTEXTE) || ''
  const [v, setV] = useState({ categorie: 'genie_civil', nom: '', proprietaire_type: 'particulier', proprietaire_nom: '', proprietaire_telephone: '', capacite: '', delai: '', conditions: '' })
  const [position, setPosition] = useState(null)
  const [rgpd, setRgpd] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const [fait, setFait] = useState(() => lire(CLEF_MOYEN))
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }))

  if (!contexteId) {
    return (
      <div className="participant text-center">
        <p className="text-sm text-sourdine">Choisissez d'abord votre commune sur l'accueil.</p>
        <Link to="/" className="lien" style={{ display: 'inline-block', marginTop: 24 }}>Retour à l'accueil</Link>
      </div>
    )
  }
  if (fait) {
    return (
      <div className="participant text-center" data-moyen-fait>
        <p className="text-3xl mb-3">🙏</p>
        <h1 className="text-lg font-semibold text-encre mb-2">Merci !</h1>
        <p className="text-sm text-sourdine">Votre moyen « {fait.nom} » est enregistré auprès de la commune, qui le vérifiera et vous contactera avant toute mise à disposition.</p>
        <button type="button" className="lien" style={{ marginTop: 24 }} onClick={() => { ecrire(CLEF_MOYEN, null); setFait(null) }}>Proposer un autre moyen</button>
        <br />
        <Link to="/" className="lien" style={{ display: 'inline-block', marginTop: 12 }}>Retour à l'accueil</Link>
      </div>
    )
  }

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!rgpd) return setErreur('Le consentement au traitement de vos coordonnées est requis.')
    setEnCours(true)
    const { data, error } = await supabase.rpc('declarer_moyen_prive', {
      p_contexte: contexteId,
      p_cle_client: nouvelleCle(),
      p_categorie: v.categorie,
      p_nom: v.nom.trim(),
      p_proprietaire_type: v.proprietaire_type,
      p_proprietaire_nom: v.proprietaire_nom.trim(),
      p_proprietaire_telephone: v.proprietaire_telephone.trim(),
      p_capacite: v.capacite.trim() || null,
      p_delai: v.delai.trim() || null,
      p_conditions: v.conditions.trim() || null,
      p_latitude: position?.lat ?? null,
      p_longitude: position?.lon ?? null,
    })
    setEnCours(false)
    if (error) return setErreur(estReseau(error) ? 'Pas de réseau : réessayez dès que vous captez.' : messageErreurEntraide(error))
    const r = { nom: v.nom.trim(), reference: data?.[0]?.reference ?? null }
    ecrire(CLEF_MOYEN, r)
    setFait(r)
  }

  return (
    <div className="participant">
      <h1 className="text-lg font-semibold text-encre mb-1">Proposer un moyen</h1>
      <p className="text-sm text-sourdine mb-4">Tracteur, pelleteuse, pompe, bateau, camion, groupe électrogène, salle, hangar… La commune saura qu'il existe et vous appellera si elle en a besoin. {MENTION_MOYEN_PRIVE}</p>
      <form onSubmit={soumettre} className="space-y-4" aria-label="Proposer un moyen">
        <div><label className="block text-xs font-medium text-sourdine mb-1">Type de moyen</label><select value={v.categorie} onChange={set('categorie')} className="w-full">{CATEGORIES_MOYEN_DECLARABLE.map((c) => <option key={c.valeur} value={c.valeur}>{c.libelle}</option>)}</select></div>
        <div><label className="block text-xs font-medium text-sourdine mb-1">Description</label><input required value={v.nom} onChange={set('nom')} className="w-full" maxLength={160} placeholder="ex. Pelleteuse 8 t avec chauffeur" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-sourdine mb-1">Capacité</label><input value={v.capacite} onChange={set('capacite')} className="w-full" maxLength={200} placeholder="ex. 8 t, 12 m³, 40 places" /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Disponible sous</label><input value={v.delai} onChange={set('delai')} className="w-full" maxLength={120} placeholder="ex. 2 h, le week-end" /></div>
        </div>
        <div><label className="block text-xs font-medium text-sourdine mb-1">Conditions</label><input value={v.conditions} onChange={set('conditions')} className="w-full" maxLength={500} placeholder="ex. prêt gratuit avec chauffeur, carburant à charge de la commune" /></div>
        <div><label className="block text-xs font-medium text-sourdine mb-1">Vous êtes</label><select value={v.proprietaire_type} onChange={set('proprietaire_type')} className="w-full"><option value="particulier">Un particulier</option><option value="entreprise">Une entreprise</option><option value="association">Une association</option></select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-sourdine mb-1">Nom / raison sociale</label><input required value={v.proprietaire_nom} onChange={set('proprietaire_nom')} className="w-full" maxLength={120} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Téléphone</label><input required type="tel" value={v.proprietaire_telephone} onChange={set('proprietaire_telephone')} className="w-full" maxLength={30} /></div>
        </div>
        <div>
          <button
            type="button"
            className="discret"
            onClick={() => navigator.geolocation?.getCurrentPosition((pos) => setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude }), () => setErreur('Position indisponible : la commune vous demandera l’adresse.'))}
          >
            {position ? `Position enregistrée (${position.lat.toFixed(4)}, ${position.lon.toFixed(4)})` : 'Utiliser ma position pour situer le moyen (facultatif)'}
          </button>
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={rgpd} onChange={(e) => setRgpd(e.target.checked)} className="mt-0.5" /><span>J'accepte que la commune garde mes coordonnées pour me contacter en cas de besoin. Elles ne sont ni publiées ni transmises.</span></label>
        {erreur && <p className="message erreur" role="alert">{erreur}</p>}
        <button type="submit" className="bouton-terrain principal" disabled={enCours}>{enCours ? 'Envoi…' : 'Déclarer ce moyen'}</button>
      </form>
    </div>
  )
}
