"""
Recettes sonores de PROJET_CASSANDRE.

Chaque recette est une fonction (seed) -> signal. Parametrique, deterministe,
versionnable en texte. Le WAV est un artefact de build, pas une source.

Ajouter un son = ajouter une fonction et l'inscrire dans RECIPES.

PLAN DE BANDES — a lire avant de toucher une arme
-------------------------------------------------
Deux passes de sons tirees d'echantillons ont ete rejetees, la seconde avec
ces mots : « le pistolet et le pompe on dirait le meme son moche en plus ».
Mesure faite apres coup : les deux armes avaient une correlation de timbre
de +0,976. La distinction des armes n'est donc pas un confort, c'est la
raison pour laquelle tout ce module existe.

Garde-fou : spectre moyen des 250 premieres ms, 30 bandes log de 100 Hz a
16 kHz, en dB, moyenne retiree, puis corrcoef entre deux sons. Toute paire
d'armes doit rester SOUS 0,55.

Les trois armes a feu se partagent donc le spectre, et chacune tient sa
bande :

    shotgun      le GRAVE      pente descendante, energie 100-700 Hz
    pistol_fire  le MEDIUM     passe-haut 800 Hz, bosses a 1,25 et 7,5 kHz
    suit_shot    l'AIGU        passe-haut 1500 Hz, resonance de culasse 3,8 kHz

Deux leviers, dans cet ordre d'efficacite mesuree :

1. La REVERB. Sur un son de 60 ms, la queue pese plus lourd que le son dans
   le spectre moyen. Une reverb commune donne a tout le mixage la meme
   couleur et fait converger les timbres : passer suit_shot de mix 0.20 a
   0.07 a fait plus pour sa distinction que tout le reste (correlation avec
   impact_concrete : 0,81 -> 0,24).
2. La FORME. Un bruit large bande ressemble a tout autre bruit large bande.
   Ce qui decorrele, c'est une forme marquee — une pente franche (shotgun)
   ou un pic etroit (suit_telegraph, +45 dB a 458 Hz, le son le plus
   distinct du jeu et ce n'est pas un hasard).
"""

from __future__ import annotations

import numpy as np

from enregistrements import prise
from synth import (SR, bandpass, brown, bubble, bubbles, chocs, crush, delay,
                   env_ad, env_adsr, env_exp, eq_circulaire, fade, highpass,
                   layer, limiteur, lowpass, loop_seamless, noise_burst, norm, periodique,
                   pink, reverb, resonant, rng, saturate, sine, sine_drop,
                   slapback, sweep_lowpass, t, transient, turbulence, white)

# Signature acoustique du lieu : hypermarche vide, beton, plafond a 5 m.
ROOM = dict(room=0.42, mix=0.22, damp=3200)
ROOM_RESERVE = dict(room=0.85, mix=0.32, damp=2200)   # reserve, 7 m, metal


# ============================================================ ARMES

def shotgun(seed=0):
    """
    Fusil a pompe. Percuteur, souffle, corps grave, claquement.

    Le sine_drop est ce qui donne le poids — sans lui, un tir sonne comme
    un bruit blanc coupe, pas comme une arme.

    Les TROIS armes a feu du jeu se partagent le spectre, et c'est un
    contrat de lisibilite, pas une preference (voir suit_shot et
    pistol_fire) : le pompe tient le GRAVE. Son energie vit entre 100 et
    700 Hz, le souffle se referme vers 320 Hz, et le claquement d'air ne
    dure que 35 ms — juste l'attaque. Un pompe qui garde de l'aigu pendant
    250 ms devient une arme de poing forte, ce qui est exactement le
    reproche qui a coule les deux passes precedentes.
    """
    click = transient(0.005, seed, hp=2200) * 0.40
    body = noise_burst(0.30, 80, 5200, decay=19, seed=seed)
    body = sweep_lowpass(body, 5200, 320) * 1.15   # l'energie se referme, vite
    boom = (lowpass(white(0.34, seed + 3), 420)
            * env_ad(int(0.34 * SR), 0.001, 13) * 0.95)
    weight = sine_drop(0.17, 210, 46, curve=2.2) * env_exp(int(0.17 * SR), 26) * 0.95
    # Le claquement reste HORS de la saturation : sature, il s'etale vers le
    # haut et rend le pompe brillant sur toute sa duree.
    crack = noise_burst(0.035, 2200, 9000, decay=150, seed=seed + 1) * 0.45
    core = lowpass(saturate(layer(click, body, boom, weight), 2.6), 6500)
    return reverb(layer(core, crack), **ROOM)


def shotgun_pump(seed=0):
    """Rearmement. Deux mecanismes distincts, separes par 90 ms."""
    back = layer(
        transient(0.008, seed, hp=1800) * 0.8,
        resonant(noise_burst(0.06, 900, 6000, 55, seed=seed), 2400, q=12) * 0.6,
    )
    fwd = layer(
        transient(0.006, seed + 1, hp=2200) * 1.0,
        resonant(noise_burst(0.05, 1200, 7000, 70, seed=seed + 1), 3100, q=14) * 0.7,
    )
    return reverb(layer(back, delay(fwd, 0.09)), room=0.2, mix=0.14)


def shell_drop(seed=0):
    """Douille au sol. Trois rebonds, resonance metallique."""
    outs = []
    for i, (dt, amp) in enumerate([(0.0, 1.0), (0.085, 0.45), (0.15, 0.2)]):
        h = resonant(noise_burst(0.05, 1800, 9000, 110, seed=seed + i), 4200 + i * 600, q=18)
        outs.append(delay(h * amp, dt))
    return reverb(layer(*outs) * 0.5, room=0.18, mix=0.12)


def pistol_fire(seed=0):
    """
    Pistolet du JOUEUR. Troisieme arme a feu du jeu, et la plus contrainte :
    elle doit se distinguer du pompe (l'autre arme du joueur) ET du tir du
    Costard (sinon on confond son propre tir avec celui qu'on recoit).

    Sa place est le MEDIUM, entre les deux : passe-haut franc a 700 Hz pour
    lui interdire le grave du pompe, formant de corps a 1,05 kHz, et un
    claquement d'air a 9,5 kHz — deux bosses la ou les deux autres n'en ont
    qu'une. Le sine_drop existe mais une octave au-dessus de celui du pompe :
    du punch, pas du poids.

    Le claquement est haut (9,5 kHz) et le formant resserre (q=16) pour une
    raison precise : a 7,5 kHz et q=12, le pistolet couvrait son propre
    impact_flesh (+0,79) — le joueur tirait sans jamais entendre s'il
    touchait. Meme defaut que celui corrige sur le pompe, meme remede.
    """
    click = transient(0.004, seed, hp=1600) * 0.45
    raw = noise_burst(0.10, 600, 4200, decay=50, seed=seed)
    body = layer(resonant(raw, 1050, q=16), raw * 0.04)
    crack = resonant(noise_burst(0.045, 3000, 11000, 120, seed=seed + 1),
                     9500, q=14) * 0.70
    punch = sine_drop(0.05, 420, 176, curve=2.3) * env_exp(int(0.05 * SR), 60) * 0.35
    sig = highpass(layer(click, body, crack, punch), 700)
    return reverb(saturate(sig, 1.9), room=0.24, mix=0.09, damp=3800)


