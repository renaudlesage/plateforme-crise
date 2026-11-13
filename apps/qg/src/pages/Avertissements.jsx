import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  LIBELLE_ETAT_REGLE,
  LIBELLE_NIVEAU,
  NIVEAUX_AVERTISSEMENT,
  TACHE_FLUX_METEO,
  TYPES_AVERTISSEMENT,
  URL_PORTAIL_METEOALARM,
  alertesDeLaCommune,
  attributionAlerte,
  bilanTraitement,
  erreurSaisie,
  etatFlux,
  etatRegle,
  evenementSaisi,
  ilYA,
  instantDepuisChampLocal,
  jourHeureBelge,
  libelleSourceAlerte,
  libelleTypeAvertissement,
  resumeRegle,
  texteErreur,
  texteValidite,
} from '@plateforme-crise/shared'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { BoutonDiscret, BoutonPrincipal } from '../components/Boutons'
import { COULEUR, Pastille } from '../components/VeilleMeteo'

const HISTORIQUE_MS = 48 * 3600 * 1000
const CHAMPS_REVEIL =
  'id, arme_le, niveau, source, est_exercice, escalade_le, acquitte_le, acquitte_par, incident_id, seuil_action_id, seuils_action(libelle), alertes_externes(type_alerte, titre)'

/**
 * Onglet Avertissements du CC (chantier C1, « page Veille » du briefing, renommée : « veille » désigne déjà la phase
 * d'un événement, la veille météo et la veille sociétale) : avertissements officiels en cours pour la commune, réveils
 * automatiques et règles qui les arment, état du flux météo. Un avertissement reçu par un autre canal (appel du CORTEX,
 * courriel du gouverneur) s'encode ici et passe par le même moteur de réveil que le flux. Les règles se règlent dans Admin.
 *
 * Doctrine : l'absence d'avertissement n'est présentée comme une information que si le flux est branché et à jour.
 */
