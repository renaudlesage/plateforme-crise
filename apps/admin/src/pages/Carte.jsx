import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarteCrise, SelecteurLocalisation } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

const COUCHES = [
  { cle: 'objets_a_risque', libelle: 'Objets à risque', couleur: '#dc5a3c', genre: 'Objet à risque', champNom: 'identification' },
  { cle: 'centres_accueil', libelle: "Centres d'accueil", couleur: '#2563eb', genre: "Centre d'accueil", champNom: 'nom' },
  { cle: 'sites_qg', libelle: 'Sites QG', couleur: '#7c3aed', genre: 'Site QG', champNom: 'nom' },
  { cle: 'infrastructures_critiques', libelle: 'Infrastructures critiques', couleur: '#b45309', genre: 'Infrastructure critique', champNom: 'nom' },
]

/**
 * Cartographie des référentiels — voir où tombent les coordonnées déjà
 * saisies à la main dans chaque module, avant d'envisager une édition
 * par clic sur la carte. Même composant partagé que la carte QG
 * (packages/shared/src/CarteCrise.jsx).
 */
export default function Carte() {
  const { contexteId } = useAuth()
  const [couches, setCouches] = useState(() => Object.fromEntries(COUCHES.map((c) => [c.cle, true])))
  const [points, setPoints] = useState({})
  const [sansPosition, setSansPosition] = useState([])
  const [aLocaliser, setALocaliser] = useState(null) // { table, id, libelle, genre }
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    setErreur(null)

    const sans = (table, colonnes) => supabase.from(table).select(colonnes).eq('contexte_id', contexteId).is('latitude', null)

    const [objets, centres, sites, infra, objSans, cenSans, sitSans, infSans] = await Promise.all([
      supabase.from('objets_a_risque').select('id, identification, categorie, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('centres_accueil').select('id, nom, type_lieu, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('sites_qg').select('id, nom, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('infrastructures_critiques').select('id, nom, type, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      sans('objets_a_risque', 'id, identification, categorie'),
      sans('centres_accueil', 'id, nom, type_lieu'),
      sans('sites_qg', 'id, nom'),
      sans('infrastructures_critiques', 'id, nom, type'),
    ])

    const premiereErreur = [objets, centres, sites, infra, objSans, cenSans, sitSans, infSans].find((r) => r.error)
    if (premiereErreur) {
      setErreur(premiereErreur.error.message)
      setChargement(false)
      return
    }

    setPoints({
      objets_a_risque: objets.data ?? [],
      centres_accueil: centres.data ?? [],
      sites_qg: sites.data ?? [],
      infrastructures_critiques: infra.data ?? [],
    })
    const versListe = (couche, lignes) =>
      (lignes ?? []).map((r) => ({
        table: couche.cle,
        id: r.id,
        libelle: r[couche.champNom] ?? couche.genre,
        genre: couche.genre,
        detail: r.categorie ?? r.type_lieu ?? r.type ?? null,
      }))
    setSansPosition([
      ...versListe(COUCHES[0], objSans.data),
      ...versListe(COUCHES[1], cenSans.data),
      ...versListe(COUCHES[2], sitSans.data),
      ...versListe(COUCHES[3], infSans.data),
    ])
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  const marqueurs = useMemo(() => {
    const tous = []
    for (const c of COUCHES) {
      if (!couches[c.cle]) continue
      for (const p of points[c.cle] ?? []) {
        tous.push({
          id: `${c.cle}-${p.id}`,
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          titre: p.identification ?? p.nom ?? c.libelle,
          sousTitre: p.categorie ?? p.type_lieu ?? p.type,
          couleur: c.couleur,
        })
      }
    }
    return tous
  }, [points, couches])

  const centre = useMemo(() => {
    if (marqueurs.length === 0) return CENTRE_BELGIQUE
    const lat = marqueurs.reduce((s, m) => s + m.lat, 0) / marqueurs.length
    const lon = marqueurs.reduce((s, m) => s + m.lon, 0) / marqueurs.length
    return { lat, lon }
  }, [marqueurs])

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Carte</h1>
      <p className="text-sm text-sourdine mb-3">
        Positionnement des référentiels géolocalisés de ce contexte. Les fiches sans
        coordonnées sont listées plus bas, sous la carte, pour être placées.
      </p>

      <div className="flex flex-wrap gap-3 mb-3">
        {COUCHES.map((c) => (
          <label key={c.cle} className="flex items-center gap-1.5 text-xs text-sourdine">
            <input
              type="checkbox"
              checked={couches[c.cle]}
              onChange={() => setCouches((prev) => ({ ...prev, [c.cle]: !prev[c.cle] }))}
            />
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c.couleur }} />
            {c.libelle} ({(points[c.cle] ?? []).length})
          </label>
        ))}
      </div>

      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : (
        <CarteCrise centre={centre} zoom={marqueurs.length ? 13 : 8} marqueurs={marqueurs} hauteur="65vh" />
      )}

      {!chargement && (
        <SectionALocaliser
          elements={sansPosition}
          choisi={aLocaliser}
          onChoisir={setALocaliser}
          onFini={() => {
            setALocaliser(null)
            charger()
          }}
        />
      )}
    </div>
  )
}

/**
 * Fiches de référentiel sans coordonnées. La localisation est un travail
 * d'administration (on connaît l'adresse, on la place) — elle ne se fait pas
 * dans l'app Terrain.
 */
function SectionALocaliser({ elements, choisi, onChoisir, onFini }) {
  const [lat, setLat] = useState(null)
  const [lon, setLon] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  function ouvrir(el) {
    setLat(null)
    setLon(null)
    setErreur(null)
    onChoisir(el)
  }

  async function enregistrer() {
    if (!choisi || lat == null || lon == null) return
    setEnCours(true)
    setErreur(null)
    const { error } = await supabase.from(choisi.table).update({ latitude: lat, longitude: lon }).eq('id', choisi.id)
    setEnCours(false)
    if (error) {
      setErreur(error.message)
      return
    }
    onFini()
  }

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-encre mb-1">À localiser ({elements.length})</h2>
      <p className="text-sm text-sourdine mb-3">
        Fiches sans coordonnées : elles n'apparaissent pas sur les cartes (QG, Terrain) tant qu'elles ne sont pas placées.
      </p>

      {elements.length === 0 ? (
        <p className="text-sm text-sourdine">Toutes les fiches de ce contexte sont localisées.</p>
      ) : (
        <ul className="space-y-1">
          {elements.map((el) => {
            const actif = choisi && choisi.table === el.table && choisi.id === el.id
            return (
              <li key={`${el.table}-${el.id}`} className="border border-trait rounded bg-surface p-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-encre">
                    {el.libelle} <span className="text-xs text-sourdine">· {el.genre}{el.detail ? ` · ${el.detail}` : ''}</span>
                  </span>
                  {actif ? (
                    <button type="button" className="discret" onClick={() => onChoisir(null)}>Annuler</button>
                  ) : (
                    <button type="button" className="discret" onClick={() => ouvrir(el)}>Localiser</button>
                  )}
                </div>
                {actif && (
                  <div className="mt-2 space-y-2">
                    <SelecteurLocalisation lat={lat} lon={lon} onChange={(la, lo) => { setLat(la); setLon(lo) }} />
                    {erreur && <p className="text-sm text-chaud">{erreur}</p>}
                    <button type="button" className="principal" disabled={lat == null || lon == null || enCours} onClick={enregistrer}>
                      {enCours ? 'Enregistrement…' : 'Enregistrer la position'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