def crowbar_swing(seed=0):
    """Coup dans le vide. Bruit de deplacement d'air, montant puis coupe."""
    n = int(0.17 * SR)
    swish = bandpass(white(0.17, seed), 700, 5500) * np.concatenate([
        np.linspace(0, 1, int(n * 0.65)) ** 2, np.linspace(1, 0, n - int(n * 0.65)) ** 3])
    return swish * 0.55


def crowbar_hit_metal(seed=0):
    """Impact metal. Deux resonances desaccordees = timbre non harmonique."""
    imp = transient(0.004, seed, hp=1500) * 0.9
    ring = layer(
        resonant(white(0.4, seed), 1850, q=45) * env_exp(int(0.4 * SR), 11) * 0.5,
        resonant(white(0.4, seed + 1), 3170, q=38) * env_exp(int(0.4 * SR), 16) * 0.32,
    )
    return reverb(layer(imp, ring), **ROOM)


def crowbar_hit_flesh(seed=0):
    """Impact mou. Grave, court, humide. Aucune resonance."""
    thud = lowpass(white(0.13, seed), 700) * env_exp(int(0.13 * SR), 42) * 0.9
    low = sine_drop(0.1, 130, 48, curve=1.7) * env_exp(int(0.1 * SR), 48) * 0.6
    return reverb(saturate(layer(thud, low), 2.0), room=0.22, mix=0.12)


# ============================================================ IMPACTS

def impact_concrete(seed=0):
    dust = noise_burst(0.1, 400, 5000, decay=60, seed=seed) * 0.7
    tick = transient(0.003, seed, hp=3000) * 0.5
    return reverb(layer(tick, dust), **ROOM)


def impact_metal(seed=0):
    tick = transient(0.003, seed, hp=4000) * 0.8
    ring = resonant(white(0.25, seed), 5200, q=30) * env_exp(int(0.25 * SR), 26) * 0.45
    return reverb(layer(tick, ring), **ROOM)


def impact_flesh(seed=0):
    """
    Balle dans un corps. A ne pas confondre avec crowbar_flesh, qui est un
    coup de BARRE : celui-la est lent, grave et pousse ; celui-ci est un
    claquement humide de 70 ms, plus haut, qui s'arrete net.

    La piece n'y est presque pas : une balle qui entre ne reveille pas
    l'hypermarche.

    Ecart assume avec weapon-sound-design, qui donne la chair comme « passe-
    bas serre, zero resonance » : c'est la recette de crowbar_flesh, et la
    reprendre ici donnait deux sons a +0,70 l'un de l'autre. Une balle n'est
    pas une masse qui pousse, elle perce — d'ou un corps plus haut (2 kHz)
    et une gerbe a 5-9 kHz. Mesure : crowbar_flesh +0,70 -> -0,33.

    Et surtout : la version grave etait a +0,94 du pompe, c'est-a-dire
    entierement masquee par le tir qui la declenche. Un joueur n'avait
    aucune confirmation de touche.
    """
    dur, n = 0.07, int(0.07 * SR)
    raw = bandpass(white(dur, seed), 900, 5500) * env_ad(n, 0.0003, 90)
    body = layer(resonant(raw, 2000, q=8), raw * 0.12)
    spat = (bandpass(white(0.035, seed + 1), 5000, 9000)
            * env_ad(int(0.035 * SR), 0.0002, 150) * 0.25)
    thump = sine_drop(0.05, 260, 120, curve=2.0) * env_exp(int(0.05 * SR), 75) * 0.20
    return reverb(saturate(highpass(layer(body, spat, thump), 700), 1.8),
                  room=0.18, mix=0.09)


def prop_break_wood(seed=0):
    """
    Caisse ou carton qui cede. Une fente initiale, puis des eclats secs et
    des debris qui retombent.

    Le bois n'a PAS de queue : ce qui resonne apres, c'est la piece, jamais
    l'objet. Les eclats sont places au hasard mais avec une seed — meme
    graine, meme debris, comme tout le reste du projet.
    """
    g = rng(seed)
    crack = layer(
        transient(0.004, seed, hp=900) * 0.9,
        resonant(noise_burst(0.09, 250, 3500, 55, seed=seed), 560, q=7) * 0.8,
    )
    splinters = []
    for i in range(9):
        dt = float(g.uniform(0.01, 0.30))
        f = float(g.uniform(700, 2600))
        s = resonant(noise_burst(0.05, 400, 5000, 95, seed=seed + i + 1), f, q=9)
        splinters.append(delay(s * float(g.uniform(0.2, 0.55)), dt))
    thud = lowpass(white(0.12, seed + 20), 400) * env_exp(int(0.12 * SR), 40) * 0.55
    debris = delay(bandpass(white(0.22, seed + 30), 600, 5000)
                   * env_exp(int(0.22 * SR), 16) * 0.22, 0.12)
    return reverb(layer(crack, thud, debris, *splinters), room=0.3, mix=0.16)


def impact_glass(seed=0):
    """Verre brise — rayon surgeles. Eclats sparses a haute frequence."""
    g = rng(seed)
    shards = []
    for i in range(14):
        dt = float(g.uniform(0, 0.28))
        f = float(g.uniform(3500, 11000))
        s = resonant(white(0.09, seed + i), f, q=28) * env_exp(int(0.09 * SR), 80)
        shards.append(delay(s * float(g.uniform(0.25, 1.0)), dt))
    crash = noise_burst(0.12, 2500, 12000, decay=34, seed=seed) * 0.8
    return reverb(layer(crash, *shards) * 0.6, **ROOM)


# ============================================================ RAMASSAGE

def pickup_ammo(seed=0):
    """Metallique, neutre, court. Ne doit pas se confondre avec un tir."""
    n = int(0.16 * SR)
    a = sine(0.16, 880) * env_exp(n, 22) * 0.5
    b = sine(0.16, 1320) * env_exp(n, 28) * 0.35
    clink = resonant(noise_burst(0.05, 2000, 9000, 80, seed=seed), 5000, q=20) * 0.4
    return reverb(layer(a, b, clink), room=0.2, mix=0.16)


def pickup_health(seed=0):
    """Montant, chaud. La forme dit 'bon pour toi' sans mot."""
    n = int(0.3 * SR)
    notes = [(523.25, 0.0), (659.25, 0.055), (783.99, 0.11)]
    outs = [delay(sine(0.3, f) * env_exp(n, 9) * 0.42, dt) for f, dt in notes]
    return reverb(layer(*outs), room=0.3, mix=0.2)


