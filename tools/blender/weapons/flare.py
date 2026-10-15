"""Pistolet de détresse : polymère orange, gros canon court qui bascule, chien apparent."""
from mathutils import Matrix, Vector

from weapons.config import PALETTE as P, BOUT_CANON_DETRESSE
from weapons.geometry import (pave, tube, balayage, profil_lateral, biseauter, conduit,
                              peindre_eclairage, fusionner)


def construire_pistolet_detresse(vue_subjective=False):
    """Même repère et même poignée que le pistolet (la main `pistol` s'y
    referme telle quelle) : origine au poing, canon le long de +Y, Z en haut.
    Ce qui le distingue à 640×360 tient en deux choses — la couleur, et un
    canon deux fois plus gros que long."""
    k = 1.15 if vue_subjective else 1.0
    z = BOUT_CANON_DETRESSE[2]
    bout = BOUT_CANON_DETRESSE[1]
    pieces = []

    # Canon de 26,5 mm : un tube épais, bouche cerclée de sombre.
    canon = conduit("det_canon", (0, -0.020, z), (0, bout - 0.012, z), 0.0215 * k, 0.0135 * k, P["orange"], 10)
    peindre_eclairage(canon, P["orange_clair"], P["orange"], P["orange_ombre"])
    pieces.append(canon)
    bouche = conduit("det_bouche", (0, bout - 0.012, z), BOUT_CANON_DETRESSE, 0.0235 * k, 0.0135 * k,
                     P["acier_sombre"], 10)
    peindre_eclairage(bouche, P["acier"], P["acier_sombre"], P["scotch"])
    pieces.append(bouche)
    pieces.append(tube("det_fond_canon", (0, 0.020, z), (0, 0.024, z), 0.0135 * k, "#0c0d0f", 10))
    # Renfort de culasse : l'anneau où le canon se verrouille.
    culasse = conduit("det_culasse", (0, -0.032, z), (0, -0.012, z), 0.0245 * k, 0.004, P["orange_ombre"], 10)
    peindre_eclairage(culasse, P["orange"], P["orange_ombre"], P["orange_ombre"])
    pieces.append(culasse)
    # Bande réfléchissante : le seul détail clair, il casse l'aplat orange.
    pieces.append(conduit("det_bande", (0, 0.058, z), (0, 0.072, z), 0.0222 * k, 0.0135 * k, P["point"], 10))

    # Carcasse : courte, sous l'arrière du canon, avec l'axe de bascule devant.
    cadre = profil_lateral("det_carcasse", [(-0.052, 0.040), (-0.046, 0.058), (0.010, 0.060),
                           (0.086, 0.052), (0.092, 0.040), (0.070, 0.036),
                           (0.012, 0.030), (-0.028, 0.012)], 0.034 * k, P["orange"])
    biseauter(cadre, 0.003)
    peindre_eclairage(cadre, P["orange_clair"], P["orange"], P["orange_ombre"])
    pieces.append(cadre)
    for s in (-1, 1):
        pieces.append(tube("det_axe", (s * 0.0175 * k, 0.080, 0.045), (s * 0.0185 * k, 0.080, 0.045),
                           0.0045, P["acier_clair"], 8))

    # Pontet large : on tire avec des gants.
    contour = [Vector((0, y, h)) for y, h in [(0.008, 0.036), (0.066, 0.036), (0.082, 0.026),
               (0.082, 0.004), (0.070, -0.006), (0.014, -0.006), (0.004, 0.006)]]
    pieces.append(balayage("det_pontet", contour, 0.012, 0.006, P["orange_ombre"]))
    pieces.append(balayage("det_detente", [Vector((0, 0.046, 0.036)), Vector((0, 0.036, 0.018)),
                   Vector((0, 0.044, 0.008))], 0.007, 0.005, P["acier_sombre"]))

    # Poignée : le profil du pistolet, plaquettes noires quadrillées.
    grip = [(-0.020, 0.046), (0.018, 0.040), (0.021, 0.015), (-0.010, -0.058),
            (-0.046, -0.055), (-0.037, -0.032)]
    poignee = biseauter(profil_lateral("det_poignee", grip, 0.033, P["orange"]), 0.004, 2)
    peindre_eclairage(poignee, P["orange_clair"], P["orange"], P["orange_ombre"])
    pieces.append(poignee)
    panel = [(-0.020, 0.031), (0.010, 0.031), (0.009, 0.010), (-0.013, -0.050),
             (-0.038, -0.047), (-0.029, -0.020)]
    for s in (-1, 1):
        plaquette = biseauter(profil_lateral("det_plaquette", panel, 0.0045, P["plaquettes"]), 0.002)
        plaquette.data.transform(Matrix.Translation((s * 0.018, 0, 0)))
        pieces.append(plaquette)
    # Anneau de dragonne sous la poignée.
    anneau = [Vector((0, -0.030, -0.058)), Vector((0, -0.036, -0.074)), Vector((0, -0.024, -0.082)),
              Vector((0, -0.014, -0.072)), Vector((0, -0.022, -0.058))]
    pieces.append(balayage("det_anneau", anneau, 0.004, 0.004, P["acier_clair"]))

    # Chien apparent, armé : la silhouette de l'arrière.
    pieces.append(balayage("det_chien", [Vector((0, -0.040, 0.056)), Vector((0, -0.050, 0.072)),
                          Vector((0, -0.047, 0.086)), Vector((0, -0.038, 0.084))], 0.008, 0.006, P["acier_sombre"]))
    return fusionner("pistolet_detresse", pieces)
