import { useCallback, useEffect, useRef, useState } from 'react'
import { texteErreur } from '@plateforme-crise/shared'
import { supabase } from '../lib/supabase'

const RAFRAICHISSEMENT_MS = 30000

/**
 * Données et actions du volet « Entraide » d'un incident (CC) : coordinateur, points d'accueil,
 * présences, équipes, missions, moyens privés, dons. Les règles (numéros, transitions, zones,
 * droits) sont dans la base ; ici on lit, on écrit et on remonte l'erreur telle quelle.
 */
export function useEntraide(incidentId, contexteId, { niveauAdmin = false } = {}) {
  const [donnees, setDonnees] = useState(null)
  const [droits, setDroits] = useState({ coordonner: false, commanderZone: false, cc: false })
  const [erreur, setErreur] = useState(null)
  const generation = useRef(0)

  const charger = useCallback(async () => {
    if (!incidentId || !contexteId) return
    const g = ++generation.current
    const [inc, params, pabs, presences, equipes, membres, missions, besoins, collectes, consignes, moyens, engages, aRelever, coord, zone, cc, centres, codeRole] = await Promise.all([
      supabase.from('incidents').select('id, nom, phase_cycle_vie, statut, est_exercice, coordinateur_benevoles, coordinateur_benevoles_user_id, coordinateur_benevoles_libelle, coordinateur_benevoles_depuis, latitude, longitude').eq('id', incidentId).maybeSingle(),
      supabase.from('parametres_entraide').select('*').eq('contexte_id', contexteId).maybeSingle(),
      supabase.from('points_accueil_benevoles').select('*').eq('incident_id', incidentId).order('ouvert_le'),
      supabase.from('presences_benevoles').select('*').eq('incident_id', incidentId).order('numero'),
      supabase.from('equipes_entraide').select('*').eq('incident_id', incidentId).order('numero'),
      supabase.from('membres_equipe_entraide').select('id, equipe_id, presence_id, de, a').eq('contexte_id', contexteId).is('a', null),
      supabase.from('missions_entraide').select('*').eq('incident_id', incidentId).order('created_at'),
      supabase.from('besoins_nature').select('*').eq('incident_id', incidentId).order('created_at'),
      supabase.from('points_collecte').select('*').eq('incident_id', incidentId).order('ouvert_le'),
      supabase.from('consignes_entraide_publiques').select('*').eq('incident_id', incidentId).maybeSingle(),
      supabase.from('ressources').select('id, nom, categorie, type_public_prive, proprietaire_type, proprietaire_nom, proprietaire_telephone, statut_juridique, delai_mise_a_dispo, capacite, conditions_partage, latitude, longitude, actif, verifie_le, contact_id').eq('contexte_id', contexteId).eq('type_public_prive', 'prive').order('nom'),
      supabase.from('moyens_engages').select('id, ressource_id, statut, libelle').eq('incident_id', incidentId).not('ressource_id', 'is', null),
      supabase.from('v_equipes_a_relever').select('*').eq('incident_id', incidentId),
      supabase.rpc('peut_coordonner_entraide', { p_incident_id: incidentId }),
      supabase.rpc('peut_commander_zone_entraide', { p_incident_id: incidentId }),
      supabase.rpc('a_capacite', { p_contexte_id: contexteId, p_ressource: 'entraide', p_action: 'modifier' }),
      supabase.from('centres_accueil').select('id, nom, adresse, latitude, longitude').eq('contexte_id', contexteId).order('nom'),
      supabase.rpc('code_role_utilisateur', { p_contexte_id: contexteId }),
    ])
    if (g !== generation.current) return
    const premiere = [inc, pabs, presences, equipes, membres, missions].find((r) => r.error)
    if (premiere) {
      setErreur(texteErreur(premiere.error))
      return
    }
    setErreur(null)
    // Désigner le coordinateur est réservé au CC : admin du contexte, autorité ou Planu (la base le vérifie aussi).
    const role = codeRole.data ?? null
    setDroits({ coordonner: coord.data === true, commanderZone: zone.data === true, modifier: cc.data === true, role, designer: cc.data === true && (niveauAdmin || ['AUTORITE_COMMUNALE', 'AUTORITE_PROVINCIALE', 'PLANU'].includes(role)) })
    setDonnees({
      incident: inc.data,
      parametres: params.data ?? null,
      pabs: pabs.data ?? [],
      presences: presences.data ?? [],
      equipes: equipes.data ?? [],
      membres: (membres.data ?? []).filter((m) => (equipes.data ?? []).some((e) => e.id === m.equipe_id)),
      missions: missions.data ?? [],
      besoins: besoins.data ?? [],
      collectes: collectes.data ?? [],
      consignes: consignes.data ?? null,
      moyens: moyens.data ?? [],
      engages: engages.data ?? [],
      aRelever: aRelever.data ?? [],
      centres: centres.data ?? [],
    })
  }, [incidentId, contexteId, niveauAdmin])

  useEffect(() => {
    charger()
  }, [charger])

  useEffect(() => {
    if (!incidentId) return undefined
    const t = setInterval(charger, RAFRAICHISSEMENT_MS)
    return () => clearInterval(t)
  }, [incidentId, charger])

  // Toute action : exécute, recharge, renvoie { error } avec un texte lisible.
  const action = useCallback(
    async (fn) => {
      try {
        const r = await fn()
        if (r?.error) return { error: { message: texteErreur(r.error), code: r.error.code } }
        await charger()
        return { error: null }
      } catch (e) {
        return { error: { message: texteErreur(e) } }
      }
    },
    [charger]
  )

  const maj = (table, id, champs) => supabase.from(table).update(champs).eq('id', id).select('id').then((r) => (!r.error && (!r.data || r.data.length === 0) ? { error: { message: 'Écriture refusée : vos droits ne le permettent pas, ou la ligne a disparu.' } } : r))

  return {
    donnees,
    droits,
    erreur,
    recharger: charger,
    designerCoordinateur: (mode, userId = null, libelle = null) =>
      action(() => supabase.rpc('designer_coordinateur_benevoles', { p_incident_id: incidentId, p_mode: mode, p_user_id: userId, p_libelle: libelle })),
    // Points d'accueil
    creerPab: (champs) => action(() => supabase.from('points_accueil_benevoles').insert({ ...champs, incident_id: incidentId })),
    modifierPab: (id, champs) => action(() => maj('points_accueil_benevoles', id, champs)),
    fermerPab: (id) => action(() => maj('points_accueil_benevoles', id, { ferme_le: new Date().toISOString() })),
    regenererQr: (id) => action(() => maj('points_accueil_benevoles', id, { jeton_qr: crypto.randomUUID() })),
    // Présences
    enregistrerPresence: (champs) => action(() => supabase.from('presences_benevoles').insert({ ...champs, incident_id: incidentId, majeur_declare: true, consignes_acceptees_le: new Date().toISOString() })),
    changerStatutPresence: (id, statut) => action(() => maj('presences_benevoles', id, { statut })),
    noterPresence: (id, note_interne) => action(() => maj('presences_benevoles', id, { note_interne })),
    // Équipes
    creerEquipe: (champs) => action(() => supabase.from('equipes_entraide').insert({ ...champs, incident_id: incidentId })),
    modifierEquipe: (id, champs) => action(() => maj('equipes_entraide', id, champs)),
    ajouterMembre: (equipeId, presenceId) => action(() => supabase.from('membres_equipe_entraide').insert({ equipe_id: equipeId, presence_id: presenceId })),
    retirerMembre: (membreId) => action(() => maj('membres_equipe_entraide', membreId, { a: new Date().toISOString() })),
    // Missions
    creerMission: (champs) => action(() => supabase.from('missions_entraide').insert({ ...champs, incident_id: incidentId })),
    modifierMission: (id, champs) => action(() => maj('missions_entraide', id, champs)),
    // Moyens privés
    activerMoyen: (ressource, champs = {}) =>
      action(() =>
        supabase.from('moyens_engages').insert({
          contexte_id: contexteId,
          incident_id: incidentId,
          ressource_id: ressource.id,
          symbole: champs.symbole ?? 'moyen_autre',
          libelle: `${ressource.nom}${ressource.proprietaire_nom ? ` (${ressource.proprietaire_nom})` : ''}`.slice(0, 120),
          discipline: 'd4',
          effectif: champs.effectif ?? null,
          statut: 'en_route',
          latitude: ressource.latitude,
          longitude: ressource.longitude,
          remarque: champs.remarque ?? null,
        })
      ),
    requisitionnerMoyen: (ressource, champs) =>
      action(() =>
        supabase.from('requisitions').insert({
          incident_id: incidentId,
          ressource_id: ressource.id,
          type_requisition: 'civile',
          autorite_decretante: champs.autorite_decretante ?? 'bourgmestre',
          objet: `${ressource.nom}${ressource.proprietaire_nom ? ` — ${ressource.proprietaire_nom}` : ''}`,
          beneficiaire: champs.beneficiaire ?? null,
          base_legale: champs.base_legale ?? 'Loi du 15 mai 2007 relative à la sécurité civile, art. 181',
          statut: 'actif',
          date_decret: new Date().toISOString(),
        })
      ),
    verifierMoyen: (id, champs) => action(() => maj('ressources', id, { ...champs, verifie_le: new Date().toISOString() })),
    // Dons
    creerBesoin: (champs) => action(() => supabase.from('besoins_nature').insert({ ...champs, incident_id: incidentId })),
    modifierBesoin: (id, champs) => action(() => maj('besoins_nature', id, champs)),
    creerCollecte: (champs) => action(() => supabase.from('points_collecte').insert({ ...champs, incident_id: incidentId })),
    fermerCollecte: (id) => action(() => maj('points_collecte', id, { ferme_le: new Date().toISOString() })),
    enregistrerConsignes: (champs, existe) =>
      action(() => (existe ? supabase.from('consignes_entraide_publiques').update(champs).eq('incident_id', incidentId).select('incident_id') : supabase.from('consignes_entraide_publiques').insert({ ...champs, incident_id: incidentId }))),
    // Sécurité
    declarerIncidentBenevole: (champs) => action(() => supabase.from('incidents_benevoles').insert({ ...champs, incident_id: incidentId })),
  }
}
