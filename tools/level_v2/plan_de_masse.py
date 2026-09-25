"""
Plan de masse du niveau v2 — source de vérité des cotes (jalon N6).

    python3 tools/level_v2/plan_de_masse.py            # rapport de contrôle
    python3 tools/level_v2/plan_de_masse.py --ascii    # vue de dessus ASCII
    python3 tools/level_v2/plan_de_masse.py --svg PATH # vue de dessus cotée

Pourquoi un script plutôt qu'un tableau dans un Markdown : les vérifications
du jalon N6 (« un seul sol praticable par colonne », « spawn hors
`attackRange` du point d'arrivée », « allée d'au moins 3 m ») sont des
calculs, pas des affirmations. Les tenir ici garantit qu'elles sont refaites
à chaque modification de cote, et que `build_*.py` (jalon N8) pourra lire les
mêmes rectangles au lieu de les recopier.

Repère : celui de Blender — X vers l'est, Y vers le nord, Z vers le haut,
mètres, grille de 0,25 m. `z` est l'altitude du SOL de l'espace.
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field

GRID = 0.25

# Valeurs lues dans le code du jeu, pas réécrites à la main ici sans source.
ATTACK_RANGE_SUIT = 16.0   # src/game/entities/suitConfig.ts
SIGHT_RANGE = 22.0         # suitConfig.ts / directorConfig.ts
EYE_HEIGHT = 1.6           # moveConfig.ts, suitConfig.ts
JUMP_HEIGHT = 1.1          # moveConfig.ts
USE_RANGE = 2.0            # loader.ts::USE_RANGE_METERS

# Budget RÉVISÉ, mesuré (ADR 0026, docs/systems/cout-de-rendu.md) : le
# chiffre de 200 000 triangles posé au jalon N1 l'avait été a priori, sans
# machine en face. 1,45 M de triangles coûtent 4,9 ms de GPU carte entière
# dans le champ. Ce sont les lampes qui ont un mur, pas les triangles.
BUDGET_DRAW_CALLS = 200
BUDGET_TRIANGLES = 1_500_000
BUDGET_LAMPES = 48

# Densité de triangles au m², mesurée : la salle d'essai de N4 fait
# 96 350 triangles pour 16 × 20 m, soit 301/m². C'est le plafond « rayon
# garni ». Les deux autres paliers sont des estimations, à recaler en N9.
# `forte` = rayon garni, le plafond mesuré. `elevee` = beaucoup de mobilier
# mais peu de petits objets (vitrines, gros électroménager). `moyenne` = du
# mobilier épars. `faible` = sol, piliers, quelques véhicules.
DENSITE_TRIS = {"forte": 300, "elevee": 180, "moyenne": 100, "faible": 30}


@dataclass
class Space:
    id: str
    nom: str
    x: tuple[float, float]
    y: tuple[float, float]
    z: float                     # altitude du sol
    hauteur: float               # hauteur sous plafond
    role: str
    duree: str = ""
    densite: str = "moyenne"     # pilote le budget de triangles
    ennemis: str = ""
    arrivee: tuple[float, float] | None = None   # où le joueur débouche
    # (nom, x, y, couvert) — `couvert` non nul autorise un spawn SOUS
    # `attackRange` du point d'arrivée : depuis l'ADR 0025, une rangée, un
    # pilier ou un meuble de plus de 1,6 m coupe réellement la ligne de vue.
    # La géométrie exacte ne se vérifie qu'au blockout (N8).
    spawns: list[tuple[str, float, float, str | None]] = field(default_factory=list)
    # Liaison en pente : (axe de descente, z au départ, z à l'arrivée).
    # L'axe est "+x" ou "+y" — le sol part de `z_depart` au bord bas de cet
    # axe et arrive à `z_arrivee` au bord haut. `None` = sol plat à `z`.
    rampe: tuple[str, float, float] | None = None
    # Repères de gameplay : (libellé, x, y, nature) avec nature ∈
    # {carte, secret, objet, porte, depart, soin, munitions}. Une trousse de
    # soin et une boîte de munitions portent leur quantité dans leur libellé
    # (« trousse de soin +25 ») : c'est lui que lit `build_blockout.py`, pas
    # une seconde table à tenir synchro. Un cinquième terme, facultatif, donne
    # une altitude AU-DESSUS du sol de l'espace : un repère posé sur un meuble
    # (le campement du secret 2, sur le toit des gondoles).
    reperes: list[tuple] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    couloir: bool = False
    # Espace atteint en GRIMPANT sur du mobilier (une caisse, un distributeur)
    # et non par le sol : le décrochement de son ouverture dépasse un saut, mais
    # le mobilier fait la marche. Le contrôle d'accessibilité le traite donc
    # dans les deux sens.
    grimpable: bool = False

    @property
    def largeur(self) -> float:
        return self.x[1] - self.x[0]

    @property
    def profondeur(self) -> float:
        return self.y[1] - self.y[0]

    @property
    def aire(self) -> float:
        return self.largeur * self.profondeur

    def chevauche(self, other: "Space") -> bool:
        return (
            self.x[0] < other.x[1] and other.x[0] < self.x[1]
            and self.y[0] < other.y[1] and other.y[0] < self.y[1]
        )


# --- Les dix espaces ---------------------------------------------------------
# Cotes calibrées sur la vitesse réelle du joueur (runSpeed 13 m/s,
# moveConfig.ts) et sur la consigne « voir grand » du 2026-09-12 : la salle
# d'essai de N4 (16 × 20 m) est un plancher, pas un gabarit.

SPACES: list[Space] = [
    Space(
        id="parking_ext", nom="Parking extérieur",
        x=(-24, 24), y=(-40, -4), z=0, hauteur=6.0, densite="faible",
        role="Spawn, tutoriel implicite, pied-de-biche",
        duree="0:45", arrivee=(0, -36),
        ennemis="2 Costards, scellés hors de portée — premier contact visuel, jamais punitif",
        spawns=[("suit_pk1", -14, -14, None), ("suit_pk2", 16, -12, None)],
        notes=[
            "Ciel ouvert : pas de dalle de plafond, murs de 6 m et un bâtiment en fond.",
            "`use_crowbar` sur le capot d'une voiture, à 12 m du spawn.",
        ],
        reperes=[
            ("départ", 0, -36, "depart"),
            ("pied-de-biche", -8, -28, "objet"),
        ],
    ),
    Space(
        id="galerie", nom="Galerie marchande",
        x=(-30, 30), y=(0, 16), z=0, hauteur=6.0, densite="elevee",
        role="Transit, gags, secret 1 (arrière-boutique du photomaton)",
        duree="1:00", arrivee=(0, 2),
        ennemis="3 Costards, dont 2 derrière les kiosques (occlusion réelle, ADR 0025)",
        spawns=[("suit_ga1", -22, 10, None), ("suit_ga2", 20, 11, None), ("suit_ga3", -6, 13, "kiosque central de la galerie")],
        notes=[
            "Verrière : la seule lumière naturelle du niveau, contraste avec la surface de vente.",
            "Machine à pinces (secret dérisoire) et photomaton contre le mur ouest : se servir du "
            "photomaton efface le pan de mur voisin, derrière lequel est le labo (secret 1).",
        ],
        reperes=[
            ("machine à pinces", -26, 6, "objet"),
            ("photomaton", -29, 6.5, "objet"),
        ],
    ),
    Space(
        id="cafeteria", nom="Cafétéria",
        x=(34, 56), y=(0, 20), z=0, hauteur=4.0, densite="moyenne",
        role="Optionnelle : soin, toilettes (Duke : +10 PV) derrière la porte est, secret 3 (bouche d'aération)",
        duree="0:30", arrivee=(35, 7),
        ennemis="2 Costards attablés — réveil à l'entrée",
        spawns=[("suit_ca1", 54, 5, None), ("suit_ca2", 52, 16, None)],
        notes=[
            "Comptoir de self : un des trois objets sans équivalent CC0, monté en volumes simples.",
            "Secret 3 : une caisse (1,0 m) puis un distributeur (1,9 m) mènent à la bouche "
            "d'aération du mur nord, et au local VMC derrière.",
        ],
        reperes=[
            # Récompense du détour : la seule trousse double avant les bureaux.
            ("trousse de soin +50", 52, 16, "soin"),
        ],
    ),
    Space(
        id="caisses", nom="Caisses",
        x=(-26, 26), y=(20, 44), z=0, hauteur=5.0, densite="moyenne",
        role="Premier vrai combat, fusil à pompe",
        duree="1:00", arrivee=(0, 22),
        ennemis="4 Costards, arrivée par les trouées entre caisses",
        spawns=[("suit_cs1", -18, 38, None), ("suit_cs2", 18, 38, None), ("suit_cs3", -6, 41, None), ("suit_cs4", 8, 41, None)],
        notes=[
            "Ligne de caisses en travers à y≈32, trouées de 2,5 m — obstacles de déplacement, PAS du couvert (1,10 m < 1,6 m).",
            "`use_pistol` posé sur un tapis de caisse, à 10 m de l'entrée — la première arme à feu.",
        ],
        reperes=[
            ("pistolet", 2, 30, "objet"),
            ("boîte de munitions +24", -18, 24, "munitions"),
            ("trousse de soin +25", -6, 41, "soin"),
        ],
    ),
    Space(
        id="hub", nom="Allée centrale (hub)",
        x=(-6, 6), y=(44, 92), z=0, hauteur=6.0, densite="moyenne",
        role="Carrefour : rayons à l'ouest, électroménager à l'est, réserve au nord",
        duree="—", arrivee=(0, 46),
        ennemis="2 Costards en patrouille, très visibles — le hub doit rester lisible",
        spawns=[("suit_hb1", 0, 76, None), ("suit_hb2", -2, 88, None)],
        notes=[
            "Micro d'annonces (`use_pa_mic`) au milieu, sur une estrade.",
            "Porte carte Argent au nord (sas y∈[92,96]).",
        ],
        reperes=[
            ("micro d'annonces", 0, 68, "objet"),
        ],
    ),
    Space(
        id="rayons", nom="Rayons",
        x=(-52, -10), y=(48, 84), z=0, hauteur=5.0, densite="forte",
        role="Combat en couloirs, carte Argent, surgelés, secret 2 (toit des gondoles)",
        duree="2:00", arrivee=(-11, 66),
        ennemis="6 Costards, embuscades dans les allées TRANSVERSALES uniquement",
        spawns=[("suit_ry1", -20, 54, "rangée de gondoles"), ("suit_ry2", -34, 56, None), ("suit_ry3", -44, 62, None),
                ("suit_ry4", -24, 74, "rangée de gondoles"), ("suit_ry5", -38, 78, None), ("suit_ry6", -48, 52, None)],
        notes=[
            "Reprise directe de la salle d'essai de N4 : mêmes rangées thématiques, mêmes néons.",
            "Deux allées transversales (y≈60 et y≈72) : c'est là que se posent les embuscades.",
            "`use_shotgun` à l'entrée est de l'allée transversale sud : l'arme arrive juste avant les combats en allée.",
            "Carte Argent derrière le comptoir du rayon frais.",
        ],
        reperes=[
            ("carte Argent", -48, 62, "carte"),
            ("fusil à pompe", -16, 60, "objet"),
            ("boîte de munitions +24", -30, 72, "munitions"),
            ("trousse de soin +25", -44, 62, "soin"),
            # Sur le TOIT de la rangée ouest, tronçon nord (2 m) : une caisse
            # d'un mètre au sud, puis deux allées transversales de 4 m à sauter.
            ("secret 2 — campement sur les gondoles", -47.5, 78, "secret", 2.0),
            ("boîte de munitions +36", -47.5, 79.75, "munitions", 2.0),
            ("trousse de soin +25", -47.5, 76.25, "soin", 2.0),
        ],
    ),
    Space(
        id="electro", nom="Électroménager / TV",
        x=(10, 46), y=(48, 80), z=0, hauteur=5.0, densite="elevee",
        role="Carte Or, mur d'écrans",
        duree="1:00", arrivee=(11, 62),
        ennemis="5 Costards, dont 2 derrière le mur d'écrans",
        spawns=[("suit_el1", 20, 52, "cabine de démonstration"), ("suit_el2", 32, 54, None), ("suit_el3", 40, 62, None),
                ("suit_el4", 26, 74, None), ("suit_el5", 38, 76, None)],
        notes=[
            "Mur d'écrans : géométrie posée, le rendu dans une texture reste hors scope (reliquat Phase 5).",
            "Carte Or dans la cabine de démonstration du coin nord-est, ouverte au sud, devant le téléviseur.",
        ],
        reperes=[
            ("carte Or", 43, 75.25, "carte"),
            ("boîte de munitions +24", 14, 52, "munitions"),
            ("trousse de soin +25", 40, 62, "soin"),
            ("mur d'écrans", 30, 50, "objet"),
        ],
    ),
    Space(
        id="reserve", nom="Réserve / quai",
        x=(-24, 20), y=(96, 132), z=0, hauteur=8.0, densite="moyenne",
        role="Verticalité (mezzanine), gros combat, accès au parking souterrain",
        duree="1:15", arrivee=(0, 98),
        ennemis="7 Costards, dont 2 sur la mezzanine (le pathfinding 2.5D les gère depuis M4)",
        spawns=[("suit_rs1", -16, 108, None), ("suit_rs2", 12, 110, None), ("suit_rs3", -8, 118, None),
                ("suit_rs4", 6, 120, None), ("suit_rs5", -20, 126, None), ("suit_rs6", -12, 128, None),
                ("suit_rs7", 14, 128, None)],
        notes=[
            "Racks de 6 m : couvert réel, un Costard posté derrière reste `idle` (ADR 0025).",
            "Mezzanine au nord, z=3.0 — rien de praticable dessous (contrainte de colonne).",
            "La rampe de quai descend au parking souterrain ; son dessous est plein.",
        ],
        # Au sud, jamais sous la mezzanine : le plus gros combat du niveau.
        reperes=[
            ("boîte de munitions +24", -6, 100, "munitions"),
            ("trousse de soin +25", -6, 112, "soin"),
            ("trousse de soin +25", 12, 110, "soin"),
        ],
    ),
    Space(
        id="souterrain", nom="Parking souterrain",
        x=(28, 76), y=(92, 124), z=-6.0, hauteur=3.5, densite="faible",
        role="Tension, embuscade entre les piliers",
        duree="1:00", arrivee=(30, 116),
        ennemis="6 Costards, dispersés entre les piliers — la seule zone où l'occlusion fait tout le travail",
        spawns=[("suit_so1", 40, 100, None), ("suit_so2", 52, 104, None), ("suit_so3", 64, 110, None),
                ("suit_so4", 44, 116, "pilier"), ("suit_so5", 58, 118, None), ("suit_so6", 70, 114, None)],
        notes=[
            "Hauteur 3,5 m, piliers tous les 8 m : pénombre, portée de vue coupée en permanence.",
            "Décalé à l'est de la réserve, jamais SOUS un espace praticable (contrainte de colonne).",
        ],
        reperes=[
            ("boîte de munitions +24", 40, 104, "munitions"),
            ("trousse de soin +25", 64, 110, "soin"),
        ],
    ),
    Space(
        # À l'ÉTAGE (retour de playtest du 2026-09-18 : « un étage avec les
        # bureaux de l'hypermarché et au bout le bureau du directeur »). Posé au-
        # dessus d'un vide : rien de praticable dessous, contrainte de colonne.
        id="bureaux", nom="Étage des bureaux",
        x=(-30, 8), y=(150, 166), z=4.0, hauteur=3.0, densite="moyenne",
        role="L'administration du magasin : un couloir, quatre bureaux, et le Directeur au bout",
        duree="0:45", arrivee=(5, 151),
        ennemis="2 Costards dans les bureaux, en embuscade derrière les cloisons",
        spawns=[("suit_bu1", -16, 161, None), ("suit_bu3", 2, 161, "cloison de la salle de pause")],
        notes=[
            "On y monte par l'escalier de service, derrière la porte carte Or.",
            "Couloir au sud (y 150..154,5), quatre bureaux au nord : sécurité, comptabilité, "
            "ressources humaines, salle de pause. Le bureau du Directeur ferme le couloir à l'ouest.",
        ],
        reperes=[
            ("boîte de munitions +36", 4, 162, "munitions"),
            # Devant la porte du Directeur : laissée au sol si le joueur arrive
            # en forme, elle attend qu'il revienne la chercher en plein combat.
            ("trousse de soin +50", -27, 152, "soin"),
        ],
    ),
    Space(
        id="direction", nom="Bureau du Directeur",
        x=(-44, -30), y=(146, 166), z=4.0, hauteur=3.5, densite="moyenne",
        role="Le Directeur, puis l'issue de secours (carte Platine)",
        duree="1:00", arrivee=(-31, 152.25),
        ennemis="1 Directeur + 1 Costard garde du corps",
        spawns=[("director_bu1", -38, 159, "salle du boss — la révélation doit être immédiate"),
                ("suit_bu2", -33, 147.5, "salle du boss — intention explicite")],
        notes=[
            "Salle de confrontation : le Directeur est volontairement SOUS `attackRange`, "
            "la révélation doit être immédiate (même choix qu'en Zone E).",
            "`door_exit` au nord : l'issue de secours, déverrouillée par la carte Platine lâchée à sa mort.",
        ],
        reperes=[
            ("carte Platine (Directeur)", -38, 159, "carte"),
            ("SORTIE", -37, 166, "porte"),
        ],
    ),
    # Posé AVANT les cachettes : le SVG numérote les espaces dans cet ordre, et
    # la doc suit cette numérotation pour les dix premiers.
    Space(
        id="toilettes", nom="Toilettes",
        x=(56, 64), y=(6, 16), z=0, hauteur=3.0, densite="moyenne",
        role="Optionnelles, au fond de la cafétéria : les cuvettes et urinoirs sont "
             "utilisables et cassables façon Duke — +10 PV en se soulageant (délai 220 s), "
             "+1 PV par gorgée à l'eau d'un sanitaire cassé",
        duree="0:10", arrivee=(57, 11),
        ennemis="aucun — une cabine fermée, des chaussures dépassent sous la porte",
        notes=[
            "Jusqu'au 2026-09-24, les toilettes n'étaient qu'un `use_toilet` flottant au milieu "
            "de la cafétéria : un cube, pas une pièce.",
            "Trois cabines au nord, deux lavabos et leurs miroirs au sud, deux urinoirs à l'est.",
            "Même jour, passe suivante : cuvettes et urinoirs deviennent des `sanitaire_*` — "
            "le +1 PV de la chasse d'eau (un `use_*` qui aurait volé l'appui sur E à la cuvette "
            "voisine) cède la place à la mécanique Duke, directement sur l'appareil. La plaque "
            "de chasse (`wc_plaque_chasse`) reste, en décor.",
        ],
        reperes=[
            # Position de la plaque de chasse d'eau (décor) au-dessus du réservoir
            # de la première cabine, sur le mur nord — plus un `use_*`.
            ("toilettes +10 PV", 60.5, 15.75, "objet"),
        ],
    ),
    Space(
        id="secret1", nom="Labo du photomaton (secret 1)",
        x=(-36, -30), y=(2, 10), z=0, hauteur=3.5, densite="faible",
        role="Secret 1 : l'arrière-boutique du photomaton, derrière un pan de mur",
        notes=["`use_photomaton` (le photomaton lui-même) ouvre `door_secret_photomaton`, le pan de mur voisin."],
        reperes=[
            ("secret 1 — labo photo", -33, 6, "secret"),
            ("trousse de soin +50", -34.75, 3.75, "soin"),
            ("boîte de munitions +36", -34.75, 8.5, "munitions"),
        ],
    ),
    Space(
        id="secret3", nom="Local VMC (secret 3)",
        x=(35, 41), y=(20, 24), z=2.0, hauteur=2.5, densite="faible", grimpable=True,
        role="Secret 3 : derrière la bouche d'aération de la cafétéria",
        reperes=[
            ("secret 3 — aération", 38.5, 22, "secret"),
            ("trousse de soin +50", 40, 21, "soin"),
        ],
    ),
]

# --- Liaisons ----------------------------------------------------------------
CORRIDORS: list[Space] = [
    Space(id="c_pk_ga", nom="Portes automatiques", x=(-4, 4), y=(-4, 0), z=0, hauteur=4.0,
          role="parking extérieur → galerie", couloir=True, densite="faible"),
    Space(id="c_ga_cf", nom="Passage cafétéria", x=(30, 34), y=(4, 10), z=0, hauteur=4.0,
          role="galerie → cafétéria (optionnel)", couloir=True, densite="faible"),
    Space(id="c_ga_cs", nom="Entrée du magasin", x=(-6, 6), y=(16, 20), z=0, hauteur=5.0,
          role="galerie → caisses", couloir=True, densite="faible"),
    Space(id="c_hb_ry", nom="Tête d'allée ouest", x=(-10, -6), y=(60, 72), z=0, hauteur=5.0,
          role="hub ↔ rayons", couloir=True, densite="faible"),
    Space(id="c_hb_el", nom="Tête d'allée est", x=(6, 10), y=(56, 68), z=0, hauteur=5.0,
          role="hub ↔ électroménager", couloir=True, densite="faible"),
    Space(id="c_hb_rs", nom="Sas carte Argent", x=(-6, 6), y=(92, 96), z=0, hauteur=4.0,
          role="hub → réserve, porte carte Argent", couloir=True, densite="faible",
          reperes=[("porte Argent", 0, 94, "porte")]),
    Space(id="c_rs_so", nom="Rampe de quai", x=(20, 28), y=(104, 116), z=-6.0, hauteur=4.0,
          role="réserve (z=0) → parking souterrain (z=-6), descend vers l'est, 37°",
          couloir=True, densite="faible", rampe=("+x", 0.0, -6.0)),
    Space(id="c_so_bu", nom="Rampe de sortie", x=(36, 44), y=(124, 132), z=-6.0, hauteur=4.0,
          role="parking souterrain (z=-6) → couloir des bureaux (z=0), remonte vers le nord, 37°",
          couloir=True, densite="faible", rampe=("+y", -6.0, 0.0)),
    Space(id="c_bu", nom="Couloir du personnel", x=(0, 44), y=(132, 140), z=0, hauteur=4.0,
          role="rampe de sortie → escalier des bureaux (porte carte Or) et couloir de service",
          couloir=True, densite="faible",
          reperes=[("porte Or", 5, 140, "porte")]),
    Space(id="c_escalier", nom="Escalier des bureaux", x=(2, 8), y=(140, 150), z=0.0, hauteur=3.0,
          role="couloir du personnel (z=0) → étage des bureaux (z=4), porte carte Or en bas, 22°",
          couloir=True, densite="faible", rampe=("+y", 0.0, 4.0)),
    # Le raccourci vers la surface de vente. Il débouchait EN SURPLOMB des
    # rayons, 3 m plus haut (« on saute dedans ») — retour de playtest du
    # 2026-09-18 : « le bout du couloir amène aux rayons mais on se trouve en
    # hauteur ». Il reste de plain-pied, et c'est une PORTE COUPE-FEU qui fait
    # le sens unique : elle ne s'ouvre que du côté du personnel.
    Space(id="c_short_ramp", nom="Couloir de service", x=(-36, 0), y=(132, 140), z=0.0, hauteur=4.0,
          role="raccourci : du couloir du personnel vers la porte coupe-feu des rayons",
          couloir=True, densite="faible"),
    Space(id="c_short_w", nom="Couloir de la porte coupe-feu", x=(-44, -36), y=(84, 140), z=0.0, hauteur=4.0,
          role="raccourci : longe les rayons jusqu'à la porte coupe-feu, qui ne s'ouvre que de ce côté",
          couloir=True, densite="faible",
          reperes=[("porte coupe-feu", -42.5, 84, "porte")]),
]

ALL = SPACES + CORRIDORS


def sur_grille(v: float) -> bool:
    return abs(v / GRID - round(v / GRID)) < 1e-6


def rapport() -> list[str]:
    out: list[str] = []
    a = lambda s: out.append(s)

    a("PLAN DE MASSE — NIVEAU V2 (jalon N6)")
    a("=" * 60)

    aire_espaces = sum(s.aire for s in SPACES)
    aire_couloirs = sum(s.aire for s in CORRIDORS)
    xs = [s.x[0] for s in ALL] + [s.x[1] for s in ALL]
    ys = [s.y[0] for s in ALL] + [s.y[1] for s in ALL]
    a(f"Emprise totale     : {max(xs) - min(xs):.0f} × {max(ys) - min(ys):.0f} m "
      f"(x ∈ [{min(xs):.0f}, {max(xs):.0f}], y ∈ [{min(ys):.0f}, {max(ys):.0f}])")
    a(f"Surface praticable : {aire_espaces:.0f} m² d'espaces + {aire_couloirs:.0f} m² de liaisons "
      f"= {aire_espaces + aire_couloirs:.0f} m²")
    a(f"Rappel salle d'essai N4 : 320 m² — le niveau fait {(aire_espaces + aire_couloirs) / 320:.0f}× cette surface")

    a("")
    a("Espaces")
    a("-" * 60)
    for s in SPACES:
        a(f"  {s.nom:<24} {s.largeur:>5.1f} × {s.profondeur:<5.1f} m  "
          f"h={s.hauteur:>3.1f}  z={s.z:>4.1f}  {s.aire:>6.0f} m²  densité {s.densite}")

    # --- Contrôle 1 : grille ------------------------------------------------
    a("")
    a("Contrôle — grille de 0,25 m")
    a("-" * 60)
    hors = [f"{s.id} ({v})" for s in ALL for v in (*s.x, *s.y, s.z, s.hauteur) if not sur_grille(v)]
    a("  OK, toutes les cotes sont sur la grille" if not hors else "  HORS GRILLE : " + ", ".join(hors))

    # --- Contrôle 2 : un seul sol praticable par colonne --------------------
    a("")
    a("Contrôle — un seul sol praticable par colonne (pathfinding 2.5D)")
    a("-" * 60)
    conflits = []
    for i, s in enumerate(ALL):
        for t in ALL[i + 1:]:
            if s.chevauche(t) and abs(s.z - t.z) > 1e-6:
                conflits.append(f"{s.id} (z={s.z}) × {t.id} (z={t.z})")
    a("  OK, aucun espace praticable au-dessus d'un autre" if not conflits
      else "  CONFLIT : " + " ; ".join(conflits))

    # --- Contrôle 3 : chevauchements de même altitude -----------------------
    a("")
    a("Contrôle — chevauchements à altitude égale")
    a("-" * 60)
    doubles, internes = [], []
    for i, s in enumerate(ALL):
        for t in ALL[i + 1:]:
            if not (s.chevauche(t) and abs(s.z - t.z) <= 1e-6):
                continue
            if s.dans == t.id or t.dans == s.id:
                internes.append(f"{s.id} dans {t.id}")
            else:
                doubles.append(f"{s.id} × {t.id}")
    a("  OK, aucun recouvrement" if not doubles else "  RECOUVREMENT : " + " ; ".join(doubles))
    for i in internes:
        a(f"  rampe interne déclarée : {i} — son DESSOUS doit être plein "
          f"(sinon deux sols dans la même colonne)")

    # --- Contrôle 4 : spawns hors attackRange du point d'arrivée ------------
    a("")
    a(f"Contrôle — spawns hors attackRange ({ATTACK_RANGE_SUIT:.0f} m) du point d'arrivée du joueur")
    a("-" * 60)
    for s in SPACES:
        if not s.arrivee or not s.spawns:
            continue
        ax, ay = s.arrivee
        distances = [(n, math.hypot(x - ax, y - ay), cover) for n, x, y, cover in s.spawns]
        nus = [(n, d) for n, d, cover in distances if d < ATTACK_RANGE_SUIT and cover is None]
        couverts = [(n, d, cover) for n, d, cover in distances if d < ATTACK_RANGE_SUIT and cover]
        if nus:
            a(f"  {s.nom:<24} À DÉCOUVERT ET TROP PRÈS : "
              + ", ".join(f"{n} à {d:.1f} m" for n, d in nus))
        else:
            a(f"  {s.nom:<24} OK, le plus proche à découvert à "
              f"{min([d for _, d, c in distances if c is None], default=float('inf')):.1f} m")
        for n, d, cover in couverts:
            a(f"  {'':<24} └ {n} à {d:.1f} m, couvert déclaré : {cover} (à vérifier au blockout, N8)")

    # --- Contrôle 5 : spawns dans l'emprise de leur espace ------------------
    a("")
    a("Contrôle — chaque spawn tombe dans l'emprise de son espace")
    a("-" * 60)
    dehors = [f"{s.id}/{n}" for s in SPACES for n, x, y, _ in s.spawns
              if not (s.x[0] < x < s.x[1] and s.y[0] < y < s.y[1])]
    a("  OK" if not dehors else "  HORS EMPRISE : " + ", ".join(dehors))

    # --- Contrôle 6 : ouvertures et connectivité -----------------------------
    a("")
    a("Ouvertures — dérivées des façades partagées")
    a("-" * 60)
    larges = []
    for o in sorted(openings(), key=lambda k: (k.a, k.b)):
        marque = ""
        if o.largeur > 14.0:
            marque = "  <<< TROP LARGE : jonction de flanc, pas de face"
            larges.append(f"{o.a}/{o.b}")
        a(f"  {o.a:<12} ↔ {o.b:<12} {o.axe}={o.at:>7.1f}  "
          f"{o.span[0]:>6.1f}..{o.span[1]:<6.1f} ({o.largeur:>4.1f} m)  z={o.z:>4.1f}{marque}")
    if larges:
        a(f"  >>> {len(larges)} jonction(s) à redresser : " + ", ".join(larges))

    a("")
    a("Jonctions volontairement murées")
    a("-" * 60)
    for paire in sorted(map(sorted, JONCTIONS_SCELLEES)):
        a(f"  {paire[0]:<12} × {paire[1]}")

    a("")
    a("Passages à sens unique — par décrochement, pas par mécanisme")
    a("-" * 60)
    uniques = [o for o in openings() if o.sens_unique
               and not ({o.a, o.b} & {sp.id for sp in ALL if sp.grimpable})]
    if not uniques and not PORTES_SENS_UNIQUE:
        a("  aucun")
    for o in uniques:
        depuis, vers = o.sens_unique
        a(f"  {depuis:<14} → {vers:<14} on descend de {o.decrochement:.1f} m, "
          f"le saut en monte {JUMP_HEIGHT:.1f}")
    for (depuis, vers) in PORTES_SENS_UNIQUE.values():
        a(f"  {depuis:<14} → {vers:<14} porte qui ne s'ouvre que du côté {depuis}")

    a("")
    a("Contrôle — tout espace est atteignable depuis le spawn")
    a("-" * 60)
    joignables = accessibles()
    isoles = [sp.nom for sp in SPACES if sp.id not in joignables]
    a(f"  OK, les {len(SPACES)} espaces sont reliés" if not isoles else "  ISOLÉ(S) : " + ", ".join(isoles))

    a("")
    a("Contrôle — chaque porte à carte commande bien son secteur")
    a("-" * 60)
    for goulot, carte, attendus in GOULOTS:
        sans = accessibles(sans=goulot)
        fuites = [x for x in attendus if x in sans]
        if fuites:
            a(f"  {carte:<14} FUITE : {', '.join(fuites)} atteignable(s) sans passer par {goulot}")
        else:
            a(f"  {carte:<14} OK — {', '.join(attendus)} hors d'atteinte sans {goulot}")

    # --- Contrôle 7 : budget de triangles ------------------------------------
    a("")
    a("Budget de triangles — estimation par densité")
    a("-" * 60)
    total = 0
    for sp in SPACES:
        t = sp.aire * DENSITE_TRIS[sp.densite]
        total += t
        a(f"  {sp.nom:<24} {sp.aire:>6.0f} m² × {DENSITE_TRIS[sp.densite]:>3}/m² = {t:>9,.0f}".replace(",", " "))
    total += sum(c.aire * DENSITE_TRIS[c.densite] for c in CORRIDORS)
    a(f"  {'TOTAL (liaisons comprises)':<24} {total:>28,.0f}".replace(",", " "))
    a(f"  Budget mesuré (ADR 0026) : {BUDGET_TRIANGLES:,} triangles et {BUDGET_LAMPES} lampes par image".replace(",", " "))
    if total > BUDGET_TRIANGLES:
        a(f"  >>> {total / BUDGET_TRIANGLES:.1f}× le budget, carte entière dessinée.")
    else:
        a(f"  OK — {total / BUDGET_TRIANGLES:.0%} du budget, même carte entière dans le champ")
        a("      (mesuré : 1,45 M de triangles = 4,9 ms de GPU, ADR 0026). Le mur est")
        a("      ailleurs : 254 lampes allumées et le shader ne compile plus. D'où un")
        a(f"      pool de {BUDGET_LAMPES} lampes, et la fusion PAR ESPACE plutôt que par niveau.")

    a("")
    a("Pire cas visible — un espace et ses voisins immédiats")
    a("-" * 60)
    for sp, voisins in PIRE_CAS:
        vus = [x for x in SPACES if x.id in {sp, *voisins}]
        t = sum(x.aire * DENSITE_TRIS[x.densite] for x in vus)
        etat = "OK" if t <= BUDGET_TRIANGLES else "AU-DESSUS"
        a(f"  {', '.join(x.nom for x in vus):<58} {t:>9,.0f}  {etat}".replace(",", " "))

    # --- Contrôle 8 : total d'ennemis ---------------------------------------
    a("")
    a("Effectif")
    a("-" * 60)
    suits = sum(1 for s in SPACES for n, *_ in s.spawns if n.startswith("suit"))
    directors = sum(1 for s in SPACES for n, *_ in s.spawns if n.startswith("director"))
    a(f"  {suits} Costards + {directors} Directeur "
      f"(niveau actuel `hypermarche_complet` : 13 Costards + 1 Directeur)")

    return out


# Groupes réellement visibles ensemble depuis un point de jeu : une porte ou
# une tête d'allée ne laisse voir qu'un espace voisin à la fois.
PIRE_CAS = [
    ("hub", ("rayons", "electro")),
    ("rayons", ("hub",)),
    ("caisses", ("hub", "galerie")),
    ("reserve", ("hub",)),
]

ASCII_SCALE_X, ASCII_SCALE_Y = 1 / 2.0, 1 / 4.0


def ascii_map() -> list[str]:
    xs = [s.x[0] for s in ALL] + [s.x[1] for s in ALL]
    ys = [s.y[0] for s in ALL] + [s.y[1] for s in ALL]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w = int((x1 - x0) * ASCII_SCALE_X) + 1
    h = int((y1 - y0) * ASCII_SCALE_Y) + 1
    grid = [[" "] * w for _ in range(h)]

    def put(space: Space, ch: str) -> None:
        cx0 = int((space.x[0] - x0) * ASCII_SCALE_X)
        cx1 = int((space.x[1] - x0) * ASCII_SCALE_X)
        cy0 = int((space.y[0] - y0) * ASCII_SCALE_Y)
        cy1 = int((space.y[1] - y0) * ASCII_SCALE_Y)
        for cy in range(cy0, min(cy1, h - 1)):
            for cx in range(cx0, min(cx1, w - 1)):
                grid[cy][cx] = ch

    for s in CORRIDORS:
        put(s, "·")
    # Un seul caractère par espace : au-delà de 9, on passe aux lettres.
    def jeton(i: int) -> str:
        return str(i + 1) if i < 9 else chr(ord("A") + i - 9)

    for i, s in enumerate(SPACES):
        put(s, jeton(i))

    lines = ["".join(row).rstrip() for row in reversed(grid)]   # nord en haut
    legend = [f"  {jeton(i)} {s.nom}" for i, s in enumerate(SPACES)] + ["  · liaisons"]
    return lines + [""] + legend


# --- Ouvertures et connectivité ---------------------------------------------

TOLERANCE = 1e-6


@dataclass(frozen=True)
class Opening:
    """Passage entre deux rectangles qui se touchent par une façade.

    DÉRIVÉ, jamais écrit à la main : deux rectangles qui partagent une ligne
    de façade avec un recouvrement non nul sont reliés par cette ouverture.
    C'est ce qui oblige le plan à n'avoir que des jonctions DE FACE — une
    liaison qui longerait sa voisine sur 28 m produirait ici une ouverture de
    28 m, immédiatement visible dans le rapport.
    """
    a: str
    b: str
    axe: str                      # "x" : façade verticale x=`at` ; "y" : façade horizontale
    at: float
    span: tuple[float, float]     # étendue de l'ouverture sur l'autre axe
    z_a: float                    # altitude du sol côté `a`
    z_b: float                    # altitude du sol côté `b`

    @property
    def largeur(self) -> float:
        return self.span[1] - self.span[0]

    @property
    def z(self) -> float:
        """Altitude de référence du passage — la plus basse des deux."""
        return min(self.z_a, self.z_b)

    @property
    def decrochement(self) -> float:
        return abs(self.z_a - self.z_b)

    @property
    def sens_unique(self) -> tuple[str, str] | None:
        """Un décrochement qu'aucun saut ne remonte ne se franchit que vers le
        bas. C'est de la géométrie, pas une règle de jeu : le moteur n'a
        AUCUN système de passage à sens unique, et n'en a pas besoin."""
        if self.decrochement <= JUMP_HEIGHT:
            return None
        return (self.a, self.b) if self.z_a > self.z_b else (self.b, self.a)


