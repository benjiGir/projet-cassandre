import math

from mathutils import Vector

from weapons.config import PALETTE as P, BOUT_CANON_POMPE, CENTRE_FUT
from weapons.geometry import (pave, tube, balayage, prisme, profil_lateral, section_chanfreinee,
                              biseauter, conduit, peindre_eclairage, fusionner)


def construire_pompe():
    pieces = []
    profil = section_chanfreinee(0.053, 0.066, 0.144, 0.010)
    pieces.append(prisme("pompe_carcasse", -0.028, 0.205, profil,
                  [P["acier_sombre"], P["acier_sombre"], P["acier"], P["acier"],
                   P["acier_clair"], P["acier_clair"], P["acier"], P["acier_sombre"],
                   P["acier"], P["acier"]]))
    crosse = profil_lateral("pompe_crosse", [(-0.362, -0.114), (-0.362, 0.073),
                  (-0.142, 0.112), (-0.079, 0.084), (-0.015, 0.090),
                  (0.012, 0.063), (0.012, 0.025), (-0.031, -0.032),
                  (-0.098, -0.011), (-0.165, -0.046)], 0.042, P["bois"])
    biseauter(crosse, 0.008, 2)
    peindre_eclairage(crosse, "#b48146", P["bois"], P["bois_sombre"])
    pieces.append(crosse)
    pieces.append(biseauter(pave("pompe_talon", (0, -0.366, -0.020),
                                (0.048, 0.018, 0.195), P["scotch"]), 0.006))
    contour = [Vector((0, y, z)) for y, z in [(0.001, 0.067), (0.056, 0.067),
               (0.067, 0.055), (0.065, 0.032), (0.053, 0.022), (0.017, 0.022), (0.005, 0.035)]]
    pieces.append(balayage("pompe_pontet", contour, 0.012, 0.0055, P["acier_sombre"]))
    pieces.append(balayage("pompe_detente", [Vector((0, 0.040, 0.068)),
                   Vector((0, 0.029, 0.043)), Vector((0, 0.039, 0.033))], 0.006, 0.005, P["acier_sombre"]))

    canon = conduit("pompe_canon", (0, 0.194, 0.115), BOUT_CANON_POMPE,
                    0.0145, 0.0105, P["acier"], 12)
    peindre_eclairage(canon, P["acier_clair"], P["acier"], P["acier_sombre"])
    pieces.append(canon)
    pieces.append(tube("pompe_fond_canon", (0, 0.240, 0.115), (0, 0.242, 0.115), 0.0105, "#111215", 12))
    magasin = tube("pompe_magasin", (0, 0.20, 0.072), (0, 0.646, 0.072), 0.0125, P["acier"], 10)
    peindre_eclairage(magasin, P["acier_clair"], P["acier"], P["acier_sombre"])
    pieces.append(magasin)
    pieces.append(tube("pompe_bouchon", (0, 0.640, 0.072), (0, 0.658, 0.072), 0.0155, P["acier_sombre"], 10))
    pieces.append(pave("pompe_attache_canon", (0, 0.610, 0.094), (0.040, 0.021, 0.064), P["acier_sombre"]))
    pieces.append(pave("pompe_surete", (0, 0.002, 0.146), (0.012, 0.025, 0.006), P["scotch"]))
    pieces.append(pave("pompe_guidon", (0, 0.657, 0.134), (0.005, 0.012, 0.008), P["point"]))
    pieces.append(biseauter(pave("pompe_port_ejection", (0.0267, 0.121, 0.110),
                                (0.001, 0.077, 0.028), P["acier_sombre"]), 0.001))
    pieces.append(pave("pompe_verrou", (0.0274, 0.135, 0.110), (0.001, 0.048, 0.018), P["inox_ombre"]))
    for s in (-1, 1):
        pieces.append(pave("pompe_tringle", (s * 0.019, 0.275, 0.068),
                           (0.005, 0.255, 0.009), P["acier_sombre"]))
    dessus = [Vector((0, y, 0.134)) for y in (0.212, 0.537)]
    pieces.append(balayage("pompe_dessus_capot", dessus, 0.015, 0.003, P["acier"]))
    for i in range(8):
        y = 0.225 + i * 0.039
        arc = [Vector((0.019 * math.cos(a), y, 0.115 + 0.019 * math.sin(a)))
               for a in [j * math.pi / 6 for j in range(7)]]
        pieces.append(balayage("pompe_pare_chaleur", arc, 0.025, 0.003, P["acier"], Vector((0, 1, 0))))
    for s in (-1, 1):
        pieces.append(pave("pompe_rail_capot", (s * 0.019, 0.372, 0.115),
                           (0.003, 0.325, 0.010), P["acier_sombre"]))
    carcasse = fusionner("pompe", pieces)

    fut_pieces = []
    z = CENTRE_FUT[2]
    for i in range(19):
        y0, y1 = 0.222 + i * 0.010, 0.222 + (i + 1) * 0.010
        gorge = i % 2 == 1 and 2 <= i <= 16
        r = 0.031 if gorge else 0.035
        section = [(r * math.cos(a), z + r * math.sin(a) * 0.82)
                   for a in [j * math.tau / 10 for j in range(10)]]
        couleur = P["bois_sombre"] if gorge else P["bois"]
        ob = prisme("pompe_fut_rainure", y0, y1, section, [couleur] * 12)
        peindre_eclairage(ob, "#b48146" if not gorge else "#754823", couleur, P["bois_sombre"])
        fut_pieces.append(ob)
    return carcasse, fusionner("pompe_fut", fut_pieces)