def pickup_key(seed=0):
    """Badge du directeur. Plus long, plus signifiant, note tenue."""
    n = int(0.55 * SR)
    pad = layer(
        sine(0.55, 440) * env_ad(n, 0.02, 5) * 0.4,
        sine(0.55, 660) * env_ad(n, 0.04, 6) * 0.3,
        sine(0.55, 880) * env_ad(n, 0.06, 7) * 0.2,
    )
    sparkle = resonant(noise_burst(0.2, 4000, 12000, 22, seed=seed), 8000, q=12) * 0.25
    return reverb(layer(pad, sparkle), room=0.5, mix=0.3)


def secret_found(seed=0):
    """
    Secret. Doit etre INSTANTANEMENT distinct de tout le reste du jeu :
    c'est la recompense, et le joueur doit savoir sans regarder le HUD.
    """
    n = int(0.75 * SR)
    arp = [(523.25, 0.0), (783.99, 0.07), (1046.5, 0.14), (1567.98, 0.21)]
    outs = [delay(sine(0.75, f) * env_exp(n, 4.5) * 0.35, dt) for f, dt in arp]
    shimmer = resonant(pink(0.75, seed), 6000, q=6) * env_exp(n, 3.5) * 0.18
    return reverb(layer(*outs, shimmer), room=0.7, mix=0.38)


# ============================================================ ENNEMI

def suit_telegraph(seed=0):
    """
    Telegraphie d'attaque du Costard. Contrat de lisibilite :
    au moins 200 ms avant les degats, timbre unique dans tout le mixage,
    et suffisamment aigu pour etre localisable en panning stereo.

    C'est le son le plus important du jeu apres le tir du joueur.
    """
    n = int(0.22 * SR)
    ratchet = resonant(noise_burst(0.1, 1500, 7000, 45, seed=seed), 3600, q=22) * 0.6
    rise = sine_drop(0.22, 380, 900, curve=0.55) * env_ad(n, 0.05, 6) * 0.35
    return reverb(layer(ratchet, rise), **ROOM)


def suit_shot(seed=0):
    """
    Tir du Costard. C'est une arme de POING, et elle doit s'entendre comme
    telle : le joueur doit savoir, sans rien voir, que ce coup de feu n'est
    pas le sien.

    Donc rien sous 400 Hz (le grave appartient au pompe), un corps serre
    entre 1,5 et 6 kHz, une resonance de culasse a 3,9 kHz, et un sine_drop
    reduit a un 'pop' de 35 ms au lieu du poids d'un pompe. C'est plus fin
    que la realite d'un 9 mm — la lisibilite passe avant, comme le fait la
    telegraphie juste a cote.
    """
    click = transient(0.0035, seed, hp=4500) * 0.55
    # Corps ETROIT (une resonance de culasse) et non large bande : un bruit
    # large a la meme forme spectrale qu'un impact de beton, et le joueur
    # confondrait le coup de feu avec sa propre balle dans le mur d'a cote.
    raw = noise_burst(0.06, 2200, 9500, decay=80, seed=seed)
    body = layer(resonant(raw, 3800, q=18), raw * 0.08)
    pop = sine_drop(0.035, 620, 280, curve=2.6) * env_exp(int(0.035 * SR), 95) * 0.30
    # Le passe-haut a 1500 Hz vide completement le bas : mesure a part, le
    # son gagne en distinction et perd son CORPS — une arme sans rien sous
    # 1 kHz s'entend comme un jouet. Ce thump court le lui rend, dose au
    # point ou la distinction tient encore (voir l'en-tete du module).
    thump = resonant(noise_burst(0.045, 200, 1400, 110, seed=seed + 7), 620, q=5) * 0.22
    # Reverb volontairement SECHE. Sur un son de 60 ms, la queue pese plus
    # lourd que le son dans le spectre moyen : une reverb commune donne a
    # tous les sons du jeu la meme couleur, et c'est elle qui les fait se
    # ressembler. Le Costard tire sec, le pompe garde la piece.
    return reverb(layer(highpass(layer(click, body, pop), 1500), thump),
                  room=0.18, mix=0.07, damp=5200)


def suit_alert(seed=0):
    """Passage IDLE -> ALERTE. Bref, sec, tres reconnaissable."""
    n = int(0.18 * SR)
    grunt = lowpass(white(0.18, seed), 1400) * env_ad(n, 0.01, 18) * 0.5
    tone = sine_drop(0.18, 220, 160, curve=1.4) * env_exp(n, 14) * 0.4
    return reverb(saturate(layer(grunt, tone), 1.8), **ROOM)


def enemy_hurt(seed=0):
    """
    Le Costard encaisse. Expiration forcee, breve.

    Contrat : le joueur doit entendre qu'il TOUCHE sans croire qu'il a tue.

    Division du travail avec suit_death : la mort est un grondement grave
    qui DESCEND, le coup encaisse est une expiration breve et haute. Deux
    FORMANTS (760 et 2600 Hz) plutot qu'un passe-bas — c'est ce qui fait
    lire une voix plutot qu'un choc, et c'est aussi ce qui le sort de la
    famille spectrale de suit_death et suit_alert (mesure : +0,69 avec un
    passe-bas, -0,29 avec des formants).
    """
    dur = 0.13
    n = int(dur * SR)
    src = white(dur, seed)
    env = env_ad(n, 0.008, 26)
    v1 = resonant(src, 760, q=9) * env
    v2 = resonant(src, 2600, q=11) * env * 0.55
    breath = bandpass(white(dur, seed + 1), 2200, 7000) * env_ad(n, 0.004, 32) * 0.45
    return reverb(saturate(highpass(layer(v1, v2, breath), 420), 1.6),
                  room=0.24, mix=0.14)


def suit_death(seed=0):
    """Mort. Chute de hauteur + chute au sol. Le joueur doit arreter de tirer."""
    n = int(0.6 * SR)
    cry = lowpass(white(0.35, seed), 2000) * env_exp(int(0.35 * SR), 9) * 0.45
    fall = sine_drop(0.35, 240, 70, curve=1.6) * env_exp(int(0.35 * SR), 7) * 0.4
    body = delay(lowpass(white(0.15, seed + 1), 500) * env_exp(int(0.15 * SR), 34) * 0.7, 0.33)
    return reverb(saturate(layer(cry, fall, body), 2.0), **ROOM)


# ============================================================ AMBIANCE

