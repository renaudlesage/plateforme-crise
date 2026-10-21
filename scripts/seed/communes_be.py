#!/usr/bin/env python3
"""Génère supabase/seed/communes_be.sql, le référentiel des communes belges (F1).

Source : export GPX du jeu « communes et localités » d'Open Data
Wallonie-Bruxelles (odwb.be, plateforme Huwise) : une ligne par commune, code
postal et localité, avec le code INS (= NIS) de la commune, ses noms FR / NL /
DE, sa province, son arrondissement, sa région et un point par commune. Le
script n'utilise que la bibliothèque standard et ne fait aucun appel réseau.

Zones de secours et de police (Wallonie) : scripts/seed/sources/
zones_wallonie_eventware.txt, extraites de la table communes d'Eventware (une
copie datée, pas de base partagée). Chaque ligne est rattachée à une seule
commune wallonne par son nom ; l'orthographe vérifiée d'Eventware remplace
celle de l'export quand seules l'apostrophe ou la casse diffèrent.

Usage :
  python3 scripts/seed/communes_be.py <communes-et-localites.gpx> [--zones <fichier>]
          [--attendu 565] [--sortie supabase/seed/communes_be.sql] [--verifier]

Le script s'arrête sur toute incohérence plutôt que de produire un référentiel
douteux : nombre de communes différent de l'attendu, valeurs divergentes pour
une même commune, province qui ne correspond pas au code NIS, arrondissement
ambigu, commune germanophone dont le nom ne correspond pas, zone rattachée à
une commune inconnue ou en double, commune wallonne sans zone.
"""

import argparse
import collections
import io
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

ESPACES = {'gpx': 'http://www.topografix.com/GPX/1/1'}
CHAMPS_COMMUNE = ('commune_fr', 'commune_nl', 'commune_de', 'province', 'arrondissement', 'region', 'lat', 'lon')

# Libellé de province de l'export → vocabulaire de contextes.province.
PROVINCES = {
    'province d anvers': 'Anvers',
    'province du brabant flamand': 'Brabant flamand',
    'province du brabant wallon': 'Brabant wallon',
    'province de flandre occidentale': 'Flandre-Occidentale',
    'province de flandre orientale': 'Flandre-Orientale',
    'province du hainaut': 'Hainaut',
    'province de liege': 'Liège',
    'province du limbourg': 'Limbourg',
    'province du luxembourg': 'Luxembourg',
    'province de namur': 'Namur',
}
REGIONS = ('Région flamande', 'Région wallonne', 'Région de Bruxelles-Capitale')
LANGUES_PAR_REGION = {
    'Région flamande': ['nl'],
    'Région wallonne': ['fr'],
    'Région de Bruxelles-Capitale': ['fr', 'nl'],
}
# Contrôle croisé : dans la nomenclature REFNIS, le code NIS commence par le
# chiffre de la province (2 : Bruxelles 21, Brabant flamand 23-24, Brabant wallon 25).
PROVINCE_PAR_PREFIXE = {
    '1': 'Anvers', '21': 'Bruxelles-Capitale', '23': 'Brabant flamand', '24': 'Brabant flamand',
    '25': 'Brabant wallon', '3': 'Flandre-Occidentale', '4': 'Flandre-Orientale', '5': 'Hainaut',
    '6': 'Liège', '7': 'Limbourg', '8': 'Luxembourg', '9': 'Namur',
}
# Les neuf communes de la région de langue allemande (Constitution, art. 4 ;
# lois coordonnées du 18 juillet 1966 sur l'emploi des langues en matière
# administrative). Chaque code est contrôlé contre les noms lus dans le fichier.
COMMUNES_GERMANOPHONES = {
    '63001': 'amel',
    '63012': 'bullingen',
    '63013': 'butgenbach',
    '63023': 'eupen',
    '63040': 'kelmis',
    '63048': 'lontzen',
    '63061': 'raeren',
    '63067': 'sankt vith',
    '63087': 'burg reuland',
}


def normaliser(texte):
    sans_accents = unicodedata.normalize('NFD', texte or '')
    sans_accents = ''.join(c for c in sans_accents if unicodedata.category(c) != 'Mn')
    return ' '.join(re.sub(r"[-'’]", ' ', sans_accents.lower()).split())


def erreur(message):
    sys.exit(f'communes_be.py : {message}')


def lire_gpx(chemin):
    """Lignes de l'export (une par commune × code postal × localité)."""
    brut = chemin.read_text(encoding='utf-8')
    # L'export laisse des « & » non échappés dans quelques noms de localités.
    brut = re.sub(r'&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)', '&amp;', brut)
    lignes = []
    for _, element in ET.iterparse(io.StringIO(brut), events=('end',)):
        if element.tag != f'{{{ESPACES["gpx"]}}}wpt':
            continue
        ligne = {'lat': element.get('lat'), 'lon': element.get('lon')}
        extension = element.find('gpx:extension', ESPACES)
        for champ in (extension if extension is not None else []):
            ligne[champ.tag.split('}')[1]] = (champ.text or '').strip()
        lignes.append(ligne)
        element.clear()
    return lignes


