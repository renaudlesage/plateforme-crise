import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTableContexte } from '../hooks/useTableContexte'
import { supabase } from '../lib/supabase'

const ITEMS_D5 = [
  { valeur: 'connecte_be_alert', libelle: 'Connecté Be-Alert' },
  { valeur: 'compte_paragon', libelle: 'Compte Paragon' },
  { valeur: 'numero_info_national_relie', libelle: 'Numéro info national relié' },
  { valeur: 'compte_trello', libelle: 'Compte Trello' },
  { valeur: 'mdp_reseaux_sociaux_dispo', libelle: 'Mot de passe réseaux sociaux dispo' },
  { valeur: 'sait_activer_team_d5', libelle: 'Sait activer Team D5' },
  { valeur: 'communications_reflexes_preparees', libelle: 'Communications réflexes préparées' },
  { valeur: 'accords_mandats_bourgmestre', libelle: 'Accords/mandats du bourgmestre' },
]

export default function ChecklistD5() {
  const { contexteId } = useAuth()
  const { lignes: contacts } = useTableContexte('contacts', contexteId, { tri: 'nom' })
  const [statuts, setStatuts] = useState({})
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    if (!contexteId) return
    supabase
      .from('checklist_d5_prerequis')
      .select('*')
      .eq('contexte_id', contexteId)
      .then(({ data }) => {
        const index = {}
        for (const l of data ?? []) {
          index[`${l.personne}__${l.item}`] = l
        }
        setStatuts(index)
        setChargement(false)
      })
  }, [contexteId])

  async function basculer(personne, contactId, item) {
    const cle = `${personne}__${item}`
    const existant = statuts[cle]
    const nouveauStatut = !existant?.statut
    const { data, error } = await supabase
      .from('checklist_d5_prerequis')
      .upsert(
        {
          id: existant?.id,
          contexte_id: contexteId,
          contact_id: contactId,
          personne,
          item,
          statut: nouveauStatut,
          date_verification: nouveauStatut ? new Date().toISOString().slice(0, 10) : null,
        },
        { onConflict: 'contexte_id,personne,item' }
      )
      .select()
      .single()
    if (!error) setStatuts((prev) => ({ ...prev, [cle]: data }))
  }

  const personnesD5 = contacts.filter((c) => c.sous_categorie === 'D5' || c.fonction?.toLowerCase().includes('info'))
  const personnesAffichees = personnesD5.length > 0 ? personnesD5 : contacts

  return (
    <div>
      <h1 className="text-xl font-semibold text-encre mb-1">Checklist D5 — prérequis opérationnels</h1>
      <p className="text-sm text-sourdine mb-4">
        Prérequis d'activation de la discipline D5 (information de la population) par personne,
        indépendamment d'un incident précis — à vérifier périodiquement, pas seulement en crise.
      </p>

      {chargement ? (
        <p className="text-sm text-sourdine">Chargement…</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-sourdine border border-dashed border-trait rounded p-6 text-center">
          Aucun contact enregistré — ajoutez d'abord des contacts dans l'annuaire.
        </p>
      ) : (
        <div className="overflow-x-auto border border-trait rounded shadow">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-fond">
                <th className="text-left px-3 py-2 font-medium text-sourdine">Personne</th>
                {ITEMS_D5.map((it) => (
                  <th key={it.valeur} className="px-2 py-2 font-medium text-sourdine whitespace-nowrap" title={it.libelle}>
                    {it.libelle}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personnesAffichees.map((c) => {
                const personne = `${c.prenom} ${c.nom}`
                return (
                  <tr key={c.id} className="border-t border-trait bg-surface">
                    <td className="px-3 py-2 whitespace-nowrap">{personne}</td>
                    {ITEMS_D5.map((it) => {
                      const coche = statuts[`${personne}__${it.valeur}`]?.statut ?? false
                      return (
                        <td key={it.valeur} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={coche}
                            onChange={() => basculer(personne, c.id, it.valeur)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
