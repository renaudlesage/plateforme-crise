import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  texteErreur,
  CATEGORIES_SITUATION,
  TYPES_SOURCE_SITUATION,
  ALEAS_SITUATION,
  ATTRIBUTS_LIEN_EXTERNE,
  MENTION_CAMERAS,
  MENTION_CAMERA_COMMUNALE,
  MESSAGE_ADRESSE_INVALIDE,
  adresseSituationValide,
  correspondRecherche,
  estCameraOuWebcam,
  etatControle,
  jourBelge,
  libelleAleaSituation,
  libelleTypeSource,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { supabase } from '../lib/supabase'

const RE_CODE = /^[a-z0-9_]{2,40}$/

/** Traduit les refus de la base en phrases utiles ; le reste passe par texteErreur. */
function messageErreur(e) {
  const m = `${e?.message ?? ''}`
  if (m.includes('sources_situation_url_check')) return MESSAGE_ADRESSE_INVALIDE
  if (m.includes('sources_situation_camera_locale_check'))
    return "Une caméra ou une webcam de la commune demande le nom du responsable du flux et l'attestation que le flux est public ou officiel."
  if (m.includes('sources_situation_code_national_uq') || m.includes('sources_situation_code_local_uq')) return 'Ce code est déjà pris par une autre source.'
  if (m.includes('sources_situation_tailles_check')) return 'Un champ est trop long ou trop court (nom : 2 à 120 caractères, note : 500, avertissement : 300).'
  return texteErreur(e)
}

/**
 * Sources de la page CC › Situation (veille sociétale) : liens sortants uniquement.
 * - « Sources de la commune » : ajoutées par le contexte, selon la capacité « situation » du rôle.
 * - « Référentiel national » : les sources communes de départ, modifiables par le super-administrateur seulement.
 * Jamais de suppression : on désactive (une source déjà vérifiée ne peut de toute façon pas être supprimée).
 */
