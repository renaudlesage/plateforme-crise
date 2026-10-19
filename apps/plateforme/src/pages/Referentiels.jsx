import { useEffect, useState } from 'react'
import {
  ACTIONS_PROTECTION, ALEAS_SITUATION, CATEGORIES_SITUATION, TYPES_SOURCE_SITUATION, TYPES_ZONE_PLANIFICATION_NUCLEAIRE,
} from '@plateforme-crise/shared'
import Onglets from '../components/Onglets'
import TableCrud from '../components/TableCrud'
import { BoutonDiscret } from '../components/Boutons'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

/**
 * Référentiels nationaux : données communes à tous les clients, modifiables
 * par le super-admin seulement (les policies RLS l'imposent). Les clients les
 * consultent depuis leurs propres apps (Admin, QG).
 */
export default function Referentiels() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Référentiels nationaux</h1>
      <p className="text-sm text-sourdine mb-4">
        Données partagées par tous les clients. Toute modification est visible immédiatement chez eux.
      </p>
      <Onglets
        onglets={[
          { cle: 'sources', libelle: 'Sources de situation', contenu: <SourcesNationales /> },
          { cle: 'catalogue', libelle: "Messages d'alerte", contenu: <ValidationCatalogue /> },
          { cle: 'nucleaire', libelle: 'Nucléaire', contenu: <Nucleaire /> },
          { cle: 'cbrn', libelle: 'Formations CBRN', contenu: <FormationsCbrn /> },
          { cle: 'lexique', libelle: "Lexique d'appels", contenu: <Lexique /> },
        ]}
      />
    </div>
  )
}

const options = (liste) => liste.map((x) => ({ valeur: x.cle ?? x.valeur, libelle: x.libelle }))

function SourcesNationales() {
  return (
    <TableCrud
      table="sources_situation"
      colonneNulle="contexte_id"
      tri="ordre_affichage"
      aide="Sources communes de la page Situation (QG). Le code est obligatoire pour une source nationale (minuscules, chiffres, _)."
      etiquetteAjout="Ajouter une source"
      valeursParDefaut={{ actif: true, mode_affichage: 'lien', ordre_affichage: 100 }}
      titreLigne={(l) => (
        <>
          <strong>{l.nom}</strong> <span className="text-xs text-sourdine font-mono">{l.code}</span>
          {!l.actif && <span className="jeton ml-2 text-veille">inactive</span>}
        </>
      )}
      champs={[
        { cle: 'nom', libelle: 'Nom', type: 'text', requis: true },
        { cle: 'code', libelle: 'Code', type: 'text', requis: true, liste: false },
        { cle: 'url', libelle: 'Adresse (https://…)', type: 'text', requis: true, liste: false },
        { cle: 'categorie', libelle: 'Catégorie', type: 'select', options: options(CATEGORIES_SITUATION), requis: true },
        { cle: 'type_source', libelle: 'Type', type: 'select', options: options(TYPES_SOURCE_SITUATION), requis: true },
        {
          cle: 'mode_affichage',
          libelle: 'Affichage',
          type: 'select',
          options: [
            { valeur: 'lien', libelle: 'Lien' },
            { valeur: 'iframe', libelle: 'Intégré (iframe)' },
            { valeur: 'flux', libelle: 'Flux' },
          ],
        },
        { cle: 'aleas_lies', libelle: 'Aléas liés', type: 'multi', options: options(ALEAS_SITUATION) },
        { cle: 'portee', libelle: 'Portée (ex. Wallonie)', type: 'text' },
        { cle: 'ordre_affichage', libelle: "Ordre d'affichage", type: 'number', liste: false },
        { cle: 'note', libelle: 'Note', type: 'textarea', liste: false },
        { cle: 'avertissement', libelle: 'Avertissement', type: 'textarea', liste: false },
        { cle: 'actif', libelle: 'Active', type: 'checkbox', liste: false },
      ]}
    />
  )
}

const STATUTS_VALIDATION = [
  { valeur: 'a_valider', libelle: 'À valider' },
  { valeur: 'en_revue', libelle: 'En revue' },
  { valeur: 'valide', libelle: 'Validé' },
  { valeur: 'rejete', libelle: 'Rejeté' },
]

/**
 * Suivi de validation du catalogue national de messages d'alerte. Le texte
 * des messages s'édite dans l'app Admin (page « Catalogue de messages
 * d'alerte ») ; ici, vue d'ensemble et changement de statut.
 */
