"""Portes animées, vantaux, sas vitrés, portes libres.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from mathutils import Vector

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import lib_helpers as H           # noqa: E402
import lib_rayons as L            # noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402

from espaces.commun import lampe
from espaces.coque import _plafond_au_bord, materiaux_espace

def poser_linteaux(ouvertures, gris, cache, coll) -> int:
    """Ferme ce qu'une ouverture laisse voir AU-DESSUS du plus bas des deux
    plafonds, et ce qu'une porte laisse voir au-dessus de son vantail.

    Le blockout perce les façades sur toute leur hauteur. Tant que les deux
    voisins avaient le même plafond, rien ne se voyait ; 13 jonctions sur 21
    n'étaient pas dans ce cas, et chacune ouvrait une bande sur le vide — de
    6,5 m aux deux rampes du souterrain, où l'on voyait par-dessus le toit du
    parking. Trouvé en regardant à hauteur d'œil, dans Blender, le 2026-09-18.

    RENDUS SEULEMENT, jamais de collider : c'est la règle 1 de
    `build_blockout.py` (« aucun linteau »), qui visait le bake de navigation —
    un rayon tiré vers le bas prendrait un linteau solide pour un sol. Un
    linteau sans collider n'existe pas pour Rapier, exactement comme un plafond.
    Tous sont au-dessus de 2,5 m : aucun joueur ne peut les atteindre.
    """
    t = bo.EPAISSEUR_MUR
    espaces = {s.id: s for s in plan.ALL}
    poses = 0
    for o in ouvertures:
        a, b = espaces.get(o.a), espaces.get(o.b)
        lo, hi = o.span

        # Imposte au-dessus d'une porte : du haut du vantail jusqu'au plus bas
        # des deux plafonds. Le sas vitré pose la sienne (`HAUTEUR_VANTAIL`).
        paire = frozenset({o.a, o.b})
        hauteur_vantail = HAUTEUR_VANTAIL.get(_cle_porte(o))
        if hauteur_vantail is not None:
            bas = o.z + hauteur_vantail
            haut = min(_plafond_au_bord(s, o.axe, o.at) for s in (a, b) if s)
            # Une porte libre dicte sa matière : l'imposte du pan de mur secret
            # doit être du plâtre de la galerie, pas le béton du labo derrière —
            # sinon c'est elle qui trahit la cachette.
            libre = PORTES_LIBRES.get(paire)
            mur = (H.textured_material(libre["imposte"]) if libre and "imposte" in libre
                   else materiaux_espace(a, gris, cache)["mur"])
            # 50 cm d'épaisseur, centrée sur la façade : une vraie traverse, plus
            # épaisse que le vantail (20 cm), et une origine sur la grille.
            if o.axe == "y":
                bo.boite(f"imposte_{o.a}_{o.b}", (lo, o.at - 0.25, bas), (hi - lo, 0.5, haut - bas),
                         "mur", {"mur": mur}, coll, None, avec_collider=False)
            else:
                bo.boite(f"imposte_{o.a}_{o.b}", (o.at - 0.25, lo, bas), (0.5, hi - lo, haut - bas),
                         "mur", {"mur": mur}, coll, None, avec_collider=False)
            poses += 1

        if not (a and b):
            continue
        pa, pb = _plafond_au_bord(a, o.axe, o.at), _plafond_au_bord(b, o.axe, o.at)
        if abs(pa - pb) < 1e-6:
            continue
        if frozenset({o.a, o.b}) == frozenset({"pc_secu", "gaine"}):
            # Le puits d'accès VMC prolonge l'escalier au-dessus du plafond du
            # PC. Sa grille cassable ferme toute la hauteur du raccord
            # (z=2..4 m) ; un linteau côté gaine la couperait et recréerait une
            # ouverture au-dessus d'elle.
            continue
        # Le linteau appartient au côté HAUT, posé dans l'emprise de ses murs
        # (règle 3 du blockout : jamais à cheval sur la ligne de façade).
        grand, bas, haut = (a, pb, pa) if pa > pb else (b, pa, pb)
        mur = materiaux_espace(grand, gris, cache)["mur"]
        nom = f"linteau_{grand.id}_{o.b if grand is a else o.a}"
        # Entre les murs de son espace, jamais dedans : une ouverture qui court
        # jusqu'au bout de la façade a les murs voisins descendus jusqu'à
        # l'angle (`bo.murs_espace`), et le linteau les traverserait.
        bords = grand.y if o.axe == "x" else grand.x
        lo, hi = max(lo, bords[0] + t), min(hi, bords[1] - t)
        if o.axe == "y":
            ya = o.at - t if abs(grand.y[1] - o.at) < 1e-6 else o.at
            bo.boite(nom, (lo, ya, bas), (hi - lo, t, haut - bas),
                     "mur", {"mur": mur}, coll, None, avec_collider=False)
        else:
            xa = o.at - t if abs(grand.x[1] - o.at) < 1e-6 else o.at
            bo.boite(nom, (xa, lo, bas), (t, hi - lo, haut - bas),
                     "mur", {"mur": mur}, coll, None, avec_collider=False)
        poses += 1
    return poses


# --- Portes animées -----------------------------------------------------------
#
# « J'aimerais des vraies portes qui bougent » (2026-09-19). Deux causes, à deux
# endroits : le jeu n'animait jamais le vantail — seul son corps physique
# glissait, invisible (ADR 0031) — et le niveau n'avait que cinq portes, des
# boîtes de 4 m sans quincaillerie. Chaque installation ci-dessous pose des
# VANTAUX : un `door_*` par vantail, origine au centre de sa boîte (le loader
# pose le corps sur l'origine, ADR 0012), sans rotation d'objet, et à UN SEUL
# matériau. La poignée partage la texture du vantail (`quincaillerie:`), le
# verre d'une porte vitrée est dans l'alpha de la sienne : deux matériaux
# feraient deux primitives glTF, donc un groupe que le loader ne reconnaît plus
# comme une porte.
#
# Le mouvement se déclare en extras, lus par le jeu (voir
# docs/6-reference/conventions-nommage.md#portes) : `battant` autour d'une
# charnière, `coulisse`, `monte`, `descend`. Une porte `auto` s'ouvre devant qui
# s'approche, joueur OU ennemi : seules les portes verrouillées (carte, sens
# unique, secret) gardent les Costards de leur côté, et le graphe de navigation
# traverse toutes les autres.

EP_VANTAIL = 0.05

# Hauteur du vantail de chaque façade à porte : `poser_linteaux` pose l'imposte
# au-dessus. `None` : l'installation pose elle-même ce qu'il y a au-dessus (le
# sas vitré a une traverse d'automatisme et un vitrage, pas un pan de mur).
# Sur la grille de 0,25 m : l'imposte a son origine au haut du vantail.
HAUTEUR_VANTAIL = {
    frozenset({"parking_ext", "c_pk_ga"}): None,
    frozenset({"c_pk_ga", "galerie"}): None,
    frozenset({"hub", "c_hb_rs"}): 2.0,
    frozenset({"c_hb_rs", "reserve"}): 2.5,
    frozenset({"c_bu", "c_escalier"}): 2.0,
    frozenset({"bureaux", "direction"}): 2.25,
    frozenset({"c_short_w", "rayons"}): 2.25,
    frozenset({"galerie", "secret1"}): bo.HAUTEUR_PORTE,
    frozenset({"cafeteria", "toilettes"}): 2.0,
    frozenset({"c_bu", "pc_secu"}): 2.1,
    frozenset({"c_bu", "vestiaires"}): 2.1,
    frozenset({"c_bu", "fournil"}): 2.1,
    frozenset({"vestiaires", "fournil"}): 2.1,
    frozenset({"c_short_w", "labo"}): 2.1,
    frozenset({"c_short_w", "chambre_froide"}): 2.25,
    frozenset({"c_short_w", "sav"}): 2.1,
    "sortie": 2.25,
}


def _cle_porte(o):
    return "sortie" if o is bo.OUVERTURE_SORTIE else frozenset({o.a, o.b})


def _monde(o, u0, v0, z0, u1, v1, z1):
    """Boîte monde d'après des cotes le long de la façade (u), en travers (v,
    compté depuis la ligne de façade) et en hauteur."""
    (ua, ub), (va, vb) = sorted((u0, u1)), sorted((v0, v1))
    if o.axe == "y":
        return (ua, o.at + va, z0, ub, o.at + vb, z1)
    return (o.at + va, ua, z0, o.at + vb, ub, z1)


def _charniere(o, bout: str) -> str:
    """`charniere` d'un vantail dont la charnière est au bout `bout` ("min" ou
    "max") de son grand axe, compté dans le repère de BLENDER. Le jeu la lit
    dans le repère three.js, où le +Y de Blender devient −Z : pour un vantail
    long en y (façade `axe == "x"`), les deux bouts s'échangent."""
    if o.axe == "y":
        return bout
    return "max" if bout == "min" else "min"


