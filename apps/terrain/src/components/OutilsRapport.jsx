import { useEffect, useRef, useState } from 'react'
import { positionActuelle, reduirePhoto } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { usePosition } from '../context/PositionContext'

const ReconnaissanceVocale = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

/** Position récente de l'appareil : celle du suivi si elle a moins d'une minute, sinon une lecture ponctuelle. */
export async function obtenirPosition(positionSuivie) {
  if (positionSuivie && Date.now() - positionSuivie.ts < 60000) return positionSuivie
  return positionActuelle(6000)
}

/**
 * Champ de texte avec dictée vocale (reconnaissance vocale du navigateur, quand elle existe).
 * Sans elle, le micro du clavier du téléphone fait le même travail : le champ est large et lisible.
 */
export function ChampDicte({ valeur, onChange, placeholder, rows = 2 }) {
  const [ecoute, setEcoute] = useState(false)
  const reco = useRef(null)

  useEffect(() => () => reco.current?.stop?.(), [])

  function basculer() {
    if (ecoute) {
      reco.current?.stop()
      return
    }
    const r = new ReconnaissanceVocale()
    r.lang = 'fr-BE'
    r.interimResults = false
    r.onresult = (e) => {
      const texte = Array.from(e.results).map((x) => x[0].transcript).join(' ')
      onChange(`${valeur ? `${valeur} ` : ''}${texte}`.trim())
    }
    r.onend = () => setEcoute(false)
    r.onerror = () => setEcoute(false)
    reco.current = r
    setEcoute(true)
    r.start()
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full" style={{ paddingRight: ReconnaissanceVocale ? 56 : undefined }} />
      {ReconnaissanceVocale && (
        <button
          type="button"
          onClick={basculer}
          aria-label={ecoute ? 'Arrêter la dictée' : 'Dicter'}
          className={ecoute ? 'principal' : 'discret'}
          style={{ position: 'absolute', right: 6, top: 6, padding: '6px 10px' }}
        >
          {ecoute ? '■' : '🎤'}
        </button>
      )}
    </div>
  )
}

function Resultat({ res }) {
  if (!res) return null
  if (res.statut === 'refus') return <p className="message erreur">{res.message}</p>
  if (res.statut === 'enfile') return <p className="message">Enregistré sur l'appareil : part dès le retour du réseau.</p>
  return <p className="message">Envoyé au CC.</p>
}

const CHAMPS_CAN = [
  { cle: 'je_suis', libelle: 'Je suis', aide: 'Où ? Qui ? (lieu, équipe)' },
  { cle: 'je_vois', libelle: 'Je vois', aide: 'Ce que je constate' },
  { cle: 'je_fais', libelle: 'Je fais', aide: 'Ce que mon équipe fait' },
  { cle: 'je_demande', libelle: 'Je demande', aide: 'Moyens, renforts, décisions' },
  { cle: 'je_prevois', libelle: 'Je prévois', aide: 'Ce que je compte faire ensuite' },
]

/** Rapport CAN guidé (« Je suis / vois / fais / demande / prévois »), dictée possible, position jointe. */
export function RapportCan({ incidentId, contexteId, roleLibelle }) {
  const { position } = usePosition()
  const [valeurs, setValeurs] = useState({})
  const [enCours, setEnCours] = useState(false)
  const [res, setRes] = useState(null)

  const rempli = CHAMPS_CAN.some((c) => (valeurs[c.cle] ?? '').trim())

  async function envoyer(e) {
    e.preventDefault()
    if (!rempli) return
    setEnCours(true)
    const pos = await obtenirPosition(position)
    const champs = Object.fromEntries(CHAMPS_CAN.map((c) => [c.cle, (valeurs[c.cle] ?? '').trim() || null]))
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'rapports_can',
      champs: {
        contexte_id: contexteId,
        incident_id: incidentId,
        role_libelle: roleLibelle ?? null,
        ...champs,
        latitude: pos?.lat ?? null,
        longitude: pos?.lon ?? null,
      },
      libelle: 'Rapport CAN',
    })
    setEnCours(false)
    setRes(r)
    if (r.statut !== 'refus') setValeurs({})
  }

  return (
    <form onSubmit={envoyer} className="space-y-3">
      <p className="text-xs text-sourdine">Court et factuel : une ou deux phrases par ligne suffisent. Votre position est jointe.</p>
      {CHAMPS_CAN.map((c) => (
        <div key={c.cle}>
          <label className="block text-xs font-medium text-sourdine mb-1">{c.libelle}</label>
          <ChampDicte valeur={valeurs[c.cle] ?? ''} onChange={(v) => setValeurs((p) => ({ ...p, [c.cle]: v }))} placeholder={c.aide} />
        </div>
      ))}
      <Resultat res={res} />
      <button type="submit" className="bouton-terrain principal" disabled={enCours || !rempli}>
        {enCours ? 'Envoi…' : 'Envoyer le rapport au CC'}
      </button>
    </form>
  )
}

/**
 * Photo géolocalisée : prise avec l'appareil, réduite, envoyée au stockage privé,
 * puis rattachée à l'incident avec sa position. L'envoi du fichier exige du réseau
 * (la file hors ligne ne porte pas les pièces jointes) : sans réseau, on le dit.
 */