function ValidationCatalogue() {
  const { utilisateur } = useAuth()
  const [messages, setMessages] = useState([])
  const [statut, setStatut] = useState('a_valider')
  const [erreur, setErreur] = useState(null)
  const [chargement, setChargement] = useState(true)

  async function charger() {
    const { data, error } = await supabase
      .from('catalogue_messages_alerte')
      .select('id, titre, message_cle, sous_messages, section, phase_cycle, statut_validation, valide_le, necessite_completion, notes_validation')
      .order('numero_message_source', { ascending: true, nullsFirst: false })
    if (error) setErreur(error.message)
    else setMessages(data ?? [])
    setChargement(false)
  }

  useEffect(() => {
    charger()
  }, [])

  // Même règle que l'app Admin : valider un message « à relire » vaut relecture.
  async function changer(m, nouveau) {
    const valide = nouveau === 'valide'
    if (valide && m.necessite_completion && !confirm('Ce message est marqué « à relire » (texte reconstitué). Le valider confirme que vous l\'avez relu. Continuer ?')) return
    const { data, error } = await supabase
      .from('catalogue_messages_alerte')
      .update({
        statut_validation: nouveau,
        valide_par: valide ? utilisateur.id : null,
        valide_le: valide ? new Date().toISOString() : null,
        ...(valide && m.necessite_completion ? { necessite_completion: false } : {}),
      })
      .eq('id', m.id)
      .select('id')
    if (error) setErreur(error.message)
    else if (!data?.length) setErreur('Modification refusée par la base (droits insuffisants).')
    else {
      setErreur(null)
      charger()
    }
  }

  const compte = (s) => messages.filter((m) => m.statut_validation === s).length
  const visibles = messages.filter((m) => !statut || m.statut_validation === statut)

  return (
    <div>
      <p className="text-xs text-sourdine mb-3">
        Un message ne doit servir en opération qu'une fois « Validé » par un expert. Le texte se modifie dans l'app Admin
        (Communication › Catalogue de messages d'alerte).
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {STATUTS_VALIDATION.map((s) => (
          <button
            key={s.valeur}
            type="button"
            className={`pastille-filtre${statut === s.valeur ? ' actif' : ''}`}
            onClick={() => setStatut(s.valeur)}
          >
            {s.libelle} ({compte(s.valeur)})
          </button>
        ))}
        <button type="button" className={`pastille-filtre${statut === '' ? ' actif' : ''}`} onClick={() => setStatut('')}>
          Tous ({messages.length})
        </button>
      </div>
      {erreur && <p className="text-sm text-chaud mb-2">{erreur}</p>}
      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : visibles.length === 0 ? (
        <p className="vide border border-dashed border-trait text-center p-4">Aucun message dans ce statut.</p>
      ) : (
        <ul className="divide-y divide-trait border border-trait rounded overflow-hidden bg-surface">
          {visibles.map((m) => (
            <li key={m.id} className="px-4 py-2.5">
              <p className="text-sm font-medium text-encre">
                {m.titre || m.section}
                {m.necessite_completion && <span className="jeton ml-2 text-veille">à relire</span>}
              </p>
              <p className="text-xs text-sourdine">{m.section}</p>
              <p className="text-sm text-encre mt-1">{m.message_cle}</p>
              {m.sous_messages?.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-encre">
                  {m.sous_messages.map((sm, i) => (
                    <li key={i}>{sm}</li>
                  ))}
                </ul>
              )}
              {m.notes_validation && <p className="text-xs text-sourdine mt-1">Notes : {m.notes_validation}</p>}
              <div className="h-1.5" />
              <div className="flex flex-wrap gap-1.5">
                {STATUTS_VALIDATION.filter((s) => s.valeur !== m.statut_validation).map((s) => (
                  <BoutonDiscret key={s.valeur} className="text-xs" onClick={() => changer(m, s.valeur)}>
                    → {s.libelle}
                  </BoutonDiscret>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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

function Nucleaire() {
  const [sites, setSites] = useState([])

  useEffect(() => {
    supabase.from('sites_nucleaires').select('id, nom').order('nom').then(({ data }) => setSites(data ?? []))
  }, [])
  const optionsSites = sites.map((s) => ({ valeur: s.id, libelle: s.nom }))
  const nomSite = (id) => sites.find((s) => s.id === id)?.nom

  return (
    <div className="space-y-8">
      <p className="text-xs text-chaud">
        Données issues de la carte officielle du NCCN (plan d'urgence nucléaire, juin 2024) : rien n'est reconstitué ici.
        La liaison blocs ↔ communes se gère dans l'app Admin (Plan d'urgence nucléaire).
      </p>
      <TableCrud
        table="sites_nucleaires"
        titre="Sites"
        tri="nom"
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
      <TableCrud
        table="zones_planification_nucleaire"
        titre="Rayons des zones"
        tri="site_id"
        titreLigne={(l) => (
          <>
            <strong>{nomSite(l.site_id)}</strong>{' '}
            <span className="text-xs text-sourdine">
              {TYPES_ZONE_PLANIFICATION_NUCLEAIRE.find((t) => t.valeur === l.type_zone)?.libelle} · {l.rayon_km} km
            </span>
            {l.a_confirmer && <span className="jeton ml-2 text-chaud">à confirmer</span>}
          </>
        )}
        champs={[
          { cle: 'site_id', libelle: 'Site', type: 'select', options: optionsSites, requis: true },
          { cle: 'type_zone', libelle: 'Zone', type: 'select', options: options(TYPES_ZONE_PLANIFICATION_NUCLEAIRE), requis: true },
          { cle: 'rayon_km', libelle: 'Rayon (km)', type: 'number', requis: true },
          { cle: 'a_confirmer', libelle: 'À confirmer', type: 'checkbox' },
          { cle: 'source_reference', libelle: 'Source', type: 'text' },
        ]}
      />
      <TableCrud
        table="blocs_planification_nucleaire"
        titre="Blocs"
        tri="code_bloc"
        vide="Aucun bloc encodé : à saisir depuis la carte officielle du NCCN."
        titreLigne={(l) => (
          <>
            <strong>{l.code_bloc}</strong> <span className="text-xs text-sourdine">{nomSite(l.site_id)}</span>
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
    </div>
  )
}

const SOURCES_CBRN = [
  { valeur: 'BULLSEYE', libelle: 'BULLSEYE (projet UE)' },
  { valeur: 'CWA17974', libelle: 'CEN CWA 17974:2023' },
  { valeur: 'autre', libelle: 'Autre' },
]
const LIGNES_CBRN = [
  { valeur: '1', libelle: '1re ligne' },
  { valeur: '2', libelle: '2e ligne' },
  { valeur: '3', libelle: '3e ligne' },
  { valeur: 'transversal', libelle: 'Transversal' },
]

function FormationsCbrn() {
  return (
    <TableCrud
      table="referentiel_formations_cbrn"
      tri="created_at"
      aide="Modules de formation CBRN proposés aux communes (BULLSEYE, CEN CWA 17974:2023)."
      vide="Référentiel vide."
      etiquetteAjout="Ajouter un module"
      titreLigne={(l) => (
        <>
          <strong>{l.module}</strong>{' '}
          <span className="text-xs text-sourdine">
            {SOURCES_CBRN.find((s) => s.valeur === l.source)?.libelle}
            {l.ligne_reponse && ` · ${LIGNES_CBRN.find((x) => x.valeur === l.ligne_reponse)?.libelle}`}
          </span>
        </>
      )}
      champs={[
        { cle: 'module', libelle: 'Module', type: 'text', requis: true },
        { cle: 'source', libelle: 'Source', type: 'select', options: SOURCES_CBRN, requis: true },
        { cle: 'ligne_reponse', libelle: 'Ligne de réponse', type: 'select', options: LIGNES_CBRN },
        { cle: 'public_cible', libelle: 'Public cible', type: 'tags' },
        { cle: 'duree_min', libelle: 'Durée (min)', type: 'number' },
        { cle: 'objectifs', libelle: 'Objectifs', type: 'textarea' },
      ]}
    />
  )
}

const LANGUES = [
  { valeur: 'fr', libelle: 'Français' },
  { valeur: 'nl', libelle: 'Néerlandais' },
  { valeur: 'en', libelle: 'Anglais' },
]
const BESOINS = ['secours', 'abri', 'eau', 'nourriture', 'sante', 'energie', 'communication', 'evacuation'].map((v) => ({
  valeur: v,
  libelle: v === 'sante' ? 'santé' : v === 'energie' ? 'énergie' : v === 'evacuation' ? 'évacuation' : v,
}))

function Lexique() {
  return (
    <TableCrud
      table="lexique_detection_appels"
      tri="langue"
      aide="Termes qui signalent un besoin dans un message public (« piégé », « plus d'électricité »…), par langue."
      etiquetteAjout="Ajouter un terme"
      titreLigne={(l) => (
        <>
          <strong>{l.terme}</strong> <span className="text-xs text-sourdine">{l.langue.toUpperCase()}</span>
        </>
      )}
      champs={[
        { cle: 'terme', libelle: 'Terme', type: 'text', requis: true },
        { cle: 'langue', libelle: 'Langue', type: 'select', options: LANGUES, requis: true },
        { cle: 'categorie_besoin', libelle: 'Besoin signalé', type: 'select', options: BESOINS },
        { cle: 'source_reference', libelle: 'Source', type: 'text' },
      ]}
    />
  )
}
