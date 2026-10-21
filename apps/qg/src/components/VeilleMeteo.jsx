import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  LIBELLE_CRITERE,
  LIBELLE_NIVEAU,
  NIVEAUX,
  SEUILS_DEFAUT,
  URL_PORTAIL_METEOALARM,
  heureBelge,
  ilYA,
  libelleCodeMeteo,
  quandMeteo,
  syntheseMeteo,
  urlOpenMeteo,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * Veille météo de la commune cliente (point = coordonnées de la commune, réglées dans Admin).
 *
 * - Prévisions Open-Meteo confrontées aux seuils et consignes de la commune (fixés à froid, avant le phénomène).
 * - Avertissement officiel IRM de la province, relayé par Meteoalarm : les deux se complètent, aucun ne remplace l'autre.
 * - Chaque franchissement de seuil est consigné seul dans le livre de bord des incidents ouverts ; DIFFUSER une
 *   alerte à la population reste un geste humain, fait ailleurs.
 *
 * Doctrine : on ne présente jamais l'absence de donnée comme « tout est vert » ; une prévision ancienne est
 * signalée comme telle ; la consignation automatique ne tourne que sur des données fraîches et des seuils enregistrés.
 */

export const COULEUR = { vert: '#2e7d32', jaune: '#b7950b', orange: '#e67e22', rouge: '#c0392b' }
const COULEUR_INCONNU = '#7f8c8d'
const FRAICHEUR_MAX_MS = 45 * 60 * 1000