def amb_hypermarche(seed=0, dur=14.0):
    """
    Hypermarche la nuit. Nappe de ventilation, bourdon 50 Hz des neons,
    evenements sparses (grincements, cliquetis lointains).

    Boucle sans couture par fondu croise — un bord net s'entend en jeu
    comme un clic periodique, et on ne le remarque qu'apres coup.
    """
    g = rng(seed)
    hvac = lowpass(brown(dur, seed), 450) * 0.34
    hiss = bandpass(pink(dur, seed + 1), 900, 6500) * 0.07
    hum = (sine(dur, 100) * 0.05 + sine(dur, 50) * 0.07)
    lfo = 1.0 + 0.16 * np.sin(2 * np.pi * 0.045 * t(dur))
    bed = (hvac + hiss) * lfo + hum

    events = []
    for i in range(7):
        dt = float(g.uniform(0.5, dur - 2.0))
        if g.random() < 0.5:
            e = resonant(noise_burst(0.5, 600, 3500, 9, seed=seed + 20 + i), 1500, q=16) * 0.09
        else:
            e = resonant(noise_burst(0.16, 2000, 8000, 40, seed=seed + 40 + i), 4500, q=20) * 0.07
        events.append(delay(e, dt))

    sig = layer(bed, *events)
    return loop_seamless(reverb(sig, room=1.1, mix=0.3, damp=2600), xfade=1.5)


def amb_reserve(seed=0, dur=14.0):
    """Reserve. Plus grave, plus vide, echo long. Metal qui travaille."""
    g = rng(seed)
    rumble = lowpass(brown(dur, seed), 200) * 0.42
    air = bandpass(pink(dur, seed + 1), 400, 3000) * 0.06
    lfo = 1.0 + 0.22 * np.sin(2 * np.pi * 0.028 * t(dur))
    bed = (rumble + air) * lfo

    events = []
    for i in range(5):
        dt = float(g.uniform(0.5, dur - 2.5))
        e = resonant(noise_burst(0.8, 300, 2200, 6, seed=seed + 60 + i), 900, q=20) * 0.1
        events.append(delay(slapback(e, ms=130, feedback=0.35, taps=3), dt))

    sig = layer(bed, *events)
    return loop_seamless(reverb(sig, **ROOM_RESERVE), xfade=1.5)


def amb_parking(seed=0, dur=12.0):
    """Parking exterieur. Vent, circulation lointaine, pas d'interieur."""
    wind = bandpass(brown(dur, seed), 60, 1400) * 0.3
    lfo = 1.0 + 0.3 * np.sin(2 * np.pi * 0.06 * t(dur))
    far = lowpass(pink(dur, seed + 1), 320) * 0.12
    return loop_seamless((wind * lfo + far), xfade=1.2)


# ============================================================ INTERACTIF

def pa_click(seed=0):
    """Micro d'annonces : le clic d'ouverture du circuit. Puis la replique."""
    pop = transient(0.006, seed, hp=200) * 0.7
    hiss = bandpass(white(0.35, seed), 2000, 7000) * env_exp(int(0.35 * SR), 5) * 0.12
    return layer(pop, hiss)


def door_open(seed=0):
    n = int(0.9 * SR)
    motor = bandpass(white(0.9, seed), 250, 2200) * env_ad(n, 0.08, 2.2) * 0.35
    rail = resonant(noise_burst(0.9, 600, 4000, 2.0, seed=seed + 1), 1700, q=10) * 0.2
    return reverb(layer(motor, rail), **ROOM)


def _beep(f, dur, amp, drive=6.0):
    """
    Bip de lecteur de carte. La saturation forte transforme le sinus en
    quasi-carre : c'est l'ELECTRONIQUE qui parle, pas un instrument.
    """
    return saturate(sine(dur, f), drive) * env_ad(int(dur * SR), 0.002, 12) * amp


def door_locked(seed=0):
    """
    Lecteur de carte de fidelite qui REFUSE.

    Deux bips carres DESCENDANTS, et un relais qui ne s'ouvre pas. Surtout
    pas un carillon : le refus doit contredire l'harmonie des ramassages,
    sinon le joueur lit une recompense la ou il y a un mur.
    """
    relay = transient(0.005, seed, hp=900) * 0.35
    b1 = _beep(392, 0.11, 0.42)
    b2 = delay(_beep(262, 0.17, 0.42), 0.13)
    return reverb(layer(relay, b1, b2), room=0.22, mix=0.12)


def door_unlock(seed=0):
    """
    Le lecteur ACCEPTE. Deux bips MONTANTS, puis le pene qui se retire.

    Le sens (montant) dit oui ; le clac mecanique qui suit dit que la porte
    est reellement ouverte. Sans lui, le joueur reste devant a re-presenter
    sa carte.
    """
    b1 = _beep(660, 0.09, 0.38, drive=5.0)
    b2 = delay(_beep(990, 0.12, 0.38, drive=5.0), 0.10)
    bolt = delay(layer(
        transient(0.006, seed, hp=1200) * 0.7,
        resonant(noise_burst(0.09, 500, 4500, 42, seed=seed + 1), 1400, q=9) * 0.5,
    ), 0.24)
    return reverb(layer(b1, b2, bolt), room=0.3, mix=0.16)


def door_slide(seed=0):
    """
    Porte automatique vitree du sas. Chuintement pneumatique et glissement
    sur rail.

    Attaque molle par CONCEPTION : rien ne claque, une porte de sas part en
    soufflant. Le choc est a la FIN (butee), pas au debut — c'est l'inverse
    d'un son d'impact, et c'est ce qui la rend reconnaissable.
    """
    dur, n = 1.25, int(1.25 * SR)
    hiss = (bandpass(pink(dur, seed), 700, 5200)
            * env_adsr(n, 0.09, 0.20, 0.55, 0.45) * 0.30)
    rail = resonant(lowpass(brown(dur, seed + 1), 900), 240, q=6)
    rail = rail * env_adsr(n, 0.12, 0.25, 0.60, 0.40) * 0.35
    stop = delay(lowpass(white(0.09, seed + 2), 800)
                 * env_exp(int(0.09 * SR), 45) * 0.40, dur - 0.14)
    return reverb(layer(hiss, rail, stop), **ROOM)


def door_shutter(seed=0):
    """
    Rideau metallique qui monte.

    Ce qui dit la TOLE n'est pas le timbre d'un choc mais leur REPETITION
    irreguliere : chaque lame qui passe le tambour frappe, et l'oreille lit
    la cadence. Un roulement lisse sonnerait comme un moteur, pas comme un
    rideau.
    """
    g = rng(seed)
    dur, n = 1.5, int(1.5 * SR)
    motor = resonant(bandpass(white(dur, seed), 120, 1200), 190, q=7)
    motor = motor * env_adsr(n, 0.08, 0.15, 0.70, 0.40) * 0.35
    sheet = resonant(bandpass(white(dur, seed + 5), 300, 3000), 520, q=12)
    sheet = sheet * env_adsr(n, 0.10, 0.30, 0.50, 0.50) * 0.22

    slats, at = [], 0.05
    while at < dur - 0.2:
        lame = resonant(noise_burst(0.04, 900, 7000, 130, seed=seed + len(slats)),
                        float(g.uniform(1500, 3000)), q=16)
        slats.append(delay(lame * float(g.uniform(0.18, 0.34)), at))
        at += float(g.uniform(0.045, 0.075))

    return reverb(layer(motor, sheet, *slats), **ROOM)


