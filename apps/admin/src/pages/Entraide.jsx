import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MENTION_RGPD_BENEVOLE_DEFAUT, STATUTS_JURIDIQUES_MOYEN, libelleStatutJuridique, libelleTypeProprietaire } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const TACHES = [
  { valeur: 'zone_rouge', libelle: 'Zone rouge (exclusion)' },
  { valeur: 'electricite', libelle: 'Installations électriques' },
  { valeur: 'eau_contaminee', libelle: 'Eau contaminée (hydrocarbures, égouts)' },
  { valeur: 'toiture', libelle: 'Travail en hauteur, toitures' },
  { valeur: 'tronconnage', libelle: 'Tronçonnage sans brevet' },
  { valeur: 'victimes', libelle: 'Prise en charge de victimes' },
  { valeur: 'conduite_engins', libelle: 'Conduite d’engins sans habilitation' },
]
const DEFAUT = { assureur: '', police_numero: '', police_url: '', age_minimum: 18, taches_interdites: ['zone_rouge', 'electricite', 'eau_contaminee', 'toiture', 'tronconnage'], duree_max_engagement_minutes: 360, duree_repos_min_minutes: 60, taille_equipe_min: 3, taille_equipe_max: 8, chef_agent_recommande: true, briefing_texte: '', mention_rgpd: '' }

/**
 * Admin › Anticipation › Entraide : ce que la commune règle avant la crise pour que le CC puisse accueillir
 * des bénévoles spontanés le jour J (assurance, âge, tâches interdites, relève, briefing, mention RGPD),
 * et la vérification des moyens privés déclarés par leurs propriétaires depuis l'app Citoyen.
 */