export function Pastille({ niveau, children }) {
  const couleur = niveau ? COULEUR[niveau] : COULEUR_INCONNU
  return (
    <span
      style={{ background: couleur, color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      {children ?? LIBELLE_NIVEAU[niveau]}
    </span>
  )
}

export default function VeilleMeteo({ compact = false, autoJournal = true }) {
  const { contexteId, contexteActuel } = useAuth()
  const peutEcrire = ['ecriture', 'admin'].includes(contexteActuel?.niveau_acces)

  const [commune, setCommune] = useState(null)
  const [seuils, setSeuils] = useState(undefined) // undefined = chargement, null = pas encore enregistrés
  const [prev, setPrev] = useState(null) // { hourly, current }
  const [recuLe, setRecuLe] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [irm, setIrm] = useState(null) // { chargement } | { erreur } | données
  const [details, setDetails] = useState(!compact)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let vivant = true
    setCommune(null)
    setSeuils(undefined)
    setPrev(null)
    setRecuLe(null)
    if (!contexteId) return undefined
    Promise.all([
      supabase.from('contextes').select('nom, latitude, longitude, province').eq('id', contexteId).maybeSingle(),
      supabase.from('meteo_seuils').select('*').eq('contexte_id', contexteId).maybeSingle(),
    ]).then(([c, s]) => {
      if (!vivant) return
      setCommune(c.data ?? {})
      setSeuils(s.data ?? null)
    })
    return () => {
      vivant = false
    }
  }, [contexteId])

  const lat = commune?.latitude
  const lon = commune?.longitude
  const localisee = lat != null && lon != null

  const chargerPrevisions = useCallback(async () => {
    if (!localisee) return
    try {
      const r = await fetch(urlOpenMeteo(lat, lon))
      if (!r.ok) throw new Error(`Service météo indisponible (HTTP ${r.status})`)
      const d = await r.json()
      if (!d.hourly?.time) throw new Error('Réponse météo inattendue')
      setPrev({ hourly: d.hourly, current: d.current ?? null, decalage: d.utc_offset_seconds ?? null })
      setRecuLe(Date.now())
      setErreur(null)
    } catch (e) {
      setErreur(e?.message === 'Failed to fetch' ? 'Pas de réseau ou service météo injoignable' : (e?.message ?? 'Service météo injoignable'))
    }
  }, [lat, lon, localisee])

  useEffect(() => {
    chargerPrevisions()
    const t = setInterval(chargerPrevisions, 15 * 60 * 1000)
    return () => clearInterval(t)
  }, [chargerPrevisions])

  const province = commune?.province
  useEffect(() => {
    if (!province) {
      setIrm(null)
      return undefined
    }
    let vivant = true
    async function charger() {
      const { data, error } = await supabase.functions.invoke('irm-vigilance', { body: { province } })
      if (!vivant) return
      if (error || !data || data.erreur) setIrm({ erreur: true })
      else setIrm({ ...data, recuLe: Date.now() })
    }
    charger()
    const t = setInterval(charger, 10 * 60 * 1000)
    return () => {
      vivant = false
      clearInterval(t)
    }
  }, [province])

  const seuilsEffectifs = seuils ?? SEUILS_DEFAUT
  // `tick` fait recalculer « maintenant » chaque minute sans refaire d'appel réseau.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const synth = useMemo(() => (prev ? syntheseMeteo(prev.hourly, seuilsEffectifs, Date.now(), prev.decalage) : null), [prev, seuilsEffectifs, tick])
  const perime = recuLe != null && Date.now() - recuLe > FRAICHEUR_MAX_MS

  // Consignation des franchissements : seulement sur données fraîches, seuils enregistrés et droit d'écriture.
  const cle = synth?.cle
  useEffect(() => {
    if (!autoJournal || !peutEcrire || !synth || seuils == null || perime) return
    supabase
      .rpc('consigner_meteo', { p_contexte: contexteId, p_niveaux: synth.niveaux, p_motifs: synth.motifs })
      .then(({ error }) => {
        if (error) console.warn('Consignation météo impossible :', error.message)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, seuils, autoJournal, peutEcrire, perime, contexteId])

  if (!contexteId || commune == null || seuils === undefined) return null

  if (!localisee) {
    return (
      <div className="bg-surface border border-dashed border-trait rounded p-3 mb-4 text-sm text-sourdine">
        <span className="font-medium text-encre">Veille météo</span> — la commune n&apos;est pas localisée : aucune prévision n&apos;est possible.
        {' '}
        Renseigne sa position dans Admin → Anticipation → « Météo de la commune ».
      </div>
    )
  }

  const heures = synth?.evaluees ?? []
  const maintenant = heures[0]
  const cur = prev?.current
  const valeurs = cur
    ? { rafale: cur.wind_gusts_10m, pluie: cur.precipitation, temp: cur.temperature_2m, code: cur.weather_code }
    : maintenant
      ? { rafale: maintenant.rafale, pluie: maintenant.pluie, temp: maintenant.temp, code: maintenant.code }
      : null
  const pire = synth?.pire
  const declencheurs = Object.values(synth?.pireParCritere ?? {}).sort((a, b) => NIVEAUX[b.niveau] - NIVEAUX[a.niveau])
  const niveauIrm = irm && !irm.erreur && irm.niveau ? irm.niveau : null
  const sansDonnee = !synth

  return (
    <section
      className="bg-surface border rounded p-3 mb-4"
      style={{ borderColor: sansDonnee ? undefined : COULEUR[pire.niveau], borderWidth: pire?.niveau && pire.niveau !== 'vert' ? 2 : 1, opacity: perime ? 0.85 : 1 }}
      aria-label="Veille météo"
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="font-medium text-encre">
          Météo · {commune.nom ?? 'commune'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {sansDonnee ? (
            <Pastille niveau={null}>Prévision indisponible</Pastille>
          ) : (
            <>
              <Pastille niveau={pire.niveau}>Prévisions : {LIBELLE_NIVEAU[pire.niveau]}</Pastille>
              {synth.echeance && <span className="text-xs text-sourdine">{quandMeteo(synth.echeance)}</span>}
            </>
          )}
          {niveauIrm && <Pastille niveau={niveauIrm}>IRM : {LIBELLE_NIVEAU[niveauIrm]}</Pastille>}
          {irm?.erreur && <Pastille niveau={null}>IRM : indisponible</Pastille>}
          {compact && (
            <button type="button" className="discret" aria-expanded={details} onClick={() => setDetails((d) => !d)}>
              {details ? 'Réduire ▴' : 'Détails ▾'}
            </button>
          )}
        </div>
      </div>

      {erreur && (
        <p className="text-sm text-chaud mt-2" role="status">
          {sansDonnee
            ? `Prévision indisponible (${erreur}). L'absence d'alerte ne veut rien dire : consulter directement l'IRM.`
            : `Mise à jour impossible (${erreur}). Dernière prévision reçue ${ilYA(new Date(recuLe).toISOString())}.`}
        </p>
      )}
      {!erreur && perime && (
        <p className="text-sm text-chaud mt-2" role="status">Prévision reçue {ilYA(new Date(recuLe).toISOString())} : peut être dépassée.</p>
      )}

      {!details && valeurs && (
        <p className="text-sm text-sourdine mt-2">
          {Math.round(valeurs.rafale)} km/h en rafales · {Math.round(valeurs.temp)} °C
          {valeurs.pluie > 0 ? ` · pluie ${valeurs.pluie} mm/h` : ' · sec'}
          {libelleCodeMeteo(valeurs.code) ? ` · ${libelleCodeMeteo(valeurs.code).toLowerCase()}` : ''}
        </p>
      )}

      {declencheurs.length > 0 && (
        <div className="mt-3 space-y-2" role="alert">
          {declencheurs.map((d) => (
            <div key={d.critere} className="rounded p-2" style={{ borderLeft: `4px solid ${COULEUR[d.niveau]}`, background: 'rgba(127,127,127,0.08)' }}>
              <p className="text-sm text-encre">
                <Pastille niveau={d.niveau}>{LIBELLE_CRITERE[d.critere]}</Pastille>{' '}
                <span className="font-medium">{LIBELLE_NIVEAU[d.niveau]}</span> — {d.motif} · {quandMeteo(d.heure)}
              </p>
              {d.consigne ? (
                <p className="text-sm text-encre mt-1">→ {d.consigne}</p>
              ) : (
                <p className="text-xs text-sourdine mt-1 italic">
                  Aucune consigne préparée pour {LIBELLE_CRITERE[d.critere].toLowerCase()} — à compléter dans Admin.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {details && (
        <div className="mt-3 space-y-4">
          {valeurs && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="border border-trait rounded p-2">
                <p className="text-2xl font-semibold text-encre">{Math.round(valeurs.rafale)}</p>
                <p className="text-xs text-sourdine">km/h rafales · alerte à {seuilsEffectifs.rafale_vigilance_kmh ?? '—'}</p>
              </div>
              <div className="border border-trait rounded p-2">
                <p className="text-2xl font-semibold text-encre">{valeurs.pluie}</p>
                <p className="text-xs text-sourdine">mm/h · alerte à {seuilsEffectifs.pluie_vigilance_mm ?? '—'}</p>
              </div>
              <div className="border border-trait rounded p-2">
                <p className="text-2xl font-semibold text-encre">{Math.round(valeurs.temp)}°</p>
                <p className="text-xs text-sourdine">{libelleCodeMeteo(valeurs.code) || 'température'}</p>
              </div>
            </div>
          )}

          <BlocIrm irm={irm} province={province} />

          {heures.length > 0 && (
            <div>
              <p className="text-xs text-sourdine mb-1">Prochaines heures — rafales (km/h), température, pluie</p>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {heures.slice(0, 24).map((h) => (
                  <div
                    key={h.heure}
                    className="text-center rounded px-1 py-1 text-xs"
                    style={{ minWidth: 44, border: `1px solid ${COULEUR[h.niveau]}`, background: h.niveau === 'vert' ? 'transparent' : `${COULEUR[h.niveau]}22` }}
                    title={`${quandMeteo(h.heure)} — rafales ${Math.round(h.rafale)} km/h, ${Math.round(h.temp)} °C, ${h.pluie} mm/h`}
                  >
                    <div className="text-sourdine">{heureBelge(h.heure)} h</div>
                    <div className="font-semibold text-encre">{Math.round(h.rafale)}</div>
                    <div className="text-sourdine">{Math.round(h.temp)}°</div>
                    <div>{h.pluie > 0 ? (h.pluie >= 4 ? '💧💧' : '💧') : ' '}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-sourdine">
            {seuils == null ? (
              <>
                Seuils par défaut, <strong>non validés par la commune</strong> : la consignation automatique dans le livre de bord est inactive tant qu&apos;ils ne sont pas enregistrés dans Admin.{' '}
              </>
            ) : autoJournal && peutEcrire ? (
              <>Chaque franchissement de seuil (hausse, baisse, retour à la normale) se consigne seul dans le livre de bord des incidents ouverts. </>
            ) : (
              <>La consignation automatique est assurée par les écrans CC ouverts avec droit d&apos;écriture. </>
            )}
            Diffuser une alerte à la population reste une décision humaine, prise ailleurs. Cet écran ne surveille que lorsqu&apos;il est ouvert : aucune veille ne tourne en arrière-plan.
            Les seuils sont des repères de départ et ne remplacent pas l&apos;avis de l&apos;IRM, de la zone de secours ni le plan d&apos;urgence communal.
            Prévisions : Open-Meteo{recuLe ? ` · reçues ${ilYA(new Date(recuLe).toISOString())}` : ''}.
          </p>
        </div>
      )}
    </section>
  )
}

function BlocIrm({ irm, province }) {
  if (!province) {
    return (
      <p className="text-xs text-sourdine border border-dashed border-trait rounded p-2">
        Avertissement officiel IRM : renseigne la province de la commune dans Admin → « Météo de la commune » pour l&apos;afficher ici.
      </p>
    )
  }
  if (!irm) return <p className="text-xs text-sourdine">Avertissement officiel IRM : consultation en cours…</p>
  if (irm.erreur) {
    return (
      <p className="text-sm text-chaud border border-trait rounded p-2">
        Avertissement officiel IRM indisponible (relais Meteoalarm injoignable). L&apos;absence d&apos;information n&apos;est pas une absence d&apos;avertissement :{' '}
        <a className="underline" href={URL_PORTAIL_METEOALARM} target="_blank" rel="noreferrer">
          consulter meteoalarm.org ↗
        </a>
      </p>
    )
  }
  return (
    <div className="border border-trait rounded p-2" style={{ borderLeft: `4px solid ${COULEUR[irm.niveau] ?? COULEUR_INCONNU}` }}>
      <p className="text-sm text-encre">
        <span className="font-medium">Avertissement officiel IRM — {province}</span> <Pastille niveau={irm.niveau} />
      </p>
      {irm.avertissements?.length > 0 ? (
        <ul className="text-sm text-encre mt-1 space-y-0.5">
          {irm.avertissements.map((a, i) => (
            <li key={`${a.zone}-${a.evenement}-${i}`}>
              <strong>{LIBELLE_NIVEAU[a.niveau] ?? a.niveau}</strong> — {a.evenement} ({a.zone})
              {a.debut_le && <span className="text-sourdine"> · dès {new Date(a.debut_le).toLocaleString('fr-BE', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-sourdine mt-1">
          Aucun avertissement trouvé pour {province} dans le flux ({irm.total_pays ?? 0} avertissement{irm.total_pays > 1 ? 's' : ''} sur le pays).
        </p>
      )}
      <p className="text-xs text-sourdine mt-1">
        Via Meteoalarm (relais des services météo nationaux, dont l&apos;IRM) ·{' '}
        <a className="underline" href={irm.lien ?? URL_PORTAIL_METEOALARM} target="_blank" rel="noreferrer">
          voir meteoalarm.org ↗
        </a>
      </p>
    </div>
  )
}
