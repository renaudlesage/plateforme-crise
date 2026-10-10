import { useCallback, useEffect, useState } from 'react'
import { SelecteurLocalisation } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from './Boutons'

/**
 * Tableau de référentiel générique (liste + ajout + modification + suppression)
 * piloté par une description de champs, pour les petits référentiels qui n'ont
 * pas besoin d'une page sur mesure.
 *
 * champs : [{ cle, libelle, type, options?, requis?, liste?, aide? }]
 *   type : 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'select'
 *        | 'tags' (texte séparé par des virgules ↔ text[])
 *        | 'multi' (cases à cocher parmi `options` ↔ text[])
 *        | 'position' (écrit latitude / longitude, `cle` ignorée)
 * portee : 'contexte' (filtre + écrit contexte_id) ou 'national' (référentiel de la plateforme)
 * peutEcrire : false → lecture seule
 * titreLigne(ligne) : texte principal d'une ligne
 * actionsLigne(ligne, recharger) : boutons supplémentaires (ex. validation)
 */
export default function TableCrud({
  table,
  titre,
  aide,
  champs,
  portee = 'contexte',
  peutEcrire = true,
  tri = 'created_at',
  titreLigne,
  actionsLigne,
  vide = 'Aucun élément pour le moment.',
  valeursParDefaut = {},
  filtre = null,
  etiquetteAjout = 'Ajouter',
}) {
  const { contexteId } = useAuth()
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enAjout, setEnAjout] = useState(false)
  const [enEdition, setEnEdition] = useState(null)

  const filtreCle = JSON.stringify(filtre)
  const charger = useCallback(async () => {
    if (portee === 'contexte' && !contexteId) return
    let q = supabase.from(table).select('*')
    if (portee === 'contexte') q = q.eq('contexte_id', contexteId)
    if (filtreCle && filtreCle !== 'null') q = q.match(JSON.parse(filtreCle))
    const { data, error } = await q.order(tri, { ascending: true })
    if (error) setErreur(error.message)
    else {
      setErreur(null)
      setLignes(data ?? [])
    }
    setChargement(false)
  }, [table, portee, contexteId, tri, filtreCle])

  useEffect(() => {
    charger()
  }, [charger])

  async function enregistrer(valeurs, id) {
    const charge = { ...valeurs }
    let r
    if (id) r = await supabase.from(table).update(charge).eq('id', id)
    else r = await supabase.from(table).insert(portee === 'contexte' ? { ...charge, contexte_id: contexteId } : charge)
    if (r.error) return { error: r.error }
    await charger()
    return { error: null }
  }

  async function supprimer(l) {
    if (!confirm('Supprimer cet élément ?')) return
    const { error } = await supabase.from(table).delete().eq('id', l.id)
    if (error) setErreur(error.message)
    else charger()
  }

  const libelleLigne = titreLigne ?? ((l) => l[champs[0].cle])

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        {titre && <h2 className="font-medium text-encre">{titre}</h2>}
        {peutEcrire && !enAjout && <BoutonPrincipal onClick={() => setEnAjout(true)}>{etiquetteAjout}</BoutonPrincipal>}
      </div>
      {aide && <p className="text-xs text-sourdine mb-3">{aide}</p>}
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}

      {enAjout && (
        <div className="border border-trait rounded p-3 mb-3 bg-fond">
          <FormulaireChamps
            champs={champs}
            valeursInitiales={valeursParDefaut}
            onAnnuler={() => setEnAjout(false)}
            onValider={async (v) => {
              const r = await enregistrer(v, null)
              if (!r.error) setEnAjout(false)
              return r
            }}
          />
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 && !enAjout ? (
        <p className="vide border border-dashed border-trait text-center p-4">{vide}</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {lignes.map((l) =>
            enEdition === l.id ? (
              <li key={l.id} className="p-3 bg-fond">
                <FormulaireChamps
                  champs={champs}
                  valeursInitiales={l}
                  onAnnuler={() => setEnEdition(null)}
                  onValider={async (v) => {
                    const r = await enregistrer(v, l.id)
                    if (!r.error) setEnEdition(null)
                    return r
                  }}
                />
              </li>
            ) : (
              <li key={l.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-encre">{libelleLigne(l)}</p>
                    <p className="text-xs text-sourdine mt-0.5 flex flex-wrap gap-x-3">
                      {champs
                        .filter((c) => c.liste !== false && c.type !== 'position' && c !== champs[0])
                        .map((c) => {
                          const texte = formater(c, l[c.cle])
                          return texte ? <span key={c.cle}>{c.libelle.toLowerCase()} : {texte}</span> : null
                        })}
                      {champs.some((c) => c.type === 'position') && l.latitude != null && (
                        <span>position : {Number(l.latitude).toFixed(4)}, {Number(l.longitude).toFixed(4)}</span>
                      )}
                    </p>
                    {actionsLigne && <div className="mt-1.5">{actionsLigne(l, charger)}</div>}
                  </div>
                  {peutEcrire && (
                    <div className="flex gap-2 shrink-0">
                      <BoutonDiscret onClick={() => setEnEdition(l.id)}>Modifier</BoutonDiscret>
                      <BoutonDiscret onClick={() => supprimer(l)}>✕</BoutonDiscret>
                    </div>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function formater(champ, valeur) {
  if (valeur == null || valeur === '') return null
  if (champ.type === 'checkbox') return valeur ? 'oui' : null
  if (champ.type === 'select') return champ.options?.find((o) => o.valeur === valeur)?.libelle ?? valeur
  if (champ.type === 'tags') return Array.isArray(valeur) ? valeur.join(', ') : valeur
  if (champ.type === 'multi') return (valeur ?? []).map((v) => champ.options.find((o) => o.valeur === v)?.libelle ?? v).join(', ') || null
  return String(valeur)
}

function FormulaireChamps({ champs, valeursInitiales, onValider, onAnnuler }) {
  const [valeurs, setValeurs] = useState(() => {
    const v = {}
    for (const c of champs) {
      if (c.type === 'position') {
        v.latitude = valeursInitiales.latitude ?? null
        v.longitude = valeursInitiales.longitude ?? null
      } else if (c.type === 'tags') v[c.cle] = (valeursInitiales[c.cle] ?? []).join(', ')
      else if (c.type === 'multi') v[c.cle] = valeursInitiales[c.cle] ?? []
      else if (c.type === 'checkbox') v[c.cle] = valeursInitiales[c.cle] ?? false
      else if (c.type === 'select') v[c.cle] = valeursInitiales[c.cle] ?? c.defaut ?? ''
      else v[c.cle] = valeursInitiales[c.cle] ?? ''
    }
    return v
  })
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const maj = (cle, valeur) => setValeurs((p) => ({ ...p, [cle]: valeur }))

  async function soumettre(e) {
    e.preventDefault()
    const charge = {}
    for (const c of champs) {
      if (c.type === 'position') {
        charge.latitude = valeurs.latitude === '' ? null : valeurs.latitude
        charge.longitude = valeurs.longitude === '' ? null : valeurs.longitude
        continue
      }
      const v = valeurs[c.cle]
      if (c.type === 'number') charge[c.cle] = v === '' ? null : Number(v)
      else if (c.type === 'checkbox') charge[c.cle] = !!v
      else if (c.type === 'multi') charge[c.cle] = v.length ? v : null
      else if (c.type === 'tags') {
        const t = v.split(',').map((x) => x.trim()).filter(Boolean)
        charge[c.cle] = t.length ? t : null
      } else if (c.type === 'select' || c.type === 'date') charge[c.cle] = v || null
      else charge[c.cle] = typeof v === 'string' ? v.trim() || null : v
      if (c.requis && charge[c.cle] == null) {
        setErreur(`Champ requis : ${c.libelle}`)
        return
      }
    }
    setEnCours(true)
    const { error } = await onValider(charge)
    setEnCours(false)
    if (error) setErreur(error.message)
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {champs.map((c) => {
          const large = c.type === 'textarea' || c.type === 'position'
          return (
            <div key={c.cle} className={large ? 'sm:col-span-2' : ''}>
              {c.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm text-sourdine">
                  <input type="checkbox" checked={valeurs[c.cle]} onChange={(e) => maj(c.cle, e.target.checked)} />
                  {c.libelle}
                </label>
              ) : c.type === 'multi' ? (
                <>
                  <label className="block text-xs font-medium text-sourdine mb-1">{c.libelle}</label>
                  <div className="flex flex-wrap gap-3">
                    {c.options.map((o) => (
                      <label key={o.valeur} className="flex items-center gap-1.5 text-sm text-sourdine">
                        <input
                          type="checkbox"
                          checked={valeurs[c.cle].includes(o.valeur)}
                          onChange={(e) =>
                            maj(c.cle, e.target.checked ? [...valeurs[c.cle], o.valeur] : valeurs[c.cle].filter((x) => x !== o.valeur))
                          }
                        />
                        {o.libelle}
                      </label>
                    ))}
                  </div>
                </>
              ) : c.type === 'position' ? (
                <>
                  <label className="block text-xs font-medium text-sourdine mb-1">{c.libelle ?? 'Position'}</label>
                  <SelecteurLocalisation
                    lat={valeurs.latitude}
                    lon={valeurs.longitude}
                    onChange={(la, lo) => setValeurs((p) => ({ ...p, latitude: la, longitude: lo }))}
                  />
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium text-sourdine mb-1">{c.libelle}{c.requis && ' *'}</label>
                  {c.type === 'textarea' ? (
                    <textarea rows={3} value={valeurs[c.cle]} onChange={(e) => maj(c.cle, e.target.value)} className="w-full" />
                  ) : c.type === 'select' ? (
                    <select value={valeurs[c.cle]} onChange={(e) => maj(c.cle, e.target.value)} className="w-full">
                      <option value="">—</option>
                      {c.options.map((o) => (
                        <option key={o.valeur} value={o.valeur}>{o.libelle}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                      step={c.type === 'number' ? 'any' : undefined}
                      value={valeurs[c.cle]}
                      onChange={(e) => maj(c.cle, e.target.value)}
                      placeholder={c.type === 'tags' ? 'séparés par des virgules' : undefined}
                      className="w-full"
                    />
                  )}
                  {c.aide && <p className="text-xs text-sourdine mt-0.5">{c.aide}</p>}
                </>
              )}
            </div>
          )
        })}
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
