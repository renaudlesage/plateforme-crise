import { useCallback, useEffect, useState } from 'react'
import { distanceM, distanceEtCap, lienItineraire, ilYA, heuresDepuis, libelleDistance } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { fileEcritures } from '../lib/fileEcritures'
import { useAuth } from '../context/AuthContext'
import { usePosition } from '../context/PositionContext'
import { obtenirPosition } from './OutilsRapport'

/* ------------------------------------------------------------------ */
/* Appel d'aide                                                        */

const NIVEAUX_AIDE = [
  { valeur: 'attention', libelle: "J'ai besoin d'aide", aide: 'Pas de danger immédiat', classe: 'discret' },
  { valeur: 'urgent', libelle: 'URGENT', aide: 'Situation qui se dégrade', classe: 'principal' },
  { valeur: 'mayday', libelle: 'MAYDAY', aide: 'Danger vital, je suis en difficulté', classe: 'principal' },
]
const STATUT_AIDE = { ouverte: 'envoyé, pas encore vu', vue: 'vu par le CC', prise_en_charge: 'pris en charge', close: 'clos' }

/**
 * Gros bouton d'appel d'aide : deux gestes (ouvrir, choisir le niveau) pour éviter l'envoi
 * accidentel, sans formulaire. Envoie la position, le rôle et le niveau au CC ; l'écriture
 * passe par la file hors ligne. L'état de l'appel (vu / pris en charge) revient ici.
 */
