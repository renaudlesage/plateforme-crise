import { useEffect, useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'

/**
 * Catalogue de couches cartographiques (C6, idée reprise de Kalisio Crisis ; aucun code repris).
 * Couches WMS ou tuiles XYZ superposées aux cartes du QG et de Terrain (zones inondables, réseau hydrographique,
 * plan de secteur…). Seules les adresses https sont acceptées. Aucune couche n'est fournie d'office : l'adresse,
 * le nom de couche et l'attribution viennent du service qui la publie (Géoportail de Wallonie, IRM, etc.).
 */
export default function CouchesCarte() {
  const { contexteId } = useAuth()
  const { lignes, chargement, erreur, creer, modifier, supprimer } = useTableContexte('couches_carte', contexteId, { tri: 'ordre' })
  const [plateforme, setPlateforme] = useState([])
  const [edition, setEdition] = useState(null)

  useEffect(() => {
    supabase.from('couches_carte').select('*').is('contexte_id', null).order('ordre').then(({ data }) => setPlateforme(data ?? []))
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-encre">Couches cartographiques</h1>
        {edition === null && <BoutonPrincipal onClick={() => setEdition('nouveau')}>Ajouter une couche</BoutonPrincipal>}
      </div>
      <p className="text-sm text-sourdine mb-4">
        Couches superposables aux cartes du QG et de Terrain (bouton des couches, en haut à gauche de la carte). Renseignez l’adresse
        du service telle que le publie son fournisseur, le nom exact de la couche (WMS) et l’attribution exigée par sa licence.
      </p>
      {erreur && <p className="text-sm text-chaud mb-2">{/couches_carte|schema cache/.test(erreur) ? 'La migration C6 n’est pas encore appliquée.' : erreur}</p>}

      {edition === 'nouveau' && (
        <FormulaireCouche
          onAnnuler={() => setEdition(null)}
          onValider={async (v) => {
            const r = await creer(v)
            if (!r.error) setEdition(null)
            return r
          }}
        />
      )}

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : lignes.length === 0 && edition !== 'nouveau' ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">Aucune couche propre à la commune.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {lignes.map((c) =>
            edition === c.id ? (
              <li key={c.id} className="p-2">
                <FormulaireCouche
                  couche={c}
                  onAnnuler={() => setEdition(null)}
                  onValider={async (v) => {
                    const r = await modifier(c.id, v)
                    if (!r.error) setEdition(null)
                    return r
                  }}
                />
              </li>
            ) : (
              <LigneCouche
                key={c.id}
                c={c}
                onModifier={() => setEdition(c.id)}
                onSupprimer={() => window.confirm(`Supprimer la couche « ${c.nom} » ?`) && supprimer(c.id)}
              />
            )
          )}
        </ul>
      )}

      {plateforme.length > 0 && (
        <>
          <h2 className="font-medium text-encre mt-6 mb-1">Couches de la plateforme</h2>
          <p className="text-xs text-sourdine mb-2">Proposées à toutes les communes ; gérées par l’administrateur de la plateforme.</p>
          <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
            {plateforme.map((c) => <LigneCouche key={c.id} c={c} />)}
          </ul>
        </>
      )}
    </div>
  )
}

function LigneCouche({ c, onModifier, onSupprimer }) {
  let hote = c.url
  try {
    hote = new URL(c.url.replace(/\{[a-z]\}/g, '0')).host
  } catch {
    /* adresse affichée telle quelle */
  }
  return (
    <li className="px-4 py-2.5 flex items-start justify-between gap-2">
      <div className="text-sm">
        <p className="text-encre">
          <strong>{c.nom}</strong>
          <span className="jeton ml-2">{c.type.toUpperCase()}</span>
          {!c.actif && <span className="jeton ml-2">inactive</span>}
          {c.visible_par_defaut && <span className="jeton ml-2">affichée d’office</span>}
        </p>
        <p className="text-xs text-sourdine">
          {hote}
          {c.couches && <> · couche {c.couches}</>} · opacité {Math.round(Number(c.opacite) * 100)} % · {c.apps.map((a) => (a === 'qg' ? 'QG' : 'Terrain')).join(', ')}
          {c.attribution && <> · © {c.attribution}</>}
        </p>
        {c.source && <p className="text-xs text-sourdine">source : {c.source}</p>}
      </div>
      {onModifier && (
        <div className="flex gap-2 flex-shrink-0">
          <BoutonDiscret onClick={onModifier}>Modifier</BoutonDiscret>
          <BoutonDiscret onClick={onSupprimer}>Supprimer</BoutonDiscret>
        </div>
      )}
    </li>
  )
}

