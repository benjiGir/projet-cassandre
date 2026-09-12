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

# Budget de N1 : 200 lots de dessin, 200 000 triangles par image.
BUDGET_DRAW_CALLS = 200
BUDGET_TRIANGLES = 200_000

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
    # Pour un couloir posé À L'INTÉRIEUR d'un espace (une rampe qui remonte
    # dans le volume du parking) : id de l'espace qui le contient.
    dans: str | None = None
    # Repères de gameplay : (libellé, x, y, nature) avec nature ∈
    # {carte, secret, objet, porte, depart}.
    reperes: list[tuple[str, float, float, str]] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    couloir: bool = False

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
            "Machine à pinces (secret dérisoire) et photomaton à l'ouest ; `secret_1_photomaton` derrière.",
        ],
        reperes=[
            ("machine à pinces", -26, 6, "objet"),
            ("photomaton", -18, 7, "objet"),
            ("secret 1 — arrière-boutique", -28, 3, "secret"),
        ],
    ),
    Space(
        id="cafeteria", nom="Cafétéria",
        x=(34, 56), y=(0, 20), z=0, hauteur=4.0, densite="moyenne",
        role="Optionnelle : soin, toilettes (+1 PV), secret 3 (bouche d'aération)",
        duree="0:30", arrivee=(35, 7),
        ennemis="2 Costards attablés — réveil à l'entrée",
        spawns=[("suit_ca1", 54, 5, None), ("suit_ca2", 52, 16, None)],
        notes=[
            "Comptoir de self : un des trois objets sans équivalent CC0, monté en volumes simples.",
            "`secret_3_aeration` : bouche accessible depuis le comptoir (1,0 m) puis le haut du frigo (2,0 m).",
        ],
        reperes=[
            ("toilettes +1 PV", 52, 11, "objet"),
            ("secret 3 — aération", 37, 18, "secret"),
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
            "`use_shotgun` posé sur un tapis de caisse, à 10 m de l'entrée.",
        ],
        reperes=[
            ("fusil à pompe", 2, 30, "objet"),
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
            "Carte Argent derrière le comptoir du rayon frais.",
        ],
        reperes=[
            ("carte Argent", -48, 62, "carte"),
            ("secret 2 — toit des gondoles", -16, 50, "secret"),
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
            "Carte Or dans la cabine de démonstration, en hauteur — saut depuis un carton (1,0 m).",
        ],
        reperes=[
            ("carte Or", 42, 76, "carte"),
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
    ),
    Space(
        id="souterrain", nom="Parking souterrain",
        x=(28, 76), y=(92, 132), z=-6.0, hauteur=3.5, densite="faible",
        role="Tension, embuscade entre les piliers",
        duree="1:00", arrivee=(30, 116),
        ennemis="6 Costards, dispersés entre les piliers — la seule zone où l'occlusion fait tout le travail",
        spawns=[("suit_so1", 40, 100, None), ("suit_so2", 52, 104, None), ("suit_so3", 64, 110, None),
                ("suit_so4", 44, 120, "pilier"), ("suit_so5", 58, 126, None), ("suit_so6", 70, 122, None)],
        notes=[
            "Hauteur 3,5 m, piliers tous les 8 m : pénombre, portée de vue coupée en permanence.",
            "Décalé à l'est de la réserve, jamais SOUS un espace praticable (contrainte de colonne).",
        ],
    ),
    Space(
        id="bureaux", nom="Bureaux direction",
        x=(-20, 8), y=(140, 166), z=0, hauteur=4.0, densite="moyenne",
        role="Le Directeur, puis la sortie (carte Platine)",
        duree="1:00", arrivee=(4, 142),
        ennemis="1 Directeur + 3 Costards",
        spawns=[("director_bu1", -6, 158, None), ("suit_bu1", -16, 148, None),
                ("suit_bu2", 2, 152, "salle du boss — intention explicite"), ("suit_bu3", -12, 162, None)],
        notes=[
            "Salle de confrontation : le Directeur est volontairement SOUS `attackRange`, la révélation doit être immédiate (même choix qu'en Zone E).",
            "`door_exit` au nord, déverrouillée par la carte Platine lâchée à sa mort.",
        ],
        reperes=[
            ("carte Platine (Directeur)", -6, 158, "carte"),
            ("SORTIE", -6, 165, "porte"),
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
    Space(id="c_rs_so", nom="Rampe de quai", x=(20, 28), y=(100, 128), z=-6.0, hauteur=4.0,
          role="réserve (z=0) → parking souterrain (z=-6), pente 21 %", couloir=True, densite="faible"),
    Space(id="c_so_bu", nom="Rampe de sortie", x=(44, 52), y=(124, 132), z=-6.0, hauteur=4.0,
          role="parking souterrain → couloir des bureaux, remonte à z=0", couloir=True,
          densite="faible", dans="souterrain"),
    Space(id="c_bu", nom="Couloir de direction", x=(0, 44), y=(132, 140), z=0, hauteur=4.0,
          role="rampe de sortie → bureaux, porte carte Or à l'ouest", couloir=True, densite="faible",
          reperes=[("porte Or", 14, 136, "porte")]),
    Space(id="c_short_n", nom="Couloir de service (nord)", x=(-44, 0), y=(132, 140), z=0, hauteur=4.0,
          role="raccourci à SENS UNIQUE, première branche", couloir=True, densite="faible",
          reperes=[("sens unique ↓", -26, 136, "porte")]),
    Space(id="c_short_w", nom="Couloir de service (ouest)", x=(-44, -36), y=(84, 132), z=0, hauteur=4.0,
          role="raccourci à SENS UNIQUE, débouche dans les rayons", couloir=True, densite="faible"),
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

    # --- Contrôle 6 : budget de triangles ------------------------------------
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
    a(f"  Budget de N1 : {BUDGET_TRIANGLES:,} par image".replace(",", " "))
    if total > BUDGET_TRIANGLES:
        a(f"  >>> {total / BUDGET_TRIANGLES:.1f}× le budget si TOUT le niveau est dessiné à chaque image.")
        a("      La fusion d'ADR 0023 regroupe aujourd'hui le décor du niveau ENTIER par")
        a("      matériau : un lot couvre toute la carte, donc rien n'est jamais éliminé")
        a("      par frustum. Conséquence pour N9 : fusionner PAR ESPACE (10 × ~5 matériaux")
        a("      = ~50 lots, sous les 200 du budget), pour que le frustum élimine les")
        a("      espaces non vus. Pire cas visible ci-dessous.")

    a("")
    a("Pire cas visible — un espace et ses voisins immédiats")
    a("-" * 60)
    for sp, voisins in PIRE_CAS:
        vus = [x for x in SPACES if x.id in {sp, *voisins}]
        t = sum(x.aire * DENSITE_TRIS[x.densite] for x in vus)
        etat = "OK" if t <= BUDGET_TRIANGLES else "AU-DESSUS"
        a(f"  {', '.join(x.nom for x in vus):<58} {t:>9,.0f}  {etat}".replace(",", " "))

    # --- Contrôle 7 : total d'ennemis ---------------------------------------
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


# --- Vue de dessus cotée, en SVG ---------------------------------------------

PX_PAR_M = 4.0
MARGE = 56.0

COULEUR = {
    "forte": "#c8622f",
    "elevee": "#c89a2f",
    "moyenne": "#5f8b6a",
    "faible": "#4a6076",
}


def svg() -> str:
    xs = [s.x[0] for s in ALL] + [s.x[1] for s in ALL]
    ys = [s.y[0] for s in ALL] + [s.y[1] for s in ALL]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w = (x1 - x0) * PX_PAR_M + 2 * MARGE
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
        if sp.largeur * PX_PAR_M < 80:
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
            # Étiquette dans le rectangle si elle y tient, juste au-dessus sinon.
            dedans = largeur_titre <= sp.largeur * PX_PAR_M - 12
            tx = px(sp.x[0]) + (8 if dedans else 0)
            ty = py(sp.y[1]) + (18 if dedans else -18)
            parts.append(
                f'<text x="{tx:.1f}" y="{ty:.1f}" fill="#e8edf2" font-size="13" '
                f'font-weight="700">{titre}</text>'
            )
            parts.append(
                f'<text x="{tx:.1f}" y="{ty + 14:.1f}" fill="#9fb0c0" font-size="10">{cote}</text>'
            )
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

    # Repères de gameplay.
    STYLE = {
        "carte": ("#8fe3ff", "◆"),
        "secret": ("#c58fff", "★"),
        "objet": ("#8fffb4", "●"),
        "porte": ("#ff8f8f", "▮"),
        "depart": ("#6fd3ff", "▶"),
    }
    for sp in ALL:
        for label, rx, ry, nature in sp.reperes:
            col, glyphe = STYLE[nature]
            place = px(rx) + 10 + len(label) * 6.2
            ancre = "end" if place > w - MARGE else "start"
            dx = -9 if ancre == "end" else 9
            parts.append(f'<text x="{px(rx):.1f}" y="{py(ry) + 4:.1f}" fill="{col}" font-size="11" '
                         f'text-anchor="middle">{glyphe}</text>')
            parts.append(f'<text x="{px(rx) + dx:.1f}" y="{py(ry) + 4:.1f}" fill="{col}" font-size="10" '
                         f'text-anchor="{ancre}">{label}</text>')

    # Échelle.
    parts.append(f'<g stroke="#9fb0c0" stroke-width="2">'
                 f'<line x1="{MARGE:.0f}" y1="{h - 24:.0f}" x2="{MARGE + 20 * PX_PAR_M:.0f}" y2="{h - 24:.0f}"/>'
                 f'</g>')
    parts.append(f'<text x="{MARGE:.0f}" y="{h - 30:.0f}" fill="#9fb0c0" font-size="11">20 m</text>')
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
