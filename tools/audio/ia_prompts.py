"""
Prompts des sons générés par un modèle texte → SFX.

Une entrée par son du sprite (`recipes.RECIPES`), même nom. Le prompt décrit
UN évènement sonore, à l'anglais (ce que le modèle comprend le mieux), dans les
termes d'un ingénieur du son : source, espace, prise de son, époque. Ce fichier
est la vraie source d'un son généré — c'est lui qu'on affine quand une prise ne
« ressemble pas à ce que c'est », pas le traitement d'après.

    nom : (prompt, durée en secondes, fidélité au prompt)

`durée` : le service facture à la seconde (40 crédits/s, durée fixée) — la
juste durée est aussi la moins chère. Plancher du service : 0,5 s.
`fidélité` (0-1) : haute = suit le prompt de près mais varie peu d'une prise à
l'autre ; basse = plus de variété. Les armes et impacts, qu'on tire cent fois,
gardent une fidélité moyenne pour que les variantes diffèrent.

Couleur du jeu : FPS des années 90 (Duke Nukem 3D, Ion Fury) dans un
hypermarché de province. Ni cinéma, ni simulation militaire : des sons francs,
lisibles et un peu outranciers. Depuis le 2026-10-01, le rendu visé est celui
d'un FPS MODERNE (référence Ion Fury / DOOM 2016) : percutant, compressé.
Leçons de jeu (2026-10-01) : les sons ennemis sont joués SANS spatialisation,
donc secs et proches ; les portes durent ce que dure leur animation (battant
0,5 s, coulissante 0,45 s, rideau 1,4 s, `game/level/doors/doors.ts`).
"""

from __future__ import annotations

EPOQUE = "1990s first-person shooter game sound effect"
SEC = "dry, no music, no voice-over"
SANS_TRAIN = "no voices, no music"
# Le lieu, en tête de chaque prompt de train : sans lui, le modèle rend un train de grande ligne.
STATION = "Field recording on an underground metro station platform, echoing tiled vault"
TUNNEL = "Field recording inside an underground metro subway tunnel, close concrete walls"
A_BORD = "Field recording inside an underground metro subway car"

