import { useCallback, useEffect, useState } from 'react'
import { ACTIONS_PROTECTION, CLASSES_URGENCE_NUCLEAIRE } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import TableCrud from '../components/TableCrud'
import Onglets from '../components/Onglets'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

const PAYS = [
  { valeur: 'BE', libelle: 'Belgique' },
  { valeur: 'FR', libelle: 'France' },
  { valeur: 'NL', libelle: 'Pays-Bas' },
]
const TYPES_SITE = [
  { valeur: 'centrale', libelle: 'Centrale' },
  { valeur: 'recherche', libelle: 'Recherche' },
  { valeur: 'radioisotopes', libelle: 'Radioisotopes' },
  { valeur: 'autre', libelle: 'Autre' },
]
const COURONNES = ['S', 'X', 'Y', 'Z', 'A', 'B', 'C', 'extension'].map((v) => ({ valeur: v, libelle: v }))

/**
 * Plan d'urgence nucléaire et radiologique (NCCN / AFCN, juin 2024) : sites,
 * blocs de planification et liaison blocs ↔ communes. Les données de zonage
 * viennent de la carte officielle du NCCN : elles ne sont jamais reconstituées
 * ici. Lecture pour tous, écriture réservée au super-admin (référentiel national).
 */
export default function PlanNucleaire() {
  const { estSuperAdmin } = useAuth()
  const [sites, setSites] = useState([])

  useEffect(() => {
    supabase.from('sites_nucleaires').select('id, nom').order('nom').then(({ data }) => setSites(data ?? []))
  }, [])
  const optionsSites = sites.map((s) => ({ valeur: s.id, libelle: s.nom }))

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Plan d'urgence nucléaire</h1>
      <p className="text-sm text-sourdine mb-2">
        Zones de préparation du plan d'urgence nucléaire et radiologique (NCCN / AFCN, juin 2024). Les actions de protection
        effectives sont fixées pendant la crise : ne pas les confondre avec les zones d'intervention de l'AR du 22 mai 2019.
      </p>
      <p className="text-sm text-chaud mb-4">
        Les blocs et leur liaison aux communes doivent provenir de la carte officielle du NCCN. Rien n'est reconstitué ici,
        et les positions des sites sont approximatives.
        {!estSuperAdmin && ' Référentiel national : modification réservée au super-admin.'}
      </p>

      <Onglets
        onglets={[
          { cle: 'commune', libelle: 'Ma commune', contenu: <MaCommune /> },
          {
            cle: 'sites',
            libelle: 'Sites',
            contenu: (
              <TableCrud
                table="sites_nucleaires"
                portee="national"
                peutEcrire={estSuperAdmin}
                tri="nom"
                aide="Centrales et installations dont le plan prévoit des zones sur le territoire belge."
                titreLigne={(l) => (
                  <>
                    <strong>{l.nom}</strong> <span className="text-xs text-sourdine">({l.pays}, {TYPES_SITE.find((t) => t.valeur === l.type_site)?.libelle})</span>
                    {l.a_confirmer && <span className="jeton ml-2 text-chaud">à confirmer</span>}
                  </>
                )}
                champs={[
                  { cle: 'nom', libelle: 'Nom', type: 'text', requis: true },
                  { cle: 'pays', libelle: 'Pays', type: 'select', options: PAYS },
                  { cle: 'type_site', libelle: 'Type', type: 'select', options: TYPES_SITE },
                  { cle: 'resume_zonage', libelle: 'Zonage (résumé du plan)', type: 'textarea' },
                  { cle: 'a_confirmer', libelle: 'Paramètres à confirmer', type: 'checkbox' },
                  { cle: 'source_reference', libelle: 'Source', type: 'text' },
                  { cle: 'position', libelle: 'Position approximative', type: 'position' },
                ]}
              />
            ),
          },
          {
            cle: 'blocs',
            libelle: 'Blocs',
            contenu: (
              <TableCrud
                table="blocs_planification_nucleaire"
                portee="national"
                peutEcrire={estSuperAdmin}
                tri="code_bloc"
                aide="Blocs opérationnels (bloc S, secteurs de 30°, couronnes X, Y, Z, A, B, C), codés sur des éléments identifiables, en priorité les frontières communales."
                vide="Aucun bloc encodé : à saisir depuis la carte officielle du NCCN."
                titreLigne={(l) => (
                  <>
                    <strong>{l.code_bloc}</strong>{' '}
                    <span className="text-xs text-sourdine">{sites.find((s) => s.id === l.site_id)?.nom}</span>
                    {l.est_zone_reflexe && <span className="jeton ml-2 text-chaud">zone réflexe</span>}
                  </>
                )}
                champs={[
                  { cle: 'site_id', libelle: 'Site', type: 'select', options: optionsSites, requis: true },
                  { cle: 'code_bloc', libelle: 'Code du bloc (ex. Y5, A10)', type: 'text', requis: true },
                  { cle: 'couronne', libelle: 'Couronne', type: 'select', options: COURONNES },
                  { cle: 'secteur_numero', libelle: 'Secteur n°', type: 'number' },
                  { cle: 'est_zone_reflexe', libelle: 'Fait partie de la zone réflexe (bloc S + couronne X)', type: 'checkbox' },
                  { cle: 'actions_preparees', libelle: 'Actions préparées', type: 'multi', options: ACTIONS_PROTECTION },
                ]}
              />
            ),
          },
          { cle: 'liaison', libelle: 'Blocs ↔ communes', contenu: <LiaisonBlocsCommunes peutEcrire={estSuperAdmin} sites={sites} /> },
          {
            cle: 'classes',
            libelle: "Classes d'urgence",
            contenu: (
              <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
                {CLASSES_URGENCE_NUCLEAIRE.map((c) => (
                  <li key={c.valeur} className="px-4 py-2.5">
                    <p className="text-sm font-medium text-encre">{c.libelle}</p>
                    <p className="text-xs text-sourdine">{c.aide}</p>
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
      />
    </div>
  )
}

/** Code INS de la commune (contextes.config.code_ins) et blocs qui la concernent. */
function MaCommune() {
  const { contexteId } = useAuth()
  const [ins, setIns] = useState('')
  const [blocs, setBlocs] = useState([])
  const [message, setMessage] = useState(null)
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    const { data: ctx } = await supabase.from('contextes').select('config').eq('id', contexteId).single()
    const code = ctx?.config?.code_ins ?? ''
    setIns(code)
    if (!code) return setBlocs([])
    const { data, error } = await supabase
      .from('blocs_communes')
      .select('part_estimee, blocs_planification_nucleaire(code_bloc, couronne, est_zone_reflexe, actions_preparees, sites_nucleaires(nom))')
      .eq('commune_code', code)
    if (error) setErreur(error.message)
    else setBlocs(data ?? [])
  }, [contexteId])

  useEffect(() => {
    if (contexteId) charger()
  }, [contexteId, charger])

  async function enregistrer(e) {
    e.preventDefault()
    setErreur(null)
    const { data: ctx } = await supabase.from('contextes').select('config').eq('id', contexteId).single()
    const config = { ...(ctx?.config ?? {}), code_ins: ins.trim() || null }
    const { error } = await supabase.from('contextes').update({ config }).eq('id', contexteId)
    if (error) setErreur(error.message)
    else {
      setMessage('Code INS enregistré.')
      charger()
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={enregistrer} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-sourdine mb-1">Code INS de la commune</label>
          <input value={ins} onChange={(e) => setIns(e.target.value)} placeholder="ex. 62063" className="w-40" />
        </div>
        <BoutonPrincipal type="submit">Enregistrer</BoutonPrincipal>
        {message && <span className="text-xs text-ok">{message}</span>}
      </form>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      {!ins ? (
        <p className="vide">Renseignez le code INS pour voir les blocs de planification qui concernent la commune.</p>
      ) : blocs.length === 0 ? (
        <p className="vide">Aucun bloc encodé pour ce code INS (la liaison blocs ↔ communes doit venir du NCCN).</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {blocs.map((b, i) => {
            const bloc = b.blocs_planification_nucleaire
            return (
              <li key={i} className="px-4 py-2.5 text-sm text-encre">
                <strong>{bloc.code_bloc}</strong> · {bloc.sites_nucleaires?.nom}
                {bloc.est_zone_reflexe && <span className="jeton ml-2 text-chaud">zone réflexe</span>}
                <span className="text-xs text-sourdine ml-2">
                  {(bloc.actions_preparees ?? []).map((a) => ACTIONS_PROTECTION.find((x) => x.valeur === a)?.libelle ?? a).join(', ')}
                  {b.part_estimee != null && ` · part de la commune ≈ ${Math.round(b.part_estimee * 100)} %`}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function LiaisonBlocsCommunes({ peutEcrire, sites }) {
  const [blocs, setBlocs] = useState([])
  const [liens, setLiens] = useState([])
  const [blocId, setBlocId] = useState('')
  const [commune, setCommune] = useState('')
  const [part, setPart] = useState('')
  const [erreur, setErreur] = useState(null)

  const charger = useCallback(async () => {
    const [b, l] = await Promise.all([
      supabase.from('blocs_planification_nucleaire').select('id, code_bloc, site_id').order('code_bloc'),
      supabase.from('blocs_communes').select('*').order('commune_code'),
    ])
    setBlocs(b.data ?? [])
    setLiens(l.data ?? [])
    setErreur(b.error?.message ?? l.error?.message ?? null)
  }, [])
  useEffect(() => {
    charger()
  }, [charger])

  const nomBloc = (id) => {
    const b = blocs.find((x) => x.id === id)
    return b ? `${b.code_bloc} (${sites.find((s) => s.id === b.site_id)?.nom ?? '?'})` : id
  }

  async function ajouter(e) {
    e.preventDefault()
    if (!blocId || !commune.trim()) return
    const { error } = await supabase.from('blocs_communes').insert({
      bloc_id: blocId,
      commune_code: commune.trim(),
      part_estimee: part === '' ? null : Number(part) / 100,
    })
    if (error) setErreur(error.message)
    else {
      setCommune('')
      setPart('')
      charger()
    }
  }

  async function retirer(l) {
    const { error } = await supabase.from('blocs_communes').delete().eq('bloc_id', l.bloc_id).eq('commune_code', l.commune_code)
    if (error) setErreur(error.message)
    else charger()
  }

  return (
    <div>
      <p className="text-xs text-sourdine mb-3">
        La liaison bloc ↔ commune ne figure pas dans le plan : elle provient de la carte officielle du NCCN.
      </p>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      {peutEcrire && (
        <form onSubmit={ajouter} className="flex flex-wrap gap-2 mb-3">
          <select value={blocId} onChange={(e) => setBlocId(e.target.value)} className="min-w-[10rem]">
            <option value="">— bloc —</option>
            {blocs.map((b) => (
              <option key={b.id} value={b.id}>{nomBloc(b.id)}</option>
            ))}
          </select>
          <input value={commune} onChange={(e) => setCommune(e.target.value)} placeholder="code INS" className="w-32" />
          <input type="number" min="0" max="100" value={part} onChange={(e) => setPart(e.target.value)} placeholder="part %" className="w-24" />
          <BoutonDiscret type="submit">Lier</BoutonDiscret>
        </form>
      )}
      {liens.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucune liaison encodée.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {liens.map((l) => (
            <li key={`${l.bloc_id}-${l.commune_code}`} className="flex items-center justify-between px-4 py-2 text-sm text-encre">
              <span>
                {nomBloc(l.bloc_id)} → INS {l.commune_code}
                {l.part_estimee != null && <span className="text-xs text-sourdine"> · ≈ {Math.round(l.part_estimee * 100)} %</span>}
              </span>
              {peutEcrire && <BoutonDiscret onClick={() => retirer(l)}>✕</BoutonDiscret>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
