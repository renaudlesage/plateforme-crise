import { useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../../lib/supabase'
import { useDonneesExercice } from '../../hooks/useDonneesExercice'
import { BoutonDiscret } from '../Boutons'
import Chronologie from './Chronologie'
import { LIBELLE_GRAVITE, STATUTS_ACTION } from '../../lib/exercices'

/**
 * Bilan d'un exercice terminé : synthèse calculée à la clôture (simple décompte, sans IA),
 * écarts et suivi des actions correctives, rapport final.
 * Lisible par tout membre ; seuls les animateurs voient la main courante et peuvent écrire.
 */
export default function ExerciceBilan({ ex, peutAnimer, onChange }) {
  const { d, erreur, recharger } = useDonneesExercice(ex.id, peutAnimer && ex.statut === 'termine')

  if (ex.statut !== 'termine') {
    return <p className="text-sm text-sourdine">Le bilan sera disponible à la clôture de l’exercice.</p>
  }
  const s = ex.synthese

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-encre mb-1">Synthèse</h2>
        {s ? <Synthese s={s} ex={ex} /> : <p className="text-sm text-chaud">Synthèse indisponible pour cet exercice.</p>}
        <p className="text-xs text-sourdine mt-2">
          Simple décompte des observations saisies pendant l’exercice, calculé à la clôture{s?.calcule_le ? ` (${new Date(s.calcule_le).toLocaleString('fr-BE')})` : ''}, sans interprétation automatique.
          Un exercice réussi ne certifie rien : il décrit ce qui a été observé, ce jour-là, dans ces conditions. Une action non observée n’est pas une réussite.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-encre">Écarts et actions correctives</h2>
        <p className="text-xs text-sourdine mb-2">Le dispositif, pas les personnes. Le texte des écarts est figé ; leur suivi reste ouvert.</p>
        {erreur && !d ? (
          <div>
            <p role="alert" className="text-sm text-chaud mb-2">{erreur}</p>
            <BoutonDiscret onClick={recharger}>Réessayer</BoutonDiscret>
          </div>
        ) : !d ? (
          <p className="text-sm text-sourdine">Chargement…</p>
        ) : d.ecarts.length === 0 ? (
          <p className="text-sm text-sourdine">Aucun écart consigné.</p>
        ) : (
          <ul className="space-y-2">
            {d.ecarts.map((e) => (
              <EcartSuivi key={e.id} e={e} editable={peutAnimer} onSauve={recharger} />
            ))}
          </ul>
        )}
      </section>

      <RapportFinal ex={ex} editable={peutAnimer} onChange={onChange} />

      {peutAnimer && d && (
        <section>
          <h2 className="text-sm font-semibold text-encre mb-1">Main courante de l’exercice</h2>
          <Chronologie d={d} limite={20} />
        </section>
      )}
    </div>
  )
}

function Tuile({ valeur, libelle, detail, accent }) {
  return (
    <div className="border border-trait rounded p-3 bg-surface">
      <p className={`text-xl font-semibold tabular-nums ${accent ?? 'text-encre'}`}>{valeur}</p>
      <p className="text-xs text-encre">{libelle}</p>
      {detail && <p className="text-xs text-sourdine">{detail}</p>}
    </div>
  )
}

