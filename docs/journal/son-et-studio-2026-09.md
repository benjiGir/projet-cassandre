---
title: "Son et studio — 2026-09"
tags: [journal, son]
status: stable
updated: 2026-09-26
---

# Son et studio — 2026-09

Son : CHANTIER EN COURS, DIRECTION ARRÊTÉE (2026-09-21).** Quatre passes
> rejetées à l'écoute avant d'y voir clair. Le son se fait désormais à DEUX
> MAINS : de vrais enregistrements CC0 pour tout ce qui est un OBJET (armes,
> impacts, verre, bois, portes, ramassages, voix des Costards), la SYNTHÈSE
> pour ce qui n'existe pas physiquement (interface, lecteur de carte, secret
> trouvé, ambiances de zone). Les deux origines se rejoignent dans un même
> sprite.
> **EN ATTENTE DE L'UTILISATEUR** : il télécharge les enregistrements depuis
> Freesound (compte obligatoire, et le navigateur de l'agent s'y voit refuser
> l'accès — ne pas compter dessus) vers `assets_src/cc0_raw/freesound/`, dont
> le README porte les conventions. **Un contributeur différent par famille** :
> une bibliothèque entière enregistrée au même endroit donne des sons qui se
> ressemblent tous, quoi qu'on leur fasse.
>
> **La leçon des quatre rejets, plus utile que les correctifs.** Le reproche
> était le même à chaque fois — « ça ne ressemble pas à ce que c'est » — et
> j'ai corrigé trois autres choses : la chaîne d'import, la distinction des
> timbres, la puissance. Les trois défauts étaient réels et mesurés ; aucun
> n'était le sien. La synthèse procédurale produit des sons structurellement
> justes — bonne enveloppe, bon spectre — mais sans le désordre qui fait dire à
> l'oreille « ça, c'est du métal ». **Avant de livrer un correctif sur une
> plainte sensorielle, vérifier qu'il répond aux MOTS employés.**
>
> **Le studio** est `tools/audio/` (ajouté par l'utilisateur avec l'agent
> `sound-forge` et cinq skills) : `synth.py` briques DSP, `recipes.py` les
> recettes en texte, `render_sfx.py`, `analyze_sfx.py` (mesures et `--mask`),
> `build_sprite.py`, `audition.py` (page d'écoute). Déterministe : même graine,
> même octet. Le jeu charge un **audio sprite** unique
> (`public/assets/audio/sfx/sfx.{ogg,m4a,json}`) au lieu d'un fichier par son ;
> `SFX_TABLE` raccorde les identifiants du JEU aux noms de RECETTES
> (`melee_fire` joue `crowbar_swing`) — deux vocabulaires séparés exprès, et le
> seul endroit à toucher au renommage. Le pool de `Howl` a disparu avec sa
> raison d'être : chaque lecture du sprite a son propre identifiant.
>
> **Le grain rétro est RETIRÉ du défaut (2026-09-20)**, et c'est la correction
> la plus mesurable : le `crush` 10 bits / 22 050 Hz décime par blocage
> d'échantillon, sans filtre — il ne COUPE pas l'aigu, il le REPLIE. Parasite
> injecté à **−1,7 dB du signal** sur `impact_metal`, faux aigu FABRIQUÉ. À
> −6 dB il y a autant de parasite que de son utile. Reste en option
> (`--crush`) pour un son dégradé DANS LA FICTION (annonce au micro,
> interphone). Effet de bord : ses marches verticales causaient tout le
> dépassement d'encodeur, donc l'écrêtage de l'atlas a disparu avec lui et la
> marge de crête est remontée de 0,80 à 0,85, zéro échantillon écrêté.
>
> **Les mesures qui gardent les portes fermées** (détail chiffré dans
> [HUD et audio](../archive/systems-hud-audio.md#assets-sonores)) :
> - **Distance de timbre** : spectre moyen des 250 premières ms, 30 bandes log
>   100 Hz-16 kHz, moyenne retirée, corrélation. Deux sons qui doivent se
>   distinguer restent **sous 0,55**. La paire rejetée était à 0,976, et TOUTE
>   la bibliothèque CC0 d'armes tenait au-dessus de 0,840 — un 12 contre un
>   .22 compris.
> - **Facteur de crête** : l'oreille juge le volume sur le niveau MOYEN, pas
>   sur le pic. Médiane du catalogue 17,3 dB, impacts à 25-30 ; les samples de
>   l'époque Build tiennent dans 6-12 dB.
> - **`analyze_sfx.py --mask`** : contrainte de GAMEPLAY, pas de goût — la
>   télégraphie d'un Costard ne doit pas être masquée par le tir du joueur,
>   c'est le canal qui dit qu'on vous tire dessus hors champ.
>
> **Pièges payés.** Howler choisit UN format d'après le codec supporté et ne se
> rabat pas sur l'autre : le sprite DOIT partir en `.ogg` ET `.m4a`. Le
> `ffmpeg` de Homebrew est livré **sans libvorbis** — le préférer parce qu'il
> est installé a produit un sprite sans `.ogg`, donc muet sur Chrome et
> Firefox ; les encodeurs sont maintenant ESSAYÉS dans l'ordre jusqu'à ce que
> l'un réussisse. Un encodeur avec perte DÉPASSE son entrée, et seul le
> décodeur du navigateur le montre (les autres rabotent à 1,0 en silence).
> Vérifié et sain : l'AAC n'ajoute pas de délai d'amorçage, les positions du
> sprite valent pour les deux formats.
>
> **Un agent n'entend pas.** `tools/audio/audition.py` écrit une page locale
> (`http://localhost:5173/audition/`) : tout le catalogue à un clic par son,
> variantes de graine comprises, mesures sous chaque bouton. En jeu,
> `cassandre.sfx.liste()` dit quel identifiant pointe sur quelle recette et si
> elle est présente, `cassandre.sfx.joue(id)` déclenche n'importe quel son sans
> provoquer la situation. Vérifié : atlas chargé, zéro identifiant orphelin sur
> 20, signal réel au bus maître. **Non vérifié, et c'est tout le sujet** :
> comment ça sonne.
>
> **Hot reload : le sondage ne part plus en production (2026-09-21).** Signalé
> par l'utilisateur, qui voyait un `HEAD` sur le `.glb` toutes les 400 ms. Le
> module s'annonçait « dev-only » et l'ADR 0011 parlait d'une session « de
> développement », mais **rien ne l'appliquait** — le sondage était bien dans
> le bundle livré. La fibre n'est créée que sous `import.meta.env.DEV`, donc la
> branche disparaît au build. La leçon dépasse le bug : **un commentaire qui
> annonce une contrainte ne l'applique pas**, et celui-là a traversé tout le
> retrofit Effect du jalon M2 sans que personne le vérifie.
>
> **
