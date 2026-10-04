/**
 * File d'écritures hors réseau.
 *
 * Porté du module `fileEcritures.js` d'Eventware 2.0 (voir
 * briefing-eventware-pour-crisiware.md, §2 principe 2 et §4 — « Files
 * hors ligne + idempotence : reprendre tel quel »).
 *
 * Le problème : sur le terrain d'une intervention, le réseau tombe —
 * pas en panne, par intermittence. Une écriture perdue à ce moment-là,
 * c'est une checklist qu'on croit cochée et qui ne l'est pas. Le
 * principe : on écrit d'abord dans le téléphone, on envoie ensuite.
 * Jamais l'inverse. L'interface confirme l'enregistrement local, pas
 * l'arrivée en base — et elle le dit.
 *
 * Contrairement à l'original Eventware, ce module est une FACTORY :
 * chaque app Crisiware (terrain, citoyen plus tard) crée son propre
 * client Supabase via `createSupabaseClient` (packages/shared n'en
 * possède pas), donc le client et la clé de stockage sont passés à la
 * création plutôt qu'importés d'un singleton.
 *
 * `localStorage` plutôt qu'IndexedDB : quelques dizaines d'opérations
 * de quelques centaines d'octets. Le jour où des pièces jointes
 * entrent en file, il faudra changer — pas avant.
 *
 * Trois natures d'opération :
 *   { nature: 'update', table, id, champs, libelle }
 *   { nature: 'insert', table, champs, libelle }  — rejouable grâce à
 *     la clé d'idempotence, posée comme `id` de la ligne (upsert avec
 *     ignoreDuplicates) : un renvoi ne crée jamais de doublon.
 *   { nature: 'rpc', fonction, arguments, libelle } — la fonction
 *     serveur doit porter sa propre clé d'idempotence.
 *
 * Ce qui n'entre PAS ici : les lectures, et toute écriture dont la
 * cohérence dépend d'un ordre global calculé côté client (ex. un
 * numéro de séquence) — celles-là ont besoin d'une RPC serveur dédiée,
 * pas de ce mécanisme générique.
 */

import { surRetourReseau, nouvelleCle } from './reessai.js'
import { texteErreur } from './erreurs.js'

const MAX_ESSAIS = 8

/**
 * @param {object} options
 * @param {import('@supabase/supabase-js').SupabaseClient} options.supabase
 * @param {string} options.clef clé localStorage, distincte par app (ex. 'crisiware.terrain.ecritures.file')
 */
