import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CarteCrise, distanceM, ilYA } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { CATEGORIES_COMPTAGE, totauxComptages } from '../components/RemonteesTerrain'
import VeilleMeteo from '../components/VeilleMeteo'

/**
 * Vue autorité : le point de situation d'un incident sur une seule page, en lecture, pour le bourgmestre
 * (ou toute personne qui doit décider sans avoir à fouiller). Rien ne se décide ici sauf une chose :
 * noter qui a été informé. Rafraîchie toutes les 30 s, et dit clairement quand elle ne l'est plus.
 *
 * Doctrine : on ne présente jamais un état périmé comme s'il était à jour ; les chiffres de personnes
 * sont des déclarations de terrain (nombres seulement), pas un recensement.
 */

const PARTIES = [
  { cle: 'gouverneur', libelle: 'Gouverneur de la province' },
  { cle: 'cc_prov', libelle: 'Comité de coordination provincial' },
  { cle: 'nccn', libelle: 'Centre de crise national (NCCN)' },
  { cle: 'zone_secours', libelle: 'Zone de secours' },
  { cle: 'police', libelle: 'Police' },
]

const COULEUR_ZONE = { rouge: '#c0392b', orange: '#e67e22', jaune: '#d4ac0d' }
const LIBELLE_ZONE = { rouge: 'rouge', orange: 'orange', jaune: 'jaune' }
const LIBELLE_STATUT = { en_cours: 'en cours', pre_alerte: 'pré-alerte' }
const LIBELLE_PHASE = {
  veille: 'Veille',
  vigilance: 'Vigilance',
  pre_alerte: 'Pré-alerte',
  alerte: 'Alerte',
  phase_active: 'Phase active',
  levee: 'Levée',
  post_crise: 'Post-crise',
}
const LIBELLE_NIVEAU_ALERTE = { info: 'Information', vigilance: 'Vigilance', urgence: 'Urgence', evacuation: 'Évacuation' }

const heure = (d) => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
const jourHeure = (d) => new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function duree(depuis) {
  const min = Math.max(0, Math.round((Date.now() - new Date(depuis).getTime()) / 60000))
  const j = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  return `${j ? `${j} j ` : ''}${h || j ? `${h} h ` : ''}${String(m).padStart(2, '0')} min`.replace(/\s+/g, ' ').trim()
}

function Tuile({ valeur, libelle, sous, alerte = false }) {
  return (
    <div className={`bg-surface border rounded p-3 text-center ${alerte ? 'border-chaud' : 'border-trait'}`}>
      <p className={`text-2xl font-semibold ${alerte ? 'text-chaud' : 'text-encre'}`}>{valeur}</p>
      <p className="text-xs text-sourdine">{libelle}</p>
      {sous && <p className="text-xs text-sourdine mt-0.5">{sous}</p>}
    </div>
  )
}

function Bloc({ titre, aide, children }) {
  return (
    <section className="bg-surface border border-trait rounded p-3" style={{ breakInside: 'avoid' }}>
      <h2 className="text-sm font-medium text-encre mb-0.5">{titre}</h2>
      {aide && <p className="text-xs text-sourdine mb-2">{aide}</p>}
      <div className="text-sm text-encre">{children}</div>
    </section>
  )
}

const Vide = ({ children }) => <p className="text-xs text-sourdine">{children}</p>

