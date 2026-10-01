"""Coque texturée : matériaux par espace, sols, plafonds, linteaux.

Extrait de `build_niveau.py` le 2026-10-01 : blocs déplacés à l'identique,
sans changement de comportement."""

from __future__ import annotations

from espaces import chemins  # noqa: F401 — met tools/blender et tools/level_v2 sur sys.path

import geo_utils                  # noqa: E402
import lib_helpers as H           # noqa: E402
import plan_de_masse as plan      # noqa: E402
import build_blockout as bo       # noqa: E402


# --- Coque texturée ----------------------------------------------------------
#
# `sol` / `mur` / `plafond` par espace. `volume` et `repere` restent les gris du
# blockout partout : un volume gris signale un espace pas encore habillé, et
# c'est une information qu'on veut garder à l'œil.

COQUE = {
    "parking_ext": ("sol_asphalte", "mur_platre_use", None),
    "galerie": ("sol_terrazzo", "mur_platre", "plafond_dalles"),
    "cafeteria": ("sol_damier", "mur_platre", "plafond_dalles"),
    "caisses": ("sol_carrelage_blanc", "mur_platre", "plafond_dalles"),
    "hub": ("sol_terrazzo", "mur_platre", "plafond_dalles"),
    "rayons": ("sol_carrelage_blanc", "mur_platre", "plafond_dalles"),
    "electro": ("sol_terrazzo_fin", "mur_platre", "plafond_dalles"),
    # Béton brut au plafond et non des dalles de faux plafond : ni une réserve
    # ni un parking souterrain n'en ont, et une dalle acoustique blanche au-
    # dessus d'un parking le fait ressembler à un bureau.
    "reserve": ("sol_beton", "mur_platre_use", "sol_beton_brut"),
    "souterrain": ("sol_beton_brut", "mur_platre_use", "sol_beton_brut"),
    "bureaux": ("sol_moquette", "mur_platre", "plafond_dalles"),
    # Les rampes du souterrain sont des rampes de PARKING : même béton que le
    # parking qu'elles desservent, pas le terrazzo de la galerie marchande.
    "c_rs_so": ("sol_beton_brut", "mur_platre_use", "sol_beton_brut"),
    "c_so_bu": ("sol_beton_brut", "mur_platre_use", "sol_beton_brut"),
    # Le secteur réservé au personnel (couloir de direction, montée et couloir
    # de service) prend la matière de la réserve : on sort de la surface de
    # vente, ça doit se voir au sol avant de se lire sur un panneau.
    "c_bu": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "c_short_ramp": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "c_short_w": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "c_escalier": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "direction": ("sol_moquette", "mur_platre", "plafond_dalles"),
    # Les deux cachettes prennent la matière de la pièce qu'elles prolongent :
    # un matériau neuf dans une cellule de 48 m est un lot de dessin de plus, et
    # les deux cellules sont dans le champ des vues déjà les plus chargées.
    "secret1": ("sol_terrazzo", "mur_platre", "plafond_dalles"),
    "secret3": ("sol_damier", "mur_platre", "plafond_dalles"),
    # Seules dans leur cellule de 48 m, les toilettes y paient un lot de dessin
    # par matière. Aux murs, le carrelage blanc des caisses fait la faïence ; le
    # sol est celui de la cafétéria, d'un seul tenant (`SOL_COMMUN`) ; le plafond,
    # en plâtre, est posé par `habiller_toilettes` (`PLAFOND_SUR_MESURE`).
    "toilettes": ("sol_damier", "sol_carrelage_blanc", "mur_platre"),

    # ===== Les coulisses, v2 (2026-09-26) =====
    # Vestiaires, fournil et préparation alimentaire sont des locaux d'hygiène :
    # carrelage blanc et plâtre propre lavable. Le labo boucherie/marée ajoute
    # son grès rouge (section 3.2.D) ; le
    # compacteur reste brut, comme la réserve dont il dépend ; la planque du
    # vigile (secret 4) tranche exprès avec sa moquette, seul confort des
    # coulisses. La gaine VMC n'a ni sol ni mur propres (un conduit), elle
    # prend le béton du couloir qu'elle double.
    "vestiaires": ("sol_carrelage_blanc", "mur_platre", "plafond_dalles"),
    "fournil": ("sol_carrelage_blanc", "mur_platre", "plafond_dalles"),
    "gaine": ("sol_beton_brut", "mur_platre_use", "sol_beton_brut"),
    # `pc_secu` (le pilote) a sa propre moquette institutionnelle et son
    # plafond sombre construits à la main (`PLAFOND_SUR_MESURE`) — l'entrée de
    # `plafond_dalles` ci-dessous ne sert donc qu'à documenter le défaut avant
    # override, jamais lue par `plafond()`. Un bureau de contrôle et un
    # atelier de retours : béton de la réserve qu'ils prolongent, pas la
    # faïence des locaux d'hygiène voisins.
    # `mur_platre` (propre) et pas `mur_platre_use` (rouillé) : une peinture
    # institutionnelle, pas un mur d'usine — corrigé après critique du pilote
    # (2026-09-26, 2e passe), le rendu confondait les deux à l'œil.
    "pc_secu": ("sol_moquette", "mur_platre", "plafond_dalles"),
    "sav": ("sol_beton", "mur_platre_use", "plafond_dalles"),
    "labo": ("sol_carrelage_blanc", "mur_platre", "plafond_dalles"),
    "chambre_froide": ("sol_carrelage_blanc", "mur_platre", "plafond_dalles"),
    "compacteur": ("sol_beton_brut", "mur_platre_use", "sol_beton_brut"),
    "secret4": ("sol_moquette", "mur_platre_use", "plafond_dalles"),
}
COQUE_COULOIR = ("sol_terrazzo", "mur_platre", "plafond_dalles")