export default function Avertissements() {
  const { contexteId, contexteActuel, utilisateur } = useAuth()
  const { reveils: enAttente } = useOutletContext()
  const peutEcrire = ['ecriture', 'admin'].includes(contexteActuel?.niveau_acces)

  const [donnees, setDonnees] = useState(null) // { province, alertes, reveils, regles, tache }
  const [erreur, setErreur] = useState(null)
  const [estSuperAdmin, setEstSuperAdmin] = useState(false)
  const [acquittement, setAcquittement] = useState({ id: null, erreur: null })

  const charger = useCallback(async () => {
    if (!contexteId) return
    const depuis = new Date(Date.now() - HISTORIQUE_MS).toISOString()
    const reponses = await Promise.all([
      supabase.from('contextes').select('province').eq('id', contexteId).maybeSingle(),
      supabase
        .from('alertes_externes_en_cours')
        .select('id, source, contexte_id, provinces, type_alerte, niveau, evenement, titre, consignes, debut_le, fin_le, emis_le, recu_le')
        .or(`contexte_id.eq.${contexteId},contexte_id.is.null`)
        .order('recu_le', { ascending: false })
        .limit(200),
      // Réveils des dernières 48 h, et ceux des événements encore ouverts quel que soit leur âge.
      supabase.from('reveils').select(`${CHAMPS_REVEIL}, incidents(nom, statut)`).eq('contexte_id', contexteId).gte('arme_le', depuis).order('arme_le', { ascending: false }).limit(50),
      supabase.from('reveils').select(`${CHAMPS_REVEIL}, incidents!inner(nom, statut)`).eq('contexte_id', contexteId).neq('incidents.statut', 'cloture').order('arme_le', { ascending: false }).limit(100),
      supabase
        .from('regles_reveil')
        .select('id, seuil_action_id, source, type_alerte, niveau_min, heure_debut, heure_fin, actif, seuils_action(libelle, ordre, actif)')
        .eq('contexte_id', contexteId),
      supabase.from('jobs_etat').select('nom, actif, silence_max, dernier_succes_le, echecs_consecutifs, derniere_erreur').eq('nom', TACHE_FLUX_METEO).maybeSingle(),
    ])
    const [commune, alertes, recents, ouverts, regles, tache] = reponses
    const probleme = reponses.find((r) => r.error)?.error
    setErreur(probleme ? texteErreur(probleme) : null)
    const parId = new Map()
    for (const r of [...(recents.data ?? []), ...(ouverts.data ?? [])]) parId.set(r.id, { ...r, incident_ouvert: r.incidents?.statut !== 'cloture' })
    setDonnees({
      province: commune.data?.province ?? null,
      alertes: alertes.data ?? [],
      reveils: [...parId.values()].sort((a, b) => String(b.arme_le).localeCompare(String(a.arme_le))),
      regles: regles.data ?? [],
      tache: tache.data ?? null,
    })
  }, [contexteId])

  useEffect(() => {
    setDonnees(null)
    charger()
    const t = setInterval(charger, 30000)
    return () => clearInterval(t)
  }, [charger])

  useEffect(() => {
    supabase.rpc('est_super_admin').then(({ data }) => setEstSuperAdmin(data === true))
  }, [])

  // Acquittement par l'état du bandeau : la pastille de l'onglet suit tout de suite.
  async function acquitter(id) {
    setAcquittement({ id, erreur: null })
    const { error } = await enAttente.acquitter(id)
    await charger()
    setAcquittement({ id: null, erreur: error ? texteErreur(error) : null })
  }

  if (!contexteId) return null
  const flux = etatFlux(donnees?.tache)

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-3">
        <div>
          <h1 className="text-lg font-semibold text-encre" style={{ margin: 0 }}>Avertissements</h1>
          <p className="text-sm text-sourdine" style={{ margin: '4px 0 0', maxWidth: '70ch' }}>
            Avertissements officiels en cours pour la commune et réveils automatiques qu'ils déclenchent. Une règle de réveil arme un seuil
            d'action ; le premier « Vu, je prends » est retenu et consigné au journal des décisions.
          </p>
        </div>
        <BoutonDiscret type="button" onClick={() => window.print()}>
          Imprimer
        </BoutonDiscret>
      </header>

      {erreur && <p role="alert" className="text-sm text-chaud mb-3">{erreur}</p>}

      {donnees === null ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : (
        <>
          <BlocReveils reveils={donnees.reveils} utilisateurId={utilisateur?.id} acquittement={acquittement} onAcquitter={acquitter} />
          <BlocAvertissements alertes={alertesDeLaCommune(donnees.alertes, { contexteId, province: donnees.province })} province={donnees.province} flux={flux} />
          {(peutEcrire || estSuperAdmin) && <BlocSaisie contexteId={contexteId} estSuperAdmin={estSuperAdmin} onEnregistre={charger} />}
          <BlocRegles regles={donnees.regles} reveils={donnees.reveils} />
        </>
      )}
    </div>
  )
}

function LienMeteoAlarm() {
  return (
    <a className="underline" href={URL_PORTAIL_METEOALARM} target="_blank" rel="noreferrer">
      meteoalarm.org ↗
    </a>
  )
}

function Section({ id, titre, children }) {
  return (
    <section aria-labelledby={id} className="mb-6">
      <h2 id={id} className="text-base font-semibold text-encre mb-2">
        {titre}
      </h2>
      {children}
    </section>
  )
}

