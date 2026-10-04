import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const ETAPES_DEMARCHE = [
  { valeur: 'intentions', libelle: 'Intentions' },
  { valeur: 'diagnostic', libelle: 'Diagnostic' },
  { valeur: 'processus_participatif', libelle: 'Processus participatif' },
  { valeur: 'integration_planification', libelle: 'Intégration planification (PST/SDL/SDT)' },
]

export default function ResilienceTerritoriale() {
  const { contexteId } = useAuth()
  const [axes, setAxes] = useState([])
  const [categoriesAleas, setCategoriesAleas] = useState([])
  const [besoins, setBesoins] = useState([])

  useEffect(() => {
    supabase.from('axes_analyse_resilience').select('*').then(({ data }) => setAxes(data ?? []))
    supabase.from('categories_aleas_wef').select('*').then(({ data }) => setCategoriesAleas(data ?? []))
    supabase.from('besoins_fondamentaux_resilience').select('*').order('ordre').then(({ data }) => setBesoins(data ?? []))
  }, [])

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Résilience territoriale</h1>
      <p className="text-sm text-sourdine mb-5">
        Diagnostic et stratégie de résilience territoriale — registre pré-crise et prévention
        structurelle (méthodologie Homeos, Région wallonne, et grille d'analyse AIRT Cerema/CGDD).
        Ouvert aux communes, GAL (Groupes d'Action Locale) et intercommunales.
      </p>

      <BlocDiagnostic contexteId={contexteId} axes={axes} />
      <BlocVulnerabilite contexteId={contexteId} categoriesAleas={categoriesAleas} />
      <BlocDemarches contexteId={contexteId} besoins={besoins} />
    </div>
  )
}

function BlocDiagnostic({ contexteId, axes }) {
  const [diagnostics, setDiagnostics] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    const { data, error } = await supabase
      .from('diagnostic_resilience_territoire')
      .select('*, axes_analyse_resilience(code, libelle)')
      .eq('contexte_id', contexteId)
      .order('date_diagnostic', { ascending: false })
    if (error) setErreur(error.message)
    else setDiagnostics(data ?? [])
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function noter(axeId, niveau) {
    const { error } = await supabase.from('diagnostic_resilience_territoire').insert({
      contexte_id: contexteId,
      axe_id: axeId,
      niveau_maturite: niveau,
    })
    if (!error) await rafraichir()
    else setErreur(error.message)
  }

  const dernierParAxe = Object.fromEntries(
    axes.map((a) => [a.id, diagnostics.find((d) => d.axe_id === a.id)])
  )

  return (
    <div className="mb-6">
      <h2 className="font-medium text-encre mb-1">Diagnostic de maturité — grille 4 axes (AIRT)</h2>
      <p className="text-xs text-sourdine mb-3">
        Temporalités/échelles, adaptation, apprentissage/innovation, gouvernance — noter chaque
        axe de 1 (peu mature) à 5 (mature) pour suivre l'évolution dans le temps.
      </p>
      {erreur && <p className="text-xs text-chaud mb-2">{erreur}</p>}
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {axes.map((a) => {
            const dernier = dernierParAxe[a.id]
            return (
              <div key={a.id} className="border border-trait rounded p-3 bg-fond">
                <p className="text-sm font-medium text-encre mb-1">{a.libelle}</p>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => noter(a.id, n)}
                      className={`pastille-filtre${dernier?.niveau_maturite === n ? ' actif' : ''}`}
                    >
                      {n}
                    </button>
                  ))}
                  {dernier && (
                    <span className="text-xs text-sourdine ml-1">
                      ({new Date(dernier.date_diagnostic).toLocaleDateString('fr-BE')})
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BlocVulnerabilite({ contexteId, categoriesAleas }) {
  const [vulnerabilites, setVulnerabilites] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const rafraichir = useCallback(async () => {
    if (!contexteId) return
    setChargement(true)
    const { data, error } = await supabase
      .from('vulnerabilites_territoriales')
      .select('*, categories_aleas_wef(code, libelle)')
      .eq('contexte_id', contexteId)
    if (error) setErreur(error.message)
    else setVulnerabilites(data ?? [])
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function noter(categorieAleaId, champ, valeur) {
    const existant = vulnerabilites.find((v) => v.categorie_alea_id === categorieAleaId)
    if (existant) {
      const { error } = await supabase
        .from('vulnerabilites_territoriales')
        .update({ [champ]: valeur })
        .eq('id', existant.id)
      if (!error) await rafraichir()
      else setErreur(error.message)
    } else {
      const { error } = await supabase.from('vulnerabilites_territoriales').insert({
        contexte_id: contexteId,
        categorie_alea_id: categorieAleaId,
        [champ]: valeur,
      })
      if (!error) await rafraichir()
      else setErreur(error.message)
    }
  }

  return (
    <div className="mb-6">
      <h2 className="font-medium text-encre mb-1">Vulnérabilité = capacité × sensibilité</h2>
      <p className="text-xs text-sourdine mb-3">
        Par catégorie d'aléa (WEF Global Risks Report) : notez la capacité (1 faible → 5 forte) et
        la sensibilité (1 faible → 5 forte) du territoire. Score de vulnérabilité calculé
        automatiquement.
      </p>
      {erreur && <p className="text-xs text-chaud mb-2">{erreur}</p>}
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <table className="w-full text-xs border border-trait rounded overflow-hidden">
          <thead>
            <tr className="bg-fond text-sourdine">
              <th className="text-left px-2 py-1.5">Catégorie d'aléa</th>
              <th className="px-2 py-1.5">Capacité</th>
              <th className="px-2 py-1.5">Sensibilité</th>
              <th className="px-2 py-1.5">Vulnérabilité</th>
            </tr>
          </thead>
          <tbody>
            {categoriesAleas.map((c) => {
              const v = vulnerabilites.find((x) => x.categorie_alea_id === c.id)
              return (
                <tr key={c.id} className="bg-surface border-t border-trait">
                  <td className="px-2 py-1.5 text-encre">{c.libelle}</td>
                  <td className="px-2 py-1.5 text-center">
                    <select
                      value={v?.score_capacite ?? ''}
                      onChange={(e) => noter(c.id, 'score_capacite', Number(e.target.value))}
                      className="text-xs"
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <select
                      value={v?.score_sensibilite ?? ''}
                      onChange={(e) => noter(c.id, 'score_sensibilite', Number(e.target.value))}
                      className="text-xs"
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center font-medium text-encre">
                    {v?.score_vulnerabilite ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function BlocDemarches({ contexteId, besoins }) {
  const {
    lignes: demarches,
    chargement,
    erreur,
    creer,
    modifier,
    supprimer,
  } = useTableContexte('demarches_resilience_territoriale', contexteId, { tri: 'date_debut' })

  const [enAjout, setEnAjout] = useState(false)
  const [demarcheDepliee, setDemarcheDepliee] = useState(null)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">Démarches de résilience territoriale</h2>
        {!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Nouvelle démarche</BoutonPrincipal>}
      </div>
      <p className="text-xs text-sourdine mb-3">
        Méthodologie en 4 étapes (outil Homeos) : intentions → diagnostic → processus participatif
        → intégration dans la planification stratégique (PST/SDL/SDT).
      </p>

      {erreur && <p className="text-xs text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <FormulaireDemarche
          onAnnuler={() => setEnAjout(false)}
          onValider={async (valeurs) => {
            const { error } = await creer(valeurs)
            if (!error) setEnAjout(false)
            return { error }
          }}
        />
      )}

      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : demarches.length === 0 && !enAjout ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucune démarche de résilience territoriale enregistrée.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
          {demarches.map((d) => (
            <li key={d.id} className="bg-surface">
              <div className="flex items-center justify-between px-4 py-2.5">
                <p className="text-sm text-encre">
                  <span className="jeton mr-2 text-info">{ETAPES_DEMARCHE.find((e) => e.valeur === d.etape)?.libelle}</span>
                  {d.outil_utilise}
                  {d.date_debut && <span className="text-xs text-sourdine ml-2">depuis le {new Date(d.date_debut).toLocaleDateString('fr-BE')}</span>}
                </p>
                <div className="flex gap-2 flex-shrink-0">
                  <select
                    value={d.etape}
                    onChange={(e) => modifier(d.id, { etape: e.target.value })}
                    className="text-xs"
                  >
                    {ETAPES_DEMARCHE.map((e) => <option key={e.valeur} value={e.valeur}>{e.libelle}</option>)}
                  </select>
                  <BoutonDiscret onClick={() => setDemarcheDepliee(demarcheDepliee === d.id ? null : d.id)}>
                    {demarcheDepliee === d.id ? 'Fermer' : 'Détails'}
                  </BoutonDiscret>
                  <BoutonDiscret
                    onClick={() => {
                      if (confirm('Supprimer cette démarche ?')) supprimer(d.id)
                    }}
                  >
                    Supprimer
                  </BoutonDiscret>
                </div>
              </div>
              {demarcheDepliee === d.id && (
                <div className="px-4 pb-3 bg-fond grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <GestionLeviers demarcheId={d.id} besoins={besoins} />
                  <GestionActeurs demarcheId={d.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireDemarche({ valeursInitiales = {}, onValider, onAnnuler }) {
  const [etape, setEtape] = useState(valeursInitiales.etape ?? 'intentions')
  const [outilUtilise, setOutilUtilise] = useState(valeursInitiales.outil_utilise ?? 'Homeos')
  const [dateDebut, setDateDebut] = useState(valeursInitiales.date_debut ?? '')
  const [documentUrl, setDocumentUrl] = useState(valeursInitiales.document_url ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      etape,
      outil_utilise: outilUtilise.trim() || 'Homeos',
      date_debut: dateDebut || null,
      document_url: documentUrl.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Étape</label>
          <select value={etape} onChange={(e) => setEtape(e.target.value)} className="w-full">
            {ETAPES_DEMARCHE.map((e) => <option key={e.valeur} value={e.valeur}>{e.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Date de début</label>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="w-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Outil utilisé</label>
          <input value={outilUtilise} onChange={(e) => setOutilUtilise(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Document (URL)</label>
          <input value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} className="w-full" />
        </div>
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

const STATUTS_LEVIER = [
  { valeur: 'identifie', libelle: 'Identifié' },
  { valeur: 'planifie', libelle: 'Planifié' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'realise', libelle: 'Réalisé' },
  { valeur: 'abandonne', libelle: 'Abandonné' },
]

function GestionLeviers({ demarcheId, besoins }) {
  const [leviers, setLeviers] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [libelle, setLibelle] = useState('')
  const [besoinFondamentalId, setBesoinFondamentalId] = useState('')
  const [responsable, setResponsable] = useState('')

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('leviers_action_resilience')
      .select('*')
      .eq('demarche_id', demarcheId)
    if (error) setErreur(error.message)
    else setLeviers(data ?? [])
    setChargement(false)
  }, [demarcheId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouter(e) {
    e.preventDefault()
    if (!libelle.trim()) return
    const { error } = await supabase.from('leviers_action_resilience').insert({
      demarche_id: demarcheId,
      libelle: libelle.trim(),
      besoin_fondamental_id: besoinFondamentalId || null,
      responsable: responsable.trim() || null,
    })
    if (!error) {
      setLibelle('')
      setResponsable('')
      await rafraichir()
    } else setErreur(error.message)
  }

  async function changerStatut(id, statut) {
    await supabase.from('leviers_action_resilience').update({ statut }).eq('id', id)
    await rafraichir()
  }

  async function retirer(id) {
    await supabase.from('leviers_action_resilience').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2">
      <p className="text-xs font-medium text-sourdine mb-1">Leviers d'action</p>
      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-2">
        <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="levier" className="text-xs flex-1 min-w-[8rem]" />
        <select value={besoinFondamentalId} onChange={(e) => setBesoinFondamentalId(e.target.value)} className="text-xs">
          <option value="">besoin —</option>
          {besoins.map((b) => <option key={b.id} value={b.id}>{b.libelle}</option>)}
        </select>
        <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="responsable" className="text-xs flex-1 min-w-[6rem]" />
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {leviers.map((l) => (
            <li key={l.id} className="flex items-center justify-between text-xs bg-surface border border-trait rounded px-2 py-1">
              <span>{l.libelle}{l.responsable && <> ({l.responsable})</>}</span>
              <span className="flex gap-1">
                <select value={l.statut} onChange={(e) => changerStatut(l.id, e.target.value)} className="text-xs">
                  {STATUTS_LEVIER.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
                </select>
                <button type="button" onClick={() => retirer(l.id)} className="text-sourdine hover:text-chaud">✕</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TYPES_ACTEUR = [
  { valeur: 'autorite_locale', libelle: 'Autorité locale' },
  { valeur: 'citoyen', libelle: 'Citoyen' },
  { valeur: 'association', libelle: 'Association' },
  { valeur: 'entreprise', libelle: 'Entreprise' },
  { valeur: 'gal', libelle: 'GAL' },
  { valeur: 'intercommunale', libelle: 'Intercommunale' },
  { valeur: 'autre', libelle: 'Autre' },
]

function GestionActeurs({ demarcheId }) {
  const [acteurs, setActeurs] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [nom, setNom] = useState('')
  const [typeActeur, setTypeActeur] = useState('autorite_locale')
  const [role, setRole] = useState('')

  const rafraichir = useCallback(async () => {
    setChargement(true)
    const { data, error } = await supabase
      .from('acteurs_resilience_territoriale')
      .select('*')
      .eq('demarche_id', demarcheId)
    if (error) setErreur(error.message)
    else setActeurs(data ?? [])
    setChargement(false)
  }, [demarcheId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function ajouter(e) {
    e.preventDefault()
    if (!nom.trim()) return
    const { error } = await supabase.from('acteurs_resilience_territoriale').insert({
      demarche_id: demarcheId,
      nom: nom.trim(),
      type_acteur: typeActeur,
      role: role.trim() || null,
    })
    if (!error) {
      setNom('')
      setRole('')
      await rafraichir()
    } else setErreur(error.message)
  }

  async function retirer(id) {
    await supabase.from('acteurs_resilience_territoriale').delete().eq('id', id)
    await rafraichir()
  }

  return (
    <div className="pt-2">
      <p className="text-xs font-medium text-sourdine mb-1">Acteurs impliqués (processus participatif)</p>
      {erreur && <p className="text-xs text-chaud mb-1">{erreur}</p>}
      <form onSubmit={ajouter} className="flex flex-wrap gap-1.5 mb-2">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="nom" className="text-xs flex-1 min-w-[6rem]" />
        <select value={typeActeur} onChange={(e) => setTypeActeur(e.target.value)} className="text-xs">
          {TYPES_ACTEUR.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </select>
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="rôle" className="text-xs flex-1 min-w-[6rem]" />
        <BoutonDiscret type="submit">Ajouter</BoutonDiscret>
      </form>
      {chargement ? (
        <p className="text-xs text-sourdine">Chargement…</p>
      ) : (
        <ul className="space-y-1">
          {acteurs.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-xs bg-surface border border-trait rounded px-2 py-1">
              <span>
                <span className="jeton mr-1.5">{TYPES_ACTEUR.find((t) => t.valeur === a.type_acteur)?.libelle}</span>
                {a.nom}{a.role && <> — {a.role}</>}
              </span>
              <button type="button" onClick={() => retirer(a.id)} className="text-sourdine hover:text-chaud">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