def cart_roll(seed=0):
    """Caddie pousse. Roulettes irregulieres — le detail qui vend le lieu."""
    g = rng(seed)
    n = int(1.1 * SR)
    base = bandpass(white(1.1, seed), 800, 5000) * 0.18
    wobble = 1.0 + 0.5 * np.sin(2 * np.pi * 7.3 * t(1.1) + g.random())
    ticks = [delay(transient(0.004, seed + i, hp=2500) * 0.16, float(g.uniform(0, 1.0)))
             for i in range(9)]
    return reverb(layer(base * wobble * env_ad(n, 0.1, 1.2), *ticks), **ROOM)


# ============================================================ SANITAIRES
#
# Les toilettes du niveau v2, facon Duke Nukem 3D : une cuvette ou un urinoir
# intact se tire la chasse (et soigne), casse il laisse un jet d'eau qu'on boit.
#
# STATUT, a lire avant d'ecouter : ce sont des PLACEHOLDERS. La direction
# arretee le 2026-09-21 veut de VRAIS enregistrements pour tout ce qui est un
# objet — l'eau et la faience en sont. Aucun enregistrement d'eau ni de
# deglutition n'existe sur disque sous une licence confirmee ; la liste de ce
# qu'il faut telecharger est dans assets_src/cc0_raw/freesound/README.md
# (ignore par git), resumee dans docs/systems/hud-audio.md#catalogue--doù-vient-chaque-son.
#
#   toilet_flush   synthese pure
#   ceramic_break  HYBRIDE : faience reelle (Kenney, assiettes CC0) + eau synthetique
#   water_gulp     synthese pure
#   amb_water_jet  synthese pure, BOUCLE du jet permanent (hors sprite)
#
# Ce que la synthese sait faire ici, et rien de plus : une structure juste
# (dans quel ordre, a quelle hauteur, combien de temps). Ce qu'elle ne sait
# pas faire, quatre passes rejetees l'ont montre : le desordre qui fait dire a
# l'oreille « ca, c'est de l'eau ». Le modele de bulles (`synth.bubble`) est ce
# qui s'en approche le plus sans enregistrement — il ne le remplace pas.

# Toilettes : petite piece carrelee. Queue courte, mais CLAIRE — le carrelage
# renvoie l'aigu que le beton de l'hypermarche absorbe.
ROOM_WC = dict(room=0.30, mix=0.20, damp=6500)

# Faience reelle : Kenney « Impact Sounds » (CC0, registre des licences). Ce
# sont des ASSIETTES qui heurtent une surface, pas une cuvette qui eclate :
# elles donnent la matiere, la recette donne l'evenement.
ASSIETTE = "kenney_audio/kenney_impact-sounds/Audio/impactPlate_{}.ogg"


def _rampe(n: int, points: list[tuple[float, float]]) -> np.ndarray:
    """Enveloppe par points (seconde, niveau), interpolee lineairement."""
    xs, ys = zip(*points)
    return np.interp(np.arange(n) / SR, xs, ys)


def toilet_flush(seed=0):
    """
    Chasse d'eau. PLACEHOLDER DE SYNTHESE, a remplacer par un enregistrement.

    L'ordre est ce qui fait une chasse, pas le timbre d'un moment : le declic
    du levier, la ruee qui tourbillonne, le siphon qui avale de l'air (le
    glouglou final, le moment le plus reconnaissable d'une vraie chasse), puis
    le robinet flotteur qui siffle en remplissant le reservoir, et s'eteint.
    Une vraie chasse dure huit secondes et le remplissage une minute : tout est
    comprime en 1,6 s, parce qu'un joueur appuie sur E et repart.

    L'eau est une NUEE DE BULLES (`synth.bubbles`) posee sur du bruit. Le bruit
    seul s'entend comme du vent ; les bulles montantes, par centaines, sont ce
    qui s'approche le plus d'un liquide sans enregistrement.

    Contrat de masquage : la telegraphie d'un Costard met 76 % de son energie
    entre 200 et 800 Hz. Une premiere version y mettait 88 % de la sienne
    (recouvrement 0,855, conflit) — deux secondes de chasse d'eau et le joueur
    n'entendait plus qu'on le visait. La bande est donc CREUSEE : l'eau passe
    par le grondement de la canalisation (sous 200 Hz) et par le chuintement
    (au-dessus de 800 Hz), et les grosses bulles du siphon restent sous 300 Hz.
    """
    g = rng(seed)
    dur = 1.62
    n = int(dur * SR)
    tt = t(dur)

    # 1. Le declic : le levier (plastique dur) qui claque, puis la soupape qui
    # se souleve dans le reservoir, un « tok » sourd.
    lever = layer(transient(0.004, seed, hp=1800) * 0.9,
                  resonant(noise_burst(0.035, 900, 6000, 120, seed=seed + 1), 2600, q=9) * 0.55,
                  resonant(noise_burst(0.02, 600, 3000, 180, seed=seed + 11), 1250, q=7) * 0.35)
    valve = delay(layer(
        sine_drop(0.07, 150, 95, curve=1.5) * env_ad(int(0.07 * SR), 0.002, 55) * 0.45,
        lowpass(white(0.05, seed + 2), 220) * env_exp(int(0.05 * SR), 70) * 0.25), 0.055)

    # 2. La ruee. Le chuintement tourne (une resonance qui balaie, de 3,4 a
    # 2 tours par seconde : la cuvette se vide) et s'assombrit a mesure que
    # l'eau descend ; la canalisation gronde dessous ; la turbulence empeche
    # tout d'etre lisse, ce qu'un liquide n'est jamais.
    ruee_env = _rampe(n, [(0, 0), (0.07, 0), (0.14, 1.0), (0.35, 0.9), (0.75, 0.55),
                          (0.92, 0.35), (1.10, 0.10), (1.25, 0)])
    tours = np.cumsum(np.interp(tt, [0, 1.2], [3.4, 2.0])) / SR
    tourbillon = 0.5 + 0.5 * np.sin(2 * np.pi * tours + float(g.uniform(0, 2 * np.pi)))
    bruit = white(dur, seed + 3)
    bas = bandpass(bruit, 900, 2000)
    haut = bandpass(bruit, 2000, 6500)
    chuinte = bas * (0.4 + 0.6 * tourbillon) + haut * (0.9 - 0.5 * tourbillon)
    chuinte = sweep_lowpass(chuinte, 7000, 2600) * turbulence(dur, 9, 0.35, seed + 4)
    chuinte = chuinte * ruee_env * 0.26
    canal = lowpass(brown(dur, seed + 5), 170) * turbulence(dur, 5, 0.4, seed + 6) * ruee_env * 0.55
    remous = bubbles(dur, 520, 0.8, 3.6, seed=seed + 7, xi=0.15, beta=1.8,
                     density=ruee_env) * 0.22

    # 3. Le siphon : l'air aspire dans le coude. De GROSSES bulles (sous
    # 300 Hz) qui montent fort, en gorgees — le « glou-glou » — et le
    # chuintement de l'air qui passe.
    siphon_env = _rampe(n, [(0, 0), (0.82, 0), (0.90, 1.0), (1.14, 0.7), (1.30, 0)])
    gorgees = 0.15 + 0.85 * np.sin(2 * np.pi * 6.0 * tt) ** 2
    glou = bubbles(dur, 70, 12.0, 28.0, seed=seed + 8, xi=0.5, beta=1.2,
                   density=siphon_env * gorgees, damping=6.0) * 0.55
    aspire = sweep_lowpass(bandpass(white(dur, seed + 9), 900, 4000), 4000, 1200)
    aspire = aspire * siphon_env * gorgees * 0.16

    # 4. Le remplissage : le robinet flotteur siffle (bruit etroit, un
    # sifflement vers 3,4 kHz), un filet d'eau retombe, et tout s'eteint.
    remplit_env = _rampe(n, [(0, 0), (1.02, 0), (1.18, 1.0), (1.40, 0.7), (dur, 0)])
    sifflet = layer(resonant(bandpass(white(dur, seed + 10), 2400, 7500), 3400, q=7) * 0.8,
                    bandpass(white(dur, seed + 12), 2400, 7500) * 0.3)
    sifflet = sifflet * remplit_env * 0.10
    filet = bubbles(dur, 140, 0.8, 2.2, seed=seed + 13, xi=0.1, beta=2.0,
                    density=remplit_env) * 0.09

    return reverb(layer(lever, valve, chuinte, canal, remous, glou, aspire, sifflet, filet),
                  **ROOM_WC)


