"""Page d'écoute locale pour choisir les sons du jeu.

    ./.venv-refs/bin/python3 tools/audio/audition.py
    # puis http://localhost:5173/audition/ (serveur de dev)

Existe pour une raison simple : **un agent ne peut pas écouter**. Il peut
trier par nom, durée et niveau, traiter proprement, mais pas juger si un son
claque. Cette page pose côte à côte, pour chaque son du jeu, les versions déjà
écoutées (`HISTORIQUE`), celle qui est installée, des variantes de TRAITEMENT
sur la même prise (`COMPARAISONS`) et des variantes de PRISE (`VARIANTES`) —
toutes passées par la MÊME chaîne que `import_sfx.py`, sinon la comparaison
mentirait.

Ce qu'elle écrit (`public/audition/`) est temporaire et gitignoré : une fois
le choix fait, il se note dans la table de `import_sfx.py`, et le dossier part.
"""

from __future__ import annotations

import html
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import import_sfx as I  # noqa: E402
import synth_sfx as SY  # noqa: E402

SORTIE = os.path.join(I.ROOT, "public", "audition")
K = I.K
F = I.F
V = f"{K}/kenney_voiceover-pack/Male"

# Versions PRÉCÉDENTES remises en regard, de la plus ancienne à la plus
# récente. Chaque entrée est un dossier de `public/` contenant `<sfx>.ogg` ;
# tous sont gitignorés et se remplissent à la main avant une écoute (pour la
# passe rejetée du 2026-09-20 : `git show <commit>:public/assets/audio/sfx/…`).
# Sans ça, la page ne montrerait que l'état courant, et on ne saurait pas si on
# avance.
HISTORIQUE = [("audition_avant", "synthétique (l'origine)"),
              ("audition_rejete", "1re passe CC0 (rejetée)")]

