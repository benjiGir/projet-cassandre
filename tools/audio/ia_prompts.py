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
0,5 s, coulissante 0,45 s, rideau 1,4 s, `game/level/doors.ts`).
"""

from __future__ import annotations

EPOQUE = "1990s first-person shooter game sound effect"
SEC = "dry, no music, no voice-over"

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
}

# Les ambiances (amb_*) ne sont PAS ici : ce sont des boucles exactes, vérifiées
# à l'échantillon près par `build_sprite.py`. Un modèle génère volontiers une
# boucle, mais il ne garantit pas le raccord ; à traiter à part, après les
# sons ponctuels.
