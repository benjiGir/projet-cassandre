---
title: Ajouter un son
tags: [guide, recette]
status: brouillon
updated: 2026-09-26
---

# Ajouter un son

## Objectif

Créer ou intégrer un effet sonore, l'empaqueter dans l'audio sprite du
jeu et vérifier son nom, sa présence, ses mesures et son rendu à
l'écoute.

## Avant de commencer

- Lisez [Studio audio](../4-technique/studio-audio.md), [Audio
  runtime](../4-technique/audio-runtime.md) et [Ajouter un
  son](../4-technique/studio-audio.md).
- Déterminez si le son représente un objet physique ou une interface /
  ambiance abstraite.
- Pour un enregistrement, vérifiez que le fichier est sous
  `assets_src/cc0_raw/` et que sa licence est inscrite à
  `assets_src/LICENCES_ASSETS.md`.
- Utilisez l'environnement Python qui contient NumPy et SciPy ;
  Matplotlib ne sert qu'aux planches de spectrogramme.
- Ne modifiez pas le gameplay pour cacher un son absent du manifeste.
- Un effet du runtime et une recette du studio ont des noms distincts,
  reliés par `SFX_TABLE`.

## Étapes

1. Ajoutez une recette dans `tools/audio/recipes.py` avec sa catégorie
   et sa fonction de rendu déterministe.
2. Pour un son physique, vérifiez les enregistrements disponibles dans
   `tools/audio/enregistrements.py` et utilisez une source autorisée.
3. Pour un son abstrait, assemblez des briques de `tools/audio/synth.py`
   autour de son enveloppe et de son spectre attendus.
4. Gardez des seeds et variantes stables ; une graine identique doit
   rendre le même signal.
5. Si le son est une boucle dense, construisez-la périodiquement et
   déclarez-la dans la liste des boucles exactes.
6. Ajoutez l'identifiant de jeu à `SFX_TABLE` dans `src/core/audio/audio.ts`
   et vérifiez la correspondance au manifeste.
7. Si la recette est nouvelle, mettez à jour les tests concernés sous
   `test/core/` ou `tools/audio/`.
8. Rendez l'audio dans un dossier temporaire : `python3
   tools/audio/render_sfx.py --out /tmp/wav`.
9. Pour une itération, restreignez à un nom ou une catégorie avec
   `--only` ou `--cat`.
10. Ajoutez `--variants` pour rendre les variations reproductibles ; ne
    remplacez pas le catalogue complet sans raison.
11. Analysez les fichiers avec `python3 tools/audio/analyze_sfx.py
    /tmp/wav`.
12. Comparez le timbre aux sons voisins avec `--timbre` et la
    télégraphie contre un tir avec `--mask` lorsque le gameplay l'exige.
13. Pour une boucle, mesurez le raccord avec `--boucle` sur le WAV puis
    sur les formats encodés.
14. Vérifiez qu'une prise CC0 absente n'a pas entraîné une sortie
    partielle : le rendu incomplet n'est pas un sprite livrable.
15. Construisez le sprite : `python3 tools/audio/build_sprite.py
    /tmp/wav --out public/assets/audio/sfx`.
16. Vérifiez les fichiers Ogg, M4A et le manifeste JSON. Howler
    sélectionne un format selon le navigateur.
17. Lancez `python3 tools/audio/audition.py` ou ouvrez la page d'écoute
    locale, sélectionnez les variantes pertinentes et écoutez au casque.
18. En jeu, utilisez `cassandre.sfx.liste()` et
    `cassandre.sfx.joue("id")` pour déclencher le son sans provoquer sa
    situation de gameplay. `present` confirme seulement que la clé existe
    dans le manifeste ; contrôlez aussi le chargement réseau de `sfx.json`
    et du format choisi par le navigateur, puis l'absence d'avertissement
    `[audio]`.
19. Mettez à jour le budget et la documentation runtime si l'identifiant
    ou le comportement change.

## Vérifier

- Le même rendu en entrée produit le même WAV.
- L'analyse confirme la durée, le niveau, le spectre et les limites de
  timbre attendues.
- Le sprite contient les deux formats et le manifeste lie l'identifiant
  runtime au nom de recette.
- Le son est déclenchable en jeu par l'action attendue et par la console
  dev.
- `cassandre.sfx.liste().present` est un contrôle de clé de manifeste, pas
  un indicateur de décodage. Vérifiez le chargement audio dans Réseau et
  écoutez le résultat.
- Une personne écoute le son au casque ; les mesures seules ne valident
  pas son identité.
- Vérifiez le masquage de la télégraphie contre les armes si le son peut
  les couvrir.

## Pièges

- Howler ne garantit pas un repli entre formats : un sprite sans l'un
  des codecs coupe une famille de navigateurs.
- Un encodeur avec pertes peut augmenter le pic au-delà du WAV source.
  Analysez le résultat encodé.
- Les prises sources sont ignorées par Git : elles doivent être
  disponibles à la génération et conformes au registre.
- Un fondu croisé sur un bruit continu dense peut créer une baisse
  audible à chaque cycle.
- N'associez pas une recette physique synthétique à un matériau qui ne
  lui ressemble pas sans jugement d'écoute.
- Un seul module relie l'identifiant runtime et le nom de recette ;
  gardez les deux vocabulaires distincts.

## Exemple réel

Commit `3d853b1`, « Toilettes à la Duke, récap de fin de partie, pause
et retours de playtest » : il ajoute des sons associés aux nouveaux
comportements, leurs recettes et leurs entrées dans le sprite du jeu.
