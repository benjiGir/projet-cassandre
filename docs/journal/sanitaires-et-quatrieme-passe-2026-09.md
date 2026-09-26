---
title: "Sanitaires et quatrième passe — 2026-09-24"
tags: [journal, niveau]
status: stable
updated: 2026-09-26
---

# Sanitaires et quatrième passe — 2026-09-24

Toilettes façon Duke 3D (2026-09-24), EN ATTENTE DU VERDICT DE PLAYTEST.**
> Demande : « utilisables comme dans Duke, redonnent de la vie ; cassées, de
> l'eau jaillit et on la boit pour se soigner ». Règle de `player.c` : se
> soulager sur une cuvette ou un urinoir intact rend +10 % des PV, puis 220 s
> de délai de GAMEPLAY (chasse d'eau seule pendant ce délai) ; un sanitaire
> cassé laisse un jet permanent, +1 PV par gorgée (touche E), illimité. Écarts
> voulus : pas de gel du joueur (invariant #10), délai non consommé à PV
> pleins. Le `use_toilet` historique suit la même règle. Nouveau préfixe
> `sanitaire_*` (3 cuvettes, 2 urinoirs, 50 PV), un lot fusionné élagué à
> 48 m comme les `use_*` ; la plaque de chasse n'est plus un `use_*` (elle
> volait l'appui E à la cuvette voisine). Fait par quatre agents
> (`level-pipeline`, `retro-render`, `level-forge`, `sound-forge`), construit
> et exporté dans la session Blender ouverte. **Trois pièges payés** :
> (1) des gouttes de 2,5 mm — la taille était appliquée deux fois, par la
> géométrie ET l'échelle d'instance —, dessinées au compte de lots et
> invisibles à l'écran : l'agent les avait « vues » dans sa scène de test ;
> (2) un `InstancedMesh` en `frustumCulled = false` coûte un lot dans TOUTES
> les vues, même vide ; (3) `_repeindre_sur_palette` laissait des
> `material_index` résiduels : tout meuble Kenney exportait en plusieurs
> primitives glTF, donc en `Group`, jamais en `Mesh` — invisible jusqu'ici
> faute d'objet préfixé qui l'exige, `validate_level.py` le contrôle
> désormais. **Budget, à lire honnêtement** : un protocole caméra seule
> (joueur au spawn, 40 ennemis) donne **211 lots** à la pire pose du parking
> extérieur, AVANT comme APRÈS ce chantier (liste d'objets identique) — les
> 198 notés ci-dessous venaient d'un autre protocole. Mesuré :
> `validate_level.py --strict` 0 erreur et 6 warnings connus, audit à zéro,
> export vérifié, `pnpm test` 329/329. **Non vérifié** : la vraie touche E
> (soulagement, gorgée), casser au tir, et le SON — trois placeholders de
> synthèse (`toilet_flush`, `ceramic_break` avec de vraies assiettes Kenney,
> `water_gulp`) à juger sur `http://localhost:5173/audition/`, en attendant
> les enregistrements Freesound listés dans `docs/4-technique/audio-runtime.md`.
> **Boucle d'eau positionnelle ajoutée le même jour** : `amb_water_jet`
> (placeholder de synthèse, 10,24 s, bouclée par construction et vérifiée
> après décodage `.ogg`/`.m4a`), un `Howl` en Web Audio
> (`core/waterAmbience.ts`, calcul pur dans `waterAmbienceMix.ts`) piloté
> depuis `updateFx` : plein volume (0,35) à ≤ 1,5 m, silence à 11 m, pan
> ±0,55, coupé hors de l'état `playing`. Vérifié en jeu par
> `cassandre.sfx.eau()` : 0,35 près du jet, 0,18 à 6 m, arrêtée à 15 m.
> `pnpm test` 352/352.
>
> **Quatrième passe en direct dans Blender (2026-09-23/24), EN ATTENTE DU
> VERDICT DE PLAYTEST.** Trois retours, trois corrections à la source :
> - **« Des trous entre les jonctions de murs »** : 18 angles vides de 25 cm,
>   partout où une ouverture court jusqu'au bout d'une façade nord/sud (sas,
>   couloirs, escalier) — `murs_espace` rognait les murs est/ouest même quand
>   rien ne tenait l'angle. Trouvés au lancer de rayons (41 grappes → 0).
> - **« Des textures qui se chevauchent »** : 82 m² de faces coplanaires
>   VISIBLES, presque toutes dans les meubles générés — plinthe, chant,
>   corniche, nez de marche coupés aux cotes exactes du corps qu'ils habillent
>   (estrade du micro : 16 m² à elle seule). Règle : une finition dépasse ou
>   rentre d'1 cm, jamais à fleur. Reste 0,14 m², négligeable. Le tampon de
>   profondeur est en 24 bits (0,1/130 m) : 1 cm d'écart ne se bat nulle part.
> - **Une vraie salle pour les toilettes** (12 sur le plan de masse, à l'est de
>   la cafétéria) : porte « WC » à la main (atlas `portes_2`, `validate_level`
>   plafonne les textures à 128×128), trois cabines, lavabos et miroirs Kenney,
>   urinoirs ; le +1 PV était la plaque de chasse d'eau (remplacé le jour
>   même par les `sanitaire_*`, voir au-dessus). Plan de masse et SVG à
>   jour (la carte n'avait pas été régénérée depuis N8).
> **Piège de budget payé** : le décor fusionne par cellule de 48 m EN 3D, le
> centre de l'objet faisant foi — un sol n'est jamais dans la tranche d'un
> mur. Seule dans sa cellule, la salle coûtait 4 lots (sol, plafond, murs,
> porte) ; ramenée à 2 par un sol d'un seul tenant avec la cafétéria
> (`SOL_COMMUN`) et un plafond monté par `bo.boite` (attribut `Col`, donc
> fusionné avec le plâtre voisin). Pire vue mesurée : **198/200** (parking
> extérieur vers le nord-est). Mesuré : `validate_level.py --strict` 0 erreur
> et 7 warnings connus, audit à zéro, export vérifié. **Non vérifié** : jouer —
> la porte WC à la vraie touche E, le +1 PV.
>
> **