def _centrer_origine(obj) -> None:
    pts = [v.co.copy() for v in obj.data.vertices]
    c = Vector(tuple((min(p[i] for p in pts) + max(p[i] for p in pts)) / 2 for i in range(3)))
    for v in obj.data.vertices:
        v.co -= c
    obj.location = c


def vantail(nom: str, bornes, texture: str, uv: str, coll, extras: dict,
            quincaillerie=(), uv_quincaillerie: str | None = None):
    """Un `door_*` : le vantail et sa quincaillerie en un seul mesh, origine au
    centre, extras de mouvement posés en custom properties."""
    # La boîte englobante du vantail EST son collider et décide de sa charnière :
    # une poignée posée hors de sa hauteur (déjà arrivé, à l'étage) l'étire
    # sans rien dire.
    for b in quincaillerie:
        if not (bornes[2] <= b[2] and b[5] <= bornes[5]):
            raise ValueError(f"{nom} : quincaillerie hors du vantail ({b[2]:.2f}–{b[5]:.2f} m)")
    parts = [(bornes, uv)] + [(b, uv_quincaillerie or uv) for b in quincaillerie]
    obj = H.boxes(nom, parts, texture, coll)
    _centrer_origine(obj)
    for cle, valeur in extras.items():
        obj[cle] = valeur
    return obj