# Deux rectangles qui se touchent ne communiquent pas forcément. Ces
# jonctions-là sont des MURS, décidés : un couloir de service qui longe la
# réserve ou les bureaux ouvrirait sinon un raccourci qui contourne une porte
# à carte, et la progression du niveau tomberait. Le contrôle des goulots
# ci-dessous vérifie que ces murs tiennent réellement.
JONCTIONS_SCELLEES: set[frozenset[str]] = {
    frozenset({"reserve", "c_bu"}),        # les bureaux ne s'atteignent que par le souterrain
    frozenset({"reserve", "c_short_ramp"}), # idem, côté raccourci
}


# Portes qui ne s'ouvrent que d'UN côté : (depuis, vers). La géométrie ne le
# dit pas — les deux sols sont de plain-pied —, c'est la porte qui le fait :
# son `use_*` n'est à portée que du côté `depuis`. Une fois ouverte, elle le
# reste, et le raccourci devient praticable dans les deux sens : c'est le
# raccourci à la Doom, qu'on débloque en l'ayant mérité.
# Passages ÉTROITS : (largeur, centre sur l'axe de la façade). Sans eux, deux
# espaces qui se touchent communiquent sur toute la longueur de leur façade
# commune — 16 m entre le couloir de l'étage et le bureau du Directeur, 8 m de
# mur « secret » ouvert sur la galerie. Toutes les cotes sur la grille.
PASSAGES: dict[frozenset[str], tuple[float, float]] = {
    frozenset({"bureaux", "direction"}): (2.0, 152.25),   # la porte capitonnée du Directeur, dans l'axe du couloir
    # Les portes va-et-vient « PRIVÉ » de la réserve : le bout nord du hub était
    # ouvert sur 12 m, un sas vide avant le rideau de la carte Argent.
    frozenset({"hub", "c_hb_rs"}): (2.0, 0.0),
    frozenset({"galerie", "secret1"}): (1.5, 8.25),       # le pan de mur qui s'efface
    frozenset({"cafeteria", "secret3"}): (2.0, 36.5),     # la bouche d'aération
    frozenset({"cafeteria", "toilettes"}): (1.0, 11.0),   # la porte des WC, à 1 m comme celles des bureaux
    # Dans l'axe de l'allée entre les rangées 0 et 1 : centrée sur x = −40, la
    # porte donnait sur le bout d'une gondole à deux mètres.
    frozenset({"c_short_w", "rayons"}): (2.5, -42.5),     # la porte coupe-feu
}