PROMPTS: dict[str, tuple[str, float, float]] = {
    # -- armes --------------------------------------------------------------
    "pistol_fire": (
        # Direction du 2026-10-01 : arme de jeu moderne (reference Ion Fury /
        # DOOM 2016), pas un tir realiste — « pas assez de puissance ».
        f"Single pistol gunshot for a modern first-person shooter video game, very punchy and powerful, heavy low-end thump, sharp crack, metallic slide clack, heavily compressed, short controlled indoor tail, {SEC}",
        1.2, 0.45),
    "shotgun": (
        f"Single pump shotgun blast for a modern first-person shooter video game, massive punchy low-end boom, sharp crack, heavily compressed, short controlled indoor tail, then the pump racked once, {SEC}",
        1.8, 0.45),
    "shotgun_pump": (
        f"Pump-action shotgun being racked once, heavy metallic chunk-chick, close microphone, {SEC}",
        0.9, 0.55),
    "shell_drop": (
        f"A single spent shotgun shell falling on a concrete floor and bouncing twice, plastic and brass clinks, {SEC}",
        0.8, 0.55),
    "crowbar_swing": (
        f"A heavy steel crowbar swung hard through the air in a first-person shooter video game, one fast deep whoosh, punchy, {SEC}",
        0.5, 0.5),
    "crowbar_metal": (
        f"A steel crowbar striking a metal surface, sharp clang with a ringing decay, single hit, {SEC}",
        0.9, 0.5),
    "crowbar_flesh": (
        f"A heavy steel crowbar hitting a body, wet meaty thud with a small crunch, single hit, violent {EPOQUE}",
        0.6, 0.5),
    # -- impacts et casse ---------------------------------------------------
    "impact_concrete": (
        f"A bullet hitting a concrete wall in a modern first-person shooter video game, sharp punchy crack with small debris and dust, single impact, short, {SEC}",
        0.5, 0.5),
    "impact_metal": (
        f"A bullet hitting a steel panel in a modern first-person shooter video game, sharp metallic clang, short ring, single impact, {SEC}",
        0.6, 0.5),
    "impact_flesh": (
        f"A bullet hitting a body in a modern first-person shooter video game, short wet meaty impact, single hit, {SEC}",
        0.5, 0.5),
    "gib_splat": (
        # Le « sproutch » d'un ennemi qui eclate (pompe a bout portant,
        # explosif) : joue une fois, par-dessus le tir et le cri de mort.
        f"A body bursting apart at point-blank range in a modern first-person shooter video game: one heavy wet squelching splat, gore and meat chunks slapping onto a hard floor, juicy, gooey, punchy and exaggerated, single event, {SEC}",
        1.4, 0.5),
    "impact_glass": (
        f"A glass display case shattering in a video game, bright crash then shards falling and tinkling on the floor, {SEC}",
        1.4, 0.5),
    "prop_break_wood": (
        f"A wooden crate smashed to pieces in a video game, loud crack, splintering wood, planks dropping, {SEC}",
        1.1, 0.5),
    "ceramic_break": (
        f"A porcelain toilet bowl smashed with a crowbar, heavy ceramic crash, pieces scattering on a tiled floor, water splashing out, small tiled bathroom, {SEC}",
        1.4, 0.5),
    # -- ramassages ---------------------------------------------------------
    "pickup_ammo": (
        f"Video game ammo pickup: a cardboard box of bullets grabbed, brass cartridges clinking, short and satisfying, {SEC}",
        0.5, 0.6),
    "pickup_health": (
        f"Video game health pickup: a plastic first-aid kit grabbed and its latch snapping open, short and satisfying, {SEC}",
        0.6, 0.6),
    "pickup_key": (
        f"Video game keycard pickup: short bright plastic card chime, positive, {EPOQUE}",
        0.8, 0.6),
    "secret_found": (
        f"Video game secret area found: a short mysterious ascending synth sparkle jingle, 1990s shooter, {SEC}",
        1.3, 0.6),
    "water_gulp": (
        f"Someone drinking water straight from a tap, two quick gulps and swallows, close, {SEC}",
        0.9, 0.5),
    "food_eat": (
        f"Someone taking a big crunchy bite of food and chewing twice, heard from very close, first person, {SEC}",
        0.7, 0.55),
    # -- ennemis ------------------------------------------------------------
    "suit_telegraph": (
        f"A pistol slide racked once, sharp metallic chk-chak, clearly audible warning, close and dry, {SEC}",
        0.5, 0.55),
    "suit_shot": (
        f"A single pistol gunshot fired by an enemy a few meters away in a supermarket, punchy, short controlled tail, video game, {SEC}",
        0.9, 0.45),
    "suit_alert": (
        f"An angry man in a suit shouting 'Hey!' in surprise, male voice, close, dry, no reverb, video game enemy, {SEC}",
        0.6, 0.5),
    "enemy_hurt": (
        f"A man grunting in pain when shot, short, male voice, close, dry, no reverb, video game enemy, {SEC}",
        0.5, 0.5),
    "suit_death": (
        f"A man's death groan falling off, then his body collapsing on a hard floor, close, dry, no reverb, video game enemy, {SEC}",
        1.3, 0.5),
    # -- interactions -------------------------------------------------------
    "pa_click": (
        f"A microphone click and a short electrical PA system crackle just before a supermarket announcement, {SEC}",
        0.6, 0.6),
    "door_open": (
        f"A heavy metal fire door pushed open quickly: handle and latch click, door swinging open in half a second, soft stop, indoors, {SEC}",
        0.7, 0.5),
    "door_locked": (
        f"A keycard reader refusing access: harsh double error beep and a locked door handle rattling, {SEC}",
        0.8, 0.6),
    "door_unlock": (
        f"A keycard reader accepting a card: short confirmation beep then a magnetic door lock releasing with a clunk, {SEC}",
        0.8, 0.6),
    "door_slide": (
        f"An automatic supermarket sliding door opening quickly in under half a second, short motor whir and rubber seal, {SEC}",
        0.8, 0.5),
    "door_shutter": (
        f"A metal roller shutter rolling up fast for about one and a half seconds, rattling corrugated steel and electric motor, ending with a clank, {SEC}",
        1.8, 0.5),
    "cart_roll": (
        f"A supermarket shopping cart rolling on a tiled floor, rattling metal wheels, {SEC}",
        2.0, 0.5),
    "toilet_flush": (
        f"A public toilet flushing, strong water rush swirling down, short, tiled bathroom, {SEC}",
        2.5, 0.5),
    # -- interface ----------------------------------------------------------
    "ui_hover": (
        f"A subtle retro computer interface blip, one tiny high beep, 1990s, {SEC}",
        0.5, 0.7),
    "ui_confirm": (
        f"A retro computer menu confirmation, short pleasant double beep, 1990s, {SEC}",
        0.5, 0.7),
    "ui_deny": (
        f"A retro computer error buzz, short low negative tone, 1990s, {SEC}",
        0.6, 0.7),
    # -- trains du métro (v2.0) ----------------------------------------------
    # Le train se joue en couches, pas en un seul passage enregistré : sa
    # vitesse et la distance au joueur changent, donc le jeu mélange une
    # boucle de roulement qui suit la rame et des sons ponctuels calés sur des
    # instants (annonce, passage de l'avant, arrêt, choc).
    #
    # Reprise du 2026-10-08 : les prises du 2026-10-06 sont abandonnées
    # (`candidats/_abandonnes/`). Leurs prompts décrivaient un TRAIN — joints
    # de rail, bogies, wagon de fret — et le mot « subway » n'y pesait rien.
    # Chaque prompt commence maintenant par le LIEU (`STATION`, `TUNNEL`,
    # `A_BORD`) et décrit une rame électrique : moteurs de traction qui
    # sifflent, roues qui crissent, air poussé dans le tunnel, air comprimé.
    # Le roulement en boucle (`train_roll`) n'est plus demandé au service : il
    # se découpe dans le palier de la prise retenue de `train_pass`.
    "train_pass": (
        # Prise 1 (2026-10-08, prompt centré sur le sifflement des moteurs) :
        # 42 % de l'énergie dans cinq raies vers 700 Hz, rien au-dessus de
        # 2 kHz. Depuis, le prompt demande d'abord le fracas large des roues.
        f"{STATION}: an electric metro train bursts out of the tunnel and runs through the station at speed "
        "without stopping. A gust of air, then the loud broadband roar and clatter of steel wheels on the "
        "rails close to the microphone, wheel squeal, hissing air, motor whine underneath, then it recedes "
        f"into the far tunnel, one single pass, {SANS_TRAIN}, no horn, no announcements",
        8.0, 0.55),
    "rail_sing": (
        # Demander un « grondement lointain » ne produisait que du grave sous
        # 60 Hz, inaudible. À l'inverse, « thin, mostly high frequencies »
        # (prise 1 du 2026-10-08) a mis 80 % de l'énergie au-dessus de 8 kHz.
        "Seamless loop recorded inside a quiet underground metro tunnel, just before a train arrives: the "
        "steel rails start to sing, a metallic ringing, whistling and zinging running along the rails like "
        "bowed steel, with small ticks and pings, a faint electric buzz from the live third rail, tense and "
        f"eerie, steady, {SANS_TRAIN}, no rumble, no bass, no train passing, no horn",
        4.0, 0.55),
    "train_horn": (
        f"{TUNNEL}: an approaching electric metro train sounds its warning horn. One loud two-tone electric "
        f"horn blast, urgent, ringing down the concrete tunnel with a long echo, {SANS_TRAIN}, no train rumble",
        2.0, 0.6),
    "train_whoosh": (
        # Prise 1 (2026-10-08, « Field recording… ») : molle, sans attaque, la
        # moitié de l'énergie sous 60 Hz. L'effet passe devant le lieu.
        "The huge whoosh of an electric metro train rushing past at arm's length on an underground station "
        "platform: a sudden violent blast of wind and hissing rushing air, screaming steel wheels and motor "
        "whine inside it, sharp loud attack then fading into the station echo, bright, punchy exaggerated "
        f"video game sound effect, {SANS_TRAIN}, no horn, no low rumble",
        2.0, 0.5),
    "train_brake": (
        f"{STATION}: an electric metro train brakes hard to a full stop at the platform. A long piercing "
        "brake squeal falling in pitch, the traction motor whine winding down, wheels grinding on the rails, "
        f"then a final hiss of compressed air, echoing in the station, {SANS_TRAIN}, no horn, no announcements",
        3.0, 0.5),
    "train_hit": (
        "A body struck by a speeding metro subway train: one massive heavy impact thud against the steel "
        f"front of the car, a wet crunch and splatter, brutal and over the top, violent {EPOQUE}, {SEC}",
        1.0, 0.5),
    "switch_lever": (
        f"{TUNNEL}: a heavy manual track switch lever is thrown. A big iron lever ratchets over and slams, "
        "then the steel rail points slide and lock with a loud metallic clunk that rings down the tunnel, "
        f"close microphone, {SANS_TRAIN}",
        1.6, 0.55),
    "emergency_stop": (
        f"{STATION}: an emergency stop handle is pulled on the platform. The sharp mechanical clack of a "
        "spring-loaded handle, immediately followed by a loud harsh electric alarm buzzer sounding for one "
        f"second and echoing in the station, {SANS_TRAIN}",
        1.8, 0.55),
    "train_doors": (
        # Prise 1 (2026-10-08) : 58 % sous 60 Hz, le grondement d'une rame en marche.
        f"{A_BORD}, standing still at a station: the doors close. A loud harsh door-closing warning buzzer "
        "for one second, then the sliding doors rattle shut and slam with a clack, a sharp pneumatic hiss, "
        f"{SANS_TRAIN}, no announcements, no rumble",
        2.5, 0.55),
    "train_depart": (
        f"{A_BORD}: the electric train pulls away from the station. A jolt, creaks, then the whine of the "
        "electric traction motors rising steadily in pitch as the wheels roll faster and the roar of the "
        f"tunnel builds, {SANS_TRAIN}, no horn, no announcements",
        4.0, 0.5),
    "ride_interior": (
        # Plus demandé en boucle : le modèle rendait un grondement sourd (78 %
        # de l'énergie sous 60 Hz). Un trajet enregistré à bord est un son
        # qu'il connaît ; la boucle se découpera dans la prise retenue.
        # Prise 1 du 2026-10-08 : nappe tonale entre 200 et 400 Hz, sans rien
        # qui cliquette ; le fracas large passe en tête du prompt.
        f"{A_BORD} at full speed through a tunnel: the loud broadband roar and hiss of the tunnel rushing "
        "past, steel wheels clattering and screeching on the rails, rattling metal panels, handrails and "
        f"windows, motor whine underneath, steady from the first to the last second, {SANS_TRAIN}, no "
        "announcements, no stop, no fade",
        8.0, 0.5),
}