def _bequilles(o, libre: float, vers_charniere: int):
    """Rosace et béquille sur les deux faces, près du bord libre. `vers_charniere`
    vaut −1 si la charnière est du côté des u décroissants."""
    e = EP_VANTAIL / 2
    s = vers_charniere
    z = o.z
    out = []
    for f in (-1, 1):
        out.append(_monde(o, libre + s * 0.08, f * e, z + 0.99, libre + s * 0.12, f * (e + 0.02), z + 1.13))
        out.append(_monde(o, libre + s * 0.08, f * (e + 0.02), z + 1.04, libre + s * 0.24, f * (e + 0.05),
                          z + 1.07))
    return out


def _barre_anti_panique(o, a: float, b: float, face: int):
    """Barre horizontale et ses deux platines, sur la face `face` (±1 en v)."""
    e = EP_VANTAIL / 2
    z = o.z
    return [_monde(o, a + 0.10, face * (e + 0.04), z + 0.98, b - 0.10, face * (e + 0.07), z + 1.05),
            _monde(o, a + 0.08, face * e, z + 0.95, a + 0.14, face * (e + 0.07), z + 1.08),
            _monde(o, b - 0.14, face * e, z + 0.95, b - 0.08, face * (e + 0.07), z + 1.08)]


def _sens_vers(o, bout: str, vers: int) -> str:
    """`sens` forcé d'un battant pour qu'il s'ouvre du côté `vers` (±1 en v).

    Le jeu tourne le vantail autour de +Y three.js, dans le sens direct pour
    "+". Pour une façade perpendiculaire à y, le bout libre d'un vantail à
    charnière `min` part vers +x ; une rotation directe autour de +Y l'envoie
    vers −Z three.js, c'est-à-dire +y Blender : "+" ouvre vers les v POSITIFS.
    Charnière `max`, bout libre vers −x : c'est l'inverse.
    """
    if o.axe != "y":
        raise ValueError("sens forcé : seulement pour une façade perpendiculaire à y")
    positif = (bout == "min") == (vers > 0)
    return "+" if positif else "-"


def porte_double(o, noms, hauteur: float, texture: str, uv: str, coll, extras: dict,
                 quincaillerie: str | None = None, face_barre: int = 1,
                 uv_quincaillerie: str | None = None, vers: int | None = None) -> list:
    """Deux vantaux battants dans l'ouverture `o`, charnières aux deux bouts.
    `quincaillerie` : "bequille", "barre" (anti-panique, sur `face_barre`) ou
    rien (va-et-vient : la plaque de poussée est peinte). `vers` (±1 en v)
    force le côté où ils s'ouvrent ; sinon, `extras` décide (`sens`)."""
    lo, hi = o.span
    mid = (lo + hi) / 2
    e = EP_VANTAIL / 2
    out = []
    for nom, (a, b), bout, libre, s in ((noms[0], (lo, mid - 0.005), "min", mid - 0.005, -1),
                                         (noms[1], (mid + 0.005, hi), "max", mid + 0.005, 1)):
        q = []
        if quincaillerie == "bequille":
            q = _bequilles(o, libre, s)
        elif quincaillerie == "barre":
            q = _barre_anti_panique(o, a, b, face_barre)
        propres = dict(extras, mouvement="battant", charniere=_charniere(o, bout))
        if vers is not None:
            propres["sens"] = _sens_vers(o, bout, vers)
        out.append(vantail(nom, _monde(o, a, -e, o.z + 0.01, b, e, o.z + hauteur), texture, uv, coll,
                           propres, q, uv_quincaillerie))
    return out