function FormulaireCouche({ couche, onValider, onAnnuler }) {
  const [v, setV] = useState({
    nom: couche?.nom ?? '',
    type: couche?.type ?? 'wms',
    url: couche?.url ?? '',
    couches: couche?.couches ?? '',
    format: couche?.format ?? 'image/png',
    transparent: couche?.transparent ?? true,
    attribution: couche?.attribution ?? '',
    opacite: couche?.opacite ?? 0.7,
    zoom_max: couche?.zoom_max ?? 19,
    visible_par_defaut: couche?.visible_par_defaut ?? false,
    apps: couche?.apps ?? ['qg', 'terrain'],
    ordre: couche?.ordre ?? 100,
    actif: couche?.actif ?? true,
    source: couche?.source ?? '',
  })
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(false)
  const maj = (cle) => (e) => setV({ ...v, [cle]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function soumettre(e) {
    e.preventDefault()
    if (!/^https:\/\//.test(v.url.trim())) {
      setErreur('Adresse en https:// uniquement.')
      return
    }
    setEnCours(true)
    const { error } = await onValider({
      ...v,
      nom: v.nom.trim(),
      url: v.url.trim(),
      couches: v.type === 'wms' ? v.couches.trim() : null,
      attribution: v.attribution.trim() || null,
      source: v.source.trim() || null,
      opacite: Number(v.opacite),
      zoom_max: Number(v.zoom_max),
      ordre: Number(v.ordre) || 100,
    })
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
  }

  return (
    <form onSubmit={soumettre} className="border border-trait rounded p-4 mb-4 bg-fond space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input required maxLength={120} value={v.nom} onChange={maj('nom')} placeholder="Nom affiché (ex. Zones inondables)" aria-label="Nom" className="sm:col-span-3" />
        <select value={v.type} onChange={maj('type')} aria-label="Type">
          <option value="wms">WMS</option>
          <option value="xyz">Tuiles XYZ</option>
        </select>
      </div>
      <input
        required
        maxLength={500}
        value={v.url}
        onChange={maj('url')}
        placeholder={v.type === 'wms' ? 'https://…/wms (adresse du service, sans paramètres)' : 'https://…/{z}/{x}/{y}.png'}
        aria-label="Adresse"
        className="w-full font-mono text-sm"
      />
      {v.type === 'wms' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input required maxLength={300} value={v.couches} onChange={maj('couches')} placeholder="Nom(s) de couche WMS (séparés par des virgules)" aria-label="Couches WMS" className="sm:col-span-2" />
          <select value={v.format} onChange={maj('format')} aria-label="Format">
            <option value="image/png">PNG</option>
            <option value="image/jpeg">JPEG</option>
          </select>
        </div>
      )}
      <input maxLength={300} value={v.attribution} onChange={maj('attribution')} placeholder="Attribution exigée par la licence (ex. © SPW)" aria-label="Attribution" className="w-full" />
      <input maxLength={500} value={v.source} onChange={maj('source')} placeholder="Source ou référence de la couche (facultatif)" aria-label="Source" className="w-full" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <label className="text-xs text-sourdine">
          Opacité ({Math.round(Number(v.opacite) * 100)} %)
          <input type="range" min="0.1" max="1" step="0.05" value={v.opacite} onChange={maj('opacite')} className="block w-full" />
        </label>
        <label className="text-xs text-sourdine">
          Zoom max
          <input type="number" min="1" max="22" value={v.zoom_max} onChange={maj('zoom_max')} className="block w-full" />
        </label>
        <label className="text-xs text-sourdine">
          Ordre
          <input type="number" value={v.ordre} onChange={maj('ordre')} className="block w-full" />
        </label>
        <div className="space-y-1">
          {['qg', 'terrain'].map((a) => (
            <label key={a} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={v.apps.includes(a)}
                onChange={(e) => setV({ ...v, apps: e.target.checked ? [...v.apps, a] : v.apps.filter((x) => x !== a) })}
              />
              {a === 'qg' ? 'QG' : 'Terrain'}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1"><input type="checkbox" checked={v.visible_par_defaut} onChange={maj('visible_par_defaut')} /> Affichée à l’ouverture de la carte</label>
        {v.type === 'wms' && <label className="flex items-center gap-1"><input type="checkbox" checked={v.transparent} onChange={maj('transparent')} /> Fond transparent</label>}
        <label className="flex items-center gap-1"><input type="checkbox" checked={v.actif} onChange={maj('actif')} /> Active</label>
      </div>
      {erreur && <p className="text-sm text-chaud">{erreur}</p>}
      <div className="flex gap-2">
        <BoutonPrincipal type="submit" disabled={enCours || !v.nom.trim() || v.apps.length === 0}>Enregistrer</BoutonPrincipal>
        <BoutonDiscret type="button" onClick={onAnnuler}>Annuler</BoutonDiscret>
      </div>
    </form>
  )
}
