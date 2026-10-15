import { useCallback, useEffect, useState } from 'react'
import { ilYA, lienItineraire } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'

/**
 * Ce que le terrain remonte au CC : appels d'aide et comptages. Les rapports C.A.N. et les photos arrivent dans le livre de bord.
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
/* Demandes des disciplines (« je demande » des rapports C.A.N.)        */

const LIBELLE_SUITE = { a_traiter: 'à traiter', prise_en_compte: 'prise en compte' }

/**
 * Les « je demande » des rapports C.A.N. pas encore traités, avec leur suite (à traiter → prise en compte →
 * satisfaite ou écartée). Le Dir PC-Ops voit le même statut sur le terrain. N'affiche rien s'il n'y en a pas.
 */
export function BandeauDemandes({ incidentId }) {
  const [lignes, setLignes] = useState([])
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('rapports_can')
      .select('id, role_libelle, je_demande, suite_statut, created_at')
      .eq('incident_id', incidentId)
      .not('je_demande', 'is', null)
      .in('suite_statut', ['a_traiter', 'prise_en_compte'])
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) setErreur(error.message)
    else {
      setErreur(null)
      setLignes((data ?? []).filter((d) => d.je_demande?.trim()))
    }
  }, [incidentId])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 20000)
    return () => clearInterval(t)
  }, [charger])

  async function traiter(id, statut) {
    const { error } = await supabase.from('rapports_can').update({ suite_statut: statut }).eq('id', id)
    if (error) setErreur(error.message)
    else charger()
  }

  if (lignes.length === 0 && !erreur) return null

  return (
    <div className="mb-4 bg-surface border border-trait rounded p-3 space-y-2">
      <h2 className="font-medium text-encre">Demandes des équipes à traiter ({lignes.length})</h2>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <ul className="space-y-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {lignes.map((d) => (
          <li key={d.id} className="text-sm">
            <p className="text-encre">{d.je_demande}</p>
            <p className="text-xs text-sourdine">
              {d.role_libelle ?? 'intervenant'} · {ilYA(d.created_at)} · {LIBELLE_SUITE[d.suite_statut]}
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              {d.suite_statut === 'a_traiter' && (
                <button type="button" className="discret" onClick={() => traiter(d.id, 'prise_en_compte')}>Prise en compte</button>
              )}
              <button type="button" className="principal" onClick={() => traiter(d.id, 'satisfaite')}>Satisfaite</button>
              <button type="button" className="discret" onClick={() => traiter(d.id, 'ecartee')}>Écarter</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Comptages de personnes                                              */

export const CATEGORIES_COMPTAGE = [
  ['evacues', 'Évacués'],
  ['accueillis', 'Accueillis'],
  ['blesses', 'Blessés'],
  ['personnes_a_risque', 'Personnes à risque'],
  ['introuvables', 'Introuvables'],
]

/** Pour chaque déclarant et chaque catégorie on retient le dernier chiffre (lignes triées de la plus récente à la plus ancienne), puis on additionne. */
export function totauxComptages(lignes) {
  const vus = new Set()
  const retenus = []
  for (const l of lignes) {
    const k = `${l.categorie}|${l.auteur_id}`
    if (vus.has(k)) continue
    vus.add(k)
    retenus.push(l)
  }
  const totaux = Object.fromEntries(CATEGORIES_COMPTAGE.map(([c]) => [c, 0]))
  for (const l of retenus) totaux[l.categorie] = (totaux[l.categorie] ?? 0) + l.nombre
  return { retenus, totaux }
}

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

  const { retenus, totaux } = totauxComptages(lignes)
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
            {CATEGORIES_COMPTAGE.map(([cle, lib]) => (
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