export default function SourcesSituation() {
  const { contexteId, estSuperAdmin, superAdminVerifie } = useAuth()
  const [portee, setPortee] = useState('commune')
  const [sources, setSources] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [droits, setDroits] = useState({ creer: false, modifier: false })
  const [recherche, setRecherche] = useState('')
  const [categorie, setCategorie] = useState('')
  const [aControler, setAControler] = useState(false)
  const [inactives, setInactives] = useState(false)
  const [edition, setEdition] = useState(null) // null | 'nouveau' | id

  const charger = useCallback(async () => {
    if (!contexteId) return
    const { data, error } = await supabase
      .from('sources_situation')
      .select('*')
      .or(`contexte_id.is.null,contexte_id.eq.${contexteId}`)
      .order('categorie')
      .order('ordre_affichage')
      .order('nom')
    if (error) setErreur(messageErreur(error))
    setSources(data ?? [])
    setChargement(false)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  // Droits de la commune : demandés à la base (même règle que les politiques d'accès), pour ne montrer que des boutons utiles.
  useEffect(() => {
    if (!contexteId) return
    let annule = false
    Promise.all(
      ['creer', 'modifier'].map((action) =>
        supabase.rpc('a_capacite', { p_contexte_id: contexteId, p_ressource: 'situation', p_action: action }).then((r) => r.data === true)
      )
    ).then(([creer, modifier]) => {
      if (!annule) setDroits({ creer, modifier })
    })
    return () => {
      annule = true
    }
  }, [contexteId])

  const national = portee === 'national'
  const peutCreer = national ? estSuperAdmin : droits.creer
  const peutModifier = national ? estSuperAdmin : droits.modifier

  const delaPortee = useMemo(() => sources.filter((s) => (national ? s.contexte_id === null : s.contexte_id === contexteId)), [sources, national, contexteId])

  const filtrees = useMemo(
    () =>
      delaPortee.filter((s) => {
        if (!inactives && !s.actif) return false
        if (categorie && s.categorie !== categorie) return false
        if (aControler && etatControle(s).etat === 'recent') return false
        return correspondRecherche(s, recherche)
      }),
    [delaPortee, inactives, categorie, aControler, recherche]
  )

  const nbAControler = useMemo(() => delaPortee.filter((s) => s.actif && etatControle(s).etat !== 'recent').length, [delaPortee])

  // La base ne signale pas un refus de droits sur une modification : elle ne modifie simplement aucune ligne.
  async function modifier(id, champs) {
    setErreur(null)
    const { data, error } = await supabase.from('sources_situation').update(champs).eq('id', id).select('id')
    if (error) {
      setErreur(messageErreur(error))
      return { error }
    }
    if (!data || data.length === 0) {
      const e = { message: 'Modification refusée : vos droits ne permettent pas de modifier cette source.' }
      setErreur(e.message)
      return { error: e }
    }
    await charger()
    return { error: null }
  }

  async function creer(champs) {
    setErreur(null)
    const { error } = await supabase.from('sources_situation').insert({ ...champs, contexte_id: national ? null : contexteId })
    if (error) {
      setErreur(messageErreur(error))
      return { error: { message: messageErreur(error) } }
    }
    await charger()
    return { error: null }
  }

  const groupes = CATEGORIES_SITUATION.map((c) => ({ ...c, lignes: filtrees.filter((s) => s.categorie === c.cle) })).filter((g) => g.lignes.length > 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-3">
        <h1 className="text-xl font-semibold text-encre">Sources de situation (veille)</h1>
        {peutCreer && edition !== 'nouveau' && <BoutonPrincipal onClick={() => setEdition('nouveau')}>Ajouter une source</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-2">
        Les sources de la page « Situation » du Comité de Coordination : marchés, médias, routes, webcams, eau, nucléaire, société.
        Chaque source s'ouvre dans un nouvel onglet : rien n'est intégré, aucun flux n'est lu par Crisiware.
      </p>
      <p className="text-xs text-sourdine mb-4">{MENTION_CAMERAS}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" className={`pastille-filtre${!national ? ' actif' : ''}`} onClick={() => { setPortee('commune'); setEdition(null) }}>
          Sources de la commune
        </button>
        <button type="button" className={`pastille-filtre${national ? ' actif' : ''}`} onClick={() => { setPortee('national'); setEdition(null) }}>
          Référentiel national
        </button>
      </div>

      {national && superAdminVerifie && !estSuperAdmin && (
        <p role="note" className="text-sm text-encre border border-trait rounded px-3 py-2 mb-4 bg-surface">
          Lecture seule. Le référentiel national est géré par le super-administrateur de la plateforme.
        </p>
      )}
      {!national && !peutCreer && !peutModifier && (
        <p role="note" className="text-sm text-encre border border-trait rounded px-3 py-2 mb-4 bg-surface">
          Lecture seule. Ajouter ou modifier une source de la commune demande la capacité « Situation » (Configuration › Rôles).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une source" aria-label="Rechercher une source" className="w-64" />
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {CATEGORIES_SITUATION.map((c) => (
            <option key={c.cle} value={c.cle}>{c.libelle}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={aControler} onChange={(e) => setAControler(e.target.checked)} />
          À contrôler seulement ({nbAControler})
        </label>
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={inactives} onChange={(e) => setInactives(e.target.checked)} />
          Montrer les sources désactivées
        </label>
      </div>

      {erreur && <p role="alert" className="text-sm text-chaud mb-3">{erreur}</p>}

      {edition === 'nouveau' && (
        <FormulaireSource
          national={national}
          onAnnuler={() => setEdition(null)}
          onValider={async (champs) => {
            const r = await creer(champs)
            if (!r.error) setEdition(null)
            return r
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : groupes.length === 0 && edition !== 'nouveau' ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          {delaPortee.length === 0
            ? national
              ? 'Aucune source dans le référentiel national.'
              : peutCreer
                ? "Aucune source propre à la commune. Ajoutez par exemple la webcam du pont ou une caméra routière locale ; le référentiel national reste visible dans la page Situation."
                : 'Aucune source propre à la commune.'
            : 'Aucune source ne correspond à ces filtres.'}
        </p>
      ) : (
        groupes.map((g) => (
          <section key={g.cle} className="mb-6">
            <h2 className="text-base font-semibold text-encre mb-2">
              {g.libelle} <span className="text-xs font-normal text-sourdine">({g.lignes.length})</span>
            </h2>
            <ul className="divide-y divide-trait border border-trait rounded overflow-hidden shadow">
              {g.lignes.map((s) =>
                edition === s.id ? (
                  <li key={s.id} className="bg-fond p-3">
                    <FormulaireSource
                      national={national}
                      valeursInitiales={s}
                      onAnnuler={() => setEdition(null)}
                      onValider={async (champs) => {
                        const r = await modifier(s.id, champs)
                        if (!r.error) setEdition(null)
                        return r
                      }}
                    />
                  </li>
                ) : (
                  <LigneSource
                    key={s.id}
                    source={s}
                    peutModifier={peutModifier}
                    onModifier={() => setEdition(s.id)}
                    onBasculerActif={() => modifier(s.id, { actif: !s.actif })}
                    onControlee={() => modifier(s.id, { controle_le: jourBelge(), controle_note: null })}
                  />
                )
              )}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function LigneSource({ source: s, peutModifier, onModifier, onBasculerActif, onControlee }) {
  const controle = etatControle(s)
  return (
    <li className="px-4 py-3 bg-surface">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-encre">
            <a href={s.url} {...ATTRIBUTS_LIEN_EXTERNE} className="underline">{s.nom}</a>
            {!s.actif && <span className="ml-2 text-xs text-sourdine">(désactivée)</span>}
            {s.suggeree && <span className="ml-2 text-xs text-sourdine">épinglée par défaut</span>}
          </p>
          <p className="text-xs text-sourdine mt-0.5 break-all">{s.url}</p>
          <p className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">{libelleTypeSource(s.type_source)}</span>
            {s.portee && <span className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">{s.portee}</span>}
            {(s.aleas_lies ?? []).map((a) => (
              <span key={a} className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">{libelleAleaSituation(a)}</span>
            ))}
            <span className={`text-xs px-1.5 py-0.5 rounded ${controle.etat === 'recent' ? 'bg-surface-2' : 'bg-surface-2 text-chaud'}`}>{controle.texte}</span>
          </p>
          {s.note && <p className="text-sm text-sourdine mt-1.5">{s.note}</p>}
          {s.avertissement && <p className="text-sm text-chaud mt-1">{s.avertissement}</p>}
          {s.controle_note && <p className="text-xs text-sourdine mt-1">Contrôle : {s.controle_note}</p>}
          {s.responsable_traitement && (
            <p className="text-xs text-sourdine mt-1">
              Responsable du flux : {s.responsable_traitement}
              {s.attestation_flux_public && ' · flux attesté public ou officiel'}
            </p>
          )}
        </div>
        {peutModifier && (
          <div className="flex flex-wrap gap-2 sm:justify-end sm:flex-shrink-0">
            <BoutonDiscret onClick={onControlee}>Adresse contrôlée aujourd'hui</BoutonDiscret>
            <BoutonDiscret onClick={onModifier}>Modifier</BoutonDiscret>
            <BoutonDiscret onClick={onBasculerActif}>{s.actif ? 'Désactiver' : 'Réactiver'}</BoutonDiscret>
          </div>
        )}
      </div>
    </li>
  )
}

function FormulaireSource({ national, valeursInitiales = null, onValider, onAnnuler }) {
  const v = valeursInitiales ?? {}
  const creation = !valeursInitiales
  const [code, setCode] = useState(v.code ?? '')
  const [nom, setNom] = useState(v.nom ?? '')
  const [url, setUrl] = useState(v.url ?? '')
  const [categorie, setCategorie] = useState(v.categorie ?? (national ? 'marches' : 'webcams'))
  const [type, setType] = useState(v.type_source ?? (national ? 'officiel' : 'cameras'))
  const [portee, setPortee] = useState(v.portee ?? '')
  const [note, setNote] = useState(v.note ?? '')
  const [avertissement, setAvertissement] = useState(v.avertissement ?? '')
  const [aleas, setAleas] = useState(v.aleas_lies ?? [])
  const [ordre, setOrdre] = useState(v.ordre_affichage ?? 100)
  const [suggeree, setSuggeree] = useState(v.suggeree ?? false)
  const [actif, setActif] = useState(v.actif ?? true)
  const [responsable, setResponsable] = useState(v.responsable_traitement ?? '')
  const [attestation, setAttestation] = useState(v.attestation_flux_public ?? false)
  const [controleLe, setControleLe] = useState(v.controle_le ?? '')
  const [controleNote, setControleNote] = useState(v.controle_note ?? '')
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const exigeCamera = !national && estCameraOuWebcam({ type_source: type, categorie })

  function basculerAlea(cle) {
    setAleas((a) => (a.includes(cle) ? a.filter((x) => x !== cle) : [...a, cle]))
  }

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    const adresse = adresseSituationValide(url)
    if (!adresse) return setErreur(MESSAGE_ADRESSE_INVALIDE)
    if (nom.trim().length < 2) return setErreur('Donnez un nom à la source (2 caractères au moins).')
    if (national && creation && !RE_CODE.test(code.trim())) return setErreur('Le code est obligatoire : 2 à 40 caractères, minuscules, chiffres ou _ (il ne pourra plus changer).')
    if (exigeCamera && (!responsable.trim() || !attestation)) {
      return setErreur("Indiquez le responsable du flux et cochez l'attestation : une caméra ou une webcam doit être un flux public ou officiel.")
    }
    const champs = {
      nom: nom.trim(),
      url: adresse,
      categorie,
      type_source: type,
      portee: portee.trim() || null,
      note: note.trim() || null,
      avertissement: avertissement.trim() || null,
      aleas_lies: aleas,
      ordre_affichage: Number.isFinite(Number(ordre)) ? Math.max(0, Math.min(10000, Math.round(Number(ordre)))) : 100,
      suggeree,
      actif,
      responsable_traitement: responsable.trim() || null,
      attestation_flux_public: exigeCamera ? attestation : false,
      controle_le: controleLe || null,
      controle_note: controleNote.trim() || null,
    }
    if (creation && national) champs.code = code.trim()
    setEnCours(true)
    const { error } = await onValider(champs)
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-sourdine">
          Nom
          <input required value={nom} maxLength={120} onChange={(e) => setNom(e.target.value)} placeholder="ex. Webcam du pont de Ferrières" className="w-full mt-1" />
        </label>
        <label className="block text-xs font-medium text-sourdine">
          Adresse (https)
          <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full mt-1" />
        </label>
        <label className="block text-xs font-medium text-sourdine">
          Catégorie
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full mt-1">
            {CATEGORIES_SITUATION.map((c) => (
              <option key={c.cle} value={c.cle}>{c.libelle}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-sourdine">
          Type
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full mt-1">
            {TYPES_SOURCE_SITUATION.map((t) => (
              <option key={t.cle} value={t.cle}>{t.libelle}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-sourdine">
          Portée
          <input value={portee} maxLength={40} onChange={(e) => setPortee(e.target.value)} placeholder="ex. Wallonie, BE, Commune" className="w-full mt-1" />
        </label>
        {national && creation && (
          <label className="block text-xs font-medium text-sourdine">
            Code (stable, ne change plus)
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex. hydro" className="w-full mt-1 font-mono" />
          </label>
        )}
      </div>

      <label className="block text-xs font-medium text-sourdine">
        Note « à regarder » <span className="font-normal">(ce qu'il faut y lire ; ni nom ni donnée individuelle)</span>
        <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full mt-1" />
      </label>
      <label className="block text-xs font-medium text-sourdine">
        Avertissement <span className="font-normal">(ex. panne signalée : affiché en évidence)</span>
        <input value={avertissement} maxLength={300} onChange={(e) => setAvertissement(e.target.value)} className="w-full mt-1" />
      </label>

      {exigeCamera && (
        <fieldset className="border border-trait rounded p-3 space-y-2">
          <legend className="text-xs font-medium text-encre px-1">Caméra ou webcam de la commune</legend>
          <p className="text-xs text-sourdine">{MENTION_CAMERAS}</p>
          <p className="text-xs text-sourdine">{MENTION_CAMERA_COMMUNALE}</p>
          <label className="block text-xs font-medium text-sourdine">
            Responsable du flux (qui le publie ou en est responsable)
            <input value={responsable} maxLength={120} onChange={(e) => setResponsable(e.target.value)} placeholder="ex. SPW Mobilité, Commune de Ferrières" className="w-full mt-1" />
          </label>
          <label className="flex items-start gap-2 text-sm text-encre">
            <input type="checkbox" checked={attestation} onChange={(e) => setAttestation(e.target.checked)} className="mt-1" />
            J'atteste que ce flux est public ou officiel : ce n'est pas de la vidéosurveillance privée.
          </label>
        </fieldset>
      )}

      <fieldset className="border border-trait rounded p-3">
        <legend className="text-xs font-medium text-encre px-1">Proposée dans un incident de type</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {ALEAS_SITUATION.map((a) => (
            <label key={a.cle} className="flex items-center gap-2 text-sm text-sourdine">
              <input type="checkbox" checked={aleas.includes(a.cle)} onChange={() => basculerAlea(a.cle)} />
              {a.libelle}
            </label>
          ))}
        </div>
        <p className="text-xs text-sourdine mt-1">Au plus 5 sources sont proposées dans un incident : celles de la commune d'abord.</p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-sourdine">
          Ordre d'affichage
          <input type="number" min={0} max={10000} value={ordre} onChange={(e) => setOrdre(e.target.value)} className="w-full mt-1" />
        </label>
        <label className="block text-xs font-medium text-sourdine">
          Adresse contrôlée le
          <input type="date" value={controleLe ?? ''} max={jourBelge()} onChange={(e) => setControleLe(e.target.value)} className="w-full mt-1" />
        </label>
        <label className="block text-xs font-medium text-sourdine">
          Résultat du contrôle
          <input value={controleNote} maxLength={300} onChange={(e) => setControleNote(e.target.value)} className="w-full mt-1" />
        </label>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={suggeree} onChange={(e) => setSuggeree(e.target.checked)} />
          Épinglée par défaut dans « Mon tableau »
        </label>
        <label className="flex items-center gap-2 text-sm text-sourdine">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
          Active
        </label>
      </div>

      {erreur && <p role="alert" className="text-sm text-chaud">{erreur}</p>}

      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>
          {creation ? 'Ajouter' : 'Enregistrer'}
        </BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>
          Annuler
        </BoutonDiscret>
      </div>
    </form>
  )
}