def _use_de_carte(o, nom_porte: str, carte: str, logic) -> None:
    """Le lecteur de carte : un boîtier plaqué au mur, à droite de la porte, du
    côté d'où l'on arrive (les v négatifs pour les trois portes à carte).

    Un `use_*` reste VISIBLE en jeu : au blockout, c'était un cube de 60 cm
    flottant à un mètre du mur. La portée d'usage (2 m) se mesure jusqu'à son
    origine, pas jusqu'à sa surface : sa taille ne change rien au gameplay."""
    # Centré SUR la face du mur (il en dépasse de 4 cm) : son origine reste sur
    # la grille de 0,25 m, comme celle de tout objet hors vantail.
    face = -bo.EPAISSEUR_MUR
    centre = _monde(o, o.span[1] + 0.5, face, o.z + 1.25, o.span[1] + 0.5, face, o.z + 1.25)[:3]
    taille = (0.2, 0.08, 0.3) if o.axe == "y" else (0.08, 0.2, 0.3)
    bo.boite_centree(f"use_{nom_porte}", centre, taille, "repere",
                     {"repere": H.textured_material("metal_bac_acier")}, logic,
                     extras={"target": nom_porte, "requires": carte})


# Le sas d'entrée : deux façades vitrées, chacune avec deux vantaux coulissants
# au milieu et deux panneaux fixes CASSABLES de part et d'autre. `dedans` : le
# côté de la façade (±1 en v) où est le sas — les vantaux coulissent de ce
# côté-là, devant les panneaux fixes, sous le caisson de l'automatisme.
SAS_FIXE = 2.0
SAS_HAUT = 2.5
SAS_PV = 25


def sas_vitre(o, groupe: str, dedans: int, props, col_coll) -> int:
    lo, hi = o.span
    mid = (lo + hi) / 2
    ht = o.z + min(s.z + s.hauteur for s in plan.ALL if s.id in (o.a, o.b))
    e = EP_VANTAIL / 2
    tag = groupe
    # Panneaux fixes, sur la ligne de façade.
    for i, (a, b) in enumerate(((lo, lo + SAS_FIXE), (hi - SAS_FIXE, hi))):
        v = H.box(f"vitre_{tag}_fixe{i}", _monde(o, a + 0.06, -0.015, o.z + 0.10, b - 0.03, 0.015, SAS_HAUT),
                  "verre", props, uv=f"aplat:{H.VERRE_TEINTE}")
        v["pv"] = SAS_PV
    # Menuiseries : seuils sous les fixes, montants, caisson de l'automatisme.
    alu = [_monde(o, lo, -0.05, o.z, lo + SAS_FIXE, 0.05, o.z + 0.10),
           _monde(o, hi - SAS_FIXE, -0.05, o.z, hi, 0.05, o.z + 0.10)]
    for u in (lo, lo + SAS_FIXE - 0.03, hi - SAS_FIXE - 0.03, hi - 0.06):
        alu.append(_monde(o, u, -0.05, o.z, u + 0.06, 0.05, SAS_HAUT))
    alu.append(_monde(o, lo, dedans * 0.03, SAS_HAUT, hi, dedans * 0.28, SAS_HAUT + 0.30))
    alu.append(_monde(o, lo, -0.05, SAS_HAUT, hi, 0.05, SAS_HAUT + 0.06))
    alu.append(_monde(o, lo, -0.05, ht - 0.06, hi, 0.05, ht))
    H.boxes(f"sas_{tag}_alu", [(b, "world") for b in alu], "metal_bac_acier", props)
    # Imposte vitrée au-dessus du caisson : on voit le ciel en entrant. Pas de
    # collider (hors d'atteinte), et le parking garde son linteau au-delà de 4 m.
    v = H.box(f"vitre_{tag}_imposte", _monde(o, lo + 0.03, -0.015, SAS_HAUT + 0.06, hi - 0.03, 0.015, ht - 0.06),
              "verre", props, uv=f"aplat:{H.VERRE_TEINTE}")
    v["solide"] = False
    # Les deux vantaux, décalés côté sas pour coulisser devant les fixes.
    v0 = dedans * 0.10
    for nom, (a, b), sens in ((f"door_{tag}_g", (lo + SAS_FIXE, mid - 0.005), "-"),
                              (f"door_{tag}_d", (mid + 0.005, hi - SAS_FIXE), "+")):
        vantail(nom, _monde(o, a, v0 - e, o.z + 0.01, b, v0 + e, SAS_HAUT - 0.01), "portes_verre",
                "porte:porte_auto", props,
                dict(mouvement="coulisse", sens=sens, course=SAS_FIXE - 0.05, auto=True, portee=3.0,
                     referme=True, delai=1.0, groupe=tag))
    return 2


