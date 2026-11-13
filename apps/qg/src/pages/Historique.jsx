import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CarteCrise,
  grilleDensite,
  incidentsCsv,
  incidentsGeoJson,
  statistiquesIncidents,
  texteErreur,
  useCouchesCarte,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret } from '../components/Boutons'
import { telecharger } from '../lib/telechargement'

/**
 * Historique des incidents de la commune (C6, idée reprise de Kalisio Crisis ; aucun code repris) : période,
 * statistiques, carte des lieux ou de densité, liste, exports CSV et GeoJSON pour le RETEX et le rapport annuel.
 * Rien de neuf en base : lecture des incidents, avec les droits habituels.
 */

const PERIODES = [
  { cle: '12m', libelle: '12 derniers mois', mois: 12 },
  { cle: '36m', libelle: '3 ans', mois: 36 },
  { cle: 'tout', libelle: 'Tout', mois: null },
]

const LIBELLE_STATUT = { pre_alerte: 'pré-alerte', en_cours: 'en cours', cloture: 'clos' }

function depuis(mois) {
  if (!mois) return null
  const d = new Date()
  d.setMonth(d.getMonth() - mois)
  return d.toISOString()
}

export default function Historique() {
  const { contexteId, contexteActuel } = useAuth()
  const [periode, setPeriode] = useState('12m')
  const [avecExercices, setAvecExercices] = useState(false)
  const [type, setType] = useState('')
  const [vue, setVue] = useState('points')
  const [incidents, setIncidents] = useState([])
  const [erreur, setErreur] = useState(null)
  const [chargement, setChargement] = useState(true)
  const couches = useCouchesCarte(supabase, contexteId, 'qg')

  const charger = useCallback(async () => {
    setChargement(true)
    let q = supabase
      .from('incidents')
      .select('id, nom, type_evenement, statut, date_debut, date_fin, degre_criticite, phase_cycle_vie, est_exercice, latitude, longitude')
      .eq('contexte_id', contexteId)
      .order('date_debut', { ascending: false })
      .limit(2000)
    const d = depuis(PERIODES.find((p) => p.cle === periode)?.mois)
    if (d) q = q.gte('date_debut', d)
    if (!avecExercices) q = q.eq('est_exercice', false)
    const { data, error } = await q
    setChargement(false)
    if (error) setErreur(texteErreur(error))
    else {
      setErreur(null)
      setIncidents(data ?? [])
    }
  }, [contexteId, periode, avecExercices])

  useEffect(() => {
    charger()
  }, [charger])

  const filtres = useMemo(() => (type ? incidents.filter((i) => (i.type_evenement?.trim() || 'non précisé') === type) : incidents), [incidents, type])
  const s = useMemo(() => statistiquesIncidents(filtres), [filtres])
  const types = useMemo(() => statistiquesIncidents(incidents).parType, [incidents])
  const localises = filtres.filter((i) => i.latitude != null && i.longitude != null)
  const centre = localises.length
    ? { lat: localises.reduce((a, i) => a + Number(i.latitude), 0) / localises.length, lon: localises.reduce((a, i) => a + Number(i.longitude), 0) / localises.length }
    : { lat: Number(contexteActuel?.contextes?.latitude) || 50.5, lon: Number(contexteActuel?.contextes?.longitude) || 4.7 }
  const densite = useMemo(() => grilleDensite(filtres), [filtres])
  const maxDensite = densite[0]?.n ?? 1
  const base = `incidents-${new Date().toISOString().slice(0, 10)}`

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Historique des incidents</h1>
      <p className="text-sm text-sourdine mb-3">
        Pour le retour d’expérience et le rapport annuel : combien, quoi, où, combien de temps. Les exercices sont exclus par défaut.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Filtres">
        {PERIODES.map((p) => (
          <button key={p.cle} type="button" className={periode === p.cle ? 'principal' : 'discret'} aria-pressed={periode === p.cle} onClick={() => setPeriode(p.cle)}>
            {p.libelle}
          </button>
        ))}
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type d’événement">
          <option value="">Tous les types</option>
          {types.map((t) => <option key={t.cle} value={t.cle}>{t.cle} ({t.n})</option>)}
        </select>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={avecExercices} onChange={(e) => setAvecExercices(e.target.checked)} /> inclure les exercices
        </label>
        <div className="flex-1" />
        <BoutonDiscret disabled={filtres.length === 0} onClick={() => telecharger(`${base}.csv`, incidentsCsv(filtres))}>Exporter CSV</BoutonDiscret>
        <BoutonDiscret disabled={localises.length === 0} onClick={() => telecharger(`${base}.geojson`, incidentsGeoJson(filtres), 'application/geo+json')}>
          Exporter GeoJSON
        </BoutonDiscret>
      </div>

      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}
      {chargement && <p className="text-sm text-sourdine">Chargement…</p>}
      {incidents.length >= 2000 && <p className="text-xs text-chaud mb-2">Affichage limité aux 2 000 incidents les plus récents : réduisez la période.</p>}

      {!chargement && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Tuile valeur={s.total} libelle="incidents" />
            <Tuile valeur={s.ouverts} libelle="encore ouverts" />
            <Tuile valeur={s.dureeMedianeHeures === null ? '—' : dureeLisible(s.dureeMedianeHeures)} libelle="durée médiane (clos)" />
            <Tuile valeur={`${s.localises}/${s.total}`} libelle="localisés" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <section>
              <h2 className="text-sm font-semibold text-encre mb-2">Par type d’événement</h2>
              {s.parType.length === 0 ? <p className="text-sm text-sourdine">Aucun incident sur la période.</p> : <BarresHorizontales lignes={s.parType} />}
            </section>
            <section>
              <h2 className="text-sm font-semibold text-encre mb-2">Par mois (début de l’incident)</h2>
              {s.parMois.length === 0 ? <p className="text-sm text-sourdine">Aucun incident sur la période.</p> : <BarresMois lignes={s.parMois} />}
            </section>
          </div>

          <section className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-encre">Carte</h2>
              <div className="flex gap-1" role="group" aria-label="Affichage de la carte">
                <button type="button" className={vue === 'points' ? 'principal' : 'discret'} aria-pressed={vue === 'points'} onClick={() => setVue('points')}>Lieux</button>
                <button type="button" className={vue === 'densite' ? 'principal' : 'discret'} aria-pressed={vue === 'densite'} onClick={() => setVue('densite')}>Densité</button>
              </div>
            </div>
            {localises.length === 0 ? (
              <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">Aucun incident localisé sur la période.</p>
            ) : (
              <CarteCrise
                couches={couches}
                centre={centre}
                zoom={12}
                hauteur="380px"
                ajusterSur={localises.map((i) => ({ lat: Number(i.latitude), lon: Number(i.longitude) }))}
                marqueurs={
                  vue === 'points'
                    ? localises.map((i) => ({
                        id: i.id,
                        lat: Number(i.latitude),
                        lon: Number(i.longitude),
                        titre: i.nom,
                        sousTitre: `${i.type_evenement ?? ''} · ${new Date(i.date_debut).toLocaleDateString('fr-BE')}${i.est_exercice ? ' · exercice' : ''}`,
                        couleur: i.est_exercice ? '#64748b' : '#c2410c',
                      }))
                    : []
                }
                cercles={
                  vue === 'densite'
                    ? densite.map((m, k) => ({
                        id: `d${k}`,
                        lat: m.lat,
                        lon: m.lon,
                        // Surface proportionnelle au nombre : rayon en racine carrée, 600 m pour la maille la plus chargée.
                        rayonM: Math.max(120, 600 * Math.sqrt(m.n / maxDensite)),
                        couleur: '#c2410c',
                        libelle: `${m.n} incident${m.n > 1 ? 's' : ''} dans cette maille (≈ 1 km)`,
                      }))
                    : []
                }
              />
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-encre mb-2">Incidents ({filtres.length})</h2>
            {filtres.length === 0 ? (
              <p className="text-sm text-sourdine">Aucun incident.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-sourdine border-b border-trait">
                      <th className="py-1 pr-2">Début</th>
                      <th className="py-1 pr-2">Nom</th>
                      <th className="py-1 pr-2">Type</th>
                      <th className="py-1 pr-2">Degré</th>
                      <th className="py-1 pr-2">Durée</th>
                      <th className="py-1">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtres.map((i) => {
                      const h = i.date_fin ? (Date.parse(i.date_fin) - Date.parse(i.date_debut)) / 3600000 : null
                      return (
                        <tr key={i.id} className="border-b border-trait">
                          <td className="py-1 pr-2 whitespace-nowrap">{new Date(i.date_debut).toLocaleDateString('fr-BE')}</td>
                          <td className="py-1 pr-2">
                            <Link to={`/incidents/${i.id}`} className="lien">{i.nom}</Link>
                            {i.est_exercice && <span className="jeton ml-1">exercice</span>}
                          </td>
                          <td className="py-1 pr-2">{i.type_evenement ?? '—'}</td>
                          <td className="py-1 pr-2">{i.degre_criticite ?? '—'}</td>
                          <td className="py-1 pr-2 whitespace-nowrap">{h === null || h < 0 ? '—' : dureeLisible(h)}</td>
                          <td className="py-1">{LIBELLE_STATUT[i.statut] ?? i.statut}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function dureeLisible(h) {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${Math.round(h * 10) / 10} h`.replace('.', ',')
  return `${Math.round(h / 24)} j`
}

function Tuile({ valeur, libelle }) {
  return (
    <div className="border border-trait rounded p-3 bg-surface">
      <p className="text-2xl font-semibold text-encre tabular-nums">{valeur}</p>
      <p className="text-xs text-sourdine">{libelle}</p>
    </div>
  )
}

/** Une seule série : une teinte, barres fines, valeur en encre de texte à côté (lisible sans la couleur). */
function BarresHorizontales({ lignes }) {
  const max = Math.max(...lignes.map((l) => l.n), 1)
  return (
    <ul className="space-y-1.5">
      {lignes.slice(0, 12).map((l) => (
        <li key={l.cle} className="grid items-center gap-2 text-sm" style={{ gridTemplateColumns: 'minmax(6rem, 10rem) 1fr 2.5rem' }} title={`${l.cle} : ${l.n}`}>
          <span className="truncate text-encre">{l.cle}</span>
          <span className="text-info" style={{ display: 'block', height: 10 }}>
            <span style={{ display: 'block', height: '100%', width: `${(l.n / max) * 100}%`, minWidth: 2, background: 'currentColor', borderRadius: '0 4px 4px 0' }} />
          </span>
          <span className="text-right tabular-nums text-sourdine">{l.n}</span>
        </li>
      ))}
      {lignes.length > 12 && <li className="text-xs text-sourdine">… {lignes.length - 12} autre(s) type(s) : voir l’export.</li>}
    </ul>
  )
}

function BarresMois({ lignes }) {
  const max = Math.max(...lignes.map((l) => l.n), 1)
  const pic = lignes.reduce((a, l) => (l.n > a.n ? l : a), lignes[0])
  const libelleMois = (cle) => new Date(`${cle}-01T12:00:00`).toLocaleDateString('fr-BE', { month: 'short', year: '2-digit' })
  return (
    <div>
      <div className="flex items-end text-info" style={{ height: 120, gap: 2 }} role="img" aria-label={`Incidents par mois, pic de ${pic.n} en ${libelleMois(pic.cle)}`}>
        {lignes.map((l) => (
          <div key={l.cle} title={`${libelleMois(l.cle)} : ${l.n}`} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default' }}>
            <div style={{ width: '100%', height: `${(l.n / max) * 100}%`, minHeight: l.n ? 2 : 0, background: 'currentColor', borderRadius: '4px 4px 0 0' }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-sourdine mt-1">
        <span>{libelleMois(lignes[0].cle)}</span>
        <span>pic : {pic.n} en {libelleMois(pic.cle)}</span>
        <span>{libelleMois(lignes[lignes.length - 1].cle)}</span>
      </div>
    </div>
  )
}
