import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import {
  NIVEAUX,
  LIBELLE_NIVEAU,
  COULEUR_NIVEAU,
  LIBELLE_STATUT,
  LIBELLE_PHASE,
  etatEnvoi,
  genererSecret,
  hoteRecepteur,
  ligneDepuisFormulaire,
  resumeEnvoi,
} from '../lib/evenementsTerritoire'

const dateHeure = (iso) => new Date(iso).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' })
const dateSeule = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-BE')

const EXEMPLE_CHARGE = `POST {adresse de réception}
Content-Type: application/json
X-Diffusion-Secret: {le secret convenu}

{
  "source": "crisiware",
  "commune": "Commune Test",
  "evenement": { "nom": "Festival …", "jeton_public": "…" },
  "incident": { "type": "inondation", "phase": "alerte" },
  "alerte": {
    "reference": "{identifiant unique du message}",
    "niveau": "urgence",
    "titre": "…", "message": "…", "consigne": "…",
    "emise_le": "2026-10-18T11:46:56+00:00"
  }
}`

function PastilleNiveau({ niveau }) {
  return (
    <span className="jeton" style={{ color: COULEUR_NIVEAU[niveau], fontWeight: 600 }}>
      {LIBELLE_NIVEAU[niveau] ?? niveau}
    </span>
  )
}

/**
 * Événements (festivals, marchés, courses…) suivis par la commune, et messages que le Comité de Coordination leur adresse.
 *
 * Quand un incident réel change de phase, le serveur PRÉPARE un message pour chaque événement suivi dont les dates sont
 * proches ; il ne l'envoie jamais de lui-même. Le CC relit, corrige si besoin, puis valide : c'est sa décision, pas celle
 * d'un automate. Un message envoyé ou écarté est définitif (le serveur refuse toute modification).
 */
