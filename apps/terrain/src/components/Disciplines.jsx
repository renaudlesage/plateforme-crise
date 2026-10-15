import { useCallback, useState } from 'react'
import { STATUTS_MOYEN, ilYA, lienItineraire, peutModifierZonage, profilDe } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { useChargementPeriodique } from '../hooks/useChargementPeriodique'
import { CATEGORIES_COMPTAGE, DemandesATraiter, Retour, ZonesIntervention, heure, totauxComptages, verifier } from './Commandement'
import { ComptagePersonnes } from './OutilsRapport'

/**
 * Écran d'accueil de chaque directeur de discipline sur le terrain (Dir-Si, Dir-Med, Dir-Pol, Dir-Log, Dir-Info).
 * Chacun voit en premier les demandes qui lui sont adressées et ses propres moyens, puis l'outil de sa discipline.
 *
 * Doctrine : nombres seulement (jamais de noms de victimes) ; ce qui vient du plan (capacités des hôpitaux,
 * des centres d'accueil) est présenté comme tel, jamais comme une disponibilité du moment ; une écriture hors
 * réseau se met en file et se dit.
 */

const SEUIL_RELEVE_H = 4 // repère d'organisation, pas une règle

function Titre({ children, aide }) {
  return (
    <div>
      <h2>{children}</h2>
      {aide && <p className="text-xs text-sourdine">{aide}</p>}
    </div>
  )
}

const listeSansPuces = { listStyle: 'none', padding: 0, margin: 0 }

/** Dernier chiffre de chaque déclarant pour chaque clé (lignes de la plus récente à la plus ancienne), puis somme par clé. */
function sommeDerniers(lignes, cle) {
  const vus = new Set()
  const somme = {}
  for (const l of lignes) {
    const k = `${cle(l)}|${l.auteur_id}`
    if (vus.has(k)) continue
    vus.add(k)
    somme[cle(l)] = (somme[cle(l)] ?? 0) + l.nombre
  }
  return somme
}

/* ------------------------------------------------------------------ */
/* Mes moyens                                                          */