def ceramic_break(seed=0):
    """
    Cuvette ou urinoir en faience qui eclate, et la gerbe d'eau qui part.
    HYBRIDE : la faience est un VRAI enregistrement, l'eau est synthetique.

    La faience vient de prises d'ASSIETTES (Kenney Impact Sounds, CC0). Une
    assiette n'est pas une cuvette de 20 kg : la prise principale est
    transposee de 4 demi-tons vers le bas (plus lourd, plus lent), doublee
    d'une seconde prise 20 ms plus tard (la piece cede en deux temps), et les
    eclats qui retombent sur le carrelage sont de petites prises transposees
    vers le HAUT (un petit morceau de la meme matiere). Les prises brutes
    portent 65 a 80 % de leur energie sous 80 Hz — la table, pas l'assiette :
    passe-haut systematique. La masse, elle, est un coup sourd de synthese
    SOUS 200 Hz : la cuvette est pleine d'eau et boulonnee, elle ne chante pas.

    Ce qui le separe de impact_glass, mesure et pas espere : le verre vit
    entre 3 et 16 kHz et tinte longtemps (q 28) ; la faience est plus grave,
    plus epaisse, ses eclats claquent sans chanter. Et il y a l'eau.

    La gerbe : l'alimentation sous pression cede JUSTE APRES la fracture (la
    faience d'abord, 50 ms seule), un souffle large et turbulent, des gouttes
    (bulles tres petites) et l'eau de la cuvette qui se renverse.

    Meme contrat de masquage que la chasse : on casse une cuvette EN COMBAT,
    au fusil. La bande 200-800 Hz de la telegraphie est laissee libre.
    """
    g = rng(seed)
    lourdes = ["heavy_001", "heavy_003", "heavy_000", "heavy_002"]
    moyennes = ["medium_002", "medium_000", "medium_004", "medium_003"]
    legeres = ["light_000", "light_001", "light_002", "light_003", "light_004", "medium_001"]

    fracture = prise(ASSIETTE.format(lourdes[seed % 4]), duree=0.32,
                     semitons=-4, passe_haut=600) * 0.80
    seconde = delay(prise(ASSIETTE.format(moyennes[seed % 4]), duree=0.24,
                          semitons=-2, passe_haut=700) * 0.50, 0.021)
    masse = layer(
        sine_drop(0.14, 135, 70, curve=1.6) * env_ad(int(0.14 * SR), 0.002, 30) * 0.55,
        lowpass(white(0.12, seed), 190) * env_exp(int(0.12 * SR), 38) * 0.45)

    eclats = []
    for i in range(7):
        dt = float(g.uniform(0.07, 0.52))
        morceau = prise(ASSIETTE.format(legeres[int(g.integers(len(legeres)))]),
                        duree=0.10, semitons=float(g.uniform(3, 8)), passe_haut=900)
        eclats.append(delay(morceau * float(g.uniform(0.12, 0.30)) * (1.1 - dt), dt))

    dur = 0.66
    n = int(dur * SR)
    gerbe_env = _rampe(n, [(0, 0), (0.05, 0), (0.09, 0.9), (0.25, 0.65),
                           (0.48, 0.25), (dur, 0)])
    souffle = bandpass(pink(dur, seed + 11), 1100, 7000)
    souffle = souffle * turbulence(dur, 14, 0.45, seed + 12) * gerbe_env * 0.26
    gouttes = bubbles(dur, 380, 0.6, 2.2, seed=seed + 13, xi=0.12, beta=2.2,
                      density=gerbe_env) * 0.14
    # L'eau de la cuvette qui se renverse : une eclaboussure, pas un bourdon —
    # 250 ms, bulles brisees par la turbulence (damping).
    renverse_env = _rampe(n, [(0, 0), (0.05, 0), (0.09, 1.0), (0.20, 0.30), (0.32, 0)])
    renverse = layer(
        bubbles(dur, 110, 12.0, 24.0, seed=seed + 14, xi=0.3, beta=1.4,
                density=renverse_env, damping=6.0) * 0.40,
        lowpass(white(dur, seed + 15), 200) * renverse_env * 0.30,
    )

    return reverb(layer(fracture, seconde, masse, souffle, gouttes, renverse, *eclats),
                  **ROOM_WC)