# Sons demandés en boucle raccordable (paramètre `loop` du service).
BOUCLES = frozenset({"rail_sing"})

# Les sons du train, dans l'ordre d'écoute : `ia_sfx.py generate --cat train`.
SONS_TRAIN = (
    "train_pass", "rail_sing", "train_horn", "train_whoosh", "train_brake", "train_hit",
    "switch_lever", "emergency_stop", "train_doors", "train_depart", "ride_interior",
)

# --- Ambiances de zone (`ia_ambiances.py`) -----------------------------------
#
# Retour du 2026-10-02 sur l'ancienne nappe : « trop monotone », « mauvaise
# couleur », et toutes les zones sonnaient pareil. D'où trois strates par zone
# (skill `ambience-and-loops`) : une NAPPE générée en boucle (`loop`, le modèle
# soigne le raccord, `analyze_sfx.raccord` le vérifie), la respiration lente
# ajoutée au mixage, et des ÉVÉNEMENTS ponctuels tirés au hasard par-dessus —
# ce sont eux qui empêchent l'oreille de verrouiller la boucle.
#
# Une nappe ne contient AUCUN événement saillant : un grincement au milieu
# d'une boucle de 12 s revient toutes les 12 s, et c'est exactement ce qui
# s'entend comme une boucle. Les prompts le disent au modèle.

