"""Page d'écoute locale pour choisir les sons du jeu.

    ./.venv-refs/bin/python3 tools/audio/audition.py
    # puis http://localhost:5173/audition/ (serveur de dev)

Existe pour une raison simple : **un agent ne peut pas écouter**. Il peut
trier par nom, durée et niveau, traiter proprement, mais pas juger si un son
claque. Cette page pose côte à côte, pour chaque son du jeu, l'ancien
placeholder synthétique, celui qui est installé, et les variantes retenues —
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

SORTIE = os.path.join(I.ROOT, "public", "audition")
K = I.K
F = I.F
V = f"{K}/kenney_voiceover-pack/Male"

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
    "melee_fire": [("lame 1", f"{K}/kenney_rpg-audio/Audio/knifeSlice.ogg", 0.35),
                   ("coup de hache", f"{K}/kenney_rpg-audio/Audio/chop.ogg", 0.40),
                   ("étoffe", f"{K}/kenney_rpg-audio/Audio/cloth3.ogg", 0.35)],
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

# Les sons du jeu, dans l'ordre de la page.
ORDRE = ["shotgun_fire", "pistol_fire", "melee_fire", "impact_concrete", "impact_metal", "impact_flesh",
         "enemy_alert", "enemy_telegraph", "enemy_hurt", "enemy_death", "door_swing", "door_slide",
         "door_shutter", "door_locked", "door_unlock", "secret_found", "heal_pickup", "ammo_pickup",
         "prop_break_wood", "prop_break_glass"]


def rendre(chemin_relatif: str, duree: float, sortie: str) -> bool:
    """Passe une variante par la chaîne d'`import_sfx`, vers `public/audition`."""
    source = os.path.join(I.BRUT, chemin_relatif)
    if not os.path.exists(source):
        print(f"[audition] source absente, ignorée : {chemin_relatif}")
        return False
    data, hz = I.lire(source)
    data = I.traiter(data, hz, I.Source(chemin_relatif, duree=duree, pack="audition"))
    import wave

    with wave.open(os.path.join(SORTIE, sortie + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(I.HZ)
        w.writeframes((data * 32767).astype("<i2").tobytes())
    import subprocess

    subprocess.run(["oggenc", "-Q", "-q", "4", "-o", os.path.join(SORTIE, sortie + ".ogg"),
                    os.path.join(SORTIE, sortie + ".wav")], check=True)
    os.unlink(os.path.join(SORTIE, sortie + ".wav"))
    return True


def main() -> None:
    avant = os.path.join(I.ROOT, "public", "audition_avant")
    shutil.rmtree(SORTIE, ignore_errors=True)
    os.makedirs(SORTIE, exist_ok=True)

    lignes = []
    for sfx in ORDRE:
        pistes = []
        # L'ancien placeholder, s'il a été mis de côté avant l'import.
        ancien = os.path.join(avant, f"{sfx}.ogg")
        if os.path.exists(ancien):
            shutil.copy(ancien, os.path.join(SORTIE, f"{sfx}__synth.ogg"))
            pistes.append(("synthétique (avant)", f"{sfx}__synth.ogg"))
        installe = os.path.join(I.SORTIE, f"{sfx}.ogg")
        if os.path.exists(installe):
            shutil.copy(installe, os.path.join(SORTIE, f"{sfx}__installe.ogg"))
            source = I.SOURCES[sfx].chemin.rsplit("/", 1)[-1] if sfx in I.SOURCES else "synthèse"
            pistes.append((f"INSTALLÉ — {source}", f"{sfx}__installe.ogg"))
        for i, (etiquette, chemin, duree) in enumerate(VARIANTES.get(sfx, [])):
            nom = f"{sfx}__v{i}"
            if rendre(chemin, duree, nom):
                pistes.append((etiquette, nom + ".ogg"))
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
  button[data-src*="__synth"] { color: #9a9aa8; }
</style>
<h1>Écoute des sons</h1>
<p class="aide">Un clic joue le son. <strong>INSTALLÉ</strong> = ce qui est dans le jeu en ce moment,
<em>synthétique (avant)</em> = l'ancien placeholder. Dis-moi les remplacements à faire, je les note dans
<code>tools/audio/import_sfx.py</code>.</p>
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
