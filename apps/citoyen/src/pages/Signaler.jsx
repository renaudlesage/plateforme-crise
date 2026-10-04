import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { nouvelleCle, surRetourReseau } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { lireFile, ajouter, majSignalement, retirer, ETATS, ETIQUETTES_STATUT } from '../lib/fileSignalements'

const STORAGE_KEY_CONTEXTE = 'citoyen_contexte_id_selectionne'

const TYPES = [
  ['route_coupee', 'Route coupée / inondée'],
  ['inondation', 'Inondation (habitation, cave…)'],
  ['degats_materiels', 'Dégâts matériels'],
  ['personne_isolee', 'Personne isolée / en danger'],
  ['danger', 'Danger immédiat'],
  ['autre', 'Autre'],
]

/**
 * Signalement citoyen sans compte — port du module Participant
 * d'Eventware (voir briefing-eventware-pour-crisiware.md §4, désigné
 * comme le différenciateur à reprendre). La commune est déjà publique
 * (sélectionnée sur l'accueil via contextes_publics) : pas besoin d'un
 * jeton d'événement ici, le contexte_id suffit.
 */
export default function Signaler() {
  const [params] = useSearchParams()
  const lieuParam = params.get('lieu') || ''
  const contexteId = localStorage.getItem(STORAGE_KEY_CONTEXTE) || ''
  const [contexteNom, setContexteNom] = useState('')
  const [chargementContexte, setChargementContexte] = useState(true)

  const [file, setFile] = useState(lireFile())
  const [type, setType] = useState('autre')
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [lieuLibre, setLieuLibre] = useState(lieuParam)
  const [position, setPosition] = useState(null)
  const [etatGeo, setEtatGeo] = useState('recherche')
  const [enLigne, setEnLigne] = useState(navigator.onLine)
  const [envoiEnCours, setEnvoiEnCours] = useState(false)

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

  /* --- Position --- */
  useEffect(() => {
    if (!navigator.geolocation) {
      setEtatGeo('indisponible')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          precision_m: p.coords.accuracy,
        })
        setEtatGeo('ok')
      },
      () => setEtatGeo('refusee'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  /* --- Réseau et renvoi automatique --- */
  useEffect(() => {
    const offline = () => setEnLigne(false)
    window.addEventListener('offline', offline)

    // Intervalle court, comme côté Eventware : un riverain qui vient de
    // signaler regarde son écran en attendant la confirmation.
    const desinstaller = surRetourReseau(() => {
      setEnLigne(navigator.onLine)
      viderFile()
    }, 15000)

    return () => {
      window.removeEventListener('offline', offline)
      desinstaller()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function envoyer(s) {
    const { data, error } = await supabase.rpc('creer_signalement_citoyen', {
      p_contexte: contexteId,
      p_cle_client: s.cle_client,
      p_type: s.type,
      p_description: s.description || null,
      p_contact: s.contact || null,
      p_latitude: s.latitude ?? null,
      p_longitude: s.longitude ?? null,
      p_precision_m: s.precision_m ?? null,
      p_lieu_libre: s.lieu_libre || null,
      p_emis_le: s.emis_le,
    })

    if (error) {
      // Contexte inconnu (P0002) : refus définitif, inutile de réessayer.
      // Tout le reste (droits, réseau) : on laisse en file, ça peut
      // changer d'une minute à l'autre.
      if (error.code === 'P0002') {
        setFile(majSignalement(s.cle_client, { etat: 'echec', motif: 'Commune inconnue ou lien invalide.' }))
        return false
      }
      setFile(majSignalement(s.cle_client, { etat: 'en_attente', motif: null }))
      return false
    }

    const ligne = Array.isArray(data) ? data[0] : data
    setFile(
      majSignalement(s.cle_client, {
        etat: 'recu',
        reference: ligne?.reference,
        statut: ligne?.statut,
      })
    )
    return true
  }

  async function viderFile() {
    const attente = lireFile().filter((s) => s.etat === 'en_attente' || s.etat === 'envoi')
    for (const s of attente) await envoyer(s)
    await rafraichirStatuts()
  }

  async function rafraichirStatuts() {
    const envoyes = lireFile().filter((s) => s.etat === 'recu')
    for (const s of envoyes) {
      const { data } = await supabase.rpc('suivre_signalement_citoyen', {
        p_contexte: contexteId,
        p_cle_client: s.cle_client,
      })
      const ligne = Array.isArray(data) ? data[0] : data
      if (ligne?.statut && ligne.statut !== s.statut) {
        setFile(majSignalement(s.cle_client, { statut: ligne.statut }))
      }
    }
  }

  async function soumettre(e) {
    e.preventDefault()
    setEnvoiEnCours(true)
    const s = {
      cle_client: nouvelleCle(),
      type,
      description,
      contact,
      lieu_libre: lieuLibre,
      ...(position ?? {}),
      emis_le: new Date().toISOString(),
      etat: 'en_attente',
    }
    setFile(ajouter(s))
    setDescription('')
    await envoyer(s)
    setEnvoiEnCours(false)
  }

  if (chargementContexte) {
    return <p className="text-sm text-sourdine text-center mt-10">Chargement…</p>
  }

  if (!contexteId) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="participant">
      <div className="bandeau">
        <Link to="/" className="lien">← retour</Link>
        <span className={`session ${enLigne ? '' : 'hors-ligne'}`}>
          {enLigne ? 'en ligne' : 'hors réseau'}
        </span>
      </div>

      <h1 className="text-lg font-semibold text-encre mb-1">Signaler un problème</h1>
      <p className="text-sm text-sourdine mb-5">
        Pour {contexteNom || 'votre commune'}. En cas d'urgence vitale, appelez le 112 en premier.
      </p>

      {file.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-medium text-encre mb-2">Mes signalements</h2>
          <div className="space-y-2">
            {file.map((s) => (
              <div key={s.cle_client} className="carte">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-encre">
                    {TYPES.find((t) => t[0] === s.type)?.[1] ?? s.type}
                    {s.reference && <span className="text-xs text-sourdine ml-2 font-mono">{s.reference}</span>}
                  </span>
                </div>
                <p className="text-xs text-sourdine mt-1">
                  {s.etat === 'recu' ? (ETIQUETTES_STATUT[s.statut] ?? 'Reçu') : ETATS[s.etat]}
                </p>
                {s.etat === 'en_attente' && (
                  <p className="text-xs text-sourdine mt-1">
                    {s.motif
                      ? `${s.motif} Le signalement partira automatiquement dès que possible.`
                      : "Pas de réseau pour l'instant. Le signalement partira tout seul dès que la connexion revient — garde cette page ouverte."}
                  </p>
                )}
                {s.etat === 'echec' && <p className="text-xs text-chaud mt-1">{s.motif}</p>}
                {s.description && <p className="text-xs text-sourdine mt-1">{s.description}</p>}
                {s.etat !== 'recu' && (
                  <button type="button" className="lien text-xs mt-1" onClick={() => setFile(retirer(s.cle_client))}>
                    Retirer de la liste
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={soumettre} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">De quoi s'agit-il ?</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full">
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Ce que vous constatez</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ex. Rue des Prés inondée sur 50 mètres"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Lieu précis (si le GPS ne suffit pas)</label>
          <input
            value={lieuLibre}
            onChange={(e) => setLieuLibre(e.target.value)}
            placeholder="ex. Pont de la rue Haute"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Votre numéro (facultatif)</label>
          <input
            type="tel"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="pour être rappelé si besoin"
            className="w-full"
          />
        </div>

        <div className="text-xs text-sourdine">
          {etatGeo === 'ok' && position && (
            <>Position transmise, précision {Math.round(position.precision_m)} m</>
          )}
          {etatGeo === 'recherche' && 'Recherche de votre position…'}
          {etatGeo === 'refusee' && 'Position non partagée — précisez le lieu ci-dessus.'}
          {etatGeo === 'indisponible' && 'Ce téléphone ne donne pas de position — précisez le lieu ci-dessus.'}
        </div>

        <button type="submit" disabled={envoiEnCours} className="principal bouton-terrain">
          {envoiEnCours ? 'Envoi…' : 'Envoyer le signalement'}
        </button>
      </form>
    </div>
  )
}
