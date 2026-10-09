import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'
import { supabase } from '../lib/supabase'

const PHASES_CATALOGUE = [
  { valeur: 'prevision', libelle: 'Prévision', niveau: 'vigilance' },
  { valeur: 'preparation', libelle: 'Préparation', niveau: 'info' },
  { valeur: 'actuation', libelle: 'Pendant la crise', niveau: 'urgence' },
  { valeur: 'recuperation', libelle: 'Récupération', niveau: 'info' },
]

// Éléments « [à compléter] » du catalogue : à remplacer avant toute publication.
const MOTIF_A_COMPLETER = /\[[^\]]+\]/g

const NIVEAUX = [
  { valeur: 'info', libelle: 'Information', classe: 'text-sourdine' },
  { valeur: 'vigilance', libelle: 'Vigilance', classe: 'text-veille' },
  { valeur: 'urgence', libelle: 'Urgence', classe: 'text-chaud' },
]

/**
 * Messages à la population pendant un incident : publication (en partant d'un
 * modèle préparé dans Admin ou en message libre), diffusion vers les canaux,
 * clôture. Les alertes sont rattachées à l'incident (alertes_publiques.incident_id)
 * et apparaissent aussitôt dans l'app Citoyen tant qu'elles sont actives.
 */
export default function MessagesPopulation({ incidentId }) {
  const { contexteId } = useAuth()
  const { lignes: modeles } = useTableContexte('modeles_messages_population', contexteId, { tri: 'titre' })
  const [alertes, setAlertes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enRedaction, setEnRedaction] = useState(false)

  const rafraichir = useCallback(async () => {
    const { data, error } = await supabase
      .from('alertes_publiques')
      .select('*')
      .eq('incident_id', incidentId)
      .order('date_publication', { ascending: false })
    if (error) setErreur(error.message)
    else setAlertes(data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function publier(valeurs) {
    const { error } = await supabase
      .from('alertes_publiques')
      .insert({ ...valeurs, contexte_id: contexteId, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function changerEtat(id, actif) {
    const { error } = await supabase
      .from('alertes_publiques')
      .update({ actif, ...(actif ? {} : { date_expiration: new Date().toISOString() }) })
      .eq('id', id)
    if (error) setErreur(error.message)
    else await rafraichir()
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Messages à la population</h2>
        {!enRedaction && <BoutonPrincipal onClick={() => setEnRedaction(true)}>Publier un message</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Visible tout de suite dans l'app Citoyen. Partez d'un modèle préparé dans Admin ou rédigez
        librement ; clôturez le message quand la situation le permet.
      </p>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enRedaction && (
        <Formulaire
          modeles={modeles.filter((m) => m.actif)}
          onAnnuler={() => setEnRedaction(false)}
          onValider={async (v) => {
            const r = await publier(v)
            if (!r.error) setEnRedaction(false)
            return r
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : alertes.length === 0 && !enRedaction ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
          Aucun message publié pour cet incident.
        </p>
      ) : (
        <ul className="space-y-2">
          {alertes.map((a) => {
            const niveau = NIVEAUX.find((n) => n.valeur === a.niveau_alerte)
            const enCours = a.actif && (!a.date_expiration || new Date(a.date_expiration) > new Date())
            return (
              <li key={a.id} className="bg-surface border border-trait rounded p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-encre">
                      {a.titre}
                      <span className={`jeton ml-2 ${niveau?.classe}`}>{niveau?.libelle}</span>
                      <span className={`jeton ml-1 ${enCours ? 'text-ok' : 'text-sourdine'}`}>
                        {enCours ? 'en cours' : 'clôturé'}
                      </span>
                    </p>
                    <p className="text-sm text-sourdine mt-1">{a.message}</p>
                    {a.consignes && <p className="text-xs text-sourdine mt-1">consignes : {a.consignes}</p>}
                    {a.zone_concernee && <p className="text-xs text-sourdine mt-1">zone : {a.zone_concernee}</p>}
                    <p className="text-xs text-sourdine mt-1">
                      publié le {new Date(a.date_publication).toLocaleString('fr-BE')}
                    </p>
                  </div>
                  <BoutonDiscret onClick={() => changerEtat(a.id, !enCours)}>
                    {enCours ? 'Clôturer' : 'Rouvrir'}
                  </BoutonDiscret>
                </div>
                <Diffusion alerteId={a.id} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Diffusion({ alerteId }) {
  const [enCours, setEnCours] = useState(false)
  const [resultat, setResultat] = useState(null)
  const [erreur, setErreur] = useState(null)

  async function diffuser() {
    setEnCours(true)
    setErreur(null)
    setResultat(null)
    const { data, error } = await supabase.functions.invoke('diffuser-alerte', { body: { alerte_id: alerteId } })
    setEnCours(false)
    if (error) setErreur(error.message)
    else if (data?.error) setErreur(data.error)
    else setResultat(data)
  }

  return (
    <div className="mt-2 pt-2 border-t border-trait">
      <BoutonDiscret onClick={diffuser} disabled={enCours}>
        {enCours ? 'Diffusion en cours…' : 'Diffuser vers les canaux'}
      </BoutonDiscret>
      {erreur && <p className="text-xs text-chaud mt-1">{erreur}</p>}
      {resultat?.message && <p className="text-xs text-sourdine mt-1">{resultat.message}</p>}
      {resultat?.resultats?.length > 0 && (
        <ul className="text-xs mt-1 space-y-0.5">
          {resultat.resultats.map((r, i) => (
            <li key={i} className={r.statut === 'envoye' ? 'text-ok' : 'text-chaud'}>
              {r.canal} — {r.statut === 'envoye' ? 'envoyé' : `échec (${r.erreur})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Formulaire({ modeles, onValider, onAnnuler }) {
  const [titre, setTitre] = useState('')
  const [message, setMessage] = useState('')
  const [consignes, setConsignes] = useState('')
  const [zone, setZone] = useState('')
  const [niveau, setNiveau] = useState('info')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const [catalogue, setCatalogue] = useState([])
  const [phaseCatalogue, setPhaseCatalogue] = useState('')
  const [messageCatalogue, setMessageCatalogue] = useState(null)

  useEffect(() => {
    supabase
      .from('catalogue_messages_alerte')
      .select('id, numero_message_source, phase_cycle, section, zone_thematique, message_cle, sous_messages, statut_validation, necessite_completion')
      .neq('statut_validation', 'rejete')
      .order('numero_message_source')
      .then(({ data }) => setCatalogue(data ?? []))
  }, [])

  function appliquerCatalogue(id) {
    const m = catalogue.find((x) => x.id === id)
    setMessageCatalogue(m ?? null)
    if (!m) return
    setTitre(m.zone_thematique.replace(/^\d+\.\d+\s+/, ''))
    setMessage(m.message_cle)
    setConsignes((m.sous_messages ?? []).map((l) => `• ${l}`).join('\n'))
    setNiveau(PHASES_CATALOGUE.find((p) => p.valeur === m.phase_cycle)?.niveau ?? 'info')
  }

  const restantsACompleter = messageCatalogue
    ? [...new Set(`${titre}\n${message}\n${consignes}`.match(MOTIF_A_COMPLETER) ?? [])]
    : []

  function appliquerModele(id) {
    const m = modeles.find((x) => x.id === id)
    if (!m) return
    setTitre(m.titre)
    setMessage(m.message)
    setConsignes(m.consignes ?? '')
    setNiveau(m.niveau_alerte)
  }

  async function soumettre(e) {
    e.preventDefault()
    if (restantsACompleter.length > 0) {
      setErreur(`Complétez d'abord les éléments entre crochets : ${restantsACompleter.join(' ')}`)
      return
    }
    setErreur(null)
    setEnCours(true)
    const { error } = await onValider({
      titre: titre.trim(),
      message: message.trim(),
      consignes: consignes.trim() || null,
      zone_concernee: zone.trim() || null,
      niveau_alerte: niveau,
      actif: true,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3 mb-4 bg-fond border border-trait rounded p-3">
      {catalogue.length > 0 && (
        <div className="border border-trait rounded p-2 space-y-2">
          <label className="block text-xs font-medium text-sourdine">Catalogue de messages inondation</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={phaseCatalogue}
              onChange={(e) => {
                setPhaseCatalogue(e.target.value)
                setMessageCatalogue(null)
              }}
              className="w-full"
            >
              <option value="">— phase —</option>
              {PHASES_CATALOGUE.map((p) => (
                <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
              ))}
            </select>
            <select
              value={messageCatalogue?.id ?? ''}
              onChange={(e) => appliquerCatalogue(e.target.value)}
              disabled={!phaseCatalogue}
              className="w-full sm:col-span-2"
            >
              <option value="">— message —</option>
              {catalogue
                .filter((m) => m.phase_cycle === phaseCatalogue)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.section} · {m.message_cle.length > 70 ? `${m.message_cle.slice(0, 70)}…` : m.message_cle}
                  </option>
                ))}
            </select>
          </div>
          {messageCatalogue && messageCatalogue.statut_validation !== 'valide' && (
            <p className="text-xs text-chaud">
              Message du catalogue non validé par un expert belge
              {messageCatalogue.necessite_completion ? ' (texte reconstitué, à relire)' : ''} : relisez-le avant diffusion.
            </p>
          )}
          {restantsACompleter.length > 0 && (
            <p className="text-xs text-chaud">
              À compléter avant publication : {restantsACompleter.join(' · ')}
            </p>
          )}
        </div>
      )}
      {modeles.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Partir d'un modèle</label>
          <select defaultValue="" onChange={(e) => { setMessageCatalogue(null); appliquerModele(e.target.value) }} className="w-full">
            <option value="">— message libre —</option>
            {modeles.map((m) => (
              <option key={m.id} value={m.id}>{m.titre}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Titre</label>
        <input required value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Message au public</label>
        <textarea required rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Consignes</label>
        <textarea rows={2} value={consignes} onChange={(e) => setConsignes(e.target.value)} className="w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Niveau</label>
          <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="w-full">
            {NIVEAUX.map((n) => (
              <option key={n.valeur} value={n.valeur}>{n.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Zone concernée</label>
          <input value={zone} onChange={(e) => setZone(e.target.value)} className="w-full" />
        </div>
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || restantsACompleter.length > 0}>{enCours ? 'Publication…' : 'Publier maintenant'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