PORTES_SENS_UNIQUE: dict[frozenset[str], tuple[str, str]] = {
    frozenset({"c_short_w", "rayons"}): ("c_short_w", "rayons"),
}


def _recouvrement(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float] | None:
    lo, hi = max(a[0], b[0]), min(a[1], b[1])
    return (lo, hi) if hi - lo > TOLERANCE else None


def _sol_au_bord(space: Space, axe: str, at: float) -> float:
    """Altitude du sol d'un espace au droit d'une façade — le bout haut ou bas
    d'une rampe, son `z` sinon."""
    if not space.rampe:
        return space.z
    sens, z0, z1 = space.rampe
    bord_bas = space.x[0] if sens == "+x" else space.y[0]
    bord_haut = space.x[1] if sens == "+x" else space.y[1]
    if abs(at - bord_bas) < TOLERANCE:
        return z0
    if abs(at - bord_haut) < TOLERANCE:
        return z1
    return min(z0, z1)


def openings() -> list[Opening]:
    trouvees = _openings_bruts()
    retrecies = []
    for o in trouvees:
        passage = PASSAGES.get(frozenset({o.a, o.b}))
        if passage:
            largeur, centre = passage
            o = Opening(o.a, o.b, o.axe, o.at, (centre - largeur / 2, centre + largeur / 2), o.z_a, o.z_b)
        retrecies.append(o)
    return retrecies