export default function Entraide() {
  const { contexteId } = useAuth()
  const [params, setParams] = useState(null)
  const [existe, setExiste] = useState(false)
  const [declares, setDeclares] = useState([])
  const [droit, setDroit] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [info, setInfo] = useState(null)

  const charger = useCallback(async () => {
    if (!contexteId) return
    const [p, r, d] = await Promise.all([
      supabase.from('parametres_entraide').select('*').eq('contexte_id', contexteId).maybeSingle(),
      supabase.from('ressources').select('id, nom, categorie, proprietaire_type, proprietaire_nom, proprietaire_telephone, capacite, delai_mise_a_dispo, conditions_partage, latitude, longitude, statut_juridique, actif, declare_le, verifie_le').eq('contexte_id', contexteId).eq('type_public_prive', 'prive').not('declare_le', 'is', null).order('declare_le', { ascending: false }),
      supabase.rpc('a_capacite', { p_contexte_id: contexteId, p_ressource: 'entraide', p_action: 'modifier' }),
    ])
    if (p.error) setErreur(p.error.message)
    setParams(p.data ? { ...DEFAUT, ...p.data, assureur: p.data.assureur ?? '', police_numero: p.data.police_numero ?? '', police_url: p.data.police_url ?? '', briefing_texte: p.data.briefing_texte ?? '', mention_rgpd: p.data.mention_rgpd ?? '' } : { ...DEFAUT })
    setExiste(!!p.data)
    setDeclares(r.data ?? [])
    setDroit(d.data === true)
  }, [contexteId])

  useEffect(() => {
    charger()
  }, [charger])

  async function enregistrer(e) {
    e.preventDefault()
    setErreur(null)
    setInfo(null)
    const champs = {
      assureur: params.assureur.trim() || null,
      police_numero: params.police_numero.trim() || null,
      police_url: params.police_url.trim() || null,
      age_minimum: Number(params.age_minimum),
      taches_interdites: params.taches_interdites,
      duree_max_engagement_minutes: Number(params.duree_max_engagement_minutes),
      duree_repos_min_minutes: Number(params.duree_repos_min_minutes),
      taille_equipe_min: Number(params.taille_equipe_min),
      taille_equipe_max: Number(params.taille_equipe_max),
      chef_agent_recommande: !!params.chef_agent_recommande,
      briefing_texte: params.briefing_texte.trim() || null,
      mention_rgpd: params.mention_rgpd.trim() || null,
    }
    const r = existe
      ? await supabase.from('parametres_entraide').update(champs).eq('contexte_id', contexteId).select('contexte_id')
      : await supabase.from('parametres_entraide').insert({ ...champs, contexte_id: contexteId }).select('contexte_id')
    if (r.error) return setErreur(r.error.message)
    if (!r.data || r.data.length === 0) return setErreur('Écriture refusée : vos droits ne le permettent pas (admin du contexte requis).')
    setInfo('Paramètres enregistrés.')
    await charger()
  }

  async function verifier(ressource, statut_juridique) {
    setErreur(null)
    const r = await supabase.from('ressources').update({ actif: true, statut_juridique, verifie_le: new Date().toISOString() }).eq('id', ressource.id).select('id')
    if (r.error) return setErreur(r.error.message)
    if (!r.data || r.data.length === 0) return setErreur('Écriture refusée : vos droits ne le permettent pas.')
    await charger()
  }
  async function ecarter(ressource) {
    setErreur(null)
    const r = await supabase.from('ressources').update({ actif: false, verifie_le: new Date().toISOString() }).eq('id', ressource.id).select('id')
    if (r.error) return setErreur(r.error.message)
    await charger()
  }

  const set = (k) => (e) => setParams((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const basculeTache = (v) => setParams((x) => ({ ...x, taches_interdites: x.taches_interdites.includes(v) ? x.taches_interdites.filter((y) => y !== v) : [...x.taches_interdites, v] }))
  const aVerifier = declares.filter((r) => !r.verifie_le)
  const verifies = declares.filter((r) => r.verifie_le)

  if (!params) return <p className="text-sm text-sourdine">Chargement…</p>

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Entraide : bénévoles et moyens privés</h1>
      <p className="text-sm text-sourdine mb-4">
        Ce qui se règle avant la crise. Le jour J, le Comité de Coordination désigne un coordinateur, ouvre des points d'accueil (QR) et affecte des équipes depuis la fiche incident ; le Dir PC-Ops reprend ce qui tombe en zone d'intervention.
        {' '}<Link to="/benevoles-entraide" className="underline">Bénévoles pré-inscrits</Link> · <Link to="/ressources" className="underline">Cadastre des ressources</Link>
      </p>
      {erreur && <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>}
      {info && <p role="status" className="text-sm text-ok mb-2">{info}</p>}

      <form onSubmit={enregistrer} className="border border-trait rounded p-4 mb-6 bg-fond space-y-3" aria-label="Paramètres de l'entraide">
        <h2 className="text-base font-semibold text-encre" style={{ margin: 0 }}>Cadre communal</h2>
        <p className="text-xs text-sourdine" style={{ margin: 0 }}>
          Loi du 3 juillet 2005 relative aux droits des volontaires : la commune qui encadre des bénévoles répond de leur responsabilité civile et doit les assurer. Ces réglages s'affichent aux bénévoles (âge, tâches interdites, briefing, RGPD) et au CC (relève, assurance).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className="block text-xs font-medium text-sourdine mb-1">Assureur</label><input value={params.assureur} onChange={set('assureur')} className="w-full" maxLength={120} disabled={!droit} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Numéro de police</label><input value={params.police_numero} onChange={set('police_numero')} className="w-full" maxLength={80} disabled={!droit} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Lien vers la police (facultatif)</label><input value={params.police_url} onChange={set('police_url')} className="w-full" maxLength={500} disabled={!droit} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Âge minimum</label><input type="number" min={16} max={21} value={params.age_minimum} onChange={set('age_minimum')} className="w-full" disabled={!droit} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Engagement maximal (minutes)</label><input type="number" min={60} max={1440} value={params.duree_max_engagement_minutes} onChange={set('duree_max_engagement_minutes')} className="w-full" disabled={!droit} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Repos minimal (minutes)</label><input type="number" min={0} max={720} value={params.duree_repos_min_minutes} onChange={set('duree_repos_min_minutes')} className="w-full" disabled={!droit} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Équipe : minimum</label><input type="number" min={1} max={20} value={params.taille_equipe_min} onChange={set('taille_equipe_min')} className="w-full" disabled={!droit} /></div>
          <div><label className="block text-xs font-medium text-sourdine mb-1">Équipe : maximum</label><input type="number" min={1} max={30} value={params.taille_equipe_max} onChange={set('taille_equipe_max')} className="w-full" disabled={!droit} /></div>
          <div className="flex items-end"><label className="flex items-center gap-1.5 text-sm text-sourdine"><input type="checkbox" checked={!!params.chef_agent_recommande} onChange={set('chef_agent_recommande')} disabled={!droit} />Chef d'équipe agent ou pompier recommandé</label></div>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="text-xs font-medium text-sourdine mb-1">Tâches interdites aux bénévoles</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {TACHES.map((t) => (
              <label key={t.valeur} className="text-sm text-sourdine flex items-center gap-1.5"><input type="checkbox" checked={params.taches_interdites.includes(t.valeur)} onChange={() => basculeTache(t.valeur)} disabled={!droit} />{t.libelle}</label>
            ))}
          </div>
        </fieldset>
        <div><label className="block text-xs font-medium text-sourdine mb-1">Texte de briefing (affiché au bénévole avant l'enregistrement)</label><textarea value={params.briefing_texte} onChange={set('briefing_texte')} className="w-full" rows={3} maxLength={2000} disabled={!droit} placeholder="ex. Restez avec votre chef d'équipe. Pas d'intervention sur une installation électrique. Signalez tout accident." /></div>
        <div><label className="block text-xs font-medium text-sourdine mb-1">Mention RGPD (à défaut, mention standard)</label><textarea value={params.mention_rgpd} onChange={set('mention_rgpd')} className="w-full" rows={3} maxLength={2000} disabled={!droit} placeholder={MENTION_RGPD_BENEVOLE_DEFAUT} /></div>
        {droit ? <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal> : <p className="text-xs text-sourdine">Lecture seule : seul un administrateur du contexte modifie ces paramètres.</p>}
      </form>

      <h2 className="text-base font-semibold text-encre mb-1">Moyens privés déclarés par leurs propriétaires</h2>
      <p className="text-xs text-sourdine mb-3">Déclarés depuis l'app Citoyen (« Proposer un moyen »). Un moyen non vérifié reste invisible au CC. Vérifiez par téléphone, puis qualifiez le statut juridique.</p>
      {aVerifier.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4 mb-4">Aucune déclaration en attente.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden mb-4" data-a-verifier>
          {aVerifier.map((r) => (
            <li key={r.id} data-declare={r.nom} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between px-4 py-3 bg-surface">
              <div className="min-w-0">
                <p className="text-sm font-medium text-encre">{r.nom} <span className="jeton ml-2">{r.categorie.replace(/_/g, ' ')}</span></p>
                <p className="text-xs text-sourdine">
                  {libelleTypeProprietaire(r.proprietaire_type)} : {r.proprietaire_nom}{r.proprietaire_telephone && <> · {r.proprietaire_telephone}</>}
                  {r.capacite && <> · {r.capacite}</>}{r.delai_mise_a_dispo && <> · délai {r.delai_mise_a_dispo}</>}{r.conditions_partage && <> · {r.conditions_partage}</>}
                  {r.latitude != null ? ' · localisé' : ' · sans position'} · déclaré le {new Date(r.declare_le).toLocaleDateString('fr-BE')}
                </p>
              </div>
              {droit && (
                <div className="flex flex-wrap gap-2 sm:justify-end sm:flex-shrink-0">
                  <select aria-label="Statut juridique" defaultValue="accord_oral" id={`sj-${r.id}`}>
                    {STATUTS_JURIDIQUES_MOYEN.filter((s) => s.valeur !== 'declaration_proprietaire').map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
                  </select>
                  <BoutonPrincipal type="button" onClick={() => verifier(r, document.getElementById(`sj-${r.id}`).value)}>Vérifié, mobilisable</BoutonPrincipal>
                  <BoutonDiscret type="button" onClick={() => ecarter(r)}>Écarter</BoutonDiscret>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {verifies.length > 0 && (
        <details>
          <summary className="text-sm text-sourdine cursor-pointer">{verifies.length} déclaration{verifies.length > 1 ? 's' : ''} déjà traitée{verifies.length > 1 ? 's' : ''}</summary>
          <ul className="divide-y divide-trait border border-trait rounded overflow-hidden mt-2">
            {verifies.map((r) => (
              <li key={r.id} className="px-4 py-2 bg-surface text-sm">
                {r.nom} · {r.proprietaire_nom} · {r.actif ? <span className="text-ok">{libelleStatutJuridique(r.statut_juridique)}</span> : <span className="text-sourdine">écarté</span>} · {new Date(r.verifie_le).toLocaleDateString('fr-BE')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
