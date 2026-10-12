import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { heuresDepuis, ilYA } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { SectionComptages } from './RemonteesTerrain'

/**
 * « Maintenant » : le point de situation d'un incident sur un seul écran, en lecture.
 * Rien ne se décide ici : chaque carte renvoie vers l'onglet où l'on agit.
 * Rafraîchi toutes les 30 s. Les appels d'aide, plus urgents que tout, restent dans le bandeau au-dessus des onglets.
 */

const SEUIL_RELEVE_H = 4
const LIBELLE_ZONE = { rouge: 'rouge', orange: 'orange', jaune: 'jaune' }
const LIBELLE_POINT = {
  danger: 'danger',
  route_coupee: 'route coupée',
  inondation: 'inondation',
  degats: 'dégâts',
  victimes: 'victimes',
  besoin: 'besoin',
  point_rassemblement: 'point de rassemblement',
  acces: 'accès',
  autre: 'autre',
}

const heure = (d) => new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Carte({ titre, aller, libelleAller = 'Ouvrir', alerte = false, children }) {
  return (
    <div className={`bg-surface border rounded p-3 ${alerte ? 'border-chaud' : 'border-trait'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-sm font-medium text-encre">{titre}</h3>
        {aller}
      </div>
      <div className="text-sm text-encre">{children}</div>
    </div>
  )
}

const Vide = ({ children }) => <p className="text-xs text-sourdine">{children}</p>

export default function SyntheseIncident({ incidentId, contexteId, onAller }) {
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    const depuisEquipes = new Date(Date.now() - 2 * 3600000).toISOString()
    const [sitrep, decisions, moyens, points, zones, journal, equipes, requisitions] = await Promise.all([
      supabase.from('sitreps').select('numero, horodatage, canal_conditions, canal_actions, canal_besoins, canal_anticipation').eq('incident_id', incidentId).order('numero', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('declenchements_seuils_action').select('id, horodatage_declenchement, seuils_action(libelle)').eq('incident_id', incidentId).eq('statut', 'en_attente').order('horodatage_declenchement'),
      supabase.from('moyens_engages').select('id, libelle, statut, effectif, created_at').eq('incident_id', incidentId).neq('statut', 'retire'),
      supabase.from('observations_terrain').select('id, type').eq('incident_id', incidentId).eq('statut', 'ouvert'),
      supabase.from('zones_intervention').select('id, type_zone').eq('incident_id', incidentId).is('date_levee', null),
      supabase.from('livre_de_bord').select('id, numero_ordre, horodatage, message, decision').eq('incident_id', incidentId).order('numero_ordre', { ascending: false }).limit(5),
      supabase.from('positions_equipes').select('id', { count: 'exact', head: true }).eq('incident_id', incidentId).gte('maj_le', depuisEquipes),
      supabase.from('requisitions').select('id', { count: 'exact', head: true }).eq('incident_id', incidentId).eq('statut', 'actif'),
    ])
    const premiere = [sitrep, decisions, moyens, points, zones, journal].find((r) => r.error)
    setErreur(premiere ? premiere.error.message : null)
    setD({
      sitrep: sitrep.data,
      decisions: decisions.data ?? [],
      moyens: moyens.data ?? [],
      points: points.data ?? [],
      zones: zones.data ?? [],
      journal: journal.data ?? [],
      equipes: equipes.count ?? 0,
      requisitions: requisitions.count ?? 0,
    })
  }, [incidentId])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  if (!d) return <p className="text-sm text-sourdine">Chargement…</p>

  const lien = (cle, texte = 'Ouvrir →') => (
    <button type="button" className="lien text-xs" onClick={() => onAller(cle)}>
      {texte}
    </button>
  )

  const sur = d.moyens.filter((m) => m.statut === 'sur_place')
  const enRoute = d.moyens.filter((m) => m.statut === 'en_route')
  const effectif = d.moyens.reduce((s, m) => s + (m.effectif ?? 0), 0)
  const alreleve = d.moyens.filter((m) => (m.statut === 'sur_place' || m.statut === 'en_route') && heuresDepuis(m.created_at) >= SEUIL_RELEVE_H)

  const parType = (liste, cle, libelles) => {
    const n = {}
    for (const x of liste) n[x[cle]] = (n[x[cle]] ?? 0) + 1
    return Object.entries(n).map(([k, v]) => `${v} ${libelles?.[k] ?? k}`).join(' · ')
  }

  const s = d.sitrep

  return (
    <div className="space-y-4">
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Carte titre="Décisions en attente" aller={lien('pilotage')} alerte={d.decisions.length > 0}>
          {d.decisions.length === 0 ? (
            <Vide>Aucun seuil d'action en attente de décision.</Vide>
          ) : (
            <ul className="space-y-1">
              {d.decisions.slice(0, 4).map((x) => (
                <li key={x.id}>
                  {x.seuils_action?.libelle ?? 'Seuil'} <span className="text-xs text-sourdine">· déclenché {ilYA(x.horodatage_declenchement)}</span>
                </li>
              ))}
              {d.decisions.length > 4 && <li className="text-xs text-sourdine">et {d.decisions.length - 4} autre(s)</li>}
            </ul>
          )}
        </Carte>

        <Carte titre="Dernier SitRep" aller={lien('journal')}>
          {!s ? (
            <Vide>Aucun SitRep établi.</Vide>
          ) : (
            <>
              <p className="text-xs text-sourdine mb-1">
                n°{s.numero} · {heure(s.horodatage)} ({ilYA(s.horodatage)})
              </p>
              <dl className="space-y-0.5">
                {[
                  ['Conditions', s.canal_conditions],
                  ['Actions', s.canal_actions],
                  ['Besoins', s.canal_besoins],
                  ['Anticipation', s.canal_anticipation],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-xs text-sourdine" style={{ minWidth: 76 }}>{k}</dt>
                      <dd className="text-xs" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v}</dd>
                    </div>
                  ))}
              </dl>
            </>
          )}
        </Carte>

        <Carte
          titre="Moyens engagés"
          aller={<Link to="/carte" className="lien text-xs">Carte →</Link>}
          alerte={alreleve.length > 0}
        >
          {d.moyens.length === 0 ? (
            <Vide>Aucun moyen engagé.</Vide>
          ) : (
            <>
              <p>
                {sur.length} sur place · {enRoute.length} en route
                {effectif > 0 && <span className="text-xs text-sourdine"> · {effectif} pers.</span>}
              </p>
              {alreleve.length > 0 && (
                <p className="text-xs text-chaud mt-1">
                  À relever ? {alreleve.map((m) => m.libelle).slice(0, 3).join(', ')}
                  {alreleve.length > 3 ? '…' : ''} (engagé depuis {SEUIL_RELEVE_H} h ou plus)
                </p>
              )}
            </>
          )}
        </Carte>

        <Carte titre="Terrain" aller={lien('operations')}>
          <ul className="space-y-0.5">
            <li>
              <span className="text-xs text-sourdine">Zones : </span>
              {d.zones.length ? parType(d.zones, 'type_zone', LIBELLE_ZONE) : <span className="text-xs text-sourdine">aucune</span>}
            </li>
            <li>
              <span className="text-xs text-sourdine">Points ouverts : </span>
              {d.points.length ? parType(d.points, 'type', LIBELLE_POINT) : <span className="text-xs text-sourdine">aucun</span>}
            </li>
            <li>
              <span className="text-xs text-sourdine">Équipes qui partagent leur position : </span>
              {d.equipes}
            </li>
            <li>
              <span className="text-xs text-sourdine">Réquisitions actives : </span>
              {d.requisitions}
            </li>
          </ul>
        </Carte>
      </div>

      <Carte titre="Derniers événements du journal" aller={lien('journal')}>
        {d.journal.length === 0 ? (
          <Vide>Journal vide.</Vide>
        ) : (
          <ul className="space-y-1">
            {d.journal.map((j) => (
              <li key={j.id} className="flex gap-2">
                <span className="text-xs text-sourdine" style={{ minWidth: 104 }}>{heure(j.horodatage)}</span>
                <span className="text-xs" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {j.message}
                  {j.decision && <span className="jeton ml-1">décision</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <SectionComptages incidentId={incidentId} />
    </div>
  )
}