# Portes sans carte ouvertes par un `use_*` qui porte `target` et un `message`
# (le jeu les reconnaît à ça, `game/level/interactive.ts`). Le SENS UNIQUE de
# la porte coupe-feu tient à la place de son bouton : à plus de 2 m (portée
# d'usage) de tout point du côté rayons. Une fois ouverte, elle le reste — le
# raccourci à la Doom, mérité.
PORTES_LIBRES = {
    frozenset({"galerie", "secret1"}): dict(
        porte="door_secret_photomaton", use="use_photomaton", texture="mur_platre", imposte="mur_platre",
        # DANS le caisson du photomaton : c'est lui qu'on utilise, et le bouton
        # n'a pas à se voir.
        use_centre=(-29.0, 6.5, 1.0), use_taille=(0.5, 0.5, 0.5),
        message="Clic ! Flash ! Derrière le photomaton, un pan de mur s'efface..."),
    frozenset({"c_short_w", "rayons"}): dict(
        porte="door_coupe_feu", use="use_coupe_feu", texture="metal_peint_rouge", secours=True,
        # Sur le mur ouest du couloir, à côté de la porte, à 2,9 m de tout point
        # côté rayons : hors de la portée d'usage (2 m) depuis la surface de vente.
        use_centre=(-43.75, 86.5, 1.25), use_taille=(0.1, 0.5, 0.5),
        message="Porte coupe-feu ouverte : raccourci vers les rayons"),
    # La bouche d'aération du secret 3 : un « trou béant » avant cette passe
    # (2026-09-24, retour de playtest) — la baie n'était fermée par RIEN, le
    # local et sa lumière orange se voyaient depuis toute la cafétéria.
    # `metal_tole_perforee` (déjà le rideau `door_argent`) donne le grillage
    # sans ouvrir un nouveau matériau de vantail : toujours 7 lots de portes
    # pour tout le niveau, pas 8.
    frozenset({"cafeteria", "secret3"}): dict(
        porte="door_secret_vmc", use="use_grille_vmc", texture="metal_tole_perforee",
        # Près du haut de la grille (z = 3,75, sur la grille 0,25 m) : à au
        # moins 2,85 m de tout point du SOL de la cafétéria (`playerPosition`
        # est le centre de capsule, ~0,9 m au-dessus des pieds — la seule
        # composante VERTICALE dépasse déjà la portée de 2 m, quel que soit
        # l'endroit où l'on se tient), à moins de 1,3 m de qui se tient sur le
        # distributeur voisin (1,9 m de haut).
        use_centre=(36.0, 19.75, 3.75), use_taille=(0.3, 0.08, 0.3),
        message="La grille cède sans un bruit : il y a toujours une bouche "
                "d'aération quelque part."),
}


