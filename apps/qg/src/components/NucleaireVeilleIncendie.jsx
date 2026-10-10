import { useCallback, useEffect, useMemo, useState } from 'react'
import { ACTIONS_PROTECTION, CLASSES_URGENCE_NUCLEAIRE, libelleClasseUrgence } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'

function EnTete({ titre, aide, action }) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-encre">{titre}</h2>
        {action}
      </div>
      {aide && <p className="text-xs text-sourdine mb-3">{aide}</p>}
    </>
  )
}

// ---------------------------------------------------------------------------
// Plan d'urgence nucléaire : activations par classe d'urgence
// ---------------------------------------------------------------------------

/**
 * Déclenchement du plan d'urgence nucléaire et radiologique pour un incident :
 * site concerné, classe d'urgence, blocs soumis à des actions de protection.
 * Replié tant que l'incident n'est pas de nature nucléaire/radiologique et
 * qu'aucune activation n'existe.
 */
export function SectionPlanNucleaire({ incidentId, contexteId, typeEvenement }) {
  const [activations, setActivations] = useState([])
  const [sites, setSites] = useState([])
  const [blocsCommune, setBlocsCommune] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [deplie, setDeplie] = useState(null)

  const rafraichir = useCallback(async () => {
    const [a, s, c] = await Promise.all([
      supabase.from('activations_plan_nucleaire').select('*').eq('incident_id', incidentId).order('declenche_le', { ascending: false }),
      supabase.from('sites_nucleaires').select('id, nom').order('nom'),
      supabase.from('contextes').select('config').eq('id', contexteId).single(),
    ])
    if (a.error) setErreur(a.error.message)
    setActivations(a.data ?? [])
    setSites(s.data ?? [])
    const ins = c.data?.config?.code_ins
    if (ins) {
      const { data } = await supabase
        .from('blocs_communes')
        .select('blocs_planification_nucleaire(site_id, code_bloc, est_zone_reflexe, actions_preparees)')
        .eq('commune_code', ins)
      setBlocsCommune((data ?? []).map((x) => x.blocs_planification_nucleaire).filter(Boolean))
    }
    setChargement(false)
  }, [incidentId, contexteId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  const evenementNucleaire = /nucl|radiolog|cbrn|iode/i.test(typeEvenement ?? '')
  const ouvert = deplie ?? (activations.length > 0 || evenementNucleaire)

  async function creer(valeurs) {
    const { error } = await supabase
      .from('activations_plan_nucleaire')
      .insert({ ...valeurs, contexte_id: contexteId, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function retirer(id) {
    if (!confirm('Supprimer cette activation ?')) return
    const { error } = await supabase.from('activations_plan_nucleaire').delete().eq('id', id)
    if (error) setErreur(error.message)
    else rafraichir()
  }

  if (!ouvert) {
    return (
      <div>
        <h2 className="font-medium text-encre">Plan d'urgence nucléaire</h2>
        <button type="button" className="text-xs lien" onClick={() => setDeplie(true)}>
          Déclarer une classe d'urgence nucléaire ou radiologique…
        </button>
      </div>
    )
  }

  return (
    <div>
      <EnTete
        titre="Plan d'urgence nucléaire"
        aide="Classes d'urgence du plan nucléaire et radiologique (NCCN / AFCN). Le gouverneur et les bourgmestres président les cellules de crise provinciale et communales ; les actions de protection effectives sont fixées pendant la crise."
        action={!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Déclarer une classe</BoutonPrincipal>}
      />
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireActivation
            sites={sites}
            blocsCommune={blocsCommune}
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const r = await creer(v)
              if (!r.error) setEnAjout(false)
              return r
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : activations.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune classe d'urgence déclarée pour cet incident.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {activations.map((a) => (
            <li key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium text-encre">
                    {libelleClasseUrgence(a.classe_urgence)}
                    {a.est_exercice && <span className="jeton ml-2 text-info">exercice</span>}
                  </p>
                  <p className="text-xs text-sourdine">
                    {sites.find((s) => s.id === a.site_id)?.nom ?? 'Site non précisé'} · déclenché le{' '}
                    {new Date(a.declenche_le).toLocaleString('fr-BE')}
                  </p>
                  <p className="text-xs text-sourdine">{CLASSES_URGENCE_NUCLEAIRE.find((c) => c.valeur === a.classe_urgence)?.aide}</p>
                  {a.blocs_actions_protection?.length > 0 && (
                    <p className="text-xs text-encre">Blocs concernés par des actions de protection : {a.blocs_actions_protection.join(', ')}</p>
                  )}
                  {a.notes && <p className="text-xs text-sourdine whitespace-pre-line">{a.notes}</p>}
                </div>
                <BoutonDiscret onClick={() => retirer(a.id)}>✕</BoutonDiscret>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FormulaireActivation({ sites, blocsCommune, onValider, onAnnuler }) {
  const [siteId, setSiteId] = useState('')
  const [classe, setClasse] = useState('alert')
  const [quand, setQuand] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  const [blocs, setBlocs] = useState('')
  const [exercice, setExercice] = useState(false)
  const [notes, setNotes] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const blocsDuSite = blocsCommune.filter((b) => b.site_id === siteId)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const liste = blocs.split(',').map((b) => b.trim()).filter(Boolean)
    const { error } = await onValider({
      site_id: siteId || null,
      classe_urgence: classe,
      declenche_le: new Date(quand).toISOString(),
      blocs_actions_protection: liste.length ? liste : null,
      est_exercice: exercice,
      notes: notes.trim() || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Site</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="w-full">
            <option value="">—</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Classe d'urgence</label>
          <select value={classe} onChange={(e) => setClasse(e.target.value)} className="w-full">
            {CLASSES_URGENCE_NUCLEAIRE.map((c) => (
              <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Déclenchée le</label>
          <input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} className="w-full" />
        </div>
      </div>
      <p className="text-xs text-sourdine">{CLASSES_URGENCE_NUCLEAIRE.find((c) => c.valeur === classe)?.aide}</p>

      {blocsDuSite.length > 0 && (
        <p className="text-xs text-encre">
          Blocs de la commune pour ce site :{' '}
          {blocsDuSite
            .map(
              (b) =>
                `${b.code_bloc}${b.est_zone_reflexe ? ' (zone réflexe)' : ''}${
                  b.actions_preparees?.length ? ` — ${b.actions_preparees.map((a) => ACTIONS_PROTECTION.find((x) => x.valeur === a)?.libelle ?? a).join(', ')}` : ''
                }`
            )
            .join(' ; ')}
        </p>
      )}

      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Blocs soumis à des actions de protection (codes séparés par des virgules)</label>
        <input value={blocs} onChange={(e) => setBlocs(e.target.value)} placeholder="ex. Y5, A10" className="w-full" />
      </div>
      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={exercice} onChange={(e) => setExercice(e.target.checked)} />
        Exercice (annuel pour les centrales, tous les deux ans pour les autres sites)
      </label>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Notes</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" />
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Veille & chiffres de pertes (analyste de l'information)
// ---------------------------------------------------------------------------

const SOURCES = [
  { valeur: 'officiel', libelle: 'Source officielle' },
  { valeur: 'presse', libelle: 'Presse' },
  { valeur: 'citoyen', libelle: 'Signalement citoyen' },
  { valeur: 'reseau_social', libelle: 'Réseau social' },
  { valeur: 'autre', libelle: 'Autre' },
]
const VERIFICATION = [
  { valeur: 'non_verifie', libelle: 'Non vérifié' },
  { valeur: 'verifie', libelle: 'Vérifié' },
  { valeur: 'rejete', libelle: 'Rejeté' },
]
const INDICATEURS = [
  { valeur: 'affectes', libelle: 'Personnes affectées' },
  { valeur: 'deces', libelle: 'Décès' },
  { valeur: 'blesses', libelle: 'Blessés' },
  { valeur: 'deplaces', libelle: 'Déplacés' },
  { valeur: 'evacues', libelle: 'Évacués' },
  { valeur: 'batiments_detruits', libelle: 'Bâtiments détruits' },
]
const VALIDATION_PERTES = [
  { valeur: 'a_valider', libelle: 'À valider' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'corrige', libelle: 'Corrigé' },
  { valeur: 'rejete', libelle: 'Rejeté' },
]

/**
 * Veille de la cellule de crise : sources ouvertes et signalements, avec
 * vérification humaine obligatoire. Aucune collecte automatique : l'analyste de
 * l'information encode, vérifie et rapproche. Les chiffres de pertes restent
 * « à valider » tant qu'une personne ne les a pas confirmés.
 */
export function SectionVeille({ incidentId, contexteId }) {
  const [items, setItems] = useState([])
  const [pertes, setPertes] = useState([])
  const [lexique, setLexique] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [enAjoutPerte, setEnAjoutPerte] = useState(false)

  const rafraichir = useCallback(async () => {
    const [i, p, l] = await Promise.all([
      supabase.from('veille_items').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }),
      supabase.from('donnees_pertes_extraites').select('*').eq('incident_id', incidentId).order('created_at', { ascending: false }),
      supabase.from('lexique_detection_appels').select('langue, terme, categorie_besoin'),
    ])
    if (i.error) setErreur(i.error.message)
    else if (p.error) setErreur(p.error.message)
    setItems(i.data ?? [])
    setPertes(p.data ?? [])
    setLexique(l.data ?? [])
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  async function creerItem(v) {
    const { error } = await supabase.from('veille_items').insert({ ...v, contexte_id: contexteId, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function verifier(item, statut) {
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('veille_items')
      .update({
        statut_verification: statut,
        verifie_par: statut === 'non_verifie' ? null : u?.user?.id ?? null,
        verifie_le: statut === 'non_verifie' ? null : new Date().toISOString(),
      })
      .eq('id', item.id)
    if (error) setErreur(error.message)
    else rafraichir()
  }

  async function retirerItem(id) {
    if (!confirm('Supprimer cet élément de veille ?')) return
    const { error } = await supabase.from('veille_items').delete().eq('id', id)
    if (error) setErreur(error.message)
    else rafraichir()
  }

  async function creerPerte(v) {
    const { error } = await supabase.from('donnees_pertes_extraites').insert({ ...v, contexte_id: contexteId, incident_id: incidentId })
    if (error) return { error }
    await rafraichir()
    return { error: null }
  }

  async function validerPerte(p, statut) {
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('donnees_pertes_extraites')
      .update({
        statut_validation: statut,
        valide_par: statut === 'a_valider' ? null : u?.user?.id ?? null,
        valide_le: statut === 'a_valider' ? null : new Date().toISOString(),
      })
      .eq('id', p.id)
    if (error) setErreur(error.message)
    else rafraichir()
  }

  async function retirerPerte(id) {
    const { error } = await supabase.from('donnees_pertes_extraites').delete().eq('id', id)
    if (error) setErreur(error.message)
    else rafraichir()
  }

  // Termes du lexique d'appels à l'aide repérés dans un élément de veille.
  const termesRepares = useMemo(() => {
    const m = new Map()
    for (const it of items) {
      const texte = `${it.titre ?? ''} ${it.resume ?? ''}`.toLowerCase()
      m.set(it.id, lexique.filter((l) => texte.includes(l.terme.toLowerCase())))
    }
    return m
  }, [items, lexique])

  return (
    <div>
      <EnTete
        titre="Veille & chiffres de pertes"
        aide="Rôle d'analyste de l'information : sources ouvertes et signalements citoyens, vérifiés par une personne avant d'être utilisés. Aucune collecte automatique ; ne pas relayer un élément non vérifié."
        action={!enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>Ajouter un élément</BoutonPrincipal>}
      />
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireVeille
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const r = await creerItem(v)
              if (!r.error) setEnAjout(false)
              return r
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : items.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun élément de veille pour cet incident.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {items.map((it) => (
            <li key={it.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium text-encre">
                    {it.titre}
                    <span className={`jeton ml-2 ${it.statut_verification === 'verifie' ? 'text-ok' : it.statut_verification === 'rejete' ? 'text-chaud' : 'text-sourdine'}`}>
                      {VERIFICATION.find((v) => v.valeur === it.statut_verification)?.libelle}
                    </span>
                  </p>
                  <p className="text-xs text-sourdine">
                    {SOURCES.find((s) => s.valeur === it.source_type)?.libelle}
                    {it.lieu_texte && ` · ${it.lieu_texte}`}
                    {it.categorie_alea && ` · ${it.categorie_alea}`}
                    {' · '}{new Date(it.created_at).toLocaleString('fr-BE')}
                  </p>
                  {it.resume && <p className="text-sm text-encre whitespace-pre-line">{it.resume}</p>}
                  {it.url && (
                    <p className="text-xs">
                      <a href={it.url} target="_blank" rel="noreferrer noopener" className="lien">{it.url}</a>
                    </p>
                  )}
                  {termesRepares.get(it.id)?.length > 0 && (
                    <p className="text-xs text-chaud">
                      Appel à l'aide possible : {termesRepares.get(it.id).map((t) => `« ${t.terme} »${t.categorie_besoin ? ` (${t.categorie_besoin})` : ''}`).join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {VERIFICATION.filter((v) => v.valeur !== it.statut_verification).map((v) => (
                      <BoutonDiscret key={v.valeur} onClick={() => verifier(it, v.valeur)}>{v.libelle}</BoutonDiscret>
                    ))}
                  </div>
                </div>
                <BoutonDiscret onClick={() => retirerItem(it.id)}>✕</BoutonDiscret>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <EnTete
          titre="Chiffres de pertes"
          aide="Un chiffre n'est utilisable qu'une fois validé. Agrégats uniquement : jamais de données individuelles."
          action={!enAjoutPerte && <BoutonDiscret onClick={() => setEnAjoutPerte(true)}>Ajouter un chiffre</BoutonDiscret>}
        />
        {enAjoutPerte && (
          <div className="border border-trait rounded p-3 mb-3 bg-fond">
            <FormulairePerte
              items={items}
              onAnnuler={() => setEnAjoutPerte(false)}
              onValider={async (v) => {
                const r = await creerPerte(v)
                if (!r.error) setEnAjoutPerte(false)
                return r
              }}
            />
          </div>
        )}
        {pertes.length === 0 && !enAjoutPerte ? (
          <p className="vide border border-dashed border-trait text-center p-4">Aucun chiffre de pertes enregistré.</p>
        ) : (
          <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
            {pertes.map((p) => (
              <li key={p.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-encre">
                    {INDICATEURS.find((x) => x.valeur === p.indicateur)?.libelle} : <strong>{Number(p.valeur)}</strong>
                    {p.est_cumulatif && <span className="text-xs text-sourdine"> (cumulé)</span>}
                    {p.zone_admin_code && <span className="text-xs text-sourdine"> · zone {p.zone_admin_code}</span>}
                    {p.confiance != null && <span className="text-xs text-sourdine"> · confiance {Math.round(p.confiance * 100)} %</span>}
                    <span className={`jeton ml-2 ${p.statut_validation === 'valide' || p.statut_validation === 'corrige' ? 'text-ok' : p.statut_validation === 'rejete' ? 'text-chaud' : 'text-sourdine'}`}>
                      {VALIDATION_PERTES.find((v) => v.valeur === p.statut_validation)?.libelle}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {VALIDATION_PERTES.filter((v) => v.valeur !== p.statut_validation).map((v) => (
                      <BoutonDiscret key={v.valeur} onClick={() => validerPerte(p, v.valeur)}>{v.libelle}</BoutonDiscret>
                    ))}
                  </div>
                </div>
                <BoutonDiscret onClick={() => retirerPerte(p.id)}>✕</BoutonDiscret>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function FormulaireVeille({ onValider, onAnnuler }) {
  const [source, setSource] = useState('officiel')
  const [titre, setTitre] = useState('')
  const [url, setUrl] = useState('')
  const [resume, setResume] = useState('')
  const [lieu, setLieu] = useState('')
  const [alea, setAlea] = useState('')
  const [langue, setLangue] = useState('fr')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setEnCours(true)
    const { error } = await onValider({
      source_type: source,
      titre: titre.trim(),
      url: url.trim() || null,
      resume: resume.trim() || null,
      lieu_texte: lieu.trim() || null,
      categorie_alea: alea.trim() || null,
      langue,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full">
            {SOURCES.map((s) => (
              <option key={s.valeur} value={s.valeur}>{s.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Langue</label>
          <select value={langue} onChange={(e) => setLangue(e.target.value)} className="w-full">
            <option value="fr">Français</option>
            <option value="nl">Néerlandais</option>
            <option value="en">Anglais</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Aléa</label>
          <input value={alea} onChange={(e) => setAlea(e.target.value)} placeholder="ex. inondation" className="w-full" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Titre *</label>
        <input required value={titre} onChange={(e) => setTitre(e.target.value)} className="w-full" />
      </div>
      <div>
        <label className="block text-xs font-medium text-sourdine mb-1">Résumé</label>
        <textarea rows={3} value={resume} onChange={(e) => setResume(e.target.value)} className="w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Lien</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Lieu</label>
          <input value={lieu} onChange={(e) => setLieu(e.target.value)} className="w-full" />
        </div>
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

function FormulairePerte({ items, onValider, onAnnuler }) {
  const [indicateur, setIndicateur] = useState('affectes')
  const [valeur, setValeur] = useState('')
  const [zone, setZone] = useState('')
  const [cumulatif, setCumulatif] = useState(false)
  const [confiance, setConfiance] = useState('')
  const [itemId, setItemId] = useState('')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    if (valeur === '') return
    setEnCours(true)
    const { error } = await onValider({
      indicateur,
      valeur: Number(valeur),
      zone_admin_code: zone.trim() || null,
      est_cumulatif: cumulatif,
      confiance: confiance === '' ? null : Math.min(1, Math.max(0, Number(confiance) / 100)),
      veille_item_id: itemId || null,
    })
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Indicateur</label>
          <select value={indicateur} onChange={(e) => setIndicateur(e.target.value)} className="w-full">
            {INDICATEURS.map((i) => (
              <option key={i.valeur} value={i.valeur}>{i.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Valeur *</label>
          <input type="number" min="0" step="any" required value={valeur} onChange={(e) => setValeur(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code zone (INS)</label>
          <input value={zone} onChange={(e) => setZone(e.target.value)} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Confiance (%)</label>
          <input type="number" min="0" max="100" value={confiance} onChange={(e) => setConfiance(e.target.value)} className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-sourdine mb-1">Élément de veille source</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full">
            <option value="">—</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>{i.titre}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-sourdine">
        <input type="checkbox" checked={cumulatif} onChange={(e) => setCumulatif(e.target.checked)} />
        Total cumulé (et non un incrément)
      </label>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Cause d'un incendie
// ---------------------------------------------------------------------------

const CAUSES = [
  { valeur: 'accidentelle', libelle: 'Accidentelle' },
  { valeur: 'negligence', libelle: 'Négligence' },
  { valeur: 'intentionnelle', libelle: 'Intentionnelle' },
  { valeur: 'naturelle', libelle: 'Naturelle' },
  { valeur: 'inconnue', libelle: 'Inconnue' },
]
const ENQUETES = [
  { valeur: 'ouverte', libelle: 'Ouverte' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'close', libelle: 'Close' },
]

/** Cause et enquête d'un incendie (un enregistrement par incident). Repliée hors incendie. */
export function SectionCauseIncendie({ incidentId, contexteId, typeEvenement }) {
  const [ligne, setLigne] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [deplie, setDeplie] = useState(null)
  const [cause, setCause] = useState('')
  const [detail, setDetail] = useState('')
  const [enquete, setEnquete] = useState('ouverte')

  const rafraichir = useCallback(async () => {
    const { data, error } = await supabase.from('incendies_causes').select('*').eq('incident_id', incidentId).maybeSingle()
    if (error) setErreur(error.message)
    setLigne(data ?? null)
    setCause(data?.cause_categorie ?? '')
    setDetail(data?.cause_detail ?? '')
    setEnquete(data?.enquete_statut ?? 'ouverte')
    setChargement(false)
  }, [incidentId])

  useEffect(() => {
    rafraichir()
  }, [rafraichir])

  const incendie = /incendie|feu|fire/i.test(typeEvenement ?? '')
  const ouvert = deplie ?? (!!ligne || incendie)

  async function enregistrer(e) {
    e.preventDefault()
    setErreur(null)
    const champs = { cause_categorie: cause || null, cause_detail: detail.trim() || null, enquete_statut: enquete }
    const { error } = ligne
      ? await supabase.from('incendies_causes').update(champs).eq('id', ligne.id)
      : await supabase.from('incendies_causes').insert({ ...champs, contexte_id: contexteId, incident_id: incidentId })
    if (error) setErreur(error.message)
    else rafraichir()
  }

  if (chargement) return null
  if (!ouvert) {
    return (
      <div>
        <h2 className="font-medium text-encre">Cause de l'incendie</h2>
        <button type="button" className="text-xs lien" onClick={() => setDeplie(true)}>Renseigner la cause d'un incendie…</button>
      </div>
    )
  }
  return (
    <div>
      <EnTete titre="Cause de l'incendie" aide="Catégorie de cause et état de l'enquête, pour le retour d'expérience." />
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      <form onSubmit={enregistrer} className="bg-surface border border-trait rounded p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Cause</label>
            <select value={cause} onChange={(e) => setCause(e.target.value)} className="w-full">
              <option value="">—</option>
              {CAUSES.map((c) => (
                <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Enquête</label>
            <select value={enquete} onChange={(e) => setEnquete(e.target.value)} className="w-full">
              {ENQUETES.map((c) => (
                <option key={c.valeur} value={c.valeur}>{c.libelle}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Détail</label>
          <textarea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} className="w-full" />
        </div>
        <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal>
      </form>
    </div>
  )
}
