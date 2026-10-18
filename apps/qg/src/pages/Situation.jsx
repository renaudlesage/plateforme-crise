import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CATEGORIES_SITUATION,
  MENTION_CAMERAS,
  correspondRecherche,
  heureMinuteBelge,
  jourBelge,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useSituation } from '../hooks/useSituation'
import TuileSource from '../components/TuileSource'
import { BlocSourcesUtiles } from '../components/SourcesUtiles'
import { BoutonDiscret } from '../components/Boutons'

const FUSEAU = 'Europe/Brussels'
const dateLongue = (t) => new Intl.DateTimeFormat('fr-BE', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(t))

/**
 * Pupitre de veille sociétale du Comité de Coordination : marchés, médias, routes, webcams, eau, nucléaire, société.
 * Toutes les sources sont des liens sortants vers des sites officiels ou publics ; Crisiware n'affiche, ne lit et
 * n'enregistre aucun flux. Ce qui est partagé : qui a regardé quelle source et quand (« Marquer vu »). Les épingles
 * sont personnelles.
 *
 * Anti-surcharge : pendant la réponse à un incident réel (alerte, phase active), les catégories sont repliées et seules
 * les sources liées à l'aléa de l'incident sont mises en avant.
 */
export default function Situation() {
  const { contexteId } = useAuth()
  const situation = useSituation(contexteId)
  const [requete, setRequete] = useState('')
  const [seulementTableau, setSeulementTableau] = useState(false)
  const [maintenant, setMaintenant] = useState(() => Date.now())
  const [reponses, setReponses] = useState([])

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 20000)
    return () => clearInterval(t)
  }, [])

  // Incidents réels en phase de réponse : la page se met en retrait.
  useEffect(() => {
    if (!contexteId) return
    let annule = false
    supabase
      .from('incidents')
      .select('id, nom, type_evenement, phase_cycle_vie, est_exercice')
      .eq('contexte_id', contexteId)
      .eq('statut', 'en_cours')
      .eq('est_exercice', false)
      .in('phase_cycle_vie', ['alerte', 'phase_active'])
      .then(({ data }) => {
        if (!annule) setReponses(data ?? [])
      })
    return () => {
      annule = true
    }
  }, [contexteId])

  const toutes = situation.sources ?? []
  const filtre = (s) => correspondRecherche(s, requete)
  const visibles = toutes.filter((s) => filtre(s) && (!seulementTableau || situation.epinglee(s)))
  const tableau = toutes.filter((s) => filtre(s) && situation.epinglee(s))
  const nbEpinglees = toutes.filter((s) => situation.epinglee(s)).length
  const nbVuesAujourdhui = toutes.filter((s) => {
    const v = situation.verifications[s.id]
    return v && jourBelge(v.verifie_le) === jourBelge(maintenant)
  }).length
  const filtreActif = requete.trim() !== '' || seulementTableau
  const replie = reponses.length > 0 && !filtreActif

  const tuile = (s) => (
    <TuileSource
      key={s.id}
      source={s}
      epinglee={situation.epinglee(s)}
      verification={situation.verifications[s.id]}
      peutVerifier={situation.peutVerifier}
      maintenant={maintenant}
      onEpingler={situation.basculerEpingle}
      onVu={situation.marquerVu}
    />
  )

  const categories = CATEGORIES_SITUATION.map((c) => ({ ...c, lignes: visibles.filter((s) => s.categorie === c.cle) })).filter(
    (c) => c.lignes.length > 0 || !filtreActif
  )

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-3">
        <div>
          <h1 className="text-lg font-semibold text-encre" style={{ margin: 0 }}>Situation sociétale</h1>
          <p className="text-sm text-sourdine" style={{ margin: '4px 0 0', maxWidth: '62ch' }}>
            Tableau de veille pour le Comité de Coordination : marchés, médias en direct, caméras routières, webcams publiques, eau, nucléaire et sécurité.
            Chaque tuile ouvre la source officielle ou publique.
          </p>
        </div>
        <div className="text-right" aria-live="off" style={{ fontFamily: 'var(--mono)' }}>
          <b data-horloge className="block text-2xl font-medium text-encre">{heureMinuteBelge(maintenant)}</b>
          <span className="text-xs text-sourdine">Bruxelles · {dateLongue(maintenant)}</span>
        </div>
      </header>

      <p className="flex flex-wrap gap-2 mb-3" style={{ margin: '0 0 12px' }}>
        <span className="jeton">Sources {toutes.length}</span>
        <span className="jeton">Épinglées {nbEpinglees}</span>
        <span className="jeton">Vues aujourd'hui {nbVuesAujourdhui}</span>
      </p>

      <p role="note" className="text-sm text-encre border border-trait rounded px-3 py-2 mb-3 bg-surface" style={{ margin: '0 0 12px' }}>
        <strong>Pas de flux intégré ici.</strong> Cette page classe les sources, garde vos épingles et note ce que la cellule a vérifié (qui, quand).
        {' '}{MENTION_CAMERAS}
      </p>

      {situation.erreur && <p role="alert" className="text-sm text-chaud mb-3">{situation.erreur}</p>}

      {reponses.length > 0 && (
        <section role="note" aria-label="Incidents en phase de réponse" className="border border-trait rounded p-3 mb-4 bg-surface">
          <p className="text-sm text-encre" style={{ margin: '0 0 8px' }}>
            <strong>{reponses.length > 1 ? 'Incidents en phase de réponse' : 'Incident en phase de réponse'}.</strong>{' '}
            Cette page est un pupitre de veille, pas un écran de crise : les catégories sont repliées. Voici les sources utiles à l'aléa.
          </p>
          {reponses.slice(0, 3).map((i) => (
            <div key={i.id} className="mb-3">
              <h2 className="text-sm font-semibold text-encre" style={{ margin: '0 0 6px' }}>
                <Link to={`/incidents/${i.id}`} className="underline">{i.nom}</Link>
              </h2>
              <BlocSourcesUtiles incident={i} situation={situation} maintenant={maintenant} />
            </div>
          ))}
          {reponses.length > 3 && <p className="text-xs text-sourdine" style={{ margin: 0 }}>{reponses.length - 3} autre(s) incident(s) en phase de réponse : voir leur fiche.</p>}
        </section>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Rechercher une source (ex. Meuse, Tihange, Brent)"
          aria-label="Rechercher une source"
          style={{ flex: '1 1 220px', minWidth: 0, marginBottom: 0 }}
        />
        <BoutonDiscret
          type="button"
          aria-pressed={seulementTableau}
          onClick={() => setSeulementTableau((v) => !v)}
          style={seulementTableau ? { background: 'var(--encre)', color: 'var(--fond)' } : undefined}
        >
          Mon tableau seulement
        </BoutonDiscret>
      </div>

      {situation.sources === null ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : toutes.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune source disponible. Le référentiel national se charge depuis la base ; les sources de la commune se règlent dans l'administration.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
          <nav aria-label="Catégories" className="flex gap-1.5 overflow-x-auto md:flex-col md:overflow-visible md:sticky md:top-2 md:self-start">
            <a href="#sit-tableau" className="text-sm px-2.5 py-1.5 border border-trait rounded whitespace-nowrap md:whitespace-normal text-encre no-underline">
              Mon tableau <span className="text-xs text-sourdine">{tableau.length}</span>
            </a>
            {categories.map((c) => (
              <a key={c.cle} href={`#sit-${c.cle}`} className="text-sm px-2.5 py-1.5 border border-trait rounded whitespace-nowrap md:whitespace-normal text-encre no-underline">
                {c.libelle} <span className="text-xs text-sourdine">{c.lignes.length}</span>
              </a>
            ))}
          </nav>

          <div className="min-w-0">
            <Section id="sit-tableau" titre="Mon tableau" intro="Les sources que vous gardez sous la main. Épinglez ou retirez d'un clic : ce choix n'est visible que de vous." nombre={tableau.length}>
              {tableau.length === 0 ? <Vide /> : <Grille>{tableau.map(tuile)}</Grille>}
            </Section>
            {categories.map((c) => (
              <Section key={c.cle} id={`sit-${c.cle}`} titre={c.libelle} intro={c.intro} nombre={c.lignes.length} replie={replie}>
                {c.lignes.length === 0 ? <Vide /> : <Grille>{c.lignes.map(tuile)}</Grille>}
              </Section>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-sourdine mt-6" style={{ maxWidth: '80ch' }}>
        Les adresses sont des points d'entrée, à contrôler avant tout usage opérationnel : la date du dernier « vu » est indiquée sur chaque tuile.
        Vos épingles sont personnelles ; les « vu » sont partagés avec la cellule (ils s'ajoutent, ils ne se modifient pas).
        Pour ajouter une source de la commune : administration › Anticipation › Sources de situation.
      </p>
    </div>
  )
}

function Grille({ children }) {
  return <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>{children}</div>
}

function Vide() {
  return <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4" style={{ margin: 0 }}>Rien à afficher ici avec ce filtre.</p>
}

/** Catégorie dépliable : repliée pendant la réponse à un incident, jamais quand une recherche ou « Mon tableau seulement » est active. */
function Section({ id, titre, intro, nombre, replie = false, children }) {
  return (
    <details id={id} open={!replie} className="mb-8" style={{ scrollMarginTop: 12 }}>
      <summary className="cursor-pointer mb-2">
        <h2 className="text-base font-semibold text-encre" style={{ display: 'inline', margin: 0 }}>{titre}</h2>{' '}
        <span className="text-xs text-sourdine">({nombre})</span>
      </summary>
      {intro && <p className="text-sm text-sourdine mb-3" style={{ margin: '0 0 12px', maxWidth: '70ch' }}>{intro}</p>}
      {children}
    </details>
  )
}