# Variantes proposées à l'écoute, EN PLUS de celle installée. Le commentaire
# dit ce qu'on cherche à trancher.
VARIANTES: dict[str, list[tuple[str, str, float]]] = {
    # (étiquette, chemin sous cc0_raw, durée max)
    # Quel fusil à pompe : deux vrais pompes 12, et une prise plus lointaine.
    "shotgun_fire": [("Benelli Nova", f"{F}/Nova/O_21P.wav", 0.90),
                     ("Model 12, plus loin", f"{F}/Model 12/K_17P.wav", 1.10),
                     ("Mossberg", f"{F}/Mossberg/N_30P.wav", 0.90)],
    # Quel calibre pour l'arme de poing : du .45 au .380.
    "pistol_fire": [("Walther PPQ 9 mm", f"{F}/Walther PPQ/X_39P.wav", 0.55),
                    ("Bersa .380", f"{F}/Bersa/F_47P.wav", 0.50),
                    ("S&W 642, revolver", f"{F}/Smith & Wesson 642/V_27P.wav", 0.55)],
    "impact_concrete": [("pioche 3", f"{K}/kenney_impact-sounds/Audio/impactMining_003.ogg", 0.35),
                        ("générique léger", f"{K}/kenney_impact-sounds/Audio/impactGeneric_light_000.ogg", 0.35),
                        ("pas sur béton", f"{K}/kenney_impact-sounds/Audio/footstep_concrete_000.ogg", 0.35)],
    "impact_metal": [("métal lourd", f"{K}/kenney_impact-sounds/Audio/impactMetal_heavy_000.ogg", 0.35),
                     ("tôle", f"{K}/kenney_impact-sounds/Audio/impactPlate_medium_000.ogg", 0.35),
                     ("loquet métallique", f"{K}/kenney_rpg-audio/Audio/metalClick.ogg", 0.30)],
    "impact_flesh": [("mou lourd", f"{K}/kenney_impact-sounds/Audio/impactSoft_heavy_000.ogg", 0.30),
                     ("coup moyen", f"{K}/kenney_impact-sounds/Audio/impactPunch_medium_000.ogg", 0.30),
                     ("coup lourd", f"{K}/kenney_impact-sounds/Audio/impactPunch_heavy_001.ogg", 0.35)],
    "door_swing": [("porte 1", f"{K}/kenney_rpg-audio/Audio/doorOpen_1.ogg", 0.80),
                   ("grincement", f"{K}/kenney_rpg-audio/Audio/creak2.ogg", 0.80),
                   ("fermeture", f"{K}/kenney_rpg-audio/Audio/doorClose_3.ogg", 0.70)],
    "door_locked": [("erreur 2", f"{K}/kenney_interface-sounds/Audio/error_002.ogg", 0.45),
                    ("erreur 6", f"{K}/kenney_interface-sounds/Audio/error_006.ogg", 0.45),
                    ("loquet", f"{K}/kenney_rpg-audio/Audio/metalLatch.ogg", 0.40)],
    "door_unlock": [("validation 1", f"{K}/kenney_interface-sounds/Audio/confirmation_001.ogg", 0.60),
                    ("validation 4", f"{K}/kenney_interface-sounds/Audio/confirmation_004.ogg", 0.60),
                    ("déclic métal", f"{K}/kenney_rpg-audio/Audio/metalClick.ogg", 0.35)],
    "secret_found": [("validation 3", f"{K}/kenney_interface-sounds/Audio/confirmation_003.ogg", 1.20),
                     ("pluck 2", f"{K}/kenney_interface-sounds/Audio/pluck_002.ogg", 0.60),
                     ("select 6", f"{K}/kenney_interface-sounds/Audio/select_006.ogg", 0.60)],
    "heal_pickup": [("pluck 2", f"{K}/kenney_interface-sounds/Audio/pluck_002.ogg", 0.45),
                    ("select 3", f"{K}/kenney_interface-sounds/Audio/select_003.ogg", 0.45),
                    ("validation 4", f"{K}/kenney_interface-sounds/Audio/confirmation_004.ogg", 0.50)],
    "ammo_pickup": [("pièces 2", f"{K}/kenney_rpg-audio/Audio/handleCoins2.ogg", 0.60),
                    ("déclic métal", f"{K}/kenney_rpg-audio/Audio/metalClick.ogg", 0.35),
                    ("boucle de ceinture", f"{K}/kenney_rpg-audio/Audio/beltHandle1.ogg", 0.50)],
    "prop_break_wood": [("bois lourd 3", f"{K}/kenney_impact-sounds/Audio/impactWood_heavy_003.ogg", 0.70),
                        ("bois moyen", f"{K}/kenney_impact-sounds/Audio/impactWood_medium_000.ogg", 0.60),
                        ("hache", f"{K}/kenney_rpg-audio/Audio/chop.ogg", 0.50)],
    "prop_break_glass": [("verre lourd 3", f"{K}/kenney_impact-sounds/Audio/impactGlass_heavy_003.ogg", 0.90),
                         ("verre d'interface 1", f"{K}/kenney_interface-sounds/Audio/glass_001.ogg", 0.90),
                         ("verre d'interface 4", f"{K}/kenney_interface-sounds/Audio/glass_004.ogg", 0.90)],
    # Les vocalisations : aucun pack CC0 n'a de grognement. Ce qui existe, ce
    # sont des répliques militaires — à juger, pour des vigiles en costard qui
    # parlent comme une unité d'intervention.
    "enemy_alert": [("« target engaged »", f"{V}/war_target_engaged.ogg", 1.40),
                    ("« look out »", f"{V}/war_look_out.ogg", 1.20),
                    ("« call for backup »", f"{V}/war_call_for_backup.ogg", 1.60)],
    "enemy_telegraph": [("« go go go »", f"{V}/war_go_go_go.ogg", 1.20),
                        ("déclic métal", f"{K}/kenney_rpg-audio/Audio/metalClick.ogg", 0.30),
                        ("dégainer", f"{K}/kenney_rpg-audio/Audio/drawKnife2.ogg", 0.40)],
    "enemy_hurt": [("coup mou", f"{K}/kenney_impact-sounds/Audio/impactSoft_medium_002.ogg", 0.30),
                   ("étoffe", f"{K}/kenney_rpg-audio/Audio/cloth2.ogg", 0.35)],
    "enemy_death": [("chute molle", f"{K}/kenney_impact-sounds/Audio/impactSoft_heavy_003.ogg", 0.60),
                    ("cuir qui tombe", f"{K}/kenney_rpg-audio/Audio/dropLeather.ogg", 0.60)],
    # Les deux portes mécaniques : rien de vraiment pneumatique dans ces packs.
    "door_slide": [("défilement", f"{K}/kenney_interface-sounds/Audio/scroll_001.ogg", 0.80),
                   ("agrandir", f"{K}/kenney_interface-sounds/Audio/maximize_003.ogg", 0.80)],
    "door_shutter": [("raclement", f"{K}/kenney_interface-sounds/Audio/scratch_002.ogg", 1.20),
                     ("grincement 3", f"{K}/kenney_rpg-audio/Audio/creak3.ogg", 1.20)],
}