export function MesMoyens({ incident, discipline }) {
  const charger = useCallback(async () => {
    const r = await supabase
      .from('moyens_engages')
      .select('id, libelle, statut, effectif, remarque, created_at')
      .eq('incident_id', incident.id)
      .eq('discipline', discipline)
      .neq('statut', 'retire')
      .order('created_at', { ascending: true })
    verifier(r)
    return r.data ?? []
  }, [incident.id, discipline])
  const { donnees, majLe, echec, recharger } = useChargementPeriodique({ cle: `moyens.${incident.id}.${discipline}`, charger, intervalle: 30000 })
  const [surcharge, setSurcharge] = useState({})
  const [res, setRes] = useState(null)

  async function changer(m, statut) {
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'update',
      table: 'moyens_engages',
      id: m.id,
      champs: { statut, maj_le: new Date().toISOString() },
      libelle: `${m.libelle} · ${STATUTS_MOYEN[statut] ?? statut}`,
    })
    setRes(r)
    if (r.statut !== 'refus') {
      setSurcharge((p) => ({ ...p, [m.id]: statut }))
      recharger()
    }
  }

  const lignes = (donnees ?? []).map((m) => ({ ...m, statut: surcharge[m.id] ?? m.statut })).filter((m) => m.statut !== 'retire')

  return (
    <div className="space-y-2">
      <Titre aide="Les moyens de votre discipline engagés sur cet incident. Pour en ajouter ou les déplacer : page Carte.">Mes moyens</Titre>
      {echec && <p className="text-xs text-chaud">Liste non rafraîchie depuis {majLe ? heure(majLe) : '…'} ({echec}).</p>}
      {lignes.length === 0 ? (
        donnees && <p className="vide border border-dashed border-trait text-center p-3">Aucun moyen de votre discipline n’est engagé.</p>
      ) : (
        <ul className="space-y-2" style={listeSansPuces}>
          {lignes.map((m) => {
            const h = m.created_at ? (Date.now() - new Date(m.created_at).getTime()) / 3600000 : 0
            const engage = m.statut === 'sur_place' || m.statut === 'en_route'
            return (
              <li key={m.id} className="carte">
                <p className="text-sm font-medium text-encre">
                  {m.libelle}
                  {m.effectif != null ? ` · ${m.effectif} pers.` : ''}
                </p>
                {engage && m.created_at && (
                  <p className={`text-xs ${h >= SEUIL_RELEVE_H ? 'text-chaud' : 'text-sourdine'}`}>
                    engagé depuis {Math.floor(h)} h {String(Math.floor((h - Math.floor(h)) * 60)).padStart(2, '0')}
                    {h >= SEUIL_RELEVE_H ? ' · à relever ?' : ''}
                  </p>
                )}
                {m.remarque && <p className="text-xs text-sourdine">{m.remarque}</p>}
                <select value={m.statut} onChange={(e) => changer(m, e.target.value)} className="w-full mt-2" aria-label={`Statut de ${m.libelle}`}>
                  {Object.entries(STATUTS_MOYEN).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      )}
      <Retour res={res} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dir-Med : triage au PMA et destinations hospitalières                */

const CATEGORIES_TRIAGE = ['u0', 'u1', 'u2', 'u3']

export function TriagePMA({ incident, contexteId, roleLibelle }) {
  const charger = useCallback(async () => {
    const [tri, sit] = await Promise.all([
      supabase.from('triage_victimes').select('categorie, nombre, auteur_id, created_at').eq('incident_id', incident.id).order('created_at', { ascending: false }),
      supabase.from('sitreps').select('localisation_pma, localisation_ppd').eq('incident_id', incident.id).order('numero', { ascending: false }).limit(1).maybeSingle(),
    ])
    verifier(tri, sit)
    return { lignes: tri.data ?? [], sitrep: sit.data }
  }, [incident.id])
  const { donnees, majLe, echec, recharger } = useChargementPeriodique({ cle: `triage.${incident.id}`, charger, intervalle: 30000 })
  const [valeurs, setValeurs] = useState({})
  const [lieu, setLieu] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [res, setRes] = useState(null)

  const totaux = sommeDerniers(donnees?.lignes ?? [], (l) => l.categorie)
  const total = CATEGORIES_TRIAGE.reduce((s, c) => s + (totaux[c] ?? 0), 0)
  const saisies = CATEGORIES_TRIAGE.filter((c) => valeurs[c] !== undefined && valeurs[c] !== '')

  async function envoyer(e) {
    e.preventDefault()
    if (saisies.length === 0) return
    setEnCours(true)
    let dernier = null
    for (const c of saisies) {
      dernier = await fileEcritures.ecrireOuEmpiler({
        nature: 'insert',
        table: 'triage_victimes',
        champs: { contexte_id: contexteId, incident_id: incident.id, categorie: c, nombre: Math.max(0, parseInt(valeurs[c], 10) || 0), lieu_texte: lieu.trim() || null, role_libelle: roleLibelle ?? null },
        libelle: `Triage ${c.toUpperCase()}`,
      })
      if (dernier.statut === 'refus') break
    }
    setEnCours(false)
    setRes(dernier)
    if (dernier?.statut !== 'refus') {
      setValeurs({})
      recharger()
    }
  }

  return (
    <div className="space-y-2">
      <Titre aide="Nombres seulement, jamais de noms. Indiquez le total constaté à cet instant : le CC retient le dernier chiffre de chaque déclarant.">Triage au PMA</Titre>
      {echec && <p className="text-xs text-chaud">Décompte non rafraîchi depuis {majLe ? heure(majLe) : '…'} ({echec}).</p>}
      {(donnees?.sitrep?.localisation_pma || donnees?.sitrep?.localisation_ppd) && (
        <p className="text-xs text-sourdine">
          {donnees.sitrep.localisation_pma ? `PMA : ${donnees.sitrep.localisation_pma}` : ''}
          {donnees.sitrep.localisation_pma && donnees.sitrep.localisation_ppd ? ' · ' : ''}
          {donnees.sitrep.localisation_ppd ? `PPD : ${donnees.sitrep.localisation_ppd}` : ''}
          <span> (d’après le dernier SitRep)</span>
        </p>
      )}
      <div className="grid grid-cols-4 gap-2">
        {CATEGORIES_TRIAGE.map((c) => (
          <div key={c} className="border border-trait rounded p-2 text-center bg-surface">
            <p className="text-xl font-semibold text-encre">{donnees ? totaux[c] ?? 0 : '—'}</p>
            <p className="text-xs text-sourdine">{c.toUpperCase()}</p>
          </div>
        ))}
      </div>
      {donnees ? (
        <p className="text-xs text-sourdine">
          Total compté : {total}
          {donnees.lignes[0] ? ` · dernier décompte ${ilYA(donnees.lignes[0].created_at)}` : ' · aucun décompte pour l’instant'}. Catégories : mêmes codes que dans le SitRep.
        </p>
      ) : (
        <p className="text-xs text-sourdine">Décompte indisponible : ne concluez rien de l’absence de chiffre. Vous pouvez quand même envoyer le vôtre.</p>
      )}
      <form onSubmit={envoyer} className="carte space-y-2">
        <p className="text-xs text-sourdine">Nouveau décompte (laissez vide ce que vous ne changez pas) :</p>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES_TRIAGE.map((c) => (
            <div key={c}>
              <label className="block text-xs text-sourdine text-center mb-1">{c.toUpperCase()}</label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={valeurs[c] ?? ''}
                onChange={(e) => setValeurs((p) => ({ ...p, [c]: e.target.value }))}
                style={{ width: '100%', fontSize: 18, textAlign: 'center' }}
              />
            </div>
          ))}
        </div>
        <input value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="PMA / lieu (facultatif)" className="w-full" />
        <Retour res={res} />
        <button type="submit" className="bouton-terrain principal" disabled={enCours || saisies.length === 0}>
          {enCours ? 'Envoi…' : 'Envoyer le décompte au CC'}
        </button>
      </form>
    </div>
  )
}

export function Hopitaux({ incident, contexteId, roleLibelle }) {
  const charger = useCallback(async () => {
    const [h, t] = await Promise.all([
      supabase.from('hopitaux').select('id, nom, capacite_lits_agrees, capacite_reflexe_estimee').eq('contexte_id', contexteId).order('nom'),
      supabase.from('transferts_hopitaux').select('hopital_id, nombre, auteur_id, created_at').eq('incident_id', incident.id).order('created_at', { ascending: false }),
    ])
    verifier(h, t)
    return { hopitaux: h.data ?? [], transferts: t.data ?? [] }
  }, [incident.id, contexteId])
  const { donnees, majLe, echec, recharger } = useChargementPeriodique({ cle: `hopitaux.${incident.id}`, charger, intervalle: 60000 })
  const [valeurs, setValeurs] = useState({})
  const [res, setRes] = useState(null)

  const totaux = sommeDerniers(donnees?.transferts ?? [], (l) => l.hopital_id)

  async function enregistrer(h) {
    const n = parseInt(valeurs[h.id], 10)
    if (Number.isNaN(n) || n < 0) return
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'transferts_hopitaux',
      champs: { contexte_id: contexteId, incident_id: incident.id, hopital_id: h.id, nombre: n, role_libelle: roleLibelle ?? null },
      libelle: `Dirigés vers ${h.nom}`,
    })
    setRes(r)
    if (r.statut !== 'refus') {
      setValeurs((p) => ({ ...p, [h.id]: '' }))
      recharger()
    }
  }

  return (
    <div className="space-y-2">
      <Titre aide="Capacités du plan hospitalier d’urgence, PAS des disponibilités du moment : confirmez par téléphone avant d’orienter. Indiquez le total de personnes que vous avez dirigées vers chaque hôpital.">Hôpitaux</Titre>
      {echec && <p className="text-xs text-chaud">Liste non rafraîchie depuis {majLe ? heure(majLe) : '…'} ({echec}).</p>}
      {(donnees?.hopitaux ?? []).length === 0 ? (
        donnees && <p className="vide border border-dashed border-trait text-center p-3">Aucun hôpital enregistré dans le plan.</p>
      ) : (
        <ul className="space-y-2" style={listeSansPuces}>
          {donnees.hopitaux.map((h) => (
            <li key={h.id} className="carte">
              <p className="text-sm font-medium text-encre">{h.nom}</p>
              <p className="text-xs text-sourdine">
                Plan : {h.capacite_lits_agrees ?? '—'} lits agréés · capacité réflexe estimée {h.capacite_reflexe_estimee ?? '—'}
              </p>
              <p className="text-xs text-encre mt-1">Dirigés vers cet hôpital (déclarés) : <strong>{totaux[h.id] ?? 0}</strong></p>
              <div className="flex gap-2 mt-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="total"
                  value={valeurs[h.id] ?? ''}
                  onChange={(e) => setValeurs((p) => ({ ...p, [h.id]: e.target.value }))}
                  style={{ width: 120, fontSize: 18, textAlign: 'center' }}
                  aria-label={`Total dirigé vers ${h.nom}`}
                />
                <button type="button" className="principal" disabled={valeurs[h.id] === undefined || valeurs[h.id] === ''} onClick={() => enregistrer(h)}>Enregistrer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Retour res={res} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dir-Pol : routes coupées, accès, évacuation                          */

const TYPES_ACCES = { route_coupee: 'Route coupée', acces: 'Accès / barrage' }

export function PointsAccesEtRoutes({ incident }) {
  const charger = useCallback(async () => {
    const r = await supabase
      .from('observations_terrain')
      .select('id, type, description, latitude, longitude, created_at')
      .eq('incident_id', incident.id)
      .eq('statut', 'ouvert')
      .in('type', Object.keys(TYPES_ACCES))
      .order('created_at', { ascending: false })
    verifier(r)
    return r.data ?? []
  }, [incident.id])
  const { donnees, majLe, echec } = useChargementPeriodique({ cle: `acces.${incident.id}`, charger, intervalle: 30000 })

  return (
    <div className="space-y-2">
      <Titre aide="Routes coupées et barrages signalés sur la carte (page Carte pour en ajouter).">Routes coupées et accès</Titre>
      {echec && <p className="text-xs text-chaud">Liste non rafraîchie depuis {majLe ? heure(majLe) : '…'} ({echec}).</p>}
      {(donnees ?? []).length === 0 ? (
        donnees && <p className="vide border border-dashed border-trait text-center p-3">Aucun point ouvert.</p>
      ) : (
        <ul className="space-y-2" style={listeSansPuces}>
          {donnees.map((o) => (
            <li key={o.id} className="carte text-sm">
              <p className="text-encre">
                <strong>{TYPES_ACCES[o.type]}</strong>
                {o.description ? ` — ${o.description}` : ''}
              </p>
              <p className="text-xs text-sourdine">
                {ilYA(o.created_at)} ·{' '}
                <a href={lienItineraire(o.latitude, o.longitude)} target="_blank" rel="noreferrer" className="underline">y aller ↗</a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dir-Log : centres d'accueil et ressources                            */

export function CentresEtRessources({ contexteId }) {
  const charger = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.from('centres_accueil').select('id, nom, type_lieu, adresse, capacite_hebergement, capacite_debout, parking_vehicules_lourds, accessible_poids_lourd').eq('contexte_id', contexteId).order('nom'),
      supabase.from('ressources').select('id, nom, categorie, type_public_prive, dimension_capacite, operationnel_de_nuit').eq('contexte_id', contexteId).order('nom'),
    ])
    verifier(c, r)
    return { centres: c.data ?? [], ressources: r.data ?? [] }
  }, [contexteId])
  const { donnees, majLe, echec } = useChargementPeriodique({ cle: `ressources.${contexteId}`, charger, intervalle: 120000 })
  const [filtre, setFiltre] = useState('')

  const q = filtre.trim().toLowerCase()
  const ressources = (donnees?.ressources ?? []).filter((x) => !q || `${x.nom} ${x.categorie}`.toLowerCase().includes(q))

  return (
    <div className="space-y-3">
      <Titre aide="Référentiel de la commune : capacités prévues au plan, pas disponibilités du moment. Contactez le gestionnaire avant d’engager.">Centres d’accueil et ressources</Titre>
      {echec && <p className="text-xs text-chaud">Référentiel non rafraîchi depuis {majLe ? heure(majLe) : '…'} ({echec}).</p>}
      <h3 className="text-sm font-medium text-encre">Centres d’accueil</h3>
      {(donnees?.centres ?? []).length === 0 ? (
        donnees && <p className="vide border border-dashed border-trait text-center p-3">Aucun centre enregistré.</p>
      ) : (
        <ul className="space-y-2" style={listeSansPuces}>
          {donnees.centres.map((c) => (
            <li key={c.id} className="carte text-sm">
              <p className="font-medium text-encre">{c.nom}{c.type_lieu ? ` · ${String(c.type_lieu).replace(/_/g, ' ')}` : ''}</p>
              <p className="text-xs text-sourdine">
                {c.capacite_hebergement != null ? `${c.capacite_hebergement} couchages` : 'couchages ?'} · {c.capacite_debout != null ? `${c.capacite_debout} debout` : 'debout ?'}
                {c.accessible_poids_lourd ? ' · accès poids lourds' : ''}
                {c.adresse ? ` · ${c.adresse}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      <h3 className="text-sm font-medium text-encre">Ressources</h3>
      <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Chercher (nom, catégorie)" className="w-full" aria-label="Chercher une ressource" />
      {ressources.length === 0 ? (
        donnees && <p className="vide border border-dashed border-trait text-center p-3">Aucune ressource.</p>
      ) : (
        <ul className="space-y-2" style={listeSansPuces}>
          {ressources.map((x) => (
            <li key={x.id} className="carte text-sm">
              <p className="font-medium text-encre">{x.nom}</p>
              <p className="text-xs text-sourdine">
                {String(x.categorie).replace(/_/g, ' ')} · {x.type_public_prive === 'prive' ? 'privé' : x.type_public_prive === 'public' ? 'public' : x.type_public_prive}
                {x.dimension_capacite ? ` · ${x.dimension_capacite}` : ''}
                {x.operationnel_de_nuit ? ' · opérationnel de nuit' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dir-Info : ce qui est dit, ce qui remonte des citoyens, proposer un message */

const LIBELLE_STATUT_SIGNALEMENT = { recu: 'reçus', pris_en_charge: 'pris en charge', en_cours: 'en cours', clos: 'clos', sans_suite: 'sans suite' }
const LIBELLE_TYPE_SIGNALEMENT = {
  route_coupee: 'route coupée',
  inondation: 'inondation',
  degats_materiels: 'dégâts matériels',
  personne_isolee: 'personne isolée',
  danger: 'danger',
  autre: 'autre',
}
const LIBELLE_NIVEAU_ALERTE = { info: 'Information', vigilance: 'Vigilance', urgence: 'Urgence', evacuation: 'Évacuation' }

export function VueInformation({ incident, contexteId }) {
  const charger = useCallback(async () => {
    const [al, sig, cpt] = await Promise.all([
      supabase.from('alertes_publiques').select('id, titre, niveau_alerte, date_publication, date_expiration').eq('incident_id', incident.id).eq('actif', true).order('date_publication', { ascending: false }),
      supabase.from('signalements_citoyens').select('id, statut, type').eq('contexte_id', contexteId).is('deleted_at', null),
      supabase.from('comptages_personnes').select('categorie, nombre, auteur_id, created_at').eq('incident_id', incident.id).order('created_at', { ascending: false }),
    ])
    verifier(al, sig, cpt)
    return { alertes: al.data ?? [], signalements: sig.data ?? [], comptages: cpt.data ?? [] }
  }, [incident.id, contexteId])
  const { donnees, majLe, echec } = useChargementPeriodique({ cle: `info.${incident.id}`, charger, intervalle: 30000 })
  const [texte, setTexte] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [res, setRes] = useState(null)

  const alertes = (donnees?.alertes ?? []).filter((a) => !a.date_expiration || new Date(a.date_expiration) > new Date())
  const sig = donnees?.signalements ?? []
  const parStatut = sig.reduce((acc, s) => ({ ...acc, [s.statut ?? 'recu']: (acc[s.statut ?? 'recu'] ?? 0) + 1 }), {})
  const parType = sig.reduce((acc, s) => ({ ...acc, [s.type ?? 'autre']: (acc[s.type ?? 'autre'] ?? 0) + 1 }), {})
  const totaux = donnees ? totauxComptages(donnees.comptages) : null

  async function proposer(e) {
    e.preventDefault()
    if (!texte.trim()) return
    setEnCours(true)
    const r = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'livre_de_bord',
      champs: { incident_id: incident.id, message: `[Terrain] [Proposition de message — Dir-Info] ${texte.trim()}` },
      libelle: 'Proposition de message',
    })
    setEnCours(false)
    setRes(r)
    if (r.statut !== 'refus') setTexte('')
  }

  return (
    <div className="space-y-5">
      {echec && <p className="text-xs text-chaud">Données non rafraîchies depuis {majLe ? heure(majLe) : '…'} ({echec}).</p>}

      {!donnees && !echec && <p className="text-xs text-sourdine">Chargement…</p>}

      {donnees && (
      <>
      <div className="space-y-2">
        <Titre aide="Ce que la population a déjà reçu. Toute nouvelle diffusion passe par le CC.">Messages publiés</Titre>
        {alertes.length === 0 ? (
          <p className="vide border border-dashed border-trait text-center p-3">Aucun message actif.</p>
        ) : (
          <ul className="space-y-2" style={listeSansPuces}>
            {alertes.map((a) => (
              <li key={a.id} className="carte text-sm">
                <p className="font-medium text-encre">{a.titre}</p>
                <p className="text-xs text-sourdine">{LIBELLE_NIVEAU_ALERTE[a.niveau_alerte] ?? a.niveau_alerte} · publié {ilYA(a.date_publication)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Titre aide="Nombres seulement : ce que les citoyens signalent (coordonnées et textes restent au CC).">Signalements citoyens</Titre>
        {sig.length === 0 ? (
          <p className="vide border border-dashed border-trait text-center p-3">Aucun signalement.</p>
        ) : (
          <>
            <p className="text-sm text-encre">
              {sig.length} signalement{sig.length > 1 ? 's' : ''} · {Object.entries(parStatut).map(([k, v]) => `${v} ${LIBELLE_STATUT_SIGNALEMENT[k] ?? k}`).join(' · ')}
            </p>
            <p className="text-xs text-sourdine">Par type : {Object.entries(parType).map(([k, v]) => `${LIBELLE_TYPE_SIGNALEMENT[k] ?? k} ${v}`).join(' · ')}</p>
          </>
        )}
      </div>

      {donnees.comptages.length > 0 && (
        <div className="space-y-2">
          <Titre aide="Déclarations de terrain, deux équipes peuvent compter les mêmes personnes : à confirmer avec le CC avant toute diffusion.">Chiffres du terrain</Titre>
          <p className="text-sm text-encre">
            {CATEGORIES_COMPTAGE.filter(([c]) => totaux[c] > 0).map(([c, l]) => `${l} ${totaux[c]}`).join(' · ') || 'Aucun chiffre.'}
          </p>
        </div>
      )}
      </>
      )}

      <form onSubmit={proposer} className="carte space-y-2">
        <Titre aide="Le texte arrive dans le livre de bord du CC, qui le relit, le valide et le diffuse. Rien n’est publié d’ici.">Proposer un message au CC</Titre>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} className="w-full" placeholder="Ce qu’il faudrait dire à la population ou aux médias, factuel." />
        <Retour res={res} />
        <button type="submit" className="principal" disabled={enCours || !texte.trim()}>{enCours ? 'Envoi…' : 'Envoyer la proposition au CC'}</button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Accueil d'un profil                                                  */

/** Onglet d'accueil d'un directeur de discipline. Le Dir PC-Ops a sa propre vue (VueCommandement). */
export default function VueDiscipline({ incident, contexteId, profil, roleLibelle }) {
  const p = profilDe(profil)
  if (!p || profil === 'pc_ops') return null
  const autoriseZonage = peutModifierZonage(profil)

  return (
    <div className="space-y-6">
      <DemandesATraiter incidentId={incident.id} pour={profil} />

      {profil === 'si' && (
        <>
          <MesMoyens incident={incident} discipline={p.discipline} />
          <ZonesIntervention incident={incident} peutModifier={autoriseZonage} />
        </>
      )}

      {profil === 'med' && (
        <>
          <TriagePMA incident={incident} contexteId={contexteId} roleLibelle={roleLibelle} />
          <Hopitaux incident={incident} contexteId={contexteId} roleLibelle={roleLibelle} />
          <MesMoyens incident={incident} discipline={p.discipline} />
        </>
      )}

      {profil === 'pol' && (
        <>
          <ZonesIntervention incident={incident} peutModifier={autoriseZonage} />
          <PointsAccesEtRoutes incident={incident} />
          <div className="space-y-2">
            <Titre>Évacuation et personnes recherchées</Titre>
            <ComptagePersonnes incidentId={incident.id} contexteId={contexteId} />
          </div>
          <MesMoyens incident={incident} discipline={p.discipline} />
        </>
      )}

      {profil === 'log' && (
        <>
          <CentresEtRessources contexteId={contexteId} />
          <div className="space-y-2">
            <Titre>Personnes accueillies</Titre>
            <ComptagePersonnes incidentId={incident.id} contexteId={contexteId} />
          </div>
          <MesMoyens incident={incident} discipline={p.discipline} />
        </>
      )}

      {profil === 'info' && (
        <>
          <VueInformation incident={incident} contexteId={contexteId} />
          <MesMoyens incident={incident} discipline={p.discipline} />
        </>
      )}
    </div>
  )
}
