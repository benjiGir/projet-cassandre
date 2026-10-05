from mathutils import Matrix, Vector

from weapons.config import PALETTE as P, BOUT_CANON_PISTOLET
from weapons.geometry import (pave, tube, balayage, prisme, profil_lateral, section_chanfreinee,
                              biseauter, conduit, peindre_eclairage, fusionner)


def construire_pistolet(vue_subjective=False):
    k = 1.15 if vue_subjective else 1.0
    z = BOUT_CANON_PISTOLET[2]
    pieces = []
    profil = section_chanfreinee(0.029 * k, z - 0.017, z + 0.012, 0.0035)
    couleurs = [P["carcasse"], P["inox_ombre"], P["inox"], P["inox_clair"],
                P["inox_clair"], P["inox_clair"], P["inox"], P["inox_ombre"], P["inox"], P["inox"]]
    pieces.append(prisme("pist_arriere", -0.038, 0.039, profil, couleurs))
    pieces.append(prisme("pist_nez", 0.138, 0.156, profil, couleurs))
    for s in (-1, 1):
        rail = biseauter(pave("pist_rail", (s * 0.0122 * k, 0.0885, z - 0.009),
                             (0.0065 * k, 0.099, 0.017), P["inox"]), 0.0015)
        peindre_eclairage(rail, P["inox_clair"], P["inox"], P["inox_ombre"])
        pieces.append(rail)
        for i in range(6):
            strie = pave("pist_strie", (s * (0.0145 * k + 0.0002), -0.032 + i * 0.006, z - 0.003),
                         (0.001, 0.0025, 0.016), P["inox_ombre"])
            pieces.append(strie)
    canon = conduit("pist_canon", (0, 0.023, z), BOUT_CANON_PISTOLET, 0.0085 * k, 0.0055 * k,
                    P["inox_ombre"])
    peindre_eclairage(canon, P["inox"], P["inox_ombre"], P["acier_sombre"])
    pieces.append(canon)
    pieces.append(tube("pist_fond_canon", (0, 0.031, z), (0, 0.035, z), 0.0055 * k, "#101215", 12))
    pieces.append(tube("pist_tige", (0, 0.110, z - 0.024), (0, 0.153, z - 0.024), 0.005, P["acier"]))

    cadre = profil_lateral("pist_carcasse", [(-0.052, 0.040), (-0.043, 0.052), (0.035, 0.061),
                           (0.151, 0.061), (0.151, 0.043), (0.080, 0.043),
                           (0.009, 0.032), (-0.028, 0.012)], 0.032, P["carcasse"])
    biseauter(cadre, 0.003)
    peindre_eclairage(cadre, P["acier_clair"], P["carcasse"], P["acier_sombre"])
    pieces.append(cadre)
    contour = [Vector((0, y, h)) for y, h in [(0.010, 0.042), (0.060, 0.042), (0.075, 0.033),
               (0.075, 0.016), (0.065, 0.008), (0.015, 0.008), (0.007, 0.017)]]
    pieces.append(balayage("pist_pontet", contour, 0.011, 0.005, P["carcasse"]))
    pieces.append(balayage("pist_detente", [Vector((0, 0.043, 0.042)), Vector((0, 0.032, 0.025)),
                   Vector((0, 0.039, 0.017))], 0.006, 0.004, P["acier_sombre"]))

    grip = [(-0.020, 0.046), (0.018, 0.040), (0.021, 0.015), (-0.010, -0.058),
            (-0.046, -0.055), (-0.037, -0.032)]
    pieces.append(biseauter(profil_lateral("pist_poignee", grip, 0.033, P["carcasse"]), 0.004, 2))
    panel = [(-0.020, 0.031), (0.010, 0.031), (0.009, 0.010), (-0.013, -0.050),
             (-0.038, -0.047), (-0.029, -0.020)]
    for s in (-1, 1):
        plaquette = biseauter(profil_lateral("pist_plaquette", panel, 0.0045, P["plaquettes"]), 0.002)
        plaquette.data.transform(Matrix.Translation((s * 0.018, 0, 0)))
        pieces.append(plaquette)
        for y, h in [(-0.007, 0.018), (-0.026, -0.035)]:
            pieces.append(tube("pist_vis", (s * 0.0200, y, h), (s * 0.0206, y, h), 0.0025, P["inox"], 8))
        pieces.append(biseauter(pave("pist_surete", (s * 0.021, -0.024, 0.072),
                                    (0.009, 0.019, 0.006), P["acier_sombre"]), 0.001))
        pieces.append(tube("pist_repere", (s * 0.017, -0.025, 0.055),
                           (s * 0.0175, -0.025, 0.055), 0.0018, P["rouge"], 8))
    pieces.append(biseauter(pave("pist_chargeur", (0, -0.027, -0.059), (0.036, 0.040, 0.006), P["acier_sombre"]), 0.002))
    pieces.append(balayage("pist_chien", [Vector((0, -0.041, 0.059)), Vector((0, -0.050, 0.085)),
                          Vector((0, -0.042, 0.099)), Vector((0, -0.033, 0.095))], 0.008, 0.006, P["acier_sombre"]))
    for s in (-1, 1):
        pieces.append(pave("pist_hausse", (s * 0.0065, -0.030, 0.093), (0.007, 0.008, 0.008), P["acier_sombre"]))
        pieces.append(pave("pist_point", (s * 0.0065, -0.0345, 0.093), (0.003, 0.001, 0.003), P["point"]))
    pieces.append(pave("pist_guidon", (0, 0.148, 0.094), (0.004, 0.010, 0.007), P["acier_sombre"]))
    pieces.append(pave("pist_point_avant", (0, 0.148, 0.098), (0.003, 0.005, 0.001), P["point"]))
    return fusionner("pistolet", pieces)