def _openings_bruts() -> list[Opening]:
    trouvees: list[Opening] = []
    for i, s in enumerate(ALL):
        for t in ALL[i + 1:]:
            if frozenset({s.id, t.id}) in JONCTIONS_SCELLEES:
                continue
            # Façade verticale commune : le bord droit de l'un = le bord gauche de l'autre.
            for gauche, droite in ((s, t), (t, s)):
                if abs(gauche.x[1] - droite.x[0]) < TOLERANCE:
                    span = _recouvrement(gauche.y, droite.y)
                    if span:
                        at = gauche.x[1]
                        trouvees.append(Opening(gauche.id, droite.id, "x", at, span,
                                                _sol_au_bord(gauche, "x", at),
                                                _sol_au_bord(droite, "x", at)))
            for bas, haut in ((s, t), (t, s)):
                if abs(bas.y[1] - haut.y[0]) < TOLERANCE:
                    span = _recouvrement(bas.x, haut.x)
                    if span:
                        at = bas.y[1]
                        trouvees.append(Opening(bas.id, haut.id, "y", at, span,
                                                _sol_au_bord(bas, "y", at),
                                                _sol_au_bord(haut, "y", at)))
    return trouvees


# Ce que chaque porte à carte doit commander : sans elle, ces espaces sont
# hors d'atteinte. C'est la progression du niveau, exprimée en une ligne
# vérifiable plutôt qu'en intention.
GOULOTS: list[tuple[str, str, tuple[str, ...]]] = [
    ("c_hb_rs", "carte Argent", ("reserve", "souterrain", "bureaux", "direction")),
    ("c_escalier", "carte Or", ("bureaux", "direction")),
]