def communes_depuis(lignes):
    par_code = collections.defaultdict(list)
    for ligne in lignes:
        par_code[ligne.get('code_ins', '')].append(ligne)

    communes = []
    arrondissements = collections.defaultdict(set)
    for code, groupe in sorted(par_code.items()):
        if not re.fullmatch(r'[0-9]{5}', code):
            erreur(f'code INS invalide : {code!r}')
        for champ in CHAMPS_COMMUNE:
            valeurs = {ligne.get(champ) for ligne in groupe}
            if len(valeurs) > 1:
                erreur(f'commune {code} : valeurs divergentes pour {champ} : {sorted(map(str, valeurs))}')
        ligne = groupe[0]
        region = ligne.get('region')
        if region not in REGIONS:
            erreur(f'commune {code} : région inconnue {region!r}')
        if region == 'Région de Bruxelles-Capitale':
            province = 'Bruxelles-Capitale'
        else:
            province = PROVINCES.get(normaliser(ligne.get('province')))
            if province is None:
                erreur(f'commune {code} : province inconnue {ligne.get("province")!r}')
        attendue = PROVINCE_PAR_PREFIXE.get(code[:2]) or PROVINCE_PAR_PREFIXE.get(code[0])
        if province != attendue:
            erreur(f'commune {code} : province {province} incompatible avec le code NIS ({attendue})')
        code_arrondissement = code[:2] + '000'
        arrondissements[code_arrondissement].add(ligne.get('arrondissement'))
        # Apostrophe droite partout (l'export mélange ’ et ').
        noms = {k: ligne.get(f'commune_{k}', '').replace('’', "'") for k in ('fr', 'nl', 'de')}
        langues = ['de'] if code in COMMUNES_GERMANOPHONES else list(LANGUES_PAR_REGION[region])
        if code in COMMUNES_GERMANOPHONES and not any(
                COMMUNES_GERMANOPHONES[code] == normaliser(n) for n in noms.values()):
            erreur(f'commune germanophone {code} : nom inattendu {noms} (attendu {COMMUNES_GERMANOPHONES[code]})')
        try:
            lat, lon = float(ligne['lat']), float(ligne['lon'])
        except (TypeError, ValueError):
            erreur(f'commune {code} : coordonnées illisibles')
        if not (49.4 <= lat <= 51.6 and 2.5 <= lon <= 6.5):
            erreur(f'commune {code} : point hors de Belgique ({lat}, {lon})')
        communes.append({'code': code, **noms, 'arrondissement': code_arrondissement, 'province': province,
                         'region': region, 'langues': langues, 'lat': lat, 'lon': lon})

    ambigus = {a: n for a, n in arrondissements.items() if len(n) > 1}
    if ambigus:
        erreur(f'arrondissements ambigus : {ambigus}')
    manquantes = sorted(set(COMMUNES_GERMANOPHONES) - {c['code'] for c in communes})
    if manquantes:
        erreur(f'communes germanophones absentes : {manquantes}')
    return communes


def lire_zones(chemin):
    lignes = [l for l in chemin.read_text(encoding='utf-8').splitlines() if l and not l.startswith('#')]
    entete = lignes[0].split('|')
    if entete != ['nom', 'province', 'zone_police', 'zone_secours', 'numero_zone_police']:
        erreur(f'en-tête inattendu dans {chemin.name} : {entete}')
    return [dict(zip(entete, l.split('|'))) for l in lignes[1:]]


def appliquer_zones(communes, zones):
    wallonnes = {}
    for c in communes:
        if c['region'] == 'Région wallonne':
            if normaliser(c['fr']) in wallonnes:
                erreur(f'deux communes wallonnes portent le nom {c["fr"]}')
            wallonnes[normaliser(c['fr'])] = c
    noms_par_numero = collections.defaultdict(set)
    for z in zones:
        c = wallonnes.get(normaliser(z['nom']))
        if c is None:
            erreur(f'zones : commune inconnue {z["nom"]!r}')
        if 'zone_secours' in c:
            erreur(f'zones : commune {z["nom"]} présente deux fois')
        if normaliser(c['province']) != normaliser(z['province']):
            erreur(f'zones : {z["nom"]} est en {c["province"]}, pas en {z["province"]}')
        if not re.fullmatch(r'[0-9]{4}', z['numero_zone_police']) or not z['zone_police'] or not z['zone_secours']:
            erreur(f'zones : ligne incomplète pour {z["nom"]}')
        noms_par_numero[z['numero_zone_police']].add(z['zone_police'])
        if c['fr'] != z['nom']:
            # Orthographe vérifiée d'Eventware (apostrophe, casse) ; NL et DE suivent s'ils copiaient le FR.
            for langue in ('nl', 'de'):
                if c[langue] == c['fr']:
                    c[langue] = z['nom']
            c['fr'] = z['nom']
        c.update(zone_secours=z['zone_secours'], zone_police=z['zone_police'],
                 zone_police_numero=z['numero_zone_police'])
    sans_zone = sorted(c['code'] for c in wallonnes.values() if 'zone_secours' not in c)
    if sans_zone:
        erreur(f'zones : communes wallonnes sans zone : {sans_zone}')
    ambigus = {n: z for n, z in noms_par_numero.items() if len(z) > 1}
    if ambigus:
        erreur(f'zones : numéro de zone de police à plusieurs noms : {ambigus}')


