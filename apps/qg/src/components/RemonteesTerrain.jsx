import { useCallback, useEffect, useState } from 'react'
import { ilYA, lienItineraire } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { BoutonDiscret } from './Boutons'

/**
 * Ce que le terrain remonte au CC : appels d'aide, rapports C.A.N., photos, comptages.
 * Lecture et suivi seulement : rien n'est décidé ici à la place du Dir-PC-Ops.
 */

const heure = (d) => new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/* ------------------------------------------------------------------ */
/* Appels d'aide : bandeau en tête de la fiche incident                */

const LIBELLE_NIVEAU = { attention: "Besoin d'aide", urgent: 'URGENT', mayday: 'MAYDAY' }
const COULEUR_NIVEAU = { attention: '#d97706', urgent: '#b91c1c', mayday: '#7f1d1d' }
const SUITE_STATUT = { ouverte: 'vue', vue: 'prise_en_charge', prise_en_charge: 'close' }
const ACTION_STATUT = { ouverte: 'Marquer comme vu', vue: 'Prendre en charge', prise_en_charge: 'Clore' }
const LIBELLE_STATUT = { ouverte: 'pas encore vu', vue: 'vu', prise_en_charge: 'pris en charge' }

/** Appels d'aide non clos de l'incident, rafraîchis toutes les 15 s. N'affiche rien s'il n'y en a pas. */
export function BandeauAppelsAide({ incidentId }) {
  const [appels, setAppels] = useState([])
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('alertes_aide')
      .select('id, role_libelle, niveau, message, latitude, longitude, precision_m, statut, created_at')
      .eq('incident_id', incidentId)
      .neq('statut', 'close')
      .order('created_at', { ascending: false })
    if (error) setErreur(error.message)
    else {
      setErreur(null)
      setAppels(data ?? [])
    }
  }, [incidentId])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 15000)
    return () => clearInterval(t)
  }, [charger])

  async function avancer(a) {
    const suite = SUITE_STATUT[a.statut]
    if (!suite) return
    const { error } = await supabase.from('alertes_aide').update({ statut: suite, maj_le: new Date().toISOString() }).eq('id', a.id)
    if (error) setErreur(error.message)
    else charger()
  }

  if (appels.length === 0 && !erreur) return null

  return (
    <div className="mb-4 space-y-2" role="alert" aria-live="assertive">
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      {appels.map((a) => (
        <div key={a.id} className="rounded p-3" style={{ background: COULEUR_NIVEAU[a.niveau] ?? '#b91c1c', color: '#fff' }}>
          <p className="text-sm font-semibold">
            🆘 {LIBELLE_NIVEAU[a.niveau] ?? a.niveau} · {a.role_libelle ?? 'intervenant'} · {ilYA(a.created_at)}
          </p>
          {a.message && <p className="text-sm mt-1">{a.message}</p>}
          <p className="text-xs mt-1" style={{ opacity: 0.9 }}>
            {LIBELLE_STATUT[a.statut] ?? a.statut}
            {a.latitude != null ? (
              <>
                {' · '}
                <a href={lienItineraire(a.latitude, a.longitude)} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>
                  position ±{Math.round(a.precision_m ?? 0)} m ↗
                </a>
              </>
            ) : (
              ' · position inconnue'
            )}
          </p>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => avancer(a)}
              style={{ background: '#fff', color: '#7f1d1d', border: 0, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}
            >
              {ACTION_STATUT[a.statut]}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Rapports C.A.N. et photos                                           */

const CHAMPS_CAN = [
  ['je_suis', 'Je suis'],
  ['je_vois', 'Je vois'],
  ['je_fais', 'Je fais'],
  ['je_demande', 'Je demande'],
  ['je_prevois', 'Je prévois'],
]

/** Rapports C.A.N. des équipes, photos géolocalisées. Replié par défaut (peu de place en priorité). */
export function SectionRapportsEtPhotos({ incidentId }) {
  const [rapports, setRapports] = useState([])
  const [photos, setPhotos] = useState([])
  const [urls, setUrls] = useState({})
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    const [r, p] = await Promise.all([
      supabase
        .from('rapports_can')
        .select('id, role_libelle, je_suis, je_vois, je_fais, je_demande, je_prevois, latitude, longitude, created_at')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('photos_terrain')
        .select('id, chemin, legende, latitude, longitude, created_at')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    const err = r.error ?? p.error
    setErreur(err ? err.message : null)
    setRapports(r.data ?? [])
    setPhotos(p.data ?? [])
    if ((p.data ?? []).length > 0) {
      // Bucket privé : adresses signées valables une heure
      const { data: signees } = await supabase.storage.from('photos-terrain').createSignedUrls(p.data.map((x) => x.chemin), 3600)
      setUrls(Object.fromEntries((signees ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])))
    }
  }, [incidentId])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 60000)
    return () => clearInterval(t)
  }, [charger])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-encre">
          Rapports et photos du terrain{' '}
          <span className="text-xs text-sourdine font-normal">
            ({rapports.length} rapport{rapports.length > 1 ? 's' : ''}, {photos.length} photo{photos.length > 1 ? 's' : ''})
          </span>
        </h2>
        <BoutonDiscret onClick={() => setOuvert((o) => !o)}>{ouvert ? 'Replier' : 'Afficher'}</BoutonDiscret>
      </div>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {ouvert && (
        <div className="space-y-4">
          {rapports.length === 0 && photos.length === 0 && (
            <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">Rien remonté par le terrain pour l'instant.</p>
          )}

          {rapports.length > 0 && (
            <ul className="space-y-2">
              {rapports.map((r) => (
                <li key={r.id} className="bg-surface border border-trait rounded p-3">
                  <p className="text-sm font-medium text-encre">
                    {r.role_libelle ?? 'Intervenant'} <span className="text-xs text-sourdine font-normal">· {heure(r.created_at)}</span>
                    {r.latitude != null && (
                      <a href={lienItineraire(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="lien text-xs ml-2">
                        position ↗
                      </a>
                    )}
                  </p>
                  <dl className="mt-1 text-sm">
                    {CHAMPS_CAN.filter(([cle]) => r[cle]).map(([cle, lib]) => (
                      <div key={cle} className="flex gap-2">
                        <dt className="text-sourdine" style={{ minWidth: 84 }}>{lib}</dt>
                        <dd className="text-encre">{r[cle]}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}

          {photos.length > 0 && (
            <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((p) => (
                <li key={p.id} className="bg-surface border border-trait rounded overflow-hidden">
                  {urls[p.chemin] ? (
                    <a href={urls[p.chemin]} target="_blank" rel="noreferrer">
                      <img src={urls[p.chemin]} alt={p.legende ?? 'Photo du terrain'} loading="lazy" style={{ width: '100%', height: 140, objectFit: 'cover' }} />
                    </a>
                  ) : (
                    <div className="text-xs text-sourdine p-4 text-center">Photo indisponible</div>
                  )}
                  <div className="p-2">
                    {p.legende && <p className="text-xs text-encre">{p.legende}</p>}
                    <p className="text-xs text-sourdine">
                      {heure(p.created_at)}
                      {p.latitude != null && (
                        <>
                          {' · '}
                          <a href={lienItineraire(p.latitude, p.longitude)} target="_blank" rel="noreferrer" className="lien">
                            lieu ↗
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Comptages de personnes                                              */

const CATEGORIES = [
  ['evacues', 'Évacués'],
  ['accueillis', 'Accueillis'],
  ['blesses', 'Blessés'],
  ['personnes_a_risque', 'Personnes à risque'],
  ['introuvables', 'Introuvables'],
]

/**
 * Totaux de personnes remontés par le terrain : pour chaque personne et chaque catégorie on retient
 * le dernier chiffre, puis on additionne. Nombres seulement, jamais de noms.
 * Ce sont des déclarations de terrain, pas un recensement : deux équipes peuvent compter les mêmes personnes.
 */
export function SectionComptages({ incidentId }) {
  const [lignes, setLignes] = useState([])
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('comptages_personnes')
      .select('id, categorie, nombre, lieu_texte, auteur_id, created_at')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false })
    if (error) setErreur(error.message)
    else {
      setErreur(null)
      setLignes(data ?? [])
    }
  }, [incidentId])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 60000)
    return () => clearInterval(t)
  }, [charger])

  const vus = new Set()
  const retenus = []
  for (const l of lignes) {
    const k = `${l.categorie}|${l.auteur_id}`
    if (vus.has(k)) continue
    vus.add(k)
    retenus.push(l)
  }
  const totaux = Object.fromEntries(CATEGORIES.map(([c]) => [c, 0]))
  for (const l of retenus) totaux[l.categorie] = (totaux[l.categorie] ?? 0) + l.nombre
  const dernier = lignes[0]?.created_at

  return (
    <div>
      <h2 className="font-medium text-encre mb-1">Personnes comptées par le terrain</h2>
      <p className="text-xs text-sourdine mb-2">
        Dernier chiffre de chaque déclarant, additionnés. Déclarations de terrain : deux équipes peuvent compter les mêmes personnes.
      </p>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      {lignes.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">Aucun comptage remonté.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {CATEGORIES.map(([cle, lib]) => (
              <div key={cle} className="bg-surface border border-trait rounded p-3 text-center">
                <p className="text-2xl font-semibold text-encre">{totaux[cle]}</p>
                <p className="text-xs text-sourdine">{lib}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-sourdine mt-2">
            {retenus.length} déclaration{retenus.length > 1 ? 's' : ''} retenue{retenus.length > 1 ? 's' : ''} · dernière {ilYA(dernier)}
          </p>
        </>
      )}
    </div>
  )
}