def accessibles(depuis: str = "parking_ext", sans: str | None = None) -> set[str]:
    """Espaces atteignables depuis `depuis` en ne passant que par les
    ouvertures. Un espace absent du résultat est injouable, point. `sans`
    retire un espace du graphe — c'est ainsi qu'on vérifie qu'une porte
    commande bien son secteur."""
    voisins: dict[str, set[str]] = {sp.id: set() for sp in ALL if sp.id != sans}
    grimpables = {sp.id for sp in ALL if sp.grimpable}
    for o in openings():
        if sans in (o.a, o.b):
            continue
        oriente = PORTES_SENS_UNIQUE.get(frozenset({o.a, o.b}))
        if oriente is None and not ({o.a, o.b} & grimpables):
            oriente = o.sens_unique
        if oriente:
            voisins[oriente[0]].add(oriente[1])
        else:
            voisins[o.a].add(o.b)
            voisins[o.b].add(o.a)
    vus, pile = {depuis}, [depuis]
    while pile:
        courant = pile.pop()
        for v in voisins[courant]:
            if v not in vus:
                vus.add(v)
                pile.append(v)
    return vus


# --- Vue de dessus cotée, en SVG ---------------------------------------------

PX_PAR_M = 4.0
MARGE = 56.0
# Place à droite pour les étiquettes des repères : sans elle, celles des pièces
# du bord est (toilettes, souterrain) partaient vers la gauche, sur leurs voisines.
MARGE_DROITE = 100.0
# Sous ce côté, en pixels, un espace ne porte que son numéro ; son nom va dans la
# légende du bas. Un titre vertical dans une pièce de 6 m débordait sur la voisine.
PETIT_ESPACE_PX = 48