NAPPE = "continuous steady room tone, no distinct events, no people, no voices, no music, seamless loop"

AMBIANCES: dict[str, tuple[str, float, float]] = {
    "magasin": (
        "Ambience of a huge empty French hypermarket at night after closing: low electrical hum of rows of "
        "fluorescent ceiling lights, refrigerated display cases and freezer compressors droning, air "
        f"conditioning, vast reverberant hall with tiled floor and high metal ceiling, eerie and lonely, {NAPPE}",
        12.0, 0.5),
    "parking": (
        "Ambience of an empty outdoor supermarket car park on the outskirts of a French town at night: distant "
        "steady traffic hum of a ring road, light cold wind, faint electrical buzz of sodium street lamps, open air, "
        f"no reverb, {NAPPE}",
        12.0, 0.5),
    "reserve": (
        "Ambience of a vast supermarket stockroom warehouse at night: deep low rumble of large ventilation ducts, "
        "tall steel pallet racks, concrete floor, very high metal roof, long cold metallic echo, dark and empty, "
        f"{NAPPE}",
        12.0, 0.5),
    "souterrain": (
        "Ambience of an empty underground concrete car park at night: steady drone of big extraction fans, low "
        f"ceiling, hard concrete reverberation, cold damp air, oppressive and lonely, {NAPPE}",
        12.0, 0.5),
    "coulisses": (
        "Ambience of narrow back-of-house service corridors behind a supermarket at night: buzzing fluorescent "
        "tubes, muffled machinery and cold-room compressors humming through the walls, water pipes, small hard "
        f"tiled rooms, claustrophobic, {NAPPE}",
        12.0, 0.5),
    "bureaux": (
        "Ambience of a quiet carpeted office floor upstairs in a supermarket at night: soft air conditioning, "
        "computer fans whirring, faint electrical hum, small muffled rooms, almost silent, tense corporate calm, "
        f"{NAPPE}",
        12.0, 0.5),
}