function Synthese({ s, ex }) {
  const st = s.stimuli ?? {}
  const ac = s.actions ?? {}
  const ec = s.ecarts ?? {}
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tuile
          valeur={s.duree_reelle_min != null ? `${s.duree_reelle_min} min` : '—'}
          libelle="Durée réelle"
          detail={ex.duree_minutes ? `prévue : ${ex.duree_minutes} min` : null}
        />
        <Tuile
          valeur={`${st.lances ?? 0} / ${st.total ?? 0}`}
          libelle="Stimuli lancés"
          detail={`${st.sautes ?? 0} sauté${(st.sautes ?? 0) > 1 ? 's' : ''} · ${st.non_joues ?? 0} non joué${(st.non_joues ?? 0) > 1 ? 's' : ''}`}
        />
        <Tuile
          valeur={`${ac.atteintes ?? 0} / ${ac.total ?? 0}`}
          libelle="Actions atteintes"
          detail={`${ac.non_atteintes ?? 0} non atteinte${(ac.non_atteintes ?? 0) > 1 ? 's' : ''} · ${ac.non_observees ?? 0} non observée${(ac.non_observees ?? 0) > 1 ? 's' : ''}`}
        />
        <Tuile
          valeur={ec.total ?? 0}
          libelle="Écarts consignés"
          detail={`${ec.critiques ?? 0} critique${(ec.critiques ?? 0) > 1 ? 's' : ''} · ${ec.majeurs ?? 0} majeur${(ec.majeurs ?? 0) > 1 ? 's' : ''} · ${ec.mineurs ?? 0} mineur${(ec.mineurs ?? 0) > 1 ? 's' : ''}`}
          accent={(ec.critiques ?? 0) > 0 ? 'text-chaud' : undefined}
        />
      </div>

      {(ac.total ?? 0) === 0 && (
        <p className="text-sm text-chaud">Aucune action attendue n’avait été préparée : cet exercice n’a rien mesuré.</p>
      )}
      {(ac.non_observees ?? 0) > 0 && (
        <p className="text-sm text-veille">
          {ac.non_observees} action{ac.non_observees > 1 ? 's' : ''} sur {ac.total} {ac.non_observees > 1 ? 'n’ont' : 'n’a'} pas été observée{ac.non_observees > 1 ? 's' : ''} : on ne sait pas si elles ont été faites.
        </p>
      )}

      {Array.isArray(s.par_objectif) && s.par_objectif.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="text-left text-xs text-sourdine">
                <th className="py-1 pr-3 font-medium">Objectif</th>
                <th className="py-1 pr-3 font-medium text-right">Actions</th>
                <th className="py-1 pr-3 font-medium text-right">Atteintes</th>
                <th className="py-1 font-medium text-right">Non observées</th>
              </tr>
            </thead>
            <tbody>
              {s.par_objectif.map((o) => (
                <tr key={o.objectif_id} className="border-t border-trait">
                  <td className="py-1.5 pr-3 text-encre"><span className="jeton mr-2">{o.code}</span>{o.intitule}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{o.actions}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{o.atteintes}</td>
                  <td className="py-1.5 text-right tabular-nums">{o.non_observees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EcartSuivi({ e, editable, onSauve }) {
  const [corrective, setCorrective] = useState(e.action_corrective ?? '')
  const [responsable, setResponsable] = useState(e.responsable ?? '')
  const [echeance, setEcheance] = useState(e.echeance ?? '')
  const [statut, setStatut] = useState(e.statut_action)
  const [erreur, setErreur] = useState(null)
  const [ok, setOk] = useState(false)
  const [enCours, setEnCours] = useState(false)

  async function enregistrer(ev) {
    ev.preventDefault()
    setEnCours(true)
    setErreur(null)
    setOk(false)
    const { error } = await supabase
      .from('exercice_ecarts')
      .update({
        action_corrective: corrective.trim() || null,
        responsable: responsable.trim() || null,
        echeance: echeance || null,
        statut_action: statut,
      })
      .eq('id', e.id)
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else {
      setOk(true)
      onSauve()
    }
  }

  const libelleStatut = STATUTS_ACTION.find((x) => x.valeur === e.statut_action)?.libelle ?? e.statut_action
  const enRetard = e.echeance && !['faite', 'verifiee', 'abandonnee'].includes(e.statut_action) && e.echeance < new Date().toISOString().slice(0, 10)

  return (
    <li className="border border-trait rounded p-3 bg-surface">
      <p className="text-sm text-encre">
        <span className={`jeton mr-2 ${e.gravite === 'critique' ? 'text-chaud' : e.gravite === 'majeure' ? 'text-veille' : ''}`}>
          {LIBELLE_GRAVITE[e.gravite] ?? e.gravite}
        </span>
        {e.ecart}
      </p>
      {editable ? (
        <form onSubmit={enregistrer} className="mt-2 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-sourdine mb-1">Action corrective</label>
            <input value={corrective} onChange={(x) => setCorrective(x.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Responsable (service / fonction)</label>
            <input value={responsable} onChange={(x) => setResponsable(x.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Échéance</label>
            <input type="date" value={echeance} onChange={(x) => setEcheance(x.target.value)} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sourdine mb-1">Suivi</label>
            <select value={statut} onChange={(x) => setStatut(x.target.value)} className="w-full">
              {STATUTS_ACTION.map((x) => <option key={x.valeur} value={x.valeur}>{x.libelle}</option>)}
            </select>
          </div>
          <div className="sm:col-span-3 flex items-end gap-3">
            <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer le suivi'}</BoutonDiscret>
            {ok && <span role="status" className="text-xs text-ok">Enregistré</span>}
            {erreur && <span role="alert" className="text-xs text-chaud">{erreur}</span>}
          </div>
        </form>
      ) : (
        <p className="text-xs text-sourdine mt-1">
          {e.action_corrective ? `action corrective : ${e.action_corrective}` : 'aucune action corrective précisée'}
          {e.responsable && ` · ${e.responsable}`}
          {e.echeance && ` · échéance ${new Date(e.echeance).toLocaleDateString('fr-BE')}`}
          {` · ${libelleStatut}`}
          {enRetard && <span className="text-chaud"> · en retard</span>}
        </p>
      )}
      {editable && enRetard && <p className="text-xs text-chaud mt-1">Échéance dépassée.</p>}
    </li>
  )
}

function RapportFinal({ ex, editable, onChange }) {
  const [texte, setTexte] = useState(ex.rapport_final ?? '')
  const [erreur, setErreur] = useState(null)
  const [ok, setOk] = useState(false)
  const [enCours, setEnCours] = useState(false)

  if (!editable && !ex.rapport_final) return null

  async function enregistrer(e) {
    e.preventDefault()
    setEnCours(true)
    setErreur(null)
    setOk(false)
    const { error } = await supabase.from('exercices').update({ rapport_final: texte.trim() || null }).eq('id', ex.id)
    setEnCours(false)
    if (error) setErreur(texteErreur(error))
    else {
      setOk(true)
      onChange()
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-encre">Rapport final</h2>
      <p className="text-xs text-sourdine mb-2">Jugement sur le dispositif uniquement — jamais nominatif sur une personne.</p>
      {editable ? (
        <form onSubmit={enregistrer} className="space-y-2">
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={5} className="w-full" />
          <div className="flex items-center gap-3">
            <BoutonDiscret type="submit" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer le rapport'}</BoutonDiscret>
            {ok && <span role="status" className="text-xs text-ok">Enregistré</span>}
            {erreur && <span role="alert" className="text-xs text-chaud">{erreur}</span>}
          </div>
        </form>
      ) : (
        <p className="text-sm text-encre whitespace-pre-wrap">{ex.rapport_final}</p>
      )}
    </section>
  )
}