def _porte_libre(o, spec, props, logic) -> None:
    a, b = o.span
    if spec["porte"] == "door_secret_photomaton":
        # Le pan de mur : l'épaisseur des deux murs voisins, donc affleurant des
        # deux côtés — invisible tant qu'il est fermé. Il s'enfonce dans le sol,
        # comme un passage secret de Wolfenstein.
        z_c = o.z + bo.HAUTEUR_PORTE / 2
        if o.axe == "x":
            centre, taille = (o.at, (a + b) / 2, z_c), (2 * bo.EPAISSEUR_MUR, b - a, bo.HAUTEUR_PORTE)
        else:
            centre, taille = ((a + b) / 2, o.at, z_c), (b - a, 2 * bo.EPAISSEUR_MUR, bo.HAUTEUR_PORTE)
        bo.boite_centree(spec["porte"], centre, taille, "repere",
                         {"repere": H.textured_material(spec["texture"])}, props,
                         extras={"mouvement": "descend"})
    elif spec["porte"] == "door_secret_vmc":
        # Un seul vantail, charnière côté ouest (`bout="min"`) : la baie fait
        # 2 m de large sur 2 m de haut, DÉCOLLÉE du sol (le mur reste plein en
        # dessous, la grille commence à `o.z + 2.0`, comme `ca_bouche_cadre`/
        # `vmc_cadre` construits à la main dans `habiller_cafeteria`/
        # `habiller_vmc`). `sens` reste "auto" — pas de `_sens_vers` forcé :
        # la porte s'ouvre en s'éloignant de qui appuie sur E (`resolveAutoOpenSign`),
        # donc loin du joueur perché sur le distributeur, vers le local.
        e = EP_VANTAIL / 2
        vantail(spec["porte"], _monde(o, a + 0.02, -e, o.z + 2.0, b - 0.02, e, o.z + 4.0),
                spec["texture"], "world", props,
                dict(mouvement="battant", charniere=_charniere(o, "min"), sens="auto"))
    else:
        # La porte coupe-feu : double, rouge, barres anti-panique côté personnel
        # — le côté d'où elle s'ouvre (`plan.PORTES_SENS_UNIQUE`).
        depuis = next(s for s in plan.ALL if s.id == plan.PORTES_SENS_UNIQUE[frozenset({o.a, o.b})][0])
        bornes = depuis.y if o.axe == "y" else depuis.x
        cote_personnel = 1 if (bornes[0] + bornes[1]) / 2 > o.at else -1
        # `manuelle: "fermer"` : on peut la REFERMER à la main, des deux côtés,
        # jamais l'ouvrir. Le sens unique tient toujours à la place du bouton —
        # hors de portée côté rayons — mais la porte n'est plus un interrupteur
        # à sens unique définitif : on peut la claquer derrière soi.
        porte_double(o, (spec["porte"], f"{spec['porte']}_b"), HAUTEUR_VANTAIL[frozenset({o.a, o.b})],
                     spec["texture"], "world", props, {"groupe": "coupe_feu", "manuelle": "fermer"},
                     quincaillerie="barre", face_barre=cote_personnel)
    bo.boite_centree(spec["use"], spec["use_centre"], spec["use_taille"], "repere",
                     {"repere": H.textured_material(spec["texture"])}, logic,
                     extras={"target": spec["porte"], "message": spec["message"]})
    if spec.get("secours"):
        # Bloc de secours vert au-dessus de la porte, côté personnel : le même
        # que côté rayons, pour qu'on lise la porte des deux côtés.
        L.place(L.neon(2.0), ((a + b) / 2 - 1.0, o.at + 0.35, o.z + 2.9), 0, props, props,
                f"{spec['porte']}_secours")
        lampe(logic, f"light_{spec['porte']}_secours", ((a + b) / 2, o.at + 0.7, o.z + 2.7),
              color="#4dff73", intensity=3.0, distance=7.0)