EVENEMENTS: dict[str, dict[str, tuple[str, float, float]]] = {
    "magasin": {
        "neon": (f"A fluorescent tube light flickering and buzzing for a moment in a large empty store, {SEC}",
                 2.0, 0.5),
        "frigo": (f"A supermarket freezer compressor clicking on with a low shudder, then humming, in a large empty hall, {SEC}",
                  2.5, 0.5),
        "caddie": (f"A lone shopping cart rattling as it rolls a short distance, far away in a large empty reverberant supermarket, {SEC}",
                   2.5, 0.5),
        "rayon": (f"A small plastic product falling off a shelf onto a tiled floor, far away in a large empty reverberant supermarket, {SEC}",
                  1.5, 0.5),
    },
    "parking": {
        "voiture": (f"A single car passing by in the distance at night, outdoors, {SEC}", 2.0, 0.5),
        "rafale": (f"A gust of cold wind rattling a loose metal sign in an empty car park at night, {SEC}", 2.0, 0.5),
        "scooter": (f"A moped engine revving far away in a French suburb at night, outdoors, {SEC}", 2.0, 0.5),
    },
    "reserve": {
        "tole": (f"A large metal roof creaking and groaning in a vast empty warehouse, long echo, {SEC}", 2.0, 0.5),
        "palette": (f"A wooden pallet dropped on a concrete floor far away in a vast warehouse, booming echo, {SEC}", 2.0, 0.5),
        "chaine": (f"Hanging steel chains clinking softly in a vast empty warehouse, echo, {SEC}", 2.0, 0.5),
    },
    "souterrain": {
        "goutte": (f"Water drops falling into a puddle in an underground concrete car park, echoing, {SEC}", 2.0, 0.5),
        "porte": (f"A heavy metal fire door slamming far away in an underground concrete car park, big echo, {SEC}", 2.0, 0.5),
        "pneus": (f"Car tyres squealing briefly on a smooth concrete floor far away in an underground car park, echo, {SEC}", 2.0, 0.5),
    },
    "coulisses": {
        "tuyau": (f"Old water pipes knocking and clanking inside a wall, close, small tiled room, {SEC}", 2.0, 0.5),
        "compresseur": (f"An industrial cold-room compressor starting up with a heavy clunk and shudder behind a wall, {SEC}", 2.0, 0.5),
        "porte": (f"A door closing with a latch click at the far end of a narrow service corridor, {SEC}", 2.0, 0.5),
    },
    "bureaux": {
        "telephone": (f"An old office desk phone ringing once in an empty office at night, muffled, {SEC}", 2.0, 0.5),
        "imprimante": (f"An office laser printer waking up, whirring and clicking briefly, then stopping, {SEC}", 2.0, 0.5),
        "chaise": (f"An office swivel chair creaking on its own in a quiet carpeted room, {SEC}", 2.0, 0.5),
    },
}