COULEUR = {
    "forte": "#c8622f",
    "elevee": "#c89a2f",
    "moyenne": "#5f8b6a",
    "faible": "#4a6076",
}


# Repères de gameplay sur la carte : couleur et symbole par nature.
STYLE_REPERES = {
    "carte": ("#8fe3ff", "◆"),
    "secret": ("#c58fff", "★"),
    "objet": ("#8fffb4", "●"),
    "porte": ("#ff8f8f", "▮"),
    "depart": ("#6fd3ff", "▶"),
    "soin": ("#5fe07a", "✚"),
    "munitions": ("#e0b45f", "▪"),
}


def svg() -> str:
    xs = [s.x[0] for s in ALL] + [s.x[1] for s in ALL]
    ys = [s.y[0] for s in ALL] + [s.y[1] for s in ALL]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w = (x1 - x0) * PX_PAR_M + 2 * MARGE + MARGE_DROITE
    h = (y1 - y0) * PX_PAR_M + 2 * MARGE

    def px(x: float) -> float:
        return MARGE + (x - x0) * PX_PAR_M

    def py(y: float) -> float:                       # nord en haut
        return h - MARGE - (y - y0) * PX_PAR_M

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
        f'width="{w:.0f}" height="{h:.0f}" font-family="ui-monospace, monospace">',
        '<style>text{paint-order:stroke;stroke:#14171c;stroke-width:3px;stroke-linejoin:round}</style>',
        f'<rect width="{w:.0f}" height="{h:.0f}" fill="#14171c"/>',
    ]

    # Grille de 10 m.
    parts.append('<g stroke="#222831" stroke-width="1">')
    gx = math.ceil(x0 / 10) * 10
    while gx <= x1:
        parts.append(f'<line x1="{px(gx):.1f}" y1="{py(y0):.1f}" x2="{px(gx):.1f}" y2="{py(y1):.1f}"/>')
        gx += 10
    gy = math.ceil(y0 / 10) * 10
    while gy <= y1:
        parts.append(f'<line x1="{px(x0):.1f}" y1="{py(gy):.1f}" x2="{px(x1):.1f}" y2="{py(gy):.1f}"/>')
        gy += 10
    parts.append("</g>")

    # Liaisons d'abord, espaces ensuite.
    for c in CORRIDORS:
        parts.append(
            f'<rect x="{px(c.x[0]):.1f}" y="{py(c.y[1]):.1f}" '
            f'width="{(c.largeur * PX_PAR_M):.1f}" height="{(c.profondeur * PX_PAR_M):.1f}" '
            f'fill="#2a313b" stroke="#3d4855" stroke-width="1"/>'
        )

    annexes = []
    occupe = []                                  # boîtes des textes posés : (x0, y0, x1, y1)

    def libre(boite, obstacles) -> bool:
        return all(boite[2] <= o[0] or o[2] <= boite[0] or boite[3] <= o[1] or o[3] <= boite[1]
                   for o in obstacles)

    rects = {sp.id: (px(sp.x[0]), py(sp.y[1]), px(sp.x[1]), py(sp.y[0])) for sp in SPACES}
    reperes = [(label, rx, ry, *STYLE_REPERES[nature]) for sp in ALL
               for label, rx, ry, nature, *_alt in sp.reperes]
    occupe += [(px(rx) - 5, py(ry) - 5, px(rx) + 5, py(ry) + 5) for _l, rx, ry, _c, _g in reperes]
    for i, sp in enumerate(SPACES, start=1):
        col = COULEUR[sp.densite]
        parts.append(
            f'<rect x="{px(sp.x[0]):.1f}" y="{py(sp.y[1]):.1f}" '
            f'width="{(sp.largeur * PX_PAR_M):.1f}" height="{(sp.profondeur * PX_PAR_M):.1f}" '
            f'fill="{col}" fill-opacity="0.30" stroke="{col}" stroke-width="2"/>'
        )
        titre = f"{i}. {sp.nom}"
        cote = (f'{sp.largeur:.0f} × {sp.profondeur:.0f} m · h {sp.hauteur:.1f}'
                + (f' · z {sp.z:+.0f}' if sp.z else '')
                + (f' · {sp.duree}' if sp.duree and sp.duree != "—" else ''))
        # Étiquette en haut à gauche du rectangle, pas au centre : le centre
        # appartient aux repères de gameplay. Un espace trop étroit pour son
        # nom le porte à la verticale (cas du hub).
        largeur_titre = len(titre) * 7.4
        if max(sp.largeur, sp.profondeur) * PX_PAR_M < PETIT_ESPACE_PX:
            # Au centre, ou contre un bord extérieur si un symbole y est déjà.
            r = rects[sp.id]
            cx, cy = (r[0] + r[2]) / 2, (r[1] + r[3]) / 2
            for nx, ny in ((cx, cy), (r[0] - 9, cy), (r[2] + 9, cy), (cx, r[1] - 7), (cx, r[3] + 9)):
                boite = (nx - 8, ny - 5, nx + 8, ny + 6)
                if libre(boite, occupe):
                    break
            occupe.append(boite)
            parts.append(f'<text x="{nx:.1f}" y="{ny + 4:.1f}" fill="#e8edf2" font-size="11" '
                         f'font-weight="700" text-anchor="middle">{i}</text>')
            annexes.append(f"{titre} ({sp.largeur:.0f} × {sp.profondeur:.0f} m)")
        elif sp.largeur * PX_PAR_M < 80:
            cx = px((sp.x[0] + sp.x[1]) / 2)
            cy = py((sp.y[0] + sp.y[1]) / 2)
            parts.append(
                f'<g transform="translate({cx:.1f},{cy:.1f}) rotate(-90)">'
                f'<text x="0" y="-4" fill="#e8edf2" font-size="13" font-weight="700" '
                f'text-anchor="middle">{titre}</text>'
                f'<text x="0" y="12" fill="#9fb0c0" font-size="10" text-anchor="middle">{cote}</text>'
                f'</g>'
            )
        else:
            # Étiquette dans le rectangle si elle y tient ; sinon juste au-dessus,
            # ou juste dessous quand un autre espace occupe le dessus (la cafétéria
            # et le local VMC collé à son mur nord).
            dedans = largeur_titre <= sp.largeur * PX_PAR_M - 12
            tx = px(sp.x[0]) + (8 if dedans else 0)
            ty = py(sp.y[1]) + (18 if dedans else -18)
            if not dedans:
                autres = [r for k, r in rects.items() if k != sp.id]
                largeur_bloc = max(largeur_titre, len(cote) * 6.0)
                if not libre((tx, ty - 11, tx + largeur_bloc, ty + 17), autres):
                    ty = py(sp.y[0]) + 16
            parts.append(
                f'<text x="{tx:.1f}" y="{ty:.1f}" fill="#e8edf2" font-size="13" '
                f'font-weight="700">{titre}</text>'
            )
            parts.append(
                f'<text x="{tx:.1f}" y="{ty + 14:.1f}" fill="#9fb0c0" font-size="10">{cote}</text>'
            )
            occupe.append((tx, ty - 11, tx + largeur_titre, ty + 17))
        for _n, sx, sy, cover in sp.spawns:
            fill = "#e8552f" if _n.startswith("director") else "#e8a33d"
            r = 4.5 if _n.startswith("director") else 3
            parts.append(f'<circle cx="{px(sx):.1f}" cy="{py(sy):.1f}" r="{r}" fill="{fill}" '
                         f'stroke="#14171c" stroke-width="1"/>')
            if cover:
                parts.append(f'<circle cx="{px(sx):.1f}" cy="{py(sy):.1f}" r="{r + 3}" fill="none" '
                             f'stroke="{fill}" stroke-width="1" stroke-dasharray="2 2"/>')
        if sp.arrivee:
            ax, ay = sp.arrivee
            parts.append(f'<rect x="{px(ax) - 3:.1f}" y="{py(ay) - 3:.1f}" width="6" height="6" '
                         f'fill="none" stroke="#6fd3ff" stroke-width="1.5"/>')
            occupe.append((px(ax) - 4, py(ay) - 4, px(ax) + 4, py(ay) + 4))

    for _label, rx, ry, col, glyphe in reperes:
        parts.append(f'<text x="{px(rx):.1f}" y="{py(ry) + 4:.1f}" fill="{col}" font-size="11" '
                     f'text-anchor="middle">{glyphe}</text>')
    for label, rx, ry, col, _glyphe in reperes:
        largeur = len(label) * 6.2
        prefere = "end" if px(rx) + 10 + largeur > w - MARGE else "start"
        autre = "start" if prefere == "end" else "end"
        # Le symbole reste sur son point ; l'étiquette cherche une place libre —
        # ni titre, ni symbole, ni autre étiquette — ligne par ligne, d'un côté
        # puis de l'autre du symbole. Faute de place libre, celle qui recouvre le
        # moins de texte.
        candidats = []
        for decalage in (0, 12, -12, 24, -24, 36, -36, 48, -48):
            for ancre in (prefere, autre):
                gauche = px(rx) - 9 - largeur if ancre == "end" else px(rx) + 9
                if gauche < 0 or gauche + largeur > w:
                    continue
                y = py(ry) + 4 + decalage
                b = (gauche, y - 9, gauche + largeur, y + 2)
                recouvert = sum(max(0.0, min(b[2], o[2]) - max(b[0], o[0])) * max(0.0, min(b[3], o[3]) - max(b[1], o[1]))
                                for o in occupe)
                candidats.append((recouvert, len(candidats), ancre, decalage))
        _r, _i, ancre, decalage = min(candidats) if candidats else (0, 0, prefere, 0)
        gauche = px(rx) - 9 - largeur if ancre == "end" else px(rx) + 9
        y = py(ry) + 4 + decalage
        occupe.append((gauche, y - 9, gauche + largeur, y + 2))
        dx = -9 if ancre == "end" else 9
        parts.append(f'<text x="{px(rx) + dx:.1f}" y="{y:.1f}" fill="{col}" font-size="10" '
                     f'text-anchor="{ancre}">{label}</text>')
    # Échelle.
    parts.append(f'<g stroke="#9fb0c0" stroke-width="2">'
                 f'<line x1="{MARGE:.0f}" y1="{h - 24:.0f}" x2="{MARGE + 20 * PX_PAR_M:.0f}" y2="{h - 24:.0f}"/>'
                 f'</g>')
    parts.append(f'<text x="{MARGE:.0f}" y="{h - 30:.0f}" fill="#9fb0c0" font-size="11">20 m</text>')
    if annexes:
        parts.append(f'<text x="{MARGE:.0f}" y="{h - 8:.0f}" fill="#9fb0c0" font-size="10">'
                     f'{" · ".join(annexes)}</text>')
    parts.append(f'<text x="{w - MARGE:.0f}" y="{h - 30:.0f}" fill="#9fb0c0" font-size="12" '
                 f'text-anchor="end">nord ↑ · grille 10 m · repère Blender</text>')
    parts.append("</svg>")
    return "\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ascii", action="store_true", help="vue de dessus ASCII")
    parser.add_argument("--svg", metavar="PATH", help="vue de dessus cotée, en SVG")
    args = parser.parse_args()

    print("\n".join(rapport()))
    if args.ascii:
        print()
        print("\n".join(ascii_map()))
    if args.svg:
        with open(args.svg, "w", encoding="utf-8") as fh:
            fh.write(svg())
        print(f"\nSVG écrit : {args.svg}")


if __name__ == "__main__":
    main()