export function creerFileEcritures({ supabase, clef }) {
  /* ---------------------------------------------------------------- */
  /* Stockage                                                          */

  function lireFile() {
    try {
      return JSON.parse(localStorage.getItem(clef) || '[]')
    } catch {
      return []
    }
  }

  function ecrireFile(file) {
    try {
      localStorage.setItem(clef, JSON.stringify(file))
    } catch {
      /* stockage plein ou navigation privée : on continue en mémoire */
    }
    prevenir()
  }

  /* ---------------------------------------------------------------- */
  /* Abonnement — un indicateur d'état s'y branche                      */

  const abonnes = new Set()

  function surChangement(fn) {
    abonnes.add(fn)
    return () => abonnes.delete(fn)
  }

  function prevenir() {
    const file = lireFile()
    abonnes.forEach((fn) => {
      try {
        fn(file)
      } catch {
        /* un abonné qui casse ne doit pas empêcher les autres */
      }
    })
  }

  /* ---------------------------------------------------------------- */
  /* Mise en file                                                       */

  function empiler(operation) {
    const ligne = {
      cle: nouvelleCle(),
      cree_le: new Date().toISOString(),
      essais: 0,
      message: null,
      ...operation,
    }
    ecrireFile([...lireFile(), ligne])
    rejouer()
    return ligne.cle
  }

  function retirer(cle) {
    ecrireFile(lireFile().filter((o) => o.cle !== cle))
  }

  function vider() {
    ecrireFile([])
  }

  /* ---------------------------------------------------------------- */
  /* Écriture directe, avec repli en file                               */

  /**
   * `navigator.onLine` ne dit pas si le réseau fonctionne, seulement si
   * une interface est active. On ne s'y fie donc pas pour décider :
   * on tente l'écriture, et c'est l'échec qui décide. Le drapeau ne
   * sert qu'à éviter une tentative manifestement vouée à l'échec, en
   * mode avion assumé.
   */
  function estErreurReseau(e) {
    if (!e) return false
    if (e.definitif) return false
    const m = `${e.name ?? ''} ${e.message ?? ''}`.toLowerCase()
    return (
      e instanceof TypeError ||
      m.includes('fetch') ||
      m.includes('network') ||
      m.includes('load failed') ||
      m.includes('timeout') ||
      m.includes('abort')
    )
  }

  /**
   * Tente l'écriture ; met en file si le réseau lâche.
   * Retourne { statut: 'ok' | 'enfile' | 'refus', cle?, message? }.
   *
   * La clé est assignée ICI, avant toute tentative — pas seulement au
   * moment d'empiler — pour qu'une opération `insert` garde le même id
   * qu'elle réussisse du premier coup ou après plusieurs rejeux. C'est
   * ce qui permet à l'appelant de poser un état optimiste local (même
   * id que la ligne qui finira en base) avant même de savoir si l'envoi
   * est immédiat ou différé.
   */
  async function ecrireOuEmpiler(operation) {
    const op = { cle: nouvelleCle(), ...operation }
    if (!navigator.onLine) {
      empiler(op)
      return { statut: 'enfile', cle: op.cle }
    }
    try {
      await envoyer(op)
      return { statut: 'ok', cle: op.cle }
    } catch (e) {
      if (estErreurReseau(e)) {
        empiler(op)
        return { statut: 'enfile', cle: op.cle }
      }
      return { statut: 'refus', message: texteErreur(e) }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Rejeu                                                              */

  let enCours = false

  async function envoyer(op) {
    if (op.nature === 'update') {
      const { error, count } = await supabase
        .from(op.table)
        .update(op.champs, { count: 'exact' })
        .eq('id', op.id)

      if (error) throw error
      if (count === 0) {
        // Zéro ligne touchée : PostgREST ne distingue pas « droits
        // refusés » de « ligne disparue », et RLS ne renvoie jamais
        // d'erreur dans ce cas (voir packages/shared/src/ecriture.js).
        throw Object.assign(new Error('Écriture refusée : vos droits ne le permettent pas, ou la ligne a disparu.'), {
          definitif: true,
        })
      }
      return
    }

    if (op.nature === 'insert') {
      // La clé d'idempotence sert d'id de ligne : un renvoi retombe sur
      // le même id et ignore silencieusement le conflit plutôt que de
      // créer un doublon.
      const { error } = await supabase
        .from(op.table)
        .upsert({ id: op.cle, ...op.champs }, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      return
    }

    if (op.nature === 'rpc') {
      const { error } = await supabase.rpc(op.fonction, op.arguments)
      if (error) throw error
      return
    }

    throw Object.assign(new Error(`Nature inconnue : ${op.nature}`), { definitif: true })
  }

  /**
   * Vide la file, dans l'ordre d'arrivée. S'arrête à la première panne
   * réseau : l'ordre compte, et une tentative qui échoue ne coûte rien
   * puisque la ligne reste en file.
   */
  async function rejouer() {
    if (enCours) return
    enCours = true

    try {
      for (const op of lireFile()) {
        try {
          await envoyer(op)
          retirer(op.cle)
        } catch (e) {
          const definitif = e.definitif || op.essais + 1 >= MAX_ESSAIS
          const file = lireFile().map((o) =>
            o.cle === op.cle
              ? { ...o, essais: o.essais + 1, message: texteErreur(e), definitif }
              : o
          )
          ecrireFile(file)
          // Panne réseau : inutile d'essayer les suivantes, et pas dans
          // le désordre. Un refus définitif, lui, ne bloque pas la
          // file : on passe à la suivante.
          if (!definitif) break
        }
      }
    } finally {
      enCours = false
    }
  }

  /** Ce qui reste à envoyer, hors refus définitifs. */
  function enAttente() {
    return lireFile().filter((o) => !o.definitif)
  }

  /** Ce qui a été refusé et demande une décision humaine. */
  function refusees() {
    return lireFile().filter((o) => o.definitif)
  }

  /* ---------------------------------------------------------------- */
  /* Déclencheurs                                                       */

  let installe = false
  let desinstaller = null

  function demarrer() {
    if (installe) return
    installe = true
    desinstaller = surRetourReseau(() => {
      if (enAttente().length) rejouer()
    })
  }

  function arreter() {
    if (desinstaller) desinstaller()
    installe = false
    desinstaller = null
  }

  return {
    lireFile,
    empiler,
    retirer,
    vider,
    surChangement,
    estErreurReseau,
    ecrireOuEmpiler,
    rejouer,
    enAttente,
    refusees,
    demarrer,
    arreter,
  }
}