# Variantes entièrement spécifiées, quand l'écoute ne porte pas sur le CHOIX
# de la prise mais sur son TRAITEMENT. Depuis le 2026-09-20 c'est le cas des
# armes : la prise est bonne, ce qui manquait était le grave (voir `I.Grave`).
COMPARAISONS: dict[str, list[tuple[str, "I.Source"]]] = {
    "shotgun_fire": [
        ("sans grave reconstruit",
         I.Source(f"{F}/Model 12/K_22P.wav", duree=0.90, pack="audition")),
        ("grave plus discret",
         I.Source(f"{F}/Model 12/K_22P.wav", duree=0.90, pack="audition",
                  grave=I.Grave(160, 85, 0.050, 0.060, 0.20, 0.13))),
        ("grave plus lourd",
         I.Source(f"{F}/Model 12/K_22P.wav", duree=0.90, pack="audition",
                  grave=I.Grave(155, 70, 0.075, 0.100, 0.42, 0.28))),
    ],
    "pistol_fire": [
        ("sans grave reconstruit",
         I.Source(f"{F}/1911/A_42P.wav", duree=0.55, pack="audition")),
        ("grave plus discret",
         I.Source(f"{F}/1911/A_42P.wav", duree=0.55, pack="audition",
                  grave=I.Grave(180, 95, 0.030, 0.040, 0.22, 0.12))),
        ("grave plus lourd",
         I.Source(f"{F}/1911/A_42P.wav", duree=0.55, pack="audition",
                  grave=I.Grave(175, 78, 0.045, 0.060, 0.48, 0.25))),
    ],
}

# Sons FABRIQUÉS proposés à l'écoute (`synth_sfx.py`). Même rôle que
# `COMPARAISONS` : la question n'est pas quelle prise, mais quel réglage.
SYNTHESES: dict[str, list[tuple[str, "SY.Souffle", int]]] = {
    # Le pied-de-biche : quelle masse a la barre ? Trois poids, du plus sec au
    # plus lourd. Celui du milieu est ce qui est installé.
    "melee_fire": [
        ("barre plus légère", SY.Souffle(0.30, 300, 1300, 380, 0.58, 1.7, 0.22, brillance=5200), 0x0C12),
        ("barre plus lourde", SY.Souffle(0.40, 190, 760, 240, 0.60, 1.6, 0.70, brillance=3000), 0x0C12),
        ("barre plus rapide", SY.Souffle(0.24, 260, 1050, 320, 0.55, 1.8, 0.45, brillance=3800), 0x0C12),
    ],
}