def water_gulp(seed=0):
    """
    Une gorgee au jet d'eau. PLACEHOLDER DE SYNTHESE.

    Joue a chaque appui sur E, donc souvent et vite : court (0,3 s), sec
    (c'est dans la tete, pas dans la piece — presque aucune reverb), et bas.

    Deux contraintes de la telegraphie d'un Costard, qui dessine une diagonale
    MONTANTE de 380 a 900 Hz :
    - ne pas la masquer (76 % de son energie entre 200 et 800 Hz) ;
    - ne pas lui RESSEMBLER. Une premiere version faisait monter son « gloup »
      de 250 a 700 Hz : la meme diagonale, en plus court. Le gloup vit donc
      sous 250 Hz, l'eau dans la bouche au-dessus de 1 kHz, et rien ne monte
      entre les deux.

    Trois temps : l'eau aspiree (bruit mouille et petites bulles), la
    deglutition (un claquement de langue, un coup sourd de gorge, une grosse
    bulle tres grave), deux petites bulles qui descendent avec l'eau.
    """
    g = rng(seed)
    n1 = int(0.08 * SR)
    aspire = layer(
        bandpass(white(0.08, seed), 1500, 6000) * env_ad(n1, 0.015, 45) * 0.14,
        bubbles(0.08, 160, 0.7, 2.0, seed=seed + 1, xi=0.15, beta=2.0) * 0.20,
    )
    j = float(g.uniform(0.085, 0.10))
    langue = layer(transient(0.003, seed + 3, hp=2500) * 0.12,
                   resonant(noise_burst(0.015, 800, 3000, 250, seed=seed + 4), 1400, q=6) * 0.10)
    gorge = sine_drop(0.07, 150, 85, curve=1.6) * env_ad(int(0.07 * SR), 0.004, 55) * 0.70
    coup = lowpass(white(0.05, seed + 2), 240) * env_ad(int(0.05 * SR), 0.002, 70) * 0.35
    n2 = int(0.10 * SR)
    gloup = bubble(float(g.uniform(15, 19)), xi=0.35)[:n2]
    gloup = gloup * env_exp(len(gloup), 38) * 0.45
    deglutit = delay(layer(langue, gorge, coup, gloup), j)
    apres = layer(*[delay(bubble(float(g.uniform(1.8, 3.0)), xi=0.2) * 0.10,
                          j + float(g.uniform(0.08, 0.16))) for _ in range(2)])
    return reverb(layer(aspire, deglutit, apres), room=0.10, mix=0.04, damp=5000)


# Duree de la boucle du jet, en ECHANTILLONS : 441 trames AAC de 1024, soit
# 10,24 s a 44 100 Hz. Pas une coquetterie :
# - l'AAC code par trames de 1024 ; une boucle qui en fait un nombre entier ne
#   laisse AUCUN remplissage en fin de fichier, meme pour un decodeur qui
#   ignorerait la liste d'edition du .m4a ;
# - 10,24 s font aussi un nombre entier d'echantillons a 48 000 Hz (491 520),
#   la frequence ou le navigateur reechantillonne presque toujours ;
# - au-dela de 6-8 s, aucun motif ne se repere au tour suivant.
JET_N = 441 * 1024


def _unite(x: np.ndarray) -> np.ndarray:
    """Ramene une couche a une puissance unite : les gains du melange en dB se lisent."""
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-12)


def _db(v: float) -> float:
    return 10 ** (v / 20)


def amb_water_jet(seed=0):
    """
    Jet d'eau PERMANENT d'un sanitaire casse, en boucle. PLACEHOLDER DE SYNTHESE.

    Le tuyau crache sous pression, l'eau monte d'un metre et demi et retombe en
    pluie sur le carrelage. Pas un robinet (un filet, des bulles graves), pas
    une douche (sans pression), pas une pluie dehors (sans piece), pas du vent
    (sans grain) : ce qui separe le jet de tout ca, c'est le GRAIN du souffle
    et le CREPITEMENT de ce qui retombe.

    Joue en boucle par le jeu, attenue et panoramique selon la distance au jet :
    le fichier est une source a plein volume vue de pres.

    Quatre couches :
    1. le jet : un souffle aigu (1-10 kHz) dont le timbre bascule sans cesse
       entre deux bandes, ride d'une rugosite rapide et coupe de petites
       poches d'air — le tuyau « crache », il ne souffle pas ;
    2. la pluie sur le carrelage : des milliers de chocs secs (gouttes sur
       carreau nu, gouttes dans la pellicule d'eau, bruine) dont la densite
       suit le debit du jet avec 1,1 s de retard — le temps de vol d'une
       goutte lancee a 1,5 m ;
    3. la flaque : des bulles minuscules (Minnaert, 1 a 7 kHz), la brique qui
       fait lire un LIQUIDE ;
    4. la canalisation sous pression : un grondement sous 150 Hz.

    BOUCLE EXACTE, pas un fondu croise : tout est fabrique periodique
    (`synth.periodique`, `boucle=True`), queue de reverb comprise — le raccord
    est un echantillon comme les autres. Un fondu croise creuserait le niveau
    de 3 dB au milieu du fondu, et un jet qui respire une fois par tour se
    repere mieux qu'un clic.

    Contrat de masquage, plus dur que pour la chasse : un bruit CONTINU pres
    duquel on se bat. La telegraphie d'un Costard met 76 % de son energie
    entre 200 et 800 Hz (diagonale 380 -> 900 Hz). Aucune couche n'y monte, et
    l'egaliseur final creuse 320-850 Hz de 18 dB par-dessus : la bande finit
    30 a 45 dB sous le maximum du jet, 0,04 % de son energie (recouvrement
    0,239, le plancher). Ce qu'il couvre encore de pres : le cliquet de la
    telegraphie a 3,6 kHz, pas sa montee.
    """
    n = JET_N
    dur = n / SR
    g = rng(seed)

    # 0. Le debit, qui n'est jamais regulier : lent (la pression du reseau),
    # moyen (le jet qui se tord). Tout le reste en depend.
    debit = (turbulence(dur, 0.9, 0.15, seed, boucle=True)
             * turbulence(dur, 4.0, 0.20, seed + 1, boucle=True))

    # 1. Le jet. Deux bandes dont le poids bascule sans cesse (le timbre bouge,
    # pas seulement le niveau), une rugosite rapide, et des poches d'air : le
    # jet se coupe a moitie, 30 a 70 ms, trois fois par seconde. Pente rose
    # au-dessus de 2,5 kHz : un plateau BLANC s'entend comme de la vapeur ou un
    # poste mal regle, pas comme de l'eau. La bande basse du souffle reste
    # discrete : 1-2 kHz appartient aux bulles de la flaque, l'indice qui dit
    # LIQUIDE (a poids egal, le souffle y couvrait 70 % des trames de 5 ms).
    src = white(dur, seed + 2)
    bas = periodique(lambda s: bandpass(s, 700, 3000), src)
    haut = periodique(lambda s: bandpass(s, 3000, 11000), src)
    bascule = turbulence(dur, 7.0, 1.0, seed + 3, boucle=True) / 2.0      # 0..1
    grain = turbulence(dur, 90.0, 0.35, seed + 4, boucle=True)
    poches = np.ones(n)
    for _ in range(int(g.poisson(3.0 * dur))):
        i, k = int(g.integers(n)), int(g.uniform(0.03, 0.07) * SR)
        poches[(i + np.arange(k)) % n] *= 1.0 - g.uniform(0.2, 0.5) * np.hanning(k)
    jet = (bas * (0.2 + 0.4 * bascule) + haut * (1.0 - 0.5 * bascule)) * grain * poches * debit
    jet = eq_circulaire(jet, [(2500, 0), (5000, -3), (10000, -7), (16000, -14)])

    # 2. La pluie : la densite suit le debit, avec le temps de vol d'une goutte.
    pluie = np.roll(debit, int(1.1 * SR))
    pluie = (pluie - pluie.min()) / (pluie.max() - pluie.min()) * 0.5 + 0.5
    carreau = chocs(dur, 650, seed + 5, ms=(0.25, 1.4), db=(-18, 0), density=pluie, boucle=True)
    carreau = periodique(lambda s: layer(highpass(s, 1800) * 0.7, resonant(s, 3400, q=2.5)), carreau)
    pellicule = chocs(dur, 420, seed + 6, ms=(0.8, 3.0), db=(-18, 0), density=pluie, boucle=True)
    pellicule = periodique(lambda s: bandpass(s, 500, 4500), pellicule)
    bruine = chocs(dur, 1400, seed + 7, ms=(0.15, 0.5), db=(-18, 0), density=pluie, boucle=True)
    bruine = periodique(lambda s: highpass(s, 5000), bruine)

    # 3. La flaque : bulles de 0,45 a 3,2 mm (1 a 7 kHz), jamais plus grosses —
    # une bulle de 4 mm chanterait a 800 Hz, dans la telegraphie.
    flaque = bubbles(dur, 400, 0.45, 3.2, seed=seed + 8, xi=0.1, beta=2.0,
                     density=pluie, damping=3.0, boucle=True)

    # 4. La canalisation.
    canal = periodique(lambda s: lowpass(s, 150), white(dur, seed + 9))
    canal = canal * turbulence(dur, 3.0, 0.35, seed + 10, boucle=True) * debit

    sig = (_unite(jet) * _db(-2) + _unite(carreau) * _db(-3) + _unite(pellicule) * _db(-6)
           + _unite(bruine) * _db(-10) + _unite(flaque) * _db(-3) + _unite(canal) * _db(-20))
    sig = periodique(lambda s: reverb(s, **ROOM_WC), sig)
    sig = eq_circulaire(sig, [(25, -18), (60, 0), (160, 0), (220, -8), (320, -18),
                              (850, -18), (1100, -6), (1400, 0), (12000, 0), (18000, -12)])
    # Les chocs les plus forts portent le facteur de crete a 20 dB, celui d'un
    # impact : normalise a -1 dBFS, le fichier n'aurait plus de corps. Rabotes
    # jusqu'a 12,5 dB, celui d'un bruit continu. APRES l'egaliseur, qui en
    # remontait 1,4.
    return limiteur(sig, 0.40, boucle=True)