EPAISSEUR_PLAFOND = 0.1

# Cible de subdivision des grandes surfaces (sols, plafonds).
#
# `H.subdivide` s'arrête quand plus aucune arête ne dépasse **`cible × 1.5`** —
# la garantie réelle est donc 1,5 fois la valeur passée, pas la valeur
# elle-même. Pour garantir une arête sous 1 m (donc plus d'un sommet par m², le
# seuil de `validate_level.py`), il faut passer 1 / 1,5 = 0,67 au plus. 0,60
# laisse de la marge et couvre toutes les cotes du niveau, la galerie de 60 m
# comprise — au-delà, les six passes de `subdivide` ne suffiraient plus.
#
# Le niveau n'est pas encore baké, mais une surface qui NE PEUT PAS l'être est
# une dette qu'on paierait au moment où on décide de le faire : le bake est par
# sommet, et une dalle à quatre coins ne porte aucun dégradé.
SUBDIV_BAKE = 0.6


def materiaux_espace(space, gris: dict, cache: dict) -> dict:
    """Le dictionnaire de matériaux du blockout, `sol` et `mur` remplacés par
    des textures. Les clés sont les mêmes, donc `bo.boite`/`bo.murs_espace`
    fonctionnent sans être touchées."""
    sol, mur, _ = COQUE.get(space.id, COQUE_COULOIR)
    cle = (sol, mur)
    if cle not in cache:
        lookup = dict(gris)
        lookup["sol"] = H.textured_material(sol)
        lookup["mur"] = H.textured_material(mur)
        cache[cle] = lookup
    return cache[cle]


# Espaces dont l'habillage construit son propre plafond (percé, à redans...) :
# `plafond()` les laisse tranquilles plutôt que d'en poser un second par-dessus.
PLAFOND_SUR_MESURE = frozenset({"galerie", "toilettes", "pc_secu"})

# Idem pour le SOL, quand l'habillage le découpe en bandes de textures
# différentes. Le défaut est volontairement l'inverse — `main()` pose un sol
# uni à tout espace qui n'est pas listé ici, habillé ou non. Un habillage qui
# oublie son sol donne ainsi une pièce banale, jamais un trou dans lequel le
# joueur tombe.
SOL_SUR_MESURE = frozenset({"rayons", "caisses", "galerie", "hub"})

# Sols posés d'UN SEUL tenant avec celui d'un voisin : hôte → invités, qui en
# prennent la matière. Le jeu fusionne le décor par matière et par cellule de
# 48 m, le CENTRE de l'objet faisant foi, et un sol n'est jamais dans la même
# tranche verticale qu'un mur : seules dans leur cellule, les toilettes payaient
# un lot de dessin rien que pour leur sol (mesuré le 2026-09-24). D'un seul
# tenant avec la cafétéria, le sol commun n'en coûte qu'un pour les deux pièces.
SOL_COMMUN = {"cafeteria": ("toilettes",)}
SOL_INVITE = frozenset(i for invites in SOL_COMMUN.values() for i in invites)


def sol_commun(space, materiaux, coll, col_coll) -> None:
    """Le sol de `space` et de ses invités en un seul mesh ; un collider par pièce."""
    espaces = {s.id: s for s in plan.ALL}
    pieces = [space] + [espaces[i] for i in SOL_COMMUN[space.id]]
    e = bo.EPAISSEUR_SOL
    parts = [{"o": (s.x[0], s.y[0], s.z - e), "s": (s.largeur, s.profondeur, e), "mat": "sol"} for s in pieces]
    coll.objects.link(geo_utils.build_multi_box_mesh(f"sol_{space.id}", parts, "sol", materiaux,
                                                     seg=bo.SEG, uv_tile=2.0))
    for s in pieces:
        proxy = geo_utils.build_proxy_object(f"col_box_sol_{s.id}", "box", (0.0, 0.0, 0.0),
                                             (s.largeur, s.profondeur, e))
        proxy.location = (s.x[0], s.y[0], s.z - e)
        col_coll.objects.link(proxy)


def plafond(space, coll) -> bool:
    """Dalle de plafond, SANS collider. Retourne False quand l'espace est à ciel
    ouvert ou quand son habillage s'en charge lui-même."""
    if space.id in PLAFOND_SUR_MESURE:
        return False
    texture = COQUE.get(space.id, COQUE_COULOIR)[2]
    if texture is None:
        return False
    x0, x1 = space.x
    y0, y1 = space.y
    if space.rampe:
        # Le plafond d'une rampe SUIT la pente, à `hauteur` au-dessus du sol en
        # tout point. Posé à plat au point haut (premier jet), il laissait 10 m
        # sous plafond au bas d'une rampe de 6 m, et surtout un vide de 6,5 m
        # au-dessus du plafond du souterrain, par lequel on voyait hors du niveau.
        sens, z0, z1 = space.rampe
        bo.dalle_inclinee(f"plafond_{space.id}", space.x, space.y,
                          z0 + space.hauteur, z1 + space.hauteur, sens,
                          EPAISSEUR_PLAFOND, H.textured_material(texture), coll)
        return True
    z = space.z
    H.box(f"plafond_{space.id}", (x0, y0, z + space.hauteur, x1, y1, z + space.hauteur + EPAISSEUR_PLAFOND),
          texture, coll, subdiv=SUBDIV_BAKE)
    return True


def _plafond_au_bord(space, axe: str, at: float) -> float:
    """Sous-face du plafond au droit d'une façade (haut des murs pour un espace
    à ciel ouvert, dont les murs font `hauteur`). Suit la pente d'une rampe."""
    return plan._sol_au_bord(space, axe, at) + space.hauteur