function BlocReveils({ reveils, utilisateurId, acquittement, onAcquitter }) {
  const enAttente = reveils.filter((r) => !r.acquitte_le && r.incident_ouvert)
  const lignes = [...enAttente, ...reveils.filter((r) => !enAttente.includes(r))]
  return (
    <Section id="section-reveils" titre={`Réveils${enAttente.length ? ` · ${enAttente.length} à acquitter` : ''}`}>
      {acquittement.erreur && <p role="alert" className="text-sm text-chaud mb-2">{acquittement.erreur}</p>}
      {lignes.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4" style={{ margin: 0 }}>
          Aucun réveil sur les dernières 48 heures ni sur les événements ouverts.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden">
          {lignes.map((r) => {
            const aAcquitter = !r.acquitte_le && r.incident_ouvert
            return (
              <li key={r.id} className="px-4 py-3 bg-surface flex flex-wrap items-start justify-between gap-3" style={aAcquitter ? { borderLeft: '4px solid #b91c1c' } : undefined}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-encre" style={{ margin: 0 }}>
                    {r.est_exercice && <span className="jeton mr-2">EXERCICE</span>}
                    <Pastille niveau={r.niveau} /> Seuil « {r.seuils_action?.libelle ?? 'seuil'} »
                  </p>
                  <p className="text-xs text-sourdine mt-1" style={{ marginBottom: 0 }}>
                    Armé le {jourHeureBelge(r.arme_le)}
                    {r.alertes_externes ? ` · avertissement ${libelleTypeAvertissement(r.alertes_externes.type_alerte).toLowerCase()}` : ''} · {libelleSourceAlerte(r.source)}
                    {r.escalade_le ? ` · suppléants prévenus le ${jourHeureBelge(r.escalade_le)}` : ''}
                  </p>
                  <p className="text-xs text-sourdine mt-0.5" style={{ marginBottom: 0 }}>
                    Événement :{' '}
                    <Link to={`/incidents/${r.incident_id}`} className="underline">
                      {r.incidents?.nom ?? 'voir la fiche'}
                    </Link>
                    {r.incident_ouvert ? '' : ' (clôturé)'}
                  </p>
                </div>
                <div className="flex-shrink-0 text-sm">
                  {r.acquitte_le ? (
                    <span className="jeton">
                      Acquitté le {jourHeureBelge(r.acquitte_le)}
                      {r.acquitte_par === utilisateurId ? ' (vous)' : ''}
                    </span>
                  ) : aAcquitter ? (
                    <BoutonPrincipal type="button" disabled={acquittement.id === r.id} onClick={() => onAcquitter(r.id)}>
                      {acquittement.id === r.id ? 'Envoi…' : 'Vu, je prends'}
                    </BoutonPrincipal>
                  ) : (
                    <span className="jeton text-sourdine">Non acquitté, événement clôturé</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

function EtatFlux({ flux }) {
  switch (flux.etat) {
    case 'ok':
      return <p className="text-xs text-sourdine mb-2">Flux MeteoAlarm (IRM) lu {ilYA(flux.dernierSucces)}.</p>
    case 'erreur':
      return (
        <p role="status" className="text-sm text-chaud mb-2">
          Dernière lecture du flux MeteoAlarm en échec{flux.erreur ? ` (${flux.erreur})` : ''} ; dernier succès {ilYA(flux.dernierSucces)}. En cas de doute : <LienMeteoAlarm />
        </p>
      )
    case 'muet':
      return (
        <p role="alert" className="text-sm text-chaud mb-2">
          Flux MeteoAlarm muet ({flux.dernierSucces ? `dernier succès ${ilYA(flux.dernierSucces)}` : 'aucune lecture réussie'}) : l'absence d'avertissement ne veut
          rien dire. Consultez <LienMeteoAlarm />
        </p>
      )
    default:
      return (
        <p role="note" className="text-sm text-encre border border-trait rounded px-3 py-2 mb-2 bg-surface">
          Le flux MeteoAlarm n'est pas encore branché : seuls les avertissements encodés ici déclenchent le réveil automatique. Surveillez <LienMeteoAlarm /> et
          les messages du centre de crise.
        </p>
      )
  }
}

function BlocAvertissements({ alertes, province, flux }) {
  return (
    <Section id="section-avertissements" titre={`Avertissements en cours${province ? ` · ${province}` : ''}`}>
      <EtatFlux flux={flux} />
      {!province && (
        <p className="text-xs text-sourdine mb-2">
          Province de la commune non renseignée (Admin → Anticipation → « Météo de la commune ») : seuls les avertissements encodés pour la commune s'affichent.
        </p>
      )}
      {alertes.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4" style={{ margin: 0 }}>
          {flux.etat === 'ok'
            ? `Aucun avertissement en cours pour ${province ?? 'la commune'}.`
            : "Aucun avertissement enregistré. Le flux n'étant pas à jour, cela ne veut rien dire."}
        </p>
      ) : (
        <ul className="space-y-2">
          {alertes.map((a) => (
            <li key={a.id} className="bg-surface border border-trait rounded p-3" style={{ borderLeft: `4px solid ${COULEUR[a.niveau]}` }}>
              <p className="text-sm text-encre" style={{ margin: 0 }}>
                {a.source === 'fixture' && <span className="jeton mr-2">EXERCICE</span>}
                <Pastille niveau={a.niveau} /> <span className="font-medium">{a.titre || a.evenement}</span>
              </p>
              <p className="text-xs text-sourdine mt-1" style={{ marginBottom: 0 }}>
                {libelleTypeAvertissement(a.type_alerte)} · {texteValidite(a)}
              </p>
              {a.consignes && (
                <p className="text-sm text-encre mt-1" style={{ marginBottom: 0, whiteSpace: 'pre-line' }}>
                  → {a.consignes}
                </p>
              )}
              <p className="text-xs text-sourdine mt-1" style={{ marginBottom: 0 }}>
                {attributionAlerte(a)}
                {a.source === 'meteoalarm' && (
                  <>
                    {' · '}
                    <LienMeteoAlarm />
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

const SAISIE_VIDE = { type_alerte: '', niveau: '', titre: '', consignes: '', debut: '', fin: '', demo: false }

/** Avertissement reçu par un autre canal : il passe par le même moteur que le flux (règles, seuil le plus élevé par fiche). */
function BlocSaisie({ contexteId, estSuperAdmin, onEnregistre }) {
  const [v, setV] = useState(SAISIE_VIDE)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'erreur', texte }
  const maj = (champ) => (e) => setV((x) => ({ ...x, [champ]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function enregistrer(e) {
    e.preventDefault()
    const debut = instantDepuisChampLocal(v.debut)
    const fin = instantDepuisChampLocal(v.fin)
    const probleme = erreurSaisie({ type_alerte: v.type_alerte, niveau: v.niveau, titre: v.titre, debut_le: debut, fin_le: fin })
    if (probleme) {
      setMessage({ type: 'erreur', texte: probleme })
      return
    }
    setEnCours(true)
    setMessage(null)
    const ligne = {
      source: v.demo ? 'fixture' : 'saisie',
      contexte_id: contexteId,
      type_alerte: v.type_alerte,
      niveau: v.niveau,
      evenement: evenementSaisi(v.type_alerte),
      titre: v.titre.trim(),
      consignes: v.consignes.trim() || null,
      fin_le: fin,
      ...(debut ? { debut_le: debut } : {}),
    }
    const { data, error } = await supabase.from('alertes_externes').insert(ligne).select('id').single()
    if (error) {
      setEnCours(false)
      setMessage({ type: 'erreur', texte: texteErreur(error) })
      return
    }
    // Le moteur de réveil tourne dans la même transaction que l'enregistrement : son bilan est déjà là.
    const { data: traitement } = await supabase.from('alertes_externes_traitements').select('nb_reveils, erreur').eq('alerte_externe_id', data.id).maybeSingle()
    setEnCours(false)
    setMessage(bilanTraitement(traitement))
    setV(SAISIE_VIDE)
    onEnregistre()
  }

  return (
    <details className="no-print mb-6 border border-trait rounded p-3 bg-surface">
      <summary className="cursor-pointer text-sm font-medium text-encre">Encoder un avertissement reçu par un autre canal</summary>
      <form onSubmit={enregistrer} className="space-y-3 mt-3">
        <p className="text-xs text-sourdine" style={{ margin: 0 }}>
          Appel du CORTEX, courriel du gouverneur, message du centre de crise : l'avertissement encodé déclenche les mêmes règles que le flux. Un niveau déjà
          signalé pour la même fiche ne réveille pas une seconde fois la cellule.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="saisie-type" className="block text-xs font-medium text-sourdine mb-1">Phénomène</label>
            <select id="saisie-type" value={v.type_alerte} onChange={maj('type_alerte')} className="w-full" required>
              <option value="">—</option>
              {TYPES_AVERTISSEMENT.map((t) => (
                <option key={t.cle} value={t.cle}>{t.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="saisie-niveau" className="block text-xs font-medium text-sourdine mb-1">Niveau</label>
            <select id="saisie-niveau" value={v.niveau} onChange={maj('niveau')} className="w-full" required>
              <option value="">—</option>
              {NIVEAUX_AVERTISSEMENT.map((n) => (
                <option key={n} value={n}>{LIBELLE_NIVEAU[n]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="saisie-titre" className="block text-xs font-medium text-sourdine mb-1">Ce que dit l'avertissement</label>
          <input
            id="saisie-titre"
            value={v.titre}
            onChange={maj('titre')}
            maxLength={500}
            required
            placeholder="ex. Orange orages sur la province, appel du CORTEX à 16:40"
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor="saisie-consignes" className="block text-xs font-medium text-sourdine mb-1">Consignes reçues (facultatif)</label>
          <textarea id="saisie-consignes" value={v.consignes} onChange={maj('consignes')} maxLength={2000} rows={2} className="w-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="saisie-debut" className="block text-xs font-medium text-sourdine mb-1">Début (maintenant si vide)</label>
            <input id="saisie-debut" type="datetime-local" value={v.debut} onChange={maj('debut')} className="w-full" />
          </div>
          <div>
            <label htmlFor="saisie-fin" className="block text-xs font-medium text-sourdine mb-1">Fin annoncée (facultatif)</label>
            <input id="saisie-fin" type="datetime-local" value={v.fin} onChange={maj('fin')} className="w-full" />
          </div>
        </div>
        {estSuperAdmin && (
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={v.demo} onChange={maj('demo')} className="mt-0.5" />
            Démonstration marquée EXERCICE (super-admin)
          </label>
        )}
        {message && (
          <p role={message.type === 'erreur' ? 'alert' : 'status'} className={`text-sm ${message.type === 'erreur' ? 'text-chaud' : 'text-encre'}`} style={{ margin: 0 }}>
            {message.texte}
          </p>
        )}
        <BoutonPrincipal type="submit" disabled={enCours}>
          {enCours ? 'Enregistrement…' : "Enregistrer l'avertissement"}
        </BoutonPrincipal>
      </form>
    </details>
  )
}

function BlocRegles({ regles, reveils }) {
  const triees = [...regles].sort(
    (a, b) => Number(b.actif) - Number(a.actif) || (a.seuils_action?.ordre ?? 0) - (b.seuils_action?.ordre ?? 0) || a.type_alerte.localeCompare(b.type_alerte),
  )
  return (
    <Section id="section-regles" titre={`Règles de réveil (${regles.length})`}>
      <p className="text-xs text-sourdine mb-2">
        Elles se règlent dans Admin → Anticipation → Réveil automatique. Quand plusieurs règles sont remplies, seul le seuil le plus élevé de chaque fiche est armé.
      </p>
      {regles.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-4" style={{ margin: 0 }}>
          Aucune règle de réveil visible : soit aucune n'est enregistrée, et aucun avertissement ne réveillera la cellule ; soit votre rôle ne permet pas de les
          consulter.
        </p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden">
          {triees.map((r) => {
            const { etat } = etatRegle(r, reveils)
            return (
              <li key={r.id} className="px-4 py-2.5 bg-surface flex flex-wrap items-center justify-between gap-2" style={{ opacity: etat === 'inactive' || etat === 'seuil_inactif' ? 0.6 : 1 }}>
                <span className="text-sm text-encre min-w-0">{resumeRegle(r, r.seuils_action?.libelle)}</span>
                <span className="jeton" style={etat === 'declenchee' ? { background: '#b91c1c', color: '#fff' } : undefined}>
                  {LIBELLE_ETAT_REGLE[etat]}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