# Recettes rendues comme des boucles EXACTES : `write_wav(boucle=True)`, sans
# fondu aux bords ni filtre qui demarre au repos (voir synth.write_wav).
# Les trois ambiances de zone n'y sont PAS, et c'est un ecart connu : elles
# se referment par `loop_seamless`, mais le fondu de 2,5 ms que `write_wav`
# pose aux bords de tout son ouvre un trou a chaque tour. Les y ajouter change
# leurs octets ; a trancher le jour ou on les branche en jeu.
BOUCLES_EXACTES = {"amb_water_jet"}


# ============================================================ UI

def ui_hover(seed=0):
    # env_ad plutot que env_exp : une sinusoide demarrant a phase 0 sous
    # enveloppe percussive pese sa premiere demi-alternance et laisse un
    # offset DC. Deux millisecondes d'attaque symetrisent.
    n = int(0.06 * SR)
    return sine(0.06, 1200) * env_ad(n, 0.002, 60) * 0.25


def ui_confirm(seed=0):
    n = int(0.16 * SR)
    return layer(sine(0.16, 880) * env_exp(n, 26) * 0.35,
                 delay(sine(0.16, 1320) * env_exp(n, 30) * 0.3, 0.05))


def ui_deny(seed=0):
    n = int(0.18 * SR)
    return saturate(saw(0.18, 160) * env_exp(n, 22) * 0.3, 2.0) if False else \
        sine_drop(0.18, 320, 140, curve=1.5) * env_exp(n, 20) * 0.35


# ============================================================ REGISTRE

RECIPES = {
    # nom              fonction            categorie   variantes
    "shotgun":        (shotgun,            "weapon",   4),
    "shotgun_pump":   (shotgun_pump,       "weapon",   3),
    "shell_drop":     (shell_drop,         "weapon",   3),
    # Le pistolet se tire bien plus souvent que le pompe : c'est lui qui a
    # le plus besoin de variantes de seed pour ne pas s'entendre en boucle.
    "pistol_fire":    (pistol_fire,        "weapon",   4),
    "crowbar_swing":  (crowbar_swing,      "weapon",   3),
    "crowbar_metal":  (crowbar_hit_metal,  "weapon",   3),
    "crowbar_flesh":  (crowbar_hit_flesh,  "weapon",   3),

    "impact_concrete": (impact_concrete,   "impact",   4),
    "impact_metal":    (impact_metal,      "impact",   4),
    "impact_flesh":    (impact_flesh,      "impact",   4),
    "impact_glass":    (impact_glass,      "impact",   2),
    "prop_break_wood": (prop_break_wood,   "impact",   3),

    "pickup_ammo":    (pickup_ammo,        "pickup",   1),
    "pickup_health":  (pickup_health,      "pickup",   1),
    "pickup_key":     (pickup_key,         "pickup",   1),
    "secret_found":   (secret_found,       "pickup",   1),

    "suit_telegraph": (suit_telegraph,     "enemy",    3),
    "suit_shot":      (suit_shot,          "enemy",    4),
    "suit_alert":     (suit_alert,         "enemy",    3),
    "enemy_hurt":     (enemy_hurt,         "enemy",    3),
    "suit_death":     (suit_death,         "enemy",    3),

    "pa_click":       (pa_click,           "interact", 1),
    "door_open":      (door_open,          "interact", 2),
    # Un lecteur de carte est une machine : il repond deux fois pareil.
    # Aucune variante de seed, et c'est voulu.
    "door_locked":    (door_locked,        "interact", 1),
    "door_unlock":    (door_unlock,        "interact", 1),
    "door_slide":     (door_slide,         "interact", 2),
    "door_shutter":   (door_shutter,       "interact", 2),
    "cart_roll":      (cart_roll,          "interact", 3),

    # Sanitaires : placeholders (voir la section). Le jeu ne joue que la seed 0 ;
    # les variantes servent a la page d'ecoute.
    "toilet_flush":   (toilet_flush,       "interact", 2),
    "ceramic_break":  (ceramic_break,      "impact",   3),
    "water_gulp":     (water_gulp,         "pickup",   4),

    "ui_hover":       (ui_hover,           "ui",       1),
    "ui_confirm":     (ui_confirm,         "ui",       1),
    "ui_deny":        (ui_deny,            "ui",       1),

    "amb_hypermarche": (amb_hypermarche,   "ambience", 1),
    "amb_reserve":     (amb_reserve,       "ambience", 1),
    "amb_parking":     (amb_parking,       "ambience", 1),
    # Boucle positionnelle, jouee pres de chaque sanitaire casse (placeholder).
    "amb_water_jet":   (amb_water_jet,     "ambience", 2),
}