# Les armes de remplacement passent par la MÊME reconstruction de grave que
# celle qui est installée : sans ça on comparerait un pompe avec ventre à un
# pompe sans ventre, et le ventre gagnerait à tous les coups.
GRAVE_VARIANTE = {"shotgun_fire": I.SOURCES["shotgun_fire"].grave,
                  "pistol_fire": I.SOURCES["pistol_fire"].grave}

# Les sons du jeu, dans l'ordre de la page.
ORDRE = ["shotgun_fire", "pistol_fire", "melee_fire", "impact_concrete", "impact_metal", "impact_flesh",
         "enemy_alert", "enemy_telegraph", "enemy_hurt", "enemy_death", "door_swing", "door_slide",
         "door_shutter", "door_locked", "door_unlock", "secret_found", "heal_pickup", "ammo_pickup",
         "prop_break_wood", "prop_break_glass"]


def rendre(s: "I.Source", sortie: str) -> bool:
    """Passe une variante par la chaîne d'`import_sfx`, vers `public/audition`."""
    source = os.path.join(I.BRUT, s.chemin)
    if not os.path.exists(source):
        print(f"[audition] source absente, ignorée : {s.chemin}")
        return False
    data, hz = I.lire(source)
    data = I.traiter(data, hz, s)
    import wave

    with wave.open(os.path.join(SORTIE, sortie + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(I.HZ)
        w.writeframes((data * 32767).astype("<i2").tobytes())
    import subprocess

    # La MÊME qualité que l'import : comparer deux encodages différents
    # reviendrait à juger l'encodeur en croyant juger la prise.
    subprocess.run(["oggenc", "-Q", "-q", I.QUALITE_OGG, "-o", os.path.join(SORTIE, sortie + ".ogg"),
                    os.path.join(SORTIE, sortie + ".wav")], check=True)
    os.unlink(os.path.join(SORTIE, sortie + ".wav"))
    return True


def rendre_synth(s: "SY.Souffle", graine: int, sortie: str) -> bool:
    """Même chose pour un son fabriqué : il n'a pas de fichier source."""
    import subprocess
    import wave

    data = SY.souffler(s, I.HZ, graine)
    with wave.open(os.path.join(SORTIE, sortie + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(I.HZ)
        w.writeframes((data * 32767).astype("<i2").tobytes())
    subprocess.run(["oggenc", "-Q", "-q", I.QUALITE_OGG, "-o", os.path.join(SORTIE, sortie + ".ogg"),
                    os.path.join(SORTIE, sortie + ".wav")], check=True)
    os.unlink(os.path.join(SORTIE, sortie + ".wav"))
    return True


def main() -> None:
    shutil.rmtree(SORTIE, ignore_errors=True)
    os.makedirs(SORTIE, exist_ok=True)

    lignes = []
    for sfx in ORDRE:
        pistes = []
        # Ce qu'on a déjà écouté, dans l'ordre chronologique.
        for rang, (dossier, etiquette) in enumerate(HISTORIQUE):
            ancien = os.path.join(I.ROOT, "public", dossier, f"{sfx}.ogg")
            if os.path.exists(ancien):
                shutil.copy(ancien, os.path.join(SORTIE, f"{sfx}__h{rang}.ogg"))
                pistes.append((etiquette, f"{sfx}__h{rang}.ogg"))

        installe = os.path.join(I.SORTIE, f"{sfx}.ogg")
        if os.path.exists(installe):
            shutil.copy(installe, os.path.join(SORTIE, f"{sfx}__installe.ogg"))
            source = (I.SOURCES[sfx].chemin.rsplit("/", 1)[-1] if sfx in I.SOURCES
                      else "fabriqué" if sfx in I.FABRIQUES else "synthèse")
            pistes.append((f"INSTALLÉ — {source}", f"{sfx}__installe.ogg"))

        # Même prise, traitement différent.
        for i, (etiquette, s) in enumerate(COMPARAISONS.get(sfx, [])):
            if rendre(s, f"{sfx}__c{i}"):
                pistes.append((etiquette, f"{sfx}__c{i}.ogg"))

        # Réglages d'un son fabriqué.
        for i, (etiquette, s, graine) in enumerate(SYNTHESES.get(sfx, [])):
            if rendre_synth(s, graine, f"{sfx}__s{i}"):
                pistes.append((etiquette, f"{sfx}__s{i}.ogg"))

        # Autre prise, même traitement que celle installée.
        for i, (etiquette, chemin, duree) in enumerate(VARIANTES.get(sfx, [])):
            s = I.Source(chemin, duree=duree, pack="audition", grave=GRAVE_VARIANTE.get(sfx))
            if rendre(s, f"{sfx}__v{i}"):
                pistes.append((etiquette, f"{sfx}__v{i}.ogg"))

        lignes.append((sfx, pistes))

    with open(os.path.join(SORTIE, "index.html"), "w") as f:
        f.write(PAGE % "\n".join(bloc(sfx, pistes) for sfx, pistes in lignes))
    print(f"[audition] {len(lignes)} sons -> http://localhost:5173/audition/")


def bloc(sfx: str, pistes: list[tuple[str, str]]) -> str:
    boutons = "\n".join(
        f'      <button data-src="{html.escape(f)}">{html.escape(t)}</button>' for t, f in pistes)
    return f'''  <section>
    <h2>{html.escape(sfx)}</h2>
    <div class="pistes">
{boutons}
    </div>
  </section>'''


PAGE = """<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<title>Écoute des sons — PROJET_CASSANDRE</title>
<style>
  :root { color-scheme: dark; }
  body { background: #14141a; color: #e8e8ee; font: 15px/1.5 ui-monospace, monospace; margin: 0 auto;
         max-width: 62rem; padding: 2rem 1rem 4rem; }
  h1 { font-size: 1.4rem; }
  p.aide { color: #9a9aa8; }
  section { border-top: 1px solid #2a2a36; padding: .6rem 0; }
  h2 { font-size: 1rem; margin: 0 0 .4rem; color: #8fd3ff; }
  .pistes { display: flex; flex-wrap: wrap; gap: .4rem; }
  button { background: #22222c; color: #e8e8ee; border: 1px solid #39394a; border-radius: 4px;
           padding: .35rem .7rem; font: inherit; cursor: pointer; }
  button:hover { background: #2e2e3c; }
  button.joue { background: #2e6f4e; border-color: #47a273; }
  button[data-src*="__installe"] { border-color: #7a6a2a; }
  button[data-src*="__h"] { color: #9a9aa8; }
</style>
<h1>Écoute des sons</h1>
<p class="aide">Un clic joue le son. <strong>INSTALLÉ</strong> = ce qui est dans le jeu en ce moment ;
les boutons gris à sa gauche sont les versions déjà écoutées, de la plus ancienne à la plus récente ;
ceux de droite sont des variantes, toutes passées par la même chaîne.</p>
<p class="aide">Les deux armes ouvrent la page : commence par elles. La question du jour n'est pas
« quelle arme » mais <strong>combien de grave</strong> — les prises de la bibliothèque n'en ont aucun, il est
reconstruit. « sans grave reconstruit » est exactement ce qui a été rejeté, en mieux enregistré.</p>
<p class="aide">Dis-moi les remplacements à faire, je les note dans <code>tools/audio/import_sfx.py</code>.</p>
%s
<script>
  let courant = null;
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-src]");
    if (!b) return;
    if (courant) { courant.pause(); document.querySelectorAll("button.joue").forEach(x => x.classList.remove("joue")); }
    courant = new Audio(b.dataset.src);
    b.classList.add("joue");
    courant.addEventListener("ended", () => b.classList.remove("joue"));
    courant.play();
  });
</script>
</html>
"""


if __name__ == "__main__":
    main()