export function PhotoGeo({ incidentId, contexteId }) {
  const { position } = usePosition()
  const [legende, setLegende] = useState('')
  const [apercu, setApercu] = useState(null)
  const [fichier, setFichier] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => () => apercu && URL.revokeObjectURL(apercu), [apercu])

  function choisir(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFichier(f)
    setApercu(URL.createObjectURL(f))
    setMessage(null)
    setErreur(null)
  }

  async function envoyer() {
    if (!fichier) return
    setEnCours(true)
    setErreur(null)
    try {
      const pos = await obtenirPosition(position)
      const blob = await reduirePhoto(fichier)
      const chemin = `${contexteId}/${incidentId}/${crypto.randomUUID()}.jpg`
      const { error: errUpload } = await supabase.storage.from('photos-terrain').upload(chemin, blob, { contentType: 'image/jpeg' })
      if (errUpload) throw new Error(navigator.onLine ? errUpload.message : "Pas de réseau : la photo ne peut pas partir. Réessayez dès que vous captez.")
      const r = await fileEcritures.ecrireOuEmpiler({
        nature: 'insert',
        table: 'photos_terrain',
        champs: {
          contexte_id: contexteId,
          incident_id: incidentId,
          chemin,
          legende: legende.trim() || null,
          latitude: pos?.lat ?? null,
          longitude: pos?.lon ?? null,
        },
        libelle: 'Photo',
      })
      if (r.statut === 'refus') throw new Error(r.message)
      setMessage(pos ? 'Photo envoyée avec sa position.' : 'Photo envoyée (position indisponible).')
      setFichier(null)
      setApercu(null)
      setLegende('')
    } catch (e) {
      setErreur(e.message ?? 'Envoi impossible.')
    }
    setEnCours(false)
  }

  return (
    <div className="space-y-2">
      <label className="bouton-terrain discret" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
        📷 Prendre une photo
        <input type="file" accept="image/*" capture="environment" onChange={choisir} style={{ display: 'none' }} />
      </label>
      {apercu && <img src={apercu} alt="Aperçu" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8 }} />}
      {fichier && (
        <>
          <ChampDicte valeur={legende} onChange={setLegende} placeholder="Légende (ce qu'on voit)" rows={2} />
          <button type="button" className="bouton-terrain principal" onClick={envoyer} disabled={enCours}>
            {enCours ? 'Envoi…' : 'Envoyer la photo au CC'}
          </button>
        </>
      )}
      {erreur && <p className="message erreur">{erreur}</p>}
      {message && <p className="message">{message}</p>}
    </div>
  )
}

const CATEGORIES_COMPTAGE = [
  { cle: 'evacues', libelle: 'Évacués' },
  { cle: 'accueillis', libelle: 'Accueillis (centre)' },
  { cle: 'blesses', libelle: 'Blessés' },
  { cle: 'personnes_a_risque', libelle: 'Personnes à risque repérées' },
  { cle: 'introuvables', libelle: 'Introuvables / non joignables' },
]

/** Comptage de personnes : des nombres seulement, jamais de listes nominatives. */
export function ComptagePersonnes({ incidentId, contexteId }) {
  const [valeurs, setValeurs] = useState({})
  const [lieu, setLieu] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [res, setRes] = useState(null)

  const lignes = CATEGORIES_COMPTAGE.filter((c) => valeurs[c.cle] !== undefined && valeurs[c.cle] !== '')

  async function envoyer(e) {
    e.preventDefault()
    if (lignes.length === 0) return
    setEnCours(true)
    let dernier = null
    for (const c of lignes) {
      dernier = await fileEcritures.ecrireOuEmpiler({
        nature: 'insert',
        table: 'comptages_personnes',
        champs: { contexte_id: contexteId, incident_id: incidentId, categorie: c.cle, nombre: Math.max(0, parseInt(valeurs[c.cle], 10) || 0), lieu_texte: lieu.trim() || null },
        libelle: `Comptage · ${c.libelle}`,
      })
      if (dernier.statut === 'refus') break
    }
    setEnCours(false)
    setRes(dernier)
    if (dernier?.statut !== 'refus') setValeurs({})
  }

  return (
    <form onSubmit={envoyer} className="space-y-2">
      <p className="text-xs text-sourdine">
        Nombres seulement, pas de noms. Indiquez le total constaté à cet instant dans votre secteur : le CC retient le dernier chiffre de chaque personne.
      </p>
      {CATEGORIES_COMPTAGE.map((c) => (
        <div key={c.cle} className="flex items-center gap-3">
          <label className="flex-1 text-sm text-encre">{c.libelle}</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={valeurs[c.cle] ?? ''}
            onChange={(e) => setValeurs((p) => ({ ...p, [c.cle]: e.target.value }))}
            style={{ width: 96, fontSize: 18, textAlign: 'center' }}
          />
        </div>
      ))}
      <input value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Secteur / lieu (facultatif)" className="w-full" />
      <Resultat res={res} />
      <button type="submit" className="bouton-terrain principal" disabled={enCours || lignes.length === 0}>
        {enCours ? 'Envoi…' : 'Envoyer le comptage'}
      </button>
    </form>
  )
}