export default function VueAutorite() {
  const { contexteId, contexteActuel } = useAuth()
  const peutEcrire = contexteActuel?.niveau_acces !== 'lecture'
  const [params, setParams] = useSearchParams()
  const [incidents, setIncidents] = useState(null)
  const [d, setD] = useState(null)
  const [derniereReussite, setDerniereReussite] = useState(null)
  const [echec, setEchec] = useState(null)
  const [maintenant, setMaintenant] = useState(Date.now())
  const [enLigne, setEnLigne] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [autre, setAutre] = useState('')
  const [erreurAction, setErreurAction] = useState(null)

  // Incidents à suivre du contexte (pour le sélecteur)
  useEffect(() => {
    if (!contexteId) return
    supabase
      .from('incidents')
      .select('id, nom, statut, date_debut')
      .eq('contexte_id', contexteId)
      .in('statut', ['en_cours', 'pre_alerte'])
      .order('date_debut', { ascending: false })
      .then(({ data }) => setIncidents(data ?? []))
  }, [contexteId])

  const incidentId = params.get('incident') ?? incidents?.[0]?.id ?? null

  const charger = useCallback(async () => {
    if (!incidentId || !contexteId) return
    const depuisEquipes = new Date(Date.now() - 2 * 3600000).toISOString()
    const q = supabase
    const [inc, sitrep, attente, prises, moyens, zones, comptages, centres, objets, alertes, signalements, requisitions, equipes, aides, infos] = await Promise.all([
      q.from('incidents').select('*, niveaux_escalade(libelle)').eq('id', incidentId).single(),
      q.from('sitreps').select('numero, horodatage, canal_conditions, canal_actions, canal_besoins, canal_anticipation, victimes_u0, victimes_u1, victimes_u2, victimes_u3').eq('incident_id', incidentId).order('numero', { ascending: false }).limit(1).maybeSingle(),
      q.from('declenchements_seuils_action').select('id, horodatage_declenchement, seuils_action(libelle)').eq('incident_id', incidentId).eq('statut', 'en_attente').order('horodatage_declenchement'),
      q.from('livre_de_bord').select('id, numero_ordre, horodatage, decision, justification_prevoyance').eq('incident_id', incidentId).not('decision', 'is', null).order('numero_ordre', { ascending: false }).limit(8),
      q.from('moyens_engages').select('id, libelle, symbole, statut, effectif, latitude, longitude').eq('incident_id', incidentId).neq('statut', 'retire'),
      q.from('zones_intervention').select('id, type_zone, centre_latitude, centre_longitude, rayon_metres').eq('incident_id', incidentId).is('date_levee', null),
      q.from('comptages_personnes').select('id, categorie, nombre, auteur_id, created_at').eq('incident_id', incidentId).order('created_at', { ascending: false }),
      q.from('centres_accueil').select('id, nom, latitude, longitude, capacite_hebergement, capacite_debout').eq('contexte_id', contexteId),
      q.from('objets_a_risque').select('id, identification, categorie, latitude, longitude, capacite_occupants').eq('contexte_id', contexteId).not('latitude', 'is', null),
      q.from('alertes_publiques').select('id, titre, niveau_alerte, date_publication').eq('incident_id', incidentId).eq('actif', true).order('date_publication', { ascending: false }),
      q.from('signalements_citoyens').select('id, statut').eq('contexte_id', contexteId).is('deleted_at', null).neq('statut', 'clos').neq('statut', 'sans_suite'),
      q.from('requisitions').select('id', { count: 'exact', head: true }).eq('incident_id', incidentId).eq('statut', 'actif'),
      q.from('positions_equipes').select('id', { count: 'exact', head: true }).eq('incident_id', incidentId).gte('maj_le', depuisEquipes),
      q.from('alertes_aide').select('id', { count: 'exact', head: true }).eq('incident_id', incidentId).neq('statut', 'close'),
      q.from('informations_parties_prenantes').select('id, partie, libelle, informe_le, note').eq('incident_id', incidentId).order('informe_le', { ascending: false }),
    ])
    const erreur = [inc, sitrep, attente, prises, moyens, zones, comptages, centres, objets, alertes, signalements, requisitions, equipes, aides, infos].find((r) => r.error)
    if (erreur) {
      // On garde l'ancien affichage mais on le dit : jamais un état périmé présenté comme à jour.
      setEchec(erreur.error.message)
      return
    }
    setEchec(null)
    setDerniereReussite(Date.now())
    setD({
      incident: inc.data,
      sitrep: sitrep.data,
      attente: attente.data ?? [],
      prises: prises.data ?? [],
      moyens: moyens.data ?? [],
      zones: zones.data ?? [],
      comptages: comptages.data ?? [],
      centres: centres.data ?? [],
      objets: objets.data ?? [],
      alertes: alertes.data ?? [],
      signalements: signalements.data ?? [],
      requisitions: requisitions.count ?? 0,
      equipes: equipes.count ?? 0,
      aides: aides.count ?? 0,
      infos: infos.data ?? [],
    })
  }, [incidentId, contexteId])

  useEffect(() => {
    setD(null)
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 15000)
    const on = () => setEnLigne(true)
    const off = () => setEnLigne(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  async function informer(partie, libelle = null) {
    setErreurAction(null)
    const { error } = await supabase.from('informations_parties_prenantes').insert({ contexte_id: contexteId, incident_id: incidentId, partie, libelle })
    if (error) setErreurAction(error.message)
    else {
      setAutre('')
      charger()
    }
  }

  const calculs = useMemo(() => {
    if (!d) return null
    const { totaux, retenus } = totauxComptages(d.comptages)
    const capacite = d.centres.reduce((s, c) => s + (c.capacite_hebergement ?? 0), 0)
    const zonesAvecCentre = d.zones.filter((z) => z.centre_latitude != null && z.centre_longitude != null && z.rayon_metres != null)
    const dansUneZone = (lat, lon) => {
      let pire = null
      for (const z of zonesAvecCentre) {
        const dist = distanceM({ lat, lon }, { lat: Number(z.centre_latitude), lon: Number(z.centre_longitude) })
        if (dist <= Number(z.rayon_metres)) {
          const ordre = { rouge: 3, orange: 2, jaune: 1 }
          if (!pire || (ordre[z.type_zone] ?? 0) > (ordre[pire] ?? 0)) pire = z.type_zone
        }
      }
      return pire
    }
    const sensibles = d.objets
      .map((o) => ({ ...o, zone: dansUneZone(Number(o.latitude), Number(o.longitude)) }))
      .filter((o) => o.zone)
    const centresEnZone = d.centres
      .filter((c) => c.latitude != null)
      .map((c) => ({ ...c, zone: dansUneZone(Number(c.latitude), Number(c.longitude)) }))
      .filter((c) => c.zone)
    const sur = d.moyens.filter((m) => m.statut === 'sur_place')
    const enRoute = d.moyens.filter((m) => m.statut === 'en_route')
    const effectif = d.moyens.reduce((s, m) => s + (m.effectif ?? 0), 0)
    const victimes = ['u0', 'u1', 'u2', 'u3'].map((k) => [k.toUpperCase(), d.sitrep?.[`victimes_${k}`]]).filter(([, v]) => v != null)
    const nouveaux = d.signalements.filter((s) => s.statut === 'recu').length
    return { totaux, retenus, capacite, sensibles, centresEnZone, sur, enRoute, effectif, victimes, nouveaux }
  }, [d])

  // Carte : tout ce qui se localise
  const carte = useMemo(() => {
    if (!d) return null
    const i = d.incident
    const marqueurs = []
    if (i?.latitude != null) marqueurs.push({ id: 'inc', lat: Number(i.latitude), lon: Number(i.longitude), titre: i.nom, sousTitre: 'Incident', couleur: '#b91c1c', symbole: 'sinistre_foyer' })
    for (const m of d.moyens.filter((x) => x.latitude != null)) {
      marqueurs.push({ id: `m-${m.id}`, lat: Number(m.latitude), lon: Number(m.longitude), titre: m.libelle, sousTitre: m.statut === 'sur_place' ? 'Sur place' : 'En route', couleur: '#8e2a8e', symbole: m.symbole })
    }
    for (const c of d.centres.filter((x) => x.latitude != null)) {
      marqueurs.push({ id: `c-${c.id}`, lat: Number(c.latitude), lon: Number(c.longitude), titre: c.nom, sousTitre: "Centre d'accueil", couleur: '#2563eb', symbole: 'infra_ca' })
    }
    const cercles = d.zones
      .filter((z) => z.centre_latitude != null && z.centre_longitude != null && z.rayon_metres != null)
      .map((z) => ({ id: z.id, lat: Number(z.centre_latitude), lon: Number(z.centre_longitude), rayonM: Number(z.rayon_metres), couleur: COULEUR_ZONE[z.type_zone], libelle: `Zone ${LIBELLE_ZONE[z.type_zone] ?? z.type_zone}` }))
    const points = [
      ...(i?.latitude != null ? [{ lat: Number(i.latitude), lon: Number(i.longitude) }] : []),
      ...cercles.map((c) => ({ lat: c.lat, lon: c.lon })),
      ...d.moyens.filter((m) => m.latitude != null).map((m) => ({ lat: Number(m.latitude), lon: Number(m.longitude) })),
    ]
    return { marqueurs, cercles, points }
  }, [d])

  if (incidents && incidents.length === 0) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-encre mb-2">Vue autorité</h1>
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">Aucun incident en cours ou en pré-alerte pour ce contexte.</p>
      </div>
    )
  }
  if (!d || !calculs) return <p className="text-sm text-sourdine">{echec ? `Impossible de charger : ${echec}` : 'Chargement…'}</p>

  const i = d.incident
  const perime = !!echec || !enLigne || (derniereReussite && maintenant - derniereReussite > 90000)
  const infoDe = (cle) => d.infos.find((x) => x.partie === cle)
  const autres = d.infos.filter((x) => x.partie === 'autre')
  const derniereAlerte = d.alertes[0]
  const { totaux } = calculs

  return (
    <div className="vue-autorite space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-encre">{i.nom}</h1>
          <p className="text-sm text-sourdine">
            {i.type_evenement && <>{i.type_evenement} · </>}
            {LIBELLE_STATUT[i.statut] ?? i.statut} · {LIBELLE_PHASE[i.phase_cycle_vie] ?? i.phase_cycle_vie}
            {i.niveaux_escalade?.libelle && <> · {i.niveaux_escalade.libelle}</>}
            {i.degre_criticite && <> · criticité {i.degre_criticite}</>}
          </p>
          {i.date_debut && (
            <p className="text-sm text-encre mt-0.5">
              Depuis {jourHeure(i.date_debut)} <span className="text-sourdine">({duree(i.date_debut)})</span>
            </p>
          )}
        </div>
        <div className="no-print flex items-center gap-2 flex-wrap">
          {incidents && incidents.length > 1 && (
            <select value={incidentId} onChange={(e) => setParams({ incident: e.target.value })} aria-label="Incident">
              {incidents.map((x) => (
                <option key={x.id} value={x.id}>{x.nom}</option>
              ))}
            </select>
          )}
          <button type="button" className="discret" onClick={charger}>Actualiser</button>
          <button type="button" className="principal" onClick={() => window.print()}>Point de situation (PDF)</button>
          <Link to={`/incidents/${i.id}`} className="lien text-xs">Fiche de l'incident →</Link>
        </div>
      </div>

      {/* Fraîcheur : jamais un état périmé présenté comme à jour */}
      {perime ? (
        <p role="alert" className="text-sm rounded p-2" style={{ background: '#b91c1c', color: '#fff' }}>
          ⚠ Données non rafraîchies{derniereReussite ? ` depuis ${heure(derniereReussite)}` : ''}
          {!enLigne ? ' (pas de réseau)' : echec ? ` (${echec})` : ''} : ne vous y fiez pas pour décider.
        </p>
      ) : (
        <p className="text-xs text-sourdine">À jour à {derniereReussite ? heure(derniereReussite) : '…'} · actualisation automatique toutes les 30 s</p>
      )}

      {d.aides > 0 && (
        <Link to={`/incidents/${i.id}`} role="alert" className="block text-sm font-semibold rounded p-2" style={{ background: '#b91c1c', color: '#fff', textDecoration: 'none' }}>
          🆘 {d.aides} appel{d.aides > 1 ? 's' : ''} d'aide ouvert{d.aides > 1 ? 's' : ''} → voir
        </Link>
      )}

      {/* Météo de la commune : prévisions + avertissement IRM (lecture seule ici) */}
      <VeilleMeteo compact autoJournal={false} />

      {/* Chiffres clés */}
      <section aria-label="Chiffres clés">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CATEGORIES_COMPTAGE.filter(([c]) => c !== 'personnes_a_risque' || totaux[c] > 0).map(([cle, lib]) => {
            const accueil = cle === 'accueillis'
            const depasse = accueil && calculs.capacite > 0 && totaux.accueillis > calculs.capacite
            return (
              <Tuile
                key={cle}
                valeur={totaux[cle]}
                libelle={lib}
                alerte={depasse || (cle === 'introuvables' && totaux[cle] > 0)}
                sous={accueil && calculs.capacite > 0 ? `sur ${calculs.capacite} places d'hébergement` : undefined}
              />
            )
          })}
          <Tuile valeur={calculs.sur.length} libelle="moyens sur place" sous={`${calculs.enRoute.length} en route${calculs.effectif ? ` · ${calculs.effectif} pers.` : ''}`} />
          <Tuile valeur={d.equipes} libelle="équipes localisées" sous="position partagée, 2 dernières heures" />
          <Tuile valeur={d.requisitions} libelle="réquisitions actives" />
          <Tuile valeur={calculs.nouveaux} libelle="signalements citoyens à traiter" sous={`${d.signalements.length} non clos`} alerte={calculs.nouveaux > 0} />
        </div>
        <p className="text-xs text-sourdine mt-2">
          Nombres déclarés par les équipes de terrain (dernier chiffre de chaque déclarant), pas un recensement : deux équipes peuvent compter les mêmes personnes.
          {d.comptages[0] ? ` Dernier comptage ${ilYA(d.comptages[0].created_at)}.` : ' Aucun comptage remonté pour l\'instant.'}
        </p>
        {calculs.victimes.length > 0 && (
          <p className="text-sm mt-1">
            Victimes (SitRep n°{d.sitrep.numero}) : {calculs.victimes.map(([k, v]) => `${k} : ${v}`).join(' · ')}
          </p>
        )}
      </section>

      {/* Carte */}
      <section aria-label="Carte">
        {carte.points.length === 0 ? (
          <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 text-center">
            Incident non localisé : la position de l'incident et les zones se renseignent dans la fiche de l'incident.
          </p>
        ) : (
          <CarteCrise
            centre={carte.points[0]}
            zoom={14}
            marqueurs={carte.marqueurs}
            cercles={carte.cercles}
            ajusterSur={carte.points.length > 1 ? carte.points : null}
            hauteur="340px"
          />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* À décider / décidé */}
        <Bloc titre="À décider" aide="Seuils d'action franchis, en attente d'une décision.">
          {d.attente.length === 0 ? (
            <Vide>Rien en attente.</Vide>
          ) : (
            <ul className="space-y-1">
              {d.attente.map((x) => (
                <li key={x.id} className="text-chaud">
                  {x.seuils_action?.libelle ?? 'Seuil'} <span className="text-xs text-sourdine">· déclenché {ilYA(x.horodatage_declenchement)}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        <Bloc titre="Décisions prises" aide="Entrées du livre de bord qui consignent une décision.">
          {d.prises.length === 0 ? (
            <Vide>Aucune décision consignée.</Vide>
          ) : (
            <ul className="space-y-1.5">
              {d.prises.map((x) => (
                <li key={x.id}>
                  <span className="text-xs text-sourdine">#{x.numero_ordre} · {jourHeure(x.horodatage)} · </span>
                  {x.decision}
                  <span className={`text-xs ml-1 ${x.justification_prevoyance ? 'text-ok' : 'text-sourdine'}`}>
                    {x.justification_prevoyance ? '(justification de prévoyance notée)' : '(sans justification de prévoyance)'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        {/* Qui est informé */}
        <Bloc titre="Qui est informé" aide="Autorités et services avertis, avec l'heure. L'information de la population se lit dans les messages publiés.">
          {erreurAction && <p className="text-xs text-chaud mb-1">{erreurAction}</p>}
          <ul className="space-y-1.5">
            {PARTIES.map((p) => {
              const x = infoDe(p.cle)
              return (
                <li key={p.cle} className="flex items-center justify-between gap-2">
                  <span>
                    {p.libelle}{' '}
                    {x ? (
                      <span className="text-xs text-ok">· informé à {heure(x.informe_le)} ({ilYA(x.informe_le)})</span>
                    ) : (
                      <span className="text-xs text-chaud">· pas encore informé</span>
                    )}
                  </span>
                  {peutEcrire && (
                    <button type="button" className="discret no-print" onClick={() => informer(p.cle)}>
                      {x ? 'Informé de nouveau' : 'Informé maintenant'}
                    </button>
                  )}
                </li>
              )
            })}
            {autres.map((x) => (
              <li key={x.id}>
                {x.libelle ?? 'Autre'} <span className="text-xs text-ok">· informé à {heure(x.informe_le)} ({ilYA(x.informe_le)})</span>
              </li>
            ))}
            <li>
              Population{' '}
              {derniereAlerte ? (
                <span className="text-xs text-ok">· dernier message « {derniereAlerte.titre} » {ilYA(derniereAlerte.date_publication)}</span>
              ) : (
                <span className="text-xs text-chaud">· aucun message publié pour cet incident</span>
              )}
            </li>
          </ul>
          {peutEcrire && (
            <div className="flex gap-2 mt-2 no-print">
              <input value={autre} onChange={(e) => setAutre(e.target.value)} placeholder="Autre (ex. bourgmestre voisin, hôpital)" className="w-full" style={{ marginBottom: 0 }} />
              <button type="button" className="discret" disabled={!autre.trim()} onClick={() => informer('autre', autre.trim())}>
                Ajouter
              </button>
            </div>
          )}
        </Bloc>

        {/* Messages à la population */}
        <Bloc titre="Messages à la population" aide="Alertes actives publiées pour cet incident.">
          {d.alertes.length === 0 ? (
            <Vide>Aucun message actif.</Vide>
          ) : (
            <ul className="space-y-1">
              {d.alertes.map((a) => (
                <li key={a.id}>
                  <span className="jeton mr-1">{LIBELLE_NIVEAU_ALERTE[a.niveau_alerte] ?? a.niveau_alerte}</span>
                  {a.titre} <span className="text-xs text-sourdine">· {jourHeure(a.date_publication)}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        {/* Sites sensibles */}
        <Bloc titre="Sites sensibles dans une zone" aide="Objets à risque et centres d'accueil situés dans une zone d'intervention active (calcul d'après les positions renseignées).">
          {calculs.sensibles.length === 0 && calculs.centresEnZone.length === 0 ? (
            <Vide>Aucun site connu dans une zone (ou positions non renseignées).</Vide>
          ) : (
            <ul className="space-y-1">
              {calculs.sensibles.map((o) => (
                <li key={o.id}>
                  <span style={{ color: COULEUR_ZONE[o.zone] }}>● zone {LIBELLE_ZONE[o.zone]}</span> · {o.identification ?? o.categorie}
                  {o.capacite_occupants ? <span className="text-xs text-sourdine"> · {o.capacite_occupants} occupants</span> : null}
                </li>
              ))}
              {calculs.centresEnZone.map((c) => (
                <li key={c.id} className="text-chaud">
                  ⚠ Centre d'accueil « {c.nom} » dans la zone {LIBELLE_ZONE[c.zone]}
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        {/* Anticipation */}
        <Bloc titre="Anticipation et besoins" aide={d.sitrep ? `SitRep n°${d.sitrep.numero} · ${jourHeure(d.sitrep.horodatage)} (${ilYA(d.sitrep.horodatage)})` : undefined}>
          {!d.sitrep ? (
            <Vide>Aucun SitRep établi.</Vide>
          ) : (
            <div className="space-y-1.5" style={{ whiteSpace: 'pre-line' }}>
              {d.sitrep.canal_anticipation ? (
                <p><strong>Anticipation.</strong> {d.sitrep.canal_anticipation}</p>
              ) : (
                <Vide>Pas d'anticipation renseignée dans le dernier SitRep.</Vide>
              )}
              {d.sitrep.canal_besoins && <p><strong>Besoins.</strong> {d.sitrep.canal_besoins}</p>}
            </div>
          )}
        </Bloc>
      </div>
    </div>
  )
}