def sql_texte(valeur):
    return 'null' if not valeur else "'" + valeur.replace("'", "''") + "'"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('fichier', type=Path)
    parser.add_argument('--zones', type=Path, help='zones de secours et de police (format de zones_wallonie_eventware.txt)')
    parser.add_argument('--attendu', type=int, default=565, help='nombre de communes attendu')
    parser.add_argument('--sortie', type=Path, default=Path('supabase/seed/communes_be.sql'))
    parser.add_argument('--verifier', action='store_true', help='contrôler sans écrire le fichier SQL')
    args = parser.parse_args()

    communes = communes_depuis(lire_gpx(args.fichier))
    if len(communes) != args.attendu:
        erreur(f'{len(communes)} communes trouvées, {args.attendu} attendues')
    par_region = collections.Counter(c['region'] for c in communes)
    print(f'{len(communes)} communes :', ', '.join(f'{r} {n}' for r, n in sorted(par_region.items())))
    if args.zones:
        appliquer_zones(communes, lire_zones(args.zones))
        avec_zone = [c for c in communes if c.get('zone_secours')]
        print(f'zones : {len(avec_zone)} communes, {len({c["zone_secours"] for c in avec_zone})} zones de secours, '
              f'{len({c["zone_police_numero"] for c in avec_zone})} zones de police')
    if args.verifier:
        return

    source = f'Open Data Wallonie-Bruxelles, export « communes et localités » ({args.fichier.name})'
    if args.zones:
        source += f' ; zones : Eventware ({args.zones.name})'
    valeurs = ',\n'.join(
        '  (' + ', '.join([
            sql_texte(c['code']), sql_texte(c['fr']), sql_texte(c['nl']), sql_texte(c['de']),
            sql_texte(c['arrondissement']), sql_texte(c['province']), sql_texte(c['region']),
            "'{" + ','.join(c['langues']) + "}'",
            f"public.st_setsrid(public.st_makepoint({c['lon']}, {c['lat']}), 4326)::public.geography",
            sql_texte(c.get('zone_secours')), sql_texte(c.get('zone_police')), sql_texte(c.get('zone_police_numero')),
            sql_texte(source),
        ]) + ')'
        for c in communes
    )
    sql = f"""-- Référentiel des communes belges (F1), généré par scripts/seed/communes_be.py.
-- Source : Open Data Wallonie-Bruxelles, jeu « communes et localités » (export GPX) ; codes INS
-- conformes à la nomenclature REFNIS de Statbel au 1er janvier 2025 (565 communes). Zones de
-- secours et de police des communes wallonnes : copie de la table communes d'Eventware
-- (scripts/seed/sources/zones_wallonie_eventware.txt), vide ailleurs.
-- Ne pas modifier à la main : relancer le script sur un nouvel export.
-- Ajout ou mise à jour seulement : un code disparu (fusion) reste en place jusqu'à décision.

insert into public.communes_be
  (code_nis, nom_fr, nom_nl, nom_de, code_arrondissement, province, region, langues, centroide,
   zone_secours, zone_police, zone_police_numero, source)
values
{valeurs}
on conflict (code_nis) do update set
  nom_fr = excluded.nom_fr,
  nom_nl = excluded.nom_nl,
  nom_de = excluded.nom_de,
  code_arrondissement = excluded.code_arrondissement,
  province = excluded.province,
  region = excluded.region,
  langues = excluded.langues,
  centroide = excluded.centroide,
  zone_secours = excluded.zone_secours,
  zone_police = excluded.zone_police,
  zone_police_numero = excluded.zone_police_numero,
  source = excluded.source,
  maj_le = now();
"""
    args.sortie.parent.mkdir(parents=True, exist_ok=True)
    args.sortie.write_text(sql, encoding='utf-8')
    print(f'écrit : {args.sortie}')


if __name__ == '__main__':
    main()
