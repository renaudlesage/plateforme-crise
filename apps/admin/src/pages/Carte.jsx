import { useCallback, useEffect, useMemo, useState } from 'react'
import { CarteCrise } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const CENTRE_BELGIQUE = { lat: 50.5039, lon: 4.4699 }

const COUCHES = [
  { cle: 'objets_a_risque', libelle: 'Objets à risque', couleur: '#dc5a3c' },
  { cle: 'centres_accueil', libelle: "Centres d'accueil", couleur: '#2563eb' },
  { cle: 'sites_qg', libelle: 'Sites QG', couleur: '#7c3aed' },
  { cle: 'infrastructures_critiques', libelle: 'Infrastructures critiques', couleur: '#b45309' },
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
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    setErreur(null)

    const [objets, centres, sites, infra] = await Promise.all([
      supabase.from('objets_a_risque').select('id, identification, categorie, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('centres_accueil').select('id, nom, type_lieu, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('sites_qg').select('id, nom, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
      supabase.from('infrastructures_critiques').select('id, nom, type, latitude, longitude').eq('contexte_id', contexteId).not('latitude', 'is', null),
    ])

    const premiereErreur = [objets, centres, sites, infra].find((r) => r.error)
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
        Positionnement des référentiels géolocalisés de ce contexte. Un point manquant
        signale une fiche sans coordonnées renseignées.
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
    </div>
  )
}