export default function EvenementsTerritoire() {
  const { contexteId } = useAuth()
  const [liens, setLiens] = useState(null)
  const [emissions, setEmissions] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [annonce, setAnnonce] = useState(null) // { ok, texte } : résultat de la dernière action, visible même si la carte disparaît
  const [ajout, setAjout] = useState(false)
  const [edition, setEdition] = useState(null)
  const [redaction, setRedaction] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    const [l, e] = await Promise.all([
      supabase.from('evenements_territoire').select('*').eq('contexte_id', contexteId).order('actif', { ascending: false }).order('nom'),
      supabase.from('emissions_evenements').select('*, incidents(nom)').eq('contexte_id', contexteId).order('propose_le', { ascending: false }).limit(200),
    ])
    const premiere = l.error || e.error
    if (premiere) {
      setErreur(texteErreur(premiere))
      return
    }
    setErreur(null)
    setLiens(l.data ?? [])
    setEmissions(e.data ?? [])
  }, [contexteId])

  useEffect(() => {
    charger()
    // Une phase peut changer pendant que l'écran est ouvert : une proposition arrive d'elle-même.
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  if (erreur && !liens) return <p role="alert" className="text-sm text-chaud">{erreur}</p>
  if (!liens || !emissions) return <p className="text-sm text-sourdine">Chargement…</p>

  const parId = Object.fromEntries(liens.map((x) => [x.id, x]))
  const aTraiter = emissions.filter((x) => x.statut === 'a_valider' || x.statut === 'echec').sort((a, b) => new Date(a.propose_le) - new Date(b.propose_le))
  const historique = emissions.filter((x) => x.statut === 'envoye' || x.statut === 'annule')

  return (
    <div>
      <h1 className="text-lg font-semibold text-encre mb-1">Événements du territoire</h1>
      <p className="text-sm text-sourdine mb-4">
        Festivals, marchés, courses… qui se tiennent sur la commune. Quand un incident réel passe en pré-alerte, en alerte ou est levé, un message est
        préparé pour chaque événement suivi dont les dates sont proches. <strong>Rien ne part sans votre validation</strong> : relisez, corrigez si besoin,
        puis envoyez.
      </p>

      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}
      {annonce && (
        <p role={annonce.ok ? 'status' : 'alert'} className={`text-sm mb-3 border rounded p-2 ${annonce.ok ? 'border-trait text-encre' : 'border-chaud text-chaud'}`}>
          {annonce.texte}{' '}
          <button type="button" className="lien" onClick={() => setAnnonce(null)}>Fermer</button>
        </p>
      )}

      <section aria-labelledby="ev-a-valider" className="mb-6">
        <h2 id="ev-a-valider" className="text-sm font-medium text-encre mb-2">Messages à valider ({aTraiter.length})</h2>
        {aTraiter.length === 0 ? (
          <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">Aucun message en attente.</p>
        ) : (
          <ul className="space-y-3">
            {aTraiter.map((x) => (
              <CarteEmission key={x.id} emission={x} lien={parId[x.evenement_territoire_id]} onChange={charger} onAnnonce={setAnnonce} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ev-suivis" className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 id="ev-suivis" className="text-sm font-medium text-encre">Événements suivis ({liens.length})</h2>
          {!ajout && (
            <BoutonDiscret type="button" onClick={() => { setAjout(true); setEdition(null) }}>
              Suivre un événement
            </BoutonDiscret>
          )}
        </div>

        {ajout && (
          <FormulaireLien
            contexteId={contexteId}
            lien={null}
            onFini={async (cree) => {
              setAjout(false)
              await charger()
              // Le secret ne se définit que sur un événement existant : on rouvre la fiche pour qu'il soit la suite logique.
              if (cree?.id) setEdition(cree.id)
            }}
            onAnnuler={() => setAjout(false)}
            onChange={charger}
          />
        )}

        {liens.length === 0 && !ajout ? (
          <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
            Aucun événement suivi. Ajoutez ceux que la commune doit pouvoir prévenir (kermesse, festival, marché, course…).
          </p>
        ) : (
          <ul className="space-y-3">
            {liens.map((l) => (
              <li key={l.id} className="bg-surface border border-trait rounded p-3" style={l.actif ? undefined : { opacity: 0.7 }} data-evenement={l.id}>
                {edition === l.id ? (
                  <FormulaireLien contexteId={contexteId} lien={l} onFini={async () => { setEdition(null); await charger() }} onAnnuler={() => setEdition(null)} onChange={charger} />
                ) : (
                  <FicheLien
                    lien={l}
                    onModifier={() => { setEdition(l.id); setRedaction(null); setAjout(false) }}
                    onRediger={() => { setRedaction(redaction === l.id ? null : l.id); setEdition(null) }}
                    redigeant={redaction === l.id}
                    onChange={charger}
                    onAnnonce={setAnnonce}
                  />
                )}
                {redaction === l.id && (
                  <MessageManuel
                    lien={l}
                    onFini={async () => {
                      setRedaction(null)
                      setAnnonce({ ok: true, texte: `Message préparé pour « ${l.nom} » : relisez-le dans « Messages à valider », puis envoyez-le.` })
                      await charger()
                    }}
                    onAnnuler={() => setRedaction(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="mb-6">
        <summary className="text-sm font-medium text-encre cursor-pointer">Historique ({historique.length})</summary>
        {historique.length === 0 ? (
          <p className="text-sm text-sourdine mt-2">Aucun message envoyé ou écarté pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-trait border border-trait rounded overflow-hidden mt-2">
            {historique.slice(0, 50).map((x) => (
              <li key={x.id} className="px-3 py-2 bg-surface text-sm">
                <p className="text-encre">
                  <PastilleNiveau niveau={x.niveau} /> <strong>{x.titre}</strong>
                </p>
                <p className="text-xs text-sourdine">
                  {parId[x.evenement_territoire_id]?.nom ?? 'Événement'} ·{' '}
                  {x.statut === 'envoye' ? `envoyé le ${dateHeure(x.envoye_le)}${x.code_reponse ? ` (HTTP ${x.code_reponse})` : ''}` : `non envoyé — ${x.motif_annulation ?? 'écarté'}`}
                  {x.incidents?.nom && <> · incident : {x.incidents.nom}</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="mb-2">
        <summary className="text-sm font-medium text-encre cursor-pointer">Ce que reçoit l'organisateur</summary>
        <p className="text-xs text-sourdine mt-2 mb-1">
          Chaque message est envoyé en HTTPS vers l'adresse de réception de l'événement, avec le secret convenu dans l'en-tête indiqué. La référence est unique
          par message : le récepteur peut s'en servir pour ignorer un doublon. Le récepteur doit répondre 2xx pour que le message soit compté comme envoyé.
        </p>
        <pre className="text-xs border border-trait rounded p-2 bg-fond" style={{ overflowX: 'auto' }}>{EXEMPLE_CHARGE}</pre>
      </details>
    </div>
  )
}

function CarteEmission({ emission: x, lien, onChange, onAnnonce }) {
  const [mode, setMode] = useState(null) // null | 'edition' | 'envoi' | 'ecarter'
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [niveau, setNiveau] = useState(x.niveau)
  const [titre, setTitre] = useState(x.titre)
  const [message, setMessage] = useState(x.message)
  const [consigne, setConsigne] = useState(x.consigne ?? '')
  const [motif, setMotif] = useState('')
  // Un double clic ou un double toucher ne doit pas lancer deux envois : le verrou se pose avant que l'écran ait eu le temps de se redessiner.
  const verrou = useRef(false)
  const envoi = etatEnvoi(lien)
  const hote = hoteRecepteur(lien?.url_recepteur)
  const automatique = x.declencheur === 'phase_incident'

  // Le texte peut avoir été remis à jour par le serveur (alerte qui monte d'un cran) depuis l'ouverture de l'écran : on repart du texte actuel.
  function ouvrirEdition() {
    setNiveau(x.niveau)
    setTitre(x.titre)
    setMessage(x.message)
    setConsigne(x.consigne ?? '')
    setErreur(null)
    setMode('edition')
  }

  async function enregistrer(e) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    const { data, error } = await supabase
      .from('emissions_evenements')
      .update({ niveau, titre: titre.trim(), message: message.trim(), consigne: consigne.trim() || null })
      .eq('id', x.id)
      .select('id')
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else if (!data?.length) setErreur('Modification refusée : ce message n\'est plus modifiable, ou vos droits ne le permettent pas.')
    else {
      setMode(null)
      await onChange()
    }
  }

  async function envoyer() {
    if (verrou.current) return
    verrou.current = true
    setEnCours(true)
    setErreur(null)
    const { data, error } = await supabase.rpc('envoyer_emission_evenement', { p_emission_id: x.id })
    verrou.current = false
    setEnCours(false)
    if (error) {
      setErreur(texteErreur(error))
      return
    }
    const r = resumeEnvoi(data)
    onAnnonce({ ok: r.ok, texte: `${lien?.nom ?? 'Événement'} : ${r.texte}` })
    setMode(null)
    await onChange()
  }

  async function ecarter() {
    if (verrou.current) return
    verrou.current = true
    setEnCours(true)
    setErreur(null)
    const { data, error } = await supabase
      .from('emissions_evenements')
      .update({ statut: 'annule', motif_annulation: motif.trim() || null })
      .eq('id', x.id)
      .select('id')
    verrou.current = false
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else if (!data?.length) setErreur('Action refusée : ce message n\'est plus modifiable, ou vos droits ne le permettent pas.')
    else {
      onAnnonce({ ok: true, texte: `Message écarté pour « ${lien?.nom ?? 'l\'événement'} » : il n'est pas parti.` })
      await onChange()
    }
  }

  return (
    <li className="bg-surface border border-trait rounded p-3" data-emission={x.id}>
      <p className="text-xs text-sourdine">
        <strong className="text-encre">{lien?.nom ?? 'Événement'}</strong>
        {lien?.organisateur && <> ({lien.organisateur})</>} · <PastilleNiveau niveau={x.niveau} /> ·{' '}
        {automatique ? (
          <>
            proposé automatiquement le {dateHeure(x.propose_le)}
            {x.incident_id && (
              <>
                {' '}pour l'incident <Link to={`/incidents/${x.incident_id}`} className="lien">{x.incidents?.nom ?? 'voir'}</Link>
                {x.phase_incident && <> ({LIBELLE_PHASE[x.phase_incident] ?? x.phase_incident})</>}
              </>
            )}
          </>
        ) : (
          <>écrit à la main le {dateHeure(x.propose_le)}</>
        )}
        {x.statut === 'echec' && (
          <>
            {' '}
            <span className="jeton ml-2" style={{ color: '#b91c1c' }}>{LIBELLE_STATUT.echec}</span>
          </>
        )}
      </p>

      {x.statut === 'echec' && (
        <p role="alert" className="text-xs text-chaud mt-1">
          Dernière tentative le {x.derniere_tentative_le ? dateHeure(x.derniere_tentative_le) : '—'} : {x.erreur ?? 'échec'}
          {x.tentatives > 1 && <> ({x.tentatives} tentatives)</>}. Rien n'est parti.
        </p>
      )}

      {mode === 'edition' ? (
        <form onSubmit={enregistrer} className="space-y-2 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`em-n-${x.id}`}>Niveau</label>
              <select id={`em-n-${x.id}`} value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full">
                {NIVEAUX.map((n) => <option key={n} value={n}>{LIBELLE_NIVEAU[n]}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`em-t-${x.id}`}>Titre</label>
              <input id={`em-t-${x.id}`} value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full" required minLength={3} maxLength={200} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`em-m-${x.id}`}>Message</label>
            <textarea id={`em-m-${x.id}`} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full" required minLength={3} maxLength={2000} />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`em-c-${x.id}`}>Consigne (facultatif)</label>
            <textarea id={`em-c-${x.id}`} value={consigne} onChange={(e) => setConsigne(e.target.value)} rows={2} className="w-full" maxLength={1000} />
          </div>
          {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
          <div className="flex gap-2">
            <BoutonPrincipal type="submit" disabled={enCours || titre.trim().length < 3 || message.trim().length < 3}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
            <BoutonDiscret type="button" onClick={() => setMode(null)} disabled={enCours}>Annuler</BoutonDiscret>
          </div>
        </form>
      ) : (
        <div className="mt-1">
          <p className="text-sm font-medium text-encre">{x.titre}</p>
          <p className="text-sm text-encre mt-0.5" style={{ whiteSpace: 'pre-line' }}>{x.message}</p>
          {x.consigne && (
            <p className="text-xs text-sourdine mt-1" style={{ whiteSpace: 'pre-line' }}><strong>Consigne :</strong> {x.consigne}</p>
          )}
        </div>
      )}

      {!mode && (
        <>
          {!envoi.ok && <p className="text-xs text-chaud mt-2">{envoi.raison}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <BoutonPrincipal type="button" disabled={!envoi.ok} onClick={() => { setMode('envoi'); setErreur(null) }}>
              {x.statut === 'echec' ? 'Renvoyer…' : 'Envoyer…'}
            </BoutonPrincipal>
            <BoutonDiscret type="button" onClick={ouvrirEdition}>Modifier le texte</BoutonDiscret>
            <BoutonDiscret type="button" onClick={() => { setMode('ecarter'); setErreur(null) }}>Ne pas envoyer</BoutonDiscret>
          </div>
        </>
      )}

      {mode === 'envoi' && (
        <div className="border border-trait rounded p-2 mt-2 bg-fond space-y-2" role="group" aria-label="Confirmer l'envoi">
          <p className="text-sm text-encre">
            Envoyer ce message à <strong>{lien?.organisateur || lien?.nom}</strong>{hote && <> ({hote})</>} ? Il part tel qu'il est écrit ci-dessus et ne pourra plus être modifié.
          </p>
          {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
          {enCours && <p role="status" className="text-xs text-sourdine">Envoi en cours… (5 secondes au plus)</p>}
          <div className="flex gap-2">
            <BoutonPrincipal type="button" onClick={envoyer} disabled={enCours}>{enCours ? 'Envoi…' : 'Confirmer l\'envoi'}</BoutonPrincipal>
            <BoutonDiscret type="button" onClick={() => setMode(null)} disabled={enCours}>Retour</BoutonDiscret>
          </div>
        </div>
      )}

      {mode === 'ecarter' && (
        <div className="border border-trait rounded p-2 mt-2 bg-fond space-y-2" role="group" aria-label="Écarter le message">
          <p className="text-sm text-encre">Ce message ne sera pas envoyé et ne pourra plus l'être. Motif (facultatif, conservé dans l'historique) :</p>
          <input value={motif} onChange={(e) => setMotif(e.target.value)} className="w-full" maxLength={300} aria-label="Motif" />
          {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
          <div className="flex gap-2">
            <BoutonPrincipal type="button" onClick={ecarter} disabled={enCours}>{enCours ? 'Un instant…' : 'Confirmer : ne pas envoyer'}</BoutonPrincipal>
            <BoutonDiscret type="button" onClick={() => setMode(null)} disabled={enCours}>Retour</BoutonDiscret>
          </div>
        </div>
      )}
    </li>
  )
}

function FicheLien({ lien: l, onModifier, onRediger, redigeant, onChange, onAnnonce }) {
  const [enCours, setEnCours] = useState(false)
  const hote = hoteRecepteur(l.url_recepteur)

  async function basculer() {
    setEnCours(true)
    const { data, error } = await supabase.from('evenements_territoire').update({ actif: !l.actif }).eq('id', l.id).select('id')
    setEnCours(false)
    if (error) onAnnonce({ ok: false, texte: texteErreur(error) })
    else if (!data?.length) onAnnonce({ ok: false, texte: 'Action refusée : vos droits ne permettent pas de modifier cet événement.' })
    else await onChange()
  }

  return (
    <div>
      <p className="text-sm font-medium text-encre">
        {l.nom}
        {!l.actif && (
          <>
            {' '}
            <span className="jeton ml-2">plus suivi</span>
          </>
        )}
      </p>
      <p className="text-xs text-sourdine mt-0.5">
        {l.organisateur ? `${l.organisateur} · ` : ''}
        {l.date_debut || l.date_fin
          ? `${l.date_debut ? `du ${dateSeule(l.date_debut)}` : ''}${l.date_fin ? ` au ${dateSeule(l.date_fin)}` : ''} · `
          : 'dates non précisées · '}
        réception : {hote ?? <em>aucune adresse</em>} · secret : {l.secret_defini ? 'défini' : <em>non défini</em>}
      </p>
      {l.notes && <p className="text-xs text-sourdine mt-0.5" style={{ whiteSpace: 'pre-line' }}>{l.notes}</p>}
      <div className="flex flex-wrap gap-2 mt-2">
        <BoutonDiscret type="button" onClick={onModifier}>Modifier</BoutonDiscret>
        <BoutonDiscret type="button" onClick={onRediger} disabled={!l.actif} aria-expanded={redigeant}>Écrire un message</BoutonDiscret>
        <BoutonDiscret type="button" onClick={basculer} disabled={enCours}>{l.actif ? 'Ne plus suivre' : 'Suivre de nouveau'}</BoutonDiscret>
      </div>
    </div>
  )
}

function FormulaireLien({ contexteId, lien, onFini, onAnnuler, onChange }) {
  const [f, setF] = useState({
    nom: lien?.nom ?? '',
    organisateur: lien?.organisateur ?? '',
    jeton_public: lien?.jeton_public ?? '',
    url_recepteur: lien?.url_recepteur ?? '',
    entete_secret: lien?.entete_secret ?? 'X-Diffusion-Secret',
    date_debut: lien?.date_debut ?? '',
    date_fin: lien?.date_fin ?? '',
    notes: lien?.notes ?? '',
  })
  const [enCours, setEnCours] = useState(false)
  const [erreurs, setErreurs] = useState([])
  const verrou = useRef(false)
  const maj = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const id = lien?.id ?? 'nouveau'
  const adresseChangee = lien && (f.url_recepteur.trim() || null) !== (lien.url_recepteur ?? null)

  async function valider(e) {
    e.preventDefault()
    const { erreurs: locales, ligne } = ligneDepuisFormulaire(f)
    if (locales.length) {
      setErreurs(locales)
      return
    }
    if (verrou.current) return
    verrou.current = true
    setEnCours(true)
    setErreurs([])
    let resultat
    if (lien) {
      resultat = await supabase.from('evenements_territoire').update(ligne).eq('id', lien.id).select('*')
    } else {
      resultat = await supabase.from('evenements_territoire').insert({ contexte_id: contexteId, ...ligne, actif: true }).select('*').single()
    }
    verrou.current = false
    setEnCours(false)
    const { data, error } = resultat
    if (error) {
      setErreurs([error.code === '23505' ? 'Cet événement (même jeton public) est déjà suivi par la commune.' : texteErreur(error)])
    } else if (lien && !data?.length) {
      setErreurs(['Modification refusée : vos droits ne permettent pas de modifier cet événement.'])
    } else {
      await onFini(lien ? lien : data)
    }
  }

  return (
    <div>
      <form onSubmit={valider} className="border border-trait rounded p-3 mb-2 bg-fond space-y-2">
        <p className="text-sm font-medium text-encre">{lien ? `Modifier « ${lien.nom} »` : 'Suivre un événement'}</p>
        {erreurs.length > 0 && (
          <ul role="alert" className="text-sm text-chaud list-disc pl-5">
            {erreurs.map((m) => <li key={m}>{m}</li>)}
          </ul>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`lien-nom-${id}`}>Nom de l'événement</label>
            <input id={`lien-nom-${id}`} value={f.nom} onChange={maj('nom')} className="w-full" required maxLength={200} />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`lien-org-${id}`}>Organisateur</label>
            <input id={`lien-org-${id}`} value={f.organisateur} onChange={maj('organisateur')} className="w-full" maxLength={200} />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`lien-deb-${id}`}>Du</label>
            <input id={`lien-deb-${id}`} type="date" value={f.date_debut} onChange={maj('date_debut')} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`lien-fin-${id}`}>Au</label>
            <input id={`lien-fin-${id}`} type="date" value={f.date_fin} onChange={maj('date_fin')} className="w-full" />
          </div>
        </div>
        <p className="text-xs text-sourdine">Sans dates, l'événement reçoit les messages à chaque incident. Avec dates, seulement dans les 2 jours qui précèdent son début et jusqu'à sa fin.</p>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`lien-url-${id}`}>Adresse de réception de l'organisateur (https)</label>
          <input id={`lien-url-${id}`} type="url" inputMode="url" value={f.url_recepteur} onChange={maj('url_recepteur')} className="w-full" placeholder="https://…" maxLength={500} />
          {adresseChangee && lien.secret_defini && (
            <p className="text-xs text-chaud mt-1">Changer l'adresse efface le secret : il ne part qu'à l'adresse pour laquelle il a été donné. Vous devrez le saisir de nouveau.</p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`lien-ent-${id}`}>En-tête qui porte le secret</label>
            <input id={`lien-ent-${id}`} value={f.entete_secret} onChange={maj('entete_secret')} className="w-full" maxLength={60} />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`lien-jeton-${id}`}>Jeton public Eventware (facultatif)</label>
            <input id={`lien-jeton-${id}`} value={f.jeton_public} onChange={maj('jeton_public')} className="w-full" placeholder="123e4567-e89b-12d3-…" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`lien-notes-${id}`}>Notes (contact, repères, accès des secours…)</label>
          <textarea id={`lien-notes-${id}`} value={f.notes} onChange={maj('notes')} rows={2} className="w-full" maxLength={2000} />
        </div>
        <div className="flex gap-2">
          <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : lien ? 'Enregistrer' : 'Suivre cet événement'}</BoutonPrincipal>
          <BoutonDiscret type="button" onClick={onAnnuler} disabled={enCours}>{lien ? 'Fermer' : 'Annuler'}</BoutonDiscret>
        </div>
      </form>
      {lien && <SectionSecret lien={lien} onChange={onChange} />}
    </div>
  )
}

function SectionSecret({ lien, onChange }) {
  const [secret, setSecret] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [retour, setRetour] = useState(null)
  const valide = secret.trim().length >= 16

  async function definir(valeur, texteOk) {
    setEnCours(true)
    setRetour(null)
    const { error } = await supabase.rpc('definir_secret_evenement', { p_evenement_id: lien.id, p_secret: valeur })
    setEnCours(false)
    if (error) setRetour({ ok: false, texte: texteErreur(error) })
    else {
      setSecret('')
      setRetour({ ok: true, texte: texteOk })
      await onChange()
    }
  }

  return (
    <div className="border border-trait rounded p-3 bg-fond space-y-2">
      <p className="text-sm font-medium text-encre">Secret partagé avec l'organisateur : {lien.secret_defini ? 'défini' : 'non défini'}</p>
      <p className="text-xs text-sourdine">
        Convenu avec l'organisateur (ou son logiciel), il accompagne chaque envoi dans l'en-tête « {lien.entete_secret} » pour prouver que le message vient bien de la commune. 16
        caractères au moins. Il n'est jamais réaffiché : notez-le avant d'enregistrer, et transmettez-le à l'organisateur par un canal sûr.
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="grow">
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`secret-${lien.id}`}>{lien.secret_defini ? 'Nouveau secret' : 'Secret'}</label>
          <input id={`secret-${lien.id}`} value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full font-mono" autoComplete="off" spellCheck={false} />
        </div>
        <BoutonDiscret type="button" onClick={() => setSecret(genererSecret())} disabled={enCours}>Générer</BoutonDiscret>
        <BoutonPrincipal type="button" onClick={() => definir(secret.trim(), 'Secret enregistré. Il ne sera plus affiché : assurez-vous de l\'avoir transmis.')} disabled={enCours || !valide}>
          Enregistrer le secret
        </BoutonPrincipal>
        {lien.secret_defini && (
          <BoutonDiscret type="button" onClick={() => definir('', 'Secret effacé : plus aucun envoi n\'est possible pour cet événement.')} disabled={enCours}>
            Effacer le secret
          </BoutonDiscret>
        )}
      </div>
      {secret.length > 0 && !valide && <p className="text-xs text-sourdine">Encore {16 - secret.trim().length} caractère{16 - secret.trim().length > 1 ? 's' : ''} au minimum.</p>}
      {retour && <p role={retour.ok ? 'status' : 'alert'} className={`text-sm ${retour.ok ? 'text-encre' : 'text-chaud'}`}>{retour.texte}</p>}
    </div>
  )
}

function MessageManuel({ lien, onFini, onAnnuler }) {
  const [niveau, setNiveau] = useState('information')
  const [titre, setTitre] = useState('')
  const [message, setMessage] = useState('')
  const [consigne, setConsigne] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const verrou = useRef(false)

  async function creer(e) {
    e.preventDefault()
    if (verrou.current) return
    verrou.current = true
    setEnCours(true)
    setErreur(null)
    // Le contexte, le déclencheur, le statut et l'auteur sont fixés par le serveur : un message écrit ici est toujours « à valider ».
    const { error } = await supabase.from('emissions_evenements').insert({
      evenement_territoire_id: lien.id,
      niveau,
      titre: titre.trim(),
      message: message.trim(),
      consigne: consigne.trim() || null,
    })
    verrou.current = false
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else await onFini()
  }

  return (
    <form onSubmit={creer} className="border border-trait rounded p-3 mt-2 bg-fond space-y-2">
      <p className="text-sm font-medium text-encre">Écrire un message à « {lien.nom} »</p>
      <p className="text-xs text-sourdine">Le message est d'abord placé dans « Messages à valider » : vous le relisez, puis vous l'envoyez.</p>
      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`mm-n-${lien.id}`}>Niveau</label>
          <select id={`mm-n-${lien.id}`} value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full">
            {NIVEAUX.map((n) => <option key={n} value={n}>{LIBELLE_NIVEAU[n]}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`mm-t-${lien.id}`}>Titre</label>
          <input id={`mm-t-${lien.id}`} value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full" required minLength={3} maxLength={200} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`mm-m-${lien.id}`}>Message</label>
        <textarea id={`mm-m-${lien.id}`} value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full" required minLength={3} maxLength={2000} />
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1" htmlFor={`mm-c-${lien.id}`}>Consigne (facultatif)</label>
        <textarea id={`mm-c-${lien.id}`} value={consigne} onChange={(e) => setConsigne(e.target.value)} rows={2} className="w-full" maxLength={1000} />
      </div>
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || titre.trim().length < 3 || message.trim().length < 3}>{enCours ? 'Préparation…' : 'Préparer le message'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler} disabled={enCours}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