export function BoutonAide({ incidentId, contexteId, roleLibelle }) {
  const { utilisateur } = useAuth()
  const { position } = usePosition()
  const [ouvert, setOuvert] = useState(false)
  const [message, setMessage] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [info, setInfo] = useState(null)
  const [mesAppels, setMesAppels] = useState([])

  const charger = useCallback(async () => {
    if (!utilisateur) return
    const depuis = new Date(Date.now() - 3 * 3600000).toISOString()
    const { data } = await supabase
      .from('alertes_aide')
      .select('id, niveau, statut, created_at')
      .eq('incident_id', incidentId)
      .eq('auteur_id', utilisateur.id)
      .gte('created_at', depuis)
      .neq('statut', 'close')
      .order('created_at', { ascending: false })
    setMesAppels(data ?? [])
  }, [incidentId, utilisateur])

  useEffect(() => {
    charger()
    const t = setInterval(charger, 20000)
    return () => clearInterval(t)
  }, [charger])

  async function envoyer(niveau) {
    setEnCours(true)
    const pos = await obtenirPosition(position)
    const res = await fileEcritures.ecrireOuEmpiler({
      nature: 'insert',
      table: 'alertes_aide',
      champs: {
        contexte_id: contexteId,
        incident_id: incidentId,
        role_libelle: roleLibelle ?? null,
        niveau,
        message: message.trim() || null,
        latitude: pos?.lat ?? null,
        longitude: pos?.lon ?? null,
        precision_m: pos?.precision_m ?? null,
      },
      libelle: `Appel d'aide · ${niveau}`,
    })
    setEnCours(false)
    if (res.statut === 'refus') {
      setInfo({ erreur: true, texte: res.message })
      return
    }
    setInfo({ texte: res.statut === 'enfile' ? "Appel enregistré : il part dès que le réseau revient. Si possible, appelez aussi par radio ou téléphone." : 'Appel envoyé au CC avec votre position.' })
    setOuvert(false)
    setMessage('')
    charger()
  }

  return (
    <div>
      {!ouvert ? (
        <button
          type="button"
          onClick={() => { setOuvert(true); setInfo(null) }}
          className="bouton-terrain principal"
          style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#fff', fontSize: 18, padding: '16px 12px' }}
        >
          🆘 Besoin d'aide
        </button>
      ) : (
        <div className="carte space-y-2">
          <p className="text-sm font-medium text-encre">Quel niveau ?</p>
          {NIVEAUX_AIDE.map((n) => (
            <button
              key={n.valeur}
              type="button"
              disabled={enCours}
              onClick={() => envoyer(n.valeur)}
              className={`bouton-terrain ${n.classe}`}
              style={n.valeur !== 'attention' ? { background: n.valeur === 'mayday' ? '#7f1d1d' : '#b91c1c', borderColor: '#7f1d1d', color: '#fff' } : undefined}
            >
              {n.libelle} <span style={{ fontWeight: 400, fontSize: 12 }}>· {n.aide}</span>
            </button>
          ))}
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Précision (facultatif)" className="w-full" />
          <button type="button" className="discret" onClick={() => setOuvert(false)} disabled={enCours}>Annuler</button>
        </div>
      )}
      {info && <p className={`message${info.erreur ? ' erreur' : ''} mt-2`}>{info.texte}</p>}
      {mesAppels.length > 0 && (
        <ul className="mt-2 space-y-1">
          {mesAppels.map((a) => (
            <li key={a.id} className="text-xs text-sourdine">
              Mon appel {a.niveau} ({ilYA(a.created_at)}) : {STATUT_AIDE[a.statut] ?? a.statut}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Position : activation, partage, alerte de zone                      */

export function PanneauPosition() {
  const { actif, partage, position, erreur, dansZoneRouge, setActif, setPartage } = usePosition()
  return (
    <div className="space-y-2">
      {dansZoneRouge && (
        <div className="message erreur" role="alert">
          ⚠ Vous êtes dans la zone ROUGE (exclusion). Réservée aux services d'intervention, experts et techniciens.
        </div>
      )}
      <label className="flex items-center gap-3 text-sm text-encre">
        <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        Activer ma position (carte, « autour de moi », alerte de zone)
      </label>
      <label className="flex items-center gap-3 text-sm text-encre">
        <input type="checkbox" checked={partage} onChange={(e) => setPartage(e.target.checked)} />
        Partager ma position avec le CC
      </label>
      {actif && position && (
        <p className="text-xs text-sourdine">
          Position à ±{Math.round(position.precision_m ?? 0)} m, {ilYA(position.ts)}.
        </p>
      )}
      {actif && !position && !erreur && <p className="text-xs text-sourdine">Recherche de la position…</p>}
      {erreur && <p className="message erreur">{erreur}</p>}
      <p className="text-xs text-sourdine">
        Le partage s'arrête quand vous le désactivez (votre point disparaît du CC). Le téléphone peut suspendre la localisation
        écran éteint ou l'app en arrière-plan : gardez l'app ouverte.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Autour de moi                                                       */

const REFERENTIELS = [
  { table: 'objets_a_risque', champNom: 'identification', champSous: 'categorie', genre: 'Objet à risque' },
  { table: 'infrastructures_critiques', champNom: 'nom', champSous: 'type', genre: 'Infrastructure critique' },
  { table: 'centres_accueil', champNom: 'nom', champSous: 'type_lieu', genre: "Centre d'accueil" },
  { table: 'sites_qg', champNom: 'nom', genre: 'Site CC' },
]
const RAYON_AUTOUR_M = 1000

/** Ce qui se trouve dans un rayon de 1 km autour de moi, avec distance, cap et itinéraire. */
export function AutourDeMoi() {
  const { contexteId } = useAuth()
  const { actif, position } = usePosition()
  const [elements, setElements] = useState(null)

  useEffect(() => {
    if (!actif || !contexteId) return
    let annule = false
    Promise.all(
      REFERENTIELS.map((r) =>
        supabase
          .from(r.table)
          .select(`id, ${r.champNom}${r.champSous ? `, ${r.champSous}` : ''}, latitude, longitude`)
          .eq('contexte_id', contexteId)
          .not('latitude', 'is', null)
          .then(({ data }) => (data ?? []).map((x) => ({ ...x, genre: r.genre, nom: x[r.champNom], sous: r.champSous ? x[r.champSous] : null })))
      )
    ).then((l) => !annule && setElements(l.flat()))
    return () => {
      annule = true
    }
  }, [actif, contexteId])

  if (!actif) return <p className="vide">Activez votre position (onglet « Ma position ») pour voir ce qui vous entoure.</p>
  if (!position) return <p className="vide">Recherche de la position…</p>
  if (elements === null) return <p className="vide">Chargement…</p>

  const proches = elements
    .map((e) => ({ ...e, d: distanceM(position, { lat: Number(e.latitude), lon: Number(e.longitude) }) }))
    .filter((e) => e.d <= RAYON_AUTOUR_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, 15)

  if (proches.length === 0) {
    return <p className="vide border border-dashed border-trait text-center p-4">Rien de référencé à moins de {libelleDistance(RAYON_AUTOUR_M)}.</p>
  }

  return (
    <ul className="space-y-2">
      {proches.map((e) => (
        <li key={`${e.genre}-${e.id}`} className="carte">
          <p className="text-sm font-medium text-encre">{e.nom}</p>
          <p className="text-xs text-sourdine">
            {e.genre}
            {e.sous ? ` · ${e.sous}` : ''} · {distanceEtCap(position, { lat: Number(e.latitude), lon: Number(e.longitude) })}
          </p>
          <a href={lienItineraire(e.latitude, e.longitude)} target="_blank" rel="noreferrer" className="lien text-xs">
            Itinéraire ↗
          </a>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Passation                                                           */

const CATEGORIES = { evacues: 'évacués', accueillis: 'accueillis', blesses: 'blessés', personnes_a_risque: 'personnes à risque', introuvables: 'introuvables' }
const heure = (d) => new Date(d).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })

/** Fiche de passation générée à partir de ce que l'application sait : à copier ou partager à la relève. */
export function Passation({ incident, roleLibelle }) {
  const [texte, setTexte] = useState(null)
  const [message, setMessage] = useState(null)

  const generer = useCallback(async () => {
    const id = incident.id
    const [sitrep, zones, moyens, points, aides, comptages, rapports] = await Promise.all([
      supabase.from('sitreps').select('numero, horodatage, canal_conditions, canal_actions, canal_besoins, canal_anticipation, canal_logistique').eq('incident_id', id).order('numero', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('zones_intervention').select('type_zone, rayon_metres, acces_autorise').eq('incident_id', id).is('date_levee', null),
      supabase.from('moyens_engages').select('libelle, statut, effectif, created_at').eq('incident_id', id).neq('statut', 'retire').order('created_at'),
      supabase.from('observations_terrain').select('type, description').eq('incident_id', id).eq('statut', 'ouvert'),
      supabase.from('alertes_aide').select('niveau, role_libelle, created_at, statut').eq('incident_id', id).neq('statut', 'close'),
      supabase.from('comptages_personnes').select('categorie, nombre, auteur_id, created_at').eq('incident_id', id).order('created_at', { ascending: false }),
      supabase.from('rapports_can').select('role_libelle, je_demande, je_prevois, created_at').eq('incident_id', id).order('created_at', { ascending: false }).limit(3),
    ])
    const l = []
    l.push(`PASSATION — ${incident.nom}`)
    l.push(`Établie à ${heure(new Date())} par ${roleLibelle ?? 'un intervenant'}`)
    const s = sitrep.data
    if (s) {
      l.push('', `SITUATION (SitRep n°${s.numero}, ${heure(s.horodatage)})`)
      for (const [cle, lib] of [['canal_conditions', 'Conditions'], ['canal_actions', 'Actions'], ['canal_besoins', 'Besoins'], ['canal_anticipation', 'Anticipation'], ['canal_logistique', 'Logistique']]) {
        if (s[cle]) l.push(`- ${lib} : ${s[cle]}`)
      }
    }
    if ((zones.data ?? []).length) {
      l.push('', 'ZONES ACTIVES')
      for (const z of zones.data) l.push(`- ${z.type_zone}${z.rayon_metres ? ` (rayon ${z.rayon_metres} m)` : ''}`)
    }
    if ((moyens.data ?? []).length) {
      l.push('', 'MOYENS ENGAGÉS')
      for (const m of moyens.data) {
        const h = heuresDepuis(m.created_at)
        l.push(`- ${m.libelle} · ${m.statut}${m.effectif != null ? ` · ${m.effectif} pers.` : ''} · engagé depuis ${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`)
      }
    }
    if ((points.data ?? []).length) {
      l.push('', 'POINTS OUVERTS')
      for (const p of points.data) l.push(`- ${p.type}${p.description ? ` : ${p.description}` : ''}`)
    }
    if ((aides.data ?? []).length) {
      l.push('', "APPELS D'AIDE NON CLOS")
      for (const a of aides.data) l.push(`- ${a.niveau} (${a.role_libelle ?? '—'}, ${heure(a.created_at)}) : ${a.statut}`)
    }
    // dernier chiffre par catégorie et par personne, puis somme
    const vus = new Set()
    const totaux = {}
    for (const c of comptages.data ?? []) {
      const k = `${c.categorie}-${c.auteur_id}`
      if (vus.has(k)) continue
      vus.add(k)
      totaux[c.categorie] = (totaux[c.categorie] ?? 0) + c.nombre
    }
    if (Object.keys(totaux).length) {
      l.push('', 'COMPTAGES (derniers chiffres rapportés)')
      for (const [k, v] of Object.entries(totaux)) l.push(`- ${CATEGORIES[k] ?? k} : ${v}`)
    }
    const demandes = (rapports.data ?? []).filter((r) => r.je_demande || r.je_prevois)
    if (demandes.length) {
      l.push('', 'DEMANDES ET INTENTIONS RÉCENTES')
      for (const r of demandes) {
        if (r.je_demande) l.push(`- Demande (${r.role_libelle ?? '—'}, ${heure(r.created_at)}) : ${r.je_demande}`)
        if (r.je_prevois) l.push(`- Prévu (${r.role_libelle ?? '—'}, ${heure(r.created_at)}) : ${r.je_prevois}`)
      }
    }
    l.push('', 'À COMPLÉTER PAR LE SORTANT : points d\'attention, décisions en attente, consignes reçues.')
    setTexte(l.join('\n'))
  }, [incident, roleLibelle])

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte)
      setMessage('Copié.')
    } catch {
      setMessage('Copie impossible : sélectionnez le texte à la main.')
    }
  }

  async function partager() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Passation', text: texte })
      } catch {
        /* partage annulé */
      }
    } else {
      copier()
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-sourdine">Rassemble sur une page ce que l'application sait : à transmettre à la personne ou à l'équipe qui prend la relève.</p>
      <button type="button" className="bouton-terrain principal" onClick={generer}>
        {texte ? 'Régénérer la fiche' : 'Générer la fiche de passation'}
      </button>
      {texte && (
        <>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={16} className="w-full" style={{ fontFamily: 'monospace', fontSize: 13 }} />
          <div className="flex gap-2">
            <button type="button" className="discret" onClick={copier}>Copier</button>
            <button type="button" className="discret" onClick={partager}>Partager…</button>
          </div>
          {message && <p className="message">{message}</p>}
        </>
      )}
    </div>
  )
}
