import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret } from '../components/Boutons'
import { useIncidentsEnCours, SelecteurIncident } from '../hooks/useIncidentsEnCours'

const LIBELLE_PHASE = {
  veille: 'Veille',
  vigilance: 'Vigilance',
  pre_alerte: 'Pré-alerte',
  alerte: 'Alerte',
  phase_active: 'Phase active',
  levee: 'Levée',
  post_crise: 'Post-crise',
}

const heure = (d) => new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/**
 * Situation : ce que le QG sait et décide, vu du terrain. Lecture seule,
 * rafraîchie toutes les 30 s (et à la demande). Rien de plus que ce dont
 * on a besoin debout sur place : où en est-on, qui est où, qu'a-t-on dit
 * à la population, que se passe-t-il dans le journal.
 */
export default function Situation() {
  const { contexteId } = useAuth()
  const { incidents, incident, choisir, chargement: chargementIncidents, recharger } = useIncidentsEnCours(contexteId)
  const [donnees, setDonnees] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [majLe, setMajLe] = useState(null)

  const charger = useCallback(async () => {
    if (!incident) return
    const id = incident.id
    const [niveau, siteQg, sitrep, zones, alertes, pcops, journal, points] = await Promise.all([
      incident.niveau_actuel_id
        ? supabase.from('niveaux_escalade').select('code, libelle').eq('id', incident.niveau_actuel_id).maybeSingle()
        : Promise.resolve({ data: null }),
      incident.site_qg_actuel_id
        ? supabase.from('sites_qg').select('nom, adresse').eq('id', incident.site_qg_actuel_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('sitreps').select('*').eq('incident_id', id).order('numero', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('zones_intervention').select('id, type_zone, perimetre, acces_autorise, rayon_metres').eq('incident_id', id).is('date_levee', null),
      supabase.from('alertes_publiques').select('id, titre, message, consignes, niveau_alerte, date_publication, date_expiration, actif').eq('incident_id', id).eq('actif', true).order('date_publication', { ascending: false }),
      supabase.from('pc_ops_roles').select('id, role, personne, contact').eq('incident_id', id).eq('actif', true),
      supabase.from('livre_de_bord').select('id, numero_ordre, horodatage, message, decision').eq('incident_id', id).order('numero_ordre', { ascending: false }).limit(8),
      supabase.from('observations_terrain').select('id, type, description, created_at').eq('incident_id', id).eq('statut', 'ouvert').order('created_at', { ascending: false }),
    ])
    const premiere = [niveau, siteQg, sitrep, zones, alertes, pcops, journal, points].find((r) => r.error)
    setErreur(premiere ? premiere.error.message : null)
    setDonnees({
      niveau: niveau.data,
      siteQg: siteQg.data,
      sitrep: sitrep.data,
      zones: zones.data ?? [],
      alertes: (alertes.data ?? []).filter((a) => !a.date_expiration || new Date(a.date_expiration) > new Date()),
      pcops: pcops.data ?? [],
      journal: journal.data ?? [],
      points: points.data ?? [],
    })
    setMajLe(new Date())
  }, [incident])

  useEffect(() => {
    setDonnees(null)
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  if (chargementIncidents) return <p className="vide text-center mt-6">Chargement…</p>

  if (!incident) {
    return (
      <p className="vide border border-dashed border-trait text-center p-6">
        Aucun incident en cours pour ce contexte actuellement.
      </p>
    )
  }

  const d = donnees

  return (
    <div className="space-y-5">
      <SelecteurIncident incidents={incidents} incident={incident} onChoisir={choisir} />

      <div className="bandeau-alerte niv-urgence">
        <div className="niv">Incident</div>
        <div className="contenu">
          <p className="consigne">
            {incident.nom}
            {incident.degre_criticite != null && <span className="jeton text-chaud ml-2">degré {incident.degre_criticite}</span>}
            {incident.phase_cycle_vie && <span className="jeton ml-2">{LIBELLE_PHASE[incident.phase_cycle_vie] ?? incident.phase_cycle_vie}</span>}
          </p>
          <p className="msg">
            {[incident.type_evenement, d?.niveau && `niveau ${d.niveau.libelle ?? d.niveau.code}`, `depuis le ${heure(incident.date_debut)}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {d?.siteQg && (
            <p className="msg">
              QG : {d.siteQg.nom}
              {d.siteQg.adresse ? ` — ${d.siteQg.adresse}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-sourdine">{majLe ? `Mis à jour à ${majLe.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}` : 'Chargement…'}</p>
        <BoutonDiscret onClick={() => { recharger(); charger() }}>Actualiser</BoutonDiscret>
      </div>

      {erreur && <p className="message erreur">{erreur}</p>}

      {d && (
        <>
          <Bloc titre="Messages à la population en cours" vide="Aucun message actif." items={d.alertes}>
            {(a) => (
              <li key={a.id} className="carte">
                <p className="text-sm font-medium text-encre">
                  {a.titre} <span className="jeton">{a.niveau_alerte}</span>
                </p>
                <p className="text-sm text-sourdine mt-1">{a.message}</p>
                {a.consignes && <p className="text-xs text-sourdine mt-1">consignes : {a.consignes}</p>}
                <p className="text-xs text-sourdine mt-1">publié {heure(a.date_publication)}</p>
              </li>
            )}
          </Bloc>

          <Bloc titre="Zones d'intervention" vide="Aucune zone active." items={d.zones}>
            {(z) => (
              <li key={z.id} className="carte">
                <p className="text-sm font-medium text-encre">
                  {z.type_zone}
                  {z.rayon_metres ? <span className="text-xs text-sourdine ml-2">rayon {Math.round(z.rayon_metres)} m</span> : null}
                </p>
                <p className="text-sm text-sourdine mt-1">{z.perimetre}</p>
                {z.acces_autorise && <p className="text-xs text-sourdine mt-1">accès : {z.acces_autorise}</p>}
              </li>
            )}
          </Bloc>

          <div>
            <h2>Dernier SitRep</h2>
            {d.sitrep ? (
              <div className="carte">
                <p className="text-sm font-medium text-encre">
                  n°{d.sitrep.numero} · {heure(d.sitrep.horodatage)}
                  {d.sitrep.type_incident ? ` · ${d.sitrep.type_incident}` : ''}
                </p>
                <p className="text-xs text-sourdine mt-1">
                  Victimes — U0 : {d.sitrep.victimes_u0 ?? 0} · U1 : {d.sitrep.victimes_u1 ?? 0} · U2 : {d.sitrep.victimes_u2 ?? 0} · U3 : {d.sitrep.victimes_u3 ?? 0}
                </p>
                {d.sitrep.mesures_reflexes && <p className="text-sm text-sourdine mt-1">{d.sitrep.mesures_reflexes}</p>}
                {[['Incident', d.sitrep.localisation_incident], ['PC-Ops', d.sitrep.localisation_pc_ops], ['PMA', d.sitrep.localisation_pma], ['PPD', d.sitrep.localisation_ppd]]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <p key={k} className="text-xs text-sourdine mt-1">{k} : {v}</p>
                  ))}
              </div>
            ) : (
              <p className="vide">Aucun SitRep.</p>
            )}
          </div>

          <Bloc titre="PC-Ops" vide="Aucun rôle PC-Ops actif." items={d.pcops}>
            {(r) => (
              <li key={r.id} className="carte">
                <p className="text-sm text-encre">
                  {r.role}
                  {r.personne ? ` — ${r.personne}` : ''}
                </p>
                {r.contact && (
                  <p className="text-xs mt-1">
                    <a href={`tel:${r.contact.replace(/\s+/g, '')}`}>{r.contact}</a>
                  </p>
                )}
              </li>
            )}
          </Bloc>

          <Bloc titre="Points terrain ouverts" vide="Aucun point ouvert." items={d.points}>
            {(p) => (
              <li key={p.id} className="carte">
                <p className="text-sm text-encre">
                  {p.type.replace('_', ' ')} <span className="text-xs text-sourdine">· {heure(p.created_at)}</span>
                </p>
                {p.description && <p className="text-xs text-sourdine mt-1">{p.description}</p>}
              </li>
            )}
          </Bloc>

          <Bloc titre="Journal de bord (récent)" vide="Aucune entrée." items={d.journal}>
            {(e) => (
              <li key={e.id} className="carte">
                <p className="text-xs text-sourdine">#{e.numero_ordre} · {heure(e.horodatage)}</p>
                <p className="text-sm text-encre mt-1">{e.message}</p>
                {e.decision && <p className="text-xs text-sourdine mt-1">décision : {e.decision}</p>}
              </li>
            )}
          </Bloc>
        </>
      )}
    </div>
  )
}

function Bloc({ titre, vide, items, children }) {
  return (
    <div>
      <h2>{titre}</h2>
      {items.length === 0 ? <p className="vide">{vide}</p> : <ul className="space-y-2">{items.map(children)}</ul>}
    </div>
  )
}
