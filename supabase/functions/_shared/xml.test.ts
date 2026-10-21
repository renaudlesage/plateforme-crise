import { describe, expect, it } from 'vitest'
import { ErreurXml, decoderEntites, enfant, enfantsNommes, lireXml, texteEnfant } from './xml.ts'

describe('lireXml', () => {
  it('lit éléments, attributs, préfixes et texte', () => {
    const racine = lireXml(
      `<?xml version="1.0" encoding="UTF-8"?>
      <!-- commentaire ignoré -->
      <feed xmlns="http://www.w3.org/2005/Atom" xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
        <entry>
          <link title='Liège "centre"' href="https://exemple.invalid/a?b=1&amp;c=2" hreflang="en"/>
          <cap:event>Orages &lt;violents&gt;</cap:event>
        </entry>
        <entry/>
      </feed>`,
    )
    expect(racine.nom).toBe('feed')
    expect(enfantsNommes(racine, 'entry')).toHaveLength(2)
    const entree = enfant(racine, 'entry')
    expect(enfant(entree, 'link')?.attributs).toEqual({
      title: 'Liège "centre"',
      href: 'https://exemple.invalid/a?b=1&c=2',
      hreflang: 'en',
    })
    const evenement = enfant(entree, 'event')
    expect(evenement?.prefixe).toBe('cap')
    expect(texteEnfant(entree, 'event')).toBe('Orages <violents>')
  })

  it('garde le contenu CDATA tel quel et décode les entités numériques', () => {
    const racine = lireXml('<a><b><![CDATA[x < y & z]]></b><c>&#233;t&#xE9; &#x1F600;</c></a>')
    expect(texteEnfant(racine, 'b')).toBe('x < y & z')
    expect(texteEnfant(racine, 'c')).toBe('été 😀')
  })

  it('accepte un « > » dans une valeur d’attribut, une marque d’ordre des octets et un « & » isolé', () => {
    const racine = lireXml('﻿<a titre="1 > 0"><b>Pluie & vent</b></a>')
    expect(racine.attributs.titre).toBe('1 > 0')
    expect(texteEnfant(racine, 'b')).toBe('Pluie & vent')
  })

  it('renvoie null pour un élément absent ou vide', () => {
    const racine = lireXml('<a><b>  </b></a>')
    expect(texteEnfant(racine, 'b')).toBeNull()
    expect(texteEnfant(racine, 'z')).toBeNull()
  })

  it.each([
    ['<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>', /DOCTYPE/],
    ['<a><b></a>', /inattendue/],
    ['<a><b>', /non fermée/],
    ['<a/><b/>', /Plusieurs éléments racine/],
    ['<a/>texte', /hors de l'élément racine/],
    ['<a x="1></a>', /non terminée/],
    ['<a x=1></a>', /Attribut illisible/],
    ['   ', /vide/],
  ])('refuse un document mal formé ou dangereux : %s', (xml, motif) => {
    expect(() => lireXml(xml)).toThrow(ErreurXml)
    expect(() => lireXml(xml)).toThrow(motif)
  })

  it('refuse un document trop volumineux', () => {
    expect(() => lireXml(`<a>${'x'.repeat(100)}</a>`, { tailleMax: 50 })).toThrow(/trop volumineux/)
  })
})

describe('decoderEntites', () => {
  it('laisse intactes les entités inconnues et les codes hors Unicode', () => {
    expect(decoderEntites('&nbsp; &#x110000; &amp;')).toBe('&nbsp; &#x110000; &')
  })
})