def poser_portes_animees(ouvertures, props, col_coll, logic) -> int:
    """Toutes les portes des façades du plan. Les portes des bureaux, dans des
    cloisons que le plan ne connaît pas, sont posées par `habiller_etage`."""
    poses = 0
    for o in ouvertures:
        cle = _cle_porte(o)
        if cle == frozenset({"parking_ext", "c_pk_ga"}):
            poses += sas_vitre(o, "sas_ext", 1, props, col_coll)
        elif cle == frozenset({"c_pk_ga", "galerie"}):
            poses += sas_vitre(o, "sas_int", -1, props, col_coll)
        elif cle == frozenset({"c_bu", "pc_secu"}):
            # Porte d'accès depuis le couloir ; le passage intérieur vers le
            # poste des caméras reste ouvert, sans second vantail.
            porte_double(o, ("door_pc_entree_g", "door_pc_entree_d"), HAUTEUR_VANTAIL[cle],
                         "portes_pc", "porte:porte_pc", props,
                         dict(sens="auto", auto=True, portee=1.8, referme=True, delai=0.7,
                              groupe="pc_entree"), vers=1)
            poses += 2
        elif cle == frozenset({"c_bu", "vestiaires"}):
            porte_double(o, ("door_vestiaires_entree_g", "door_vestiaires_entree_d"),
                         HAUTEUR_VANTAIL[cle], "portes_verre", "porte:porte_vav", props,
                         dict(sens="auto", auto=True, portee=1.7, referme=True, delai=0.7,
                              groupe="vestiaires_entree"), vers=1)
            poses += 2
        elif cle == frozenset({"c_bu", "fournil"}):
            porte_double(o, ("door_fournil_couloir_g", "door_fournil_couloir_d"),
                         HAUTEUR_VANTAIL[cle], "portes_verre", "porte:porte_vav", props,
                         dict(sens="auto", auto=True, portee=1.8, referme=True, delai=0.7,
                              groupe="fournil_couloir"), vers=1)
            poses += 2
        elif cle == frozenset({"vestiaires", "fournil"}):
            porte_double(o, ("door_vestiaires_fournil_g", "door_vestiaires_fournil_d"),
                         HAUTEUR_VANTAIL[cle], "portes_verre", "porte:porte_vav", props,
                         dict(sens="auto", auto=True, portee=1.7, referme=True, delai=0.7,
                              groupe="vestiaires_fournil"))
            poses += 2
        elif cle == frozenset({"c_short_w", "labo"}):
            porte_double(o, ("door_labo_boucherie_g", "door_labo_boucherie_d"),
                         HAUTEUR_VANTAIL[cle], "portes_verre", "porte:porte_vav", props,
                         dict(sens="auto", auto=True, portee=1.8, referme=True, delai=0.7,
                              groupe="labo_boucherie_entree"))
            poses += 2
        elif cle == frozenset({"c_short_w", "chambre_froide"}):
            lo, hi = o.span
            vantail("door_chambre_froide_couloir",
                    _monde(o, lo + 0.015, -EP_VANTAIL / 2, o.z + 0.01,
                           hi - 0.015, EP_VANTAIL / 2, o.z + HAUTEUR_VANTAIL[cle]),
                    "palette", "aplat:#d5d7d8", props,
                    dict(mouvement="battant", charniere=_charniere(o, "min"), sens="auto",
                         angle=105, manuelle=True, referme=False, groupe="porte_chambre_froide"))
            poses += 1
        elif cle == frozenset({"c_short_w", "sav"}):
            lo, hi = o.span
            libre = hi - 0.015
            vantail("door_sav_couloir",
                    _monde(o, lo + 0.015, -EP_VANTAIL / 2, o.z + 0.01,
                           hi - 0.015, EP_VANTAIL / 2, o.z + HAUTEUR_VANTAIL[cle]),
                    "metal_bac_acier", "world", props,
                    dict(mouvement="battant", charniere=_charniere(o, "min"), sens="auto",
                         auto=True, angle=105, portee=1.6, referme=True, delai=0.7,
                         groupe="sav_entree"),
                    _bequilles(o, libre, -1))
            poses += 1
        elif cle == frozenset({"pc_secu", "gaine"}):
            # Grille métallique posée dans le raccord surélevé (z=2..4 m).
            # Le mesh `vitre_*` fournit son collider et sa casse ; aucun bouton
            # ni animation de porte ne ferme ce passage.
            lo, hi = o.span
            espaces = {s.id: s for s in plan.ALL}
            z0 = max(o.z_a, o.z_b)
            z1 = max(_plafond_au_bord(espaces[o.a], o.axe, o.at),
                     _plafond_au_bord(espaces[o.b], o.axe, o.at))
            e = EP_VANTAIL / 2
            rail = 0.07
            parts = [
                (_monde(o, lo, -e, z0, lo + rail, e, z1), "world"),
                (_monde(o, hi - rail, -e, z0, hi, e, z1), "world"),
                (_monde(o, lo + rail, -e, z0, hi - rail, e, z0 + rail), "world"),
                (_monde(o, lo + rail, -e, z1 - rail, hi - rail, e, z1), "world"),
            ]
            for i in range(1, 5):
                centre = lo + (hi - lo) * i / 5
                parts.append((_monde(o, centre - 0.025, -e, z0 + rail,
                                     centre + 0.025, e, z1 - rail), "world"))
            for hauteur in (0.65, 1.30):
                if z0 + hauteur < z1 - rail:
                    parts.append((_monde(o, lo + rail, -e, z0 + hauteur,
                                         hi - rail, e, z0 + hauteur + 0.045), "world"))
            grille = H.boxes("vitre_pc_gaine", parts, "metal_tole_perforee", props)
            grille["pv"] = 45
            grille["matiere"] = "metal"
            poses += 1
        elif cle == frozenset({"fournil", "gaine"}):
            # Bouche cassable : le conduit est surélevé et s'atteint depuis
            # le plan de travail du fournil.
            lo, hi = o.span
            espaces = {s.id: s for s in plan.ALL}
            z0 = max(o.z_a, o.z_b)
            z1 = max(_plafond_au_bord(espaces[o.a], o.axe, o.at),
                     _plafond_au_bord(espaces[o.b], o.axe, o.at))
            e = EP_VANTAIL / 2
            rail = 0.07
            parts = [
                (_monde(o, lo, -e, z0, lo + rail, e, z1), "world"),
                (_monde(o, hi - rail, -e, z0, hi, e, z1), "world"),
                (_monde(o, lo + rail, -e, z0, hi - rail, e, z0 + rail), "world"),
                (_monde(o, lo + rail, -e, z1 - rail, hi - rail, e, z1), "world"),
            ]
            for i in range(1, 5):
                centre = lo + (hi - lo) * i / 5
                parts.append((_monde(o, centre - 0.025, -e, z0 + rail,
                                     centre + 0.025, e, z1 - rail), "world"))
            for hauteur in (0.65, 1.30):
                if z0 + hauteur < z1 - rail:
                    parts.append((_monde(o, lo + rail, -e, z0 + hauteur,
                                         hi - rail, e, z0 + hauteur + 0.045), "world"))
            bouche = H.boxes("vitre_fournil_gaine", parts, "metal_tole_perforee", props)
            bouche["pv"] = 45
            bouche["matiere"] = "metal"
            poses += 1
        elif cle == frozenset({"hub", "c_hb_rs"}):
            # Va-et-vient « PRIVÉ » : elles battent des deux côtés, se referment
            # seules, et laissent passer les Costards.
            porte_double(o, ("door_reserve_vav_g", "door_reserve_vav_d"), HAUTEUR_VANTAIL[cle],
                         "portes_verre", "porte:porte_vav", props,
                         dict(sens="auto", auto=True, portee=1.8, referme=True, delai=0.6,
                              groupe="reserve_vav"))
            poses += 2
        elif cle == frozenset({"c_hb_rs", "reserve"}):
            # Le rideau métallique du quai remonte dans son caisson, au-dessus
            # de l'imposte ; il en reste la lame finale.
            lo, hi = o.span
            vantail("door_argent", _monde(o, lo + 0.02, -0.04, o.z + 0.01, hi - 0.02, 0.04,
                                          o.z + HAUTEUR_VANTAIL[cle]),
                    "metal_tole_perforee", "world", props,
                    {"mouvement": "monte", "course": HAUTEUR_VANTAIL[cle] - 0.05},
                    [_monde(o, lo + 0.02, -0.06, o.z + 0.01, hi - 0.02, 0.06, o.z + 0.10)])
            _use_de_carte(o, "door_argent", "argent", logic)
            poses += 1
        elif cle == frozenset({"c_bu", "c_escalier"}):
            # Elles s'ouvrent vers le couloir : côté escalier, un vantail qui
            # s'ouvre en balayant les premières marches passerait au travers.
            porte_double(o, ("door_or", "door_or_b"), HAUTEUR_VANTAIL[cle], "portes_verre",
                         "porte:porte_vav", props, {"groupe": "or"}, vers=-1)
            _use_de_carte(o, "door_or", "or", logic)
            poses += 2
        elif cle == "sortie":
            # L'issue de secours du bureau du Directeur : acier, barres
            # anti-panique côté bureau.
            porte_double(o, ("door_exit", "door_exit_b"), HAUTEUR_VANTAIL[cle], "metal_bac_acier",
                         "world", props, {"sens": "auto", "groupe": "sortie"},
                         quincaillerie="barre", face_barre=-1)
            _use_de_carte(o, "door_exit", "platine", logic)
            poses += 2
        elif cle == frozenset({"bureaux", "direction"}):
            porte_double(o, ("door_direction_g", "door_direction_d"), HAUTEUR_VANTAIL[cle], "portes",
                         "porte:porte_capitonnee", props,
                         dict(sens="auto", auto=True, portee=2.0, referme=False, groupe="direction"),
                         quincaillerie="bequille", uv_quincaillerie="quincaillerie:porte_capitonnee")
            poses += 2
        elif cle in PORTES_LIBRES:
            _porte_libre(o, PORTES_LIBRES[cle], props, logic)
            poses += 1
        elif cle == frozenset({"cafeteria", "toilettes"}):
            # La porte des WC se manœuvre comme celles des bureaux : à la main
            # (touche E), les Costards la poussent. Une porte de toilettes qui
            # s'écarte toute seule se lirait comme une porte de magasin.
            lo, hi = o.span
            libre = hi - 0.005
            vantail("door_wc", _monde(o, lo + 0.005, -EP_VANTAIL / 2, o.z + 0.01, libre, EP_VANTAIL / 2,
                                      o.z + HAUTEUR_VANTAIL[cle]),
                    "portes_2", "porte:porte_wc", props,
                    dict(mouvement="battant", charniere=_charniere(o, "min"), sens="auto",
                         auto="ennemis", manuelle=True, portee=1.6, referme=False),
                    _bequilles(o, libre, -1), "quincaillerie:porte_wc")
            poses += 1
    return poses
