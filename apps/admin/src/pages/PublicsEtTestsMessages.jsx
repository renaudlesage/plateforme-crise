import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import TableCrud from '../components/TableCrud'
import Onglets from '../components/Onglets'

const CATEGORIES = [
  { valeur: 'personnel', libelle: 'Personnel' },
  { valeur: 'sante', libelle: 'Santé' },
  { valeur: 'profession', libelle: 'Profession' },
  { valeur: 'lieu', libelle: 'Lieu' },
  { valeur: 'culture', libelle: 'Culture / langue' },
  { valeur: 'social', libelle: 'Social' },
]

/**
 * Publics de communication et tests de messages (CTPN 2025) : la panique est
 * rare, mais un message doit être compris par chaque public. On teste les
 * messages du catalogue auprès de groupes et on garde le résultat. Effectifs
 * estimés par groupe uniquement : jamais de listes de personnes.
 */
export default function PublicsEtTestsMessages() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Publics & tests de messages</h1>
      <p className="text-sm text-sourdine mb-4">
        Les groupes concernés ne se limitent pas aux personnes « à risque » : intervenants non formés, non-francophones,
        personnes proches d'une installation. Décrivez chaque public (canaux, langues, relais de confiance), puis notez
        si les messages du catalogue sont compris. Effectifs estimés uniquement, jamais de listes de personnes.
      </p>
      <Onglets
        onglets={[
          { cle: 'groupes', libelle: 'Publics', contenu: <GroupesCrud /> },
          { cle: 'tests', libelle: 'Tests de messages', contenu: <TestsMessages /> },
        ]}
      />
    </div>
  )
}

const coupe = (t) => (t.length > 80 ? `${t.slice(0, 80)}…` : t)

function TestsMessages() {
  const [messages, setMessages] = useState([])
  const [groupes, setGroupes] = useState([])
  const [pret, setPret] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('catalogue_messages_alerte').select('id, numero_message_source, message_cle').order('numero_message_source'),
      supabase.from('groupes_communication_cbrne').select('id, libelle').order('libelle'),
    ]).then(([m, g]) => {
      setMessages(m.data ?? [])
      setGroupes(g.data ?? [])
      setPret(true)
    })
  }, [])

  if (!pret) return <p className="text-sm text-sourdine">Chargement…</p>
  return (
    <TableCrud
      table="tests_messages_alerte"
      tri="created_at"
      aide="Un test = un message du catalogue présenté à un public, avec le constat : compris ou non."
      vide="Aucun test enregistré."
      etiquetteAjout="Enregistrer un test"
      titreLigne={(l) => {
        const m = messages.find((x) => x.id === l.message_catalogue_id)
        const g = groupes.find((x) => x.id === l.groupe_id)
        return (
          <>
            {m ? `#${m.numero_message_source} ${coupe(m.message_cle)}` : 'Message'}
            {g && <span className="text-xs text-sourdine"> — {g.libelle}</span>}
            {l.compris != null && (
              <span className={`jeton ml-2 ${l.compris ? 'text-ok' : 'text-chaud'}`}>{l.compris ? 'compris' : 'mal compris'}</span>
            )}
          </>
        )
      }}
      champs={[
        {
          cle: 'message_catalogue_id',
          libelle: 'Message du catalogue',
          type: 'select',
          requis: true,
          options: messages.map((m) => ({ valeur: m.id, libelle: `#${m.numero_message_source} ${coupe(m.message_cle)}` })),
        },
        { cle: 'groupe_id', libelle: 'Public testé', type: 'select', options: groupes.map((g) => ({ valeur: g.id, libelle: g.libelle })) },
        { cle: 'date_test', libelle: 'Date du test', type: 'date' },
        { cle: 'compris', libelle: 'Message compris', type: 'checkbox' },
        { cle: 'remarques', libelle: 'Remarques', type: 'textarea' },
      ]}
    />
  )
}

function GroupesCrud() {
  return (
    <TableCrud
      table="groupes_communication_cbrne"
      tri="libelle"
      vide="Aucun public décrit."
      etiquetteAjout="Ajouter un public"
      titreLigne={(l) => (
        <>
          <strong>{l.libelle}</strong>
          {l.categorie && <span className="text-xs text-sourdine"> · {CATEGORIES.find((c) => c.valeur === l.categorie)?.libelle}</span>}
        </>
      )}
      champs={[
        { cle: 'libelle', libelle: 'Public', type: 'text', requis: true },
        { cle: 'categorie', libelle: 'Catégorie', type: 'select', options: CATEGORIES },
        { cle: 'canaux_preferes', libelle: 'Canaux préférés', type: 'tags' },
        { cle: 'langues', libelle: 'Langues', type: 'tags' },
        { cle: 'relais_confiance', libelle: 'Relais de confiance', type: 'text' },
        { cle: 'effectif_estime', libelle: 'Effectif estimé', type: 'number', aide: 'Estimation globale du groupe.' },
      ]}
    />
  )
}
