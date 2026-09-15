# Affiches des marques inventées — prompts de génération d'image

Une affiche par marque de `tools/textures/generate_labels.py`, plus deux
affiches de magasin. Les prompts sont en anglais : c'est la langue que tous
les générateurs suivent le mieux. Les slogans restent en français, parce que
**c'est nous qui les écrivons sur l'affiche, pas l'IA**.

## Pourquoi les prompts sont faits comme ça

En jeu, une affiche de 1,25 × 2 m tient dans environ **128 px de haut**, puis
elle est quantifiée sur la palette. L'image de l'IA sera donc réduite dix fois.
D'où quatre règles, répétées dans chaque prompt :

1. **Un seul gros sujet, des aplats, des contours noirs épais.** Un détail fin,
   un dégradé ou du grain deviennent de la bouillie une fois quantifiés.
2. **Aucun texte.** Un texte d'IA réduit à 128 px devient illisible (c'est
   pour ça que les étiquettes ont une police pixel codée à la main). Le nom et
   le slogan sont posés APRÈS la réduction, avec cette police.
3. **Le tiers du bas est une bande de couleur unie et vide.** C'est la mise en
   page des étiquettes (illustration en haut, bandeau avec le nom en bas) :
   l'affiche reprend le paquet, on reconnaît la marque d'un rayon à l'autre.
4. **Les couleurs de l'étiquette**, données en hexadécimal.

Format : **portrait 2:3** (recadré ensuite en 5:8).

- **Midjourney** : remplacer la ligne `Avoid:` par `--no text, letters, ...`
  et ajouter `--ar 2:3`.
- **Stable Diffusion / Flux** : la ligne `Avoid:` va dans le prompt négatif.
- **ChatGPT, Ideogram, Gemini** : coller tel quel.

## Avant de me passer une image

- **Test de réduction** : afficher l'image à 128 px de haut. Si le sujet ne se
  lit plus, régénérer ; ne pas espérer que ça passe mieux en jeu.
- La bande du bas est vraiment vide, sans texte parasite (les IA en glissent
  souvent).
- Aucun logo existant, aucun visage connu : règle de satire du projet.
- Déposer dans `assets_src/affiches/raw/<id>.png`, avec l'`id` indiqué sur
  chaque affiche.
- Noter le générateur utilisé : il faudra une ligne au registre
  `assets_src/LICENCES_ASSETS.md`.

---

## 1. Céréales Pyramides

`id` : `cereales_pyramides` · slogan : **« Le petit déj qui vous observe. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a cheerful breakfast bowl seen from a low angle, filled with cereal pieces shaped like tiny orange pyramids. Rising behind the bowl like a sunrise, one giant orange pyramid with a single wide-open eye at its apex, thick rays of light around it.
Background: solid yellow #f2c230. The bottom 30% of the poster is a completely empty solid red #d8231f band with nothing in it.
Palette strictly limited to: yellow #f2c230, red #d8231f, orange #e8741c, cream white #f2efe6, black #111014.
Avoid: text, letters, numbers, logos, real brands, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 2. Lait Traînées Blanches

`id` : `lait_trainees_blanches` · slogan : **« Tombé du ciel, pour toute la famille. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a clear sky with a single airliner flying across the top, leaving three thick white contrails that curve down and pour directly into a tall glass of milk standing at the bottom of the image.
Background: solid light sky blue #6cb4d6. The bottom 30% of the poster is a completely empty solid blue #1f5fbf band with nothing in it.
Palette strictly limited to: sky blue #6cb4d6, blue #1f5fbf, cream white #f2efe6, light grey #b4b6b4, black #111014.
Avoid: text, letters, numbers, logos, real brands, real airline liveries, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 3. Eau Plate de la Terre Plate

`id` : `eau_terre_plate` · slogan : **« Aucune courbe. Aucun doute. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: the Earth as a flat disc seen at a slight angle like a dinner plate, simple green continents on a blue ocean, big waterfalls pouring off its rim straight down into a large plastic water bottle standing below it.
Background: solid light sky blue #6cb4d6. The bottom 30% of the poster is a completely empty solid blue #1f5fbf band with nothing in it.
Palette strictly limited to: sky blue #6cb4d6, blue #1f5fbf, green #2e9e44, cream white #f2efe6, black #111014.
Avoid: text, letters, numbers, logos, real brands, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 4. 5G Cola

`id` : `soda_5g_cola` · slogan : **« Le goût qui capte partout. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a tall glass soda bottle filled with dark cola, its cap replaced by a small telecom antenna emitting big concentric radio-wave arcs; the bubbles inside the bottle rise in the shape of signal-strength bars.
Background: solid red #d8231f. The bottom 30% of the poster is a completely empty solid black #111014 band with nothing in it.
Palette strictly limited to: red #d8231f, black #111014, cream white #f2efe6, yellow #f2c230.
Avoid: text, letters, numbers, logos, real brands, famous bottle shapes, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 5. Raviolis du Bunker

`id` : `raviolis_bunker` · slogan : **« Tiennent jusqu'à la fin du monde. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a big open tin can of ravioli in red sauce sitting on a concrete shelf inside a fallout shelter, the steam rising from it in the shape of a small mushroom cloud; a heavy round vault door in the background with a yellow and black radiation symbol painted on it.
Background: solid olive green #5f6b3f. The bottom 30% of the poster is a completely empty solid black #111014 band with nothing in it.
Palette strictly limited to: olive green #5f6b3f, yellow #f2c230, red #d8231f, cream white #f2efe6, black #111014.
Avoid: text, letters, numbers, logos, real brands, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 6. ALU-PROTECT

`id` : `alu_protect` · slogan : **« Protège vos restes. Et vos pensées. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a single smiling 1990s dad with a big mustache, shown from the chest up, giving a thumbs-up and wearing a tall pointed hat folded from shiny aluminium foil; he holds a roll of aluminium foil unrolling toward the viewer.
Background: solid light grey #b4b6b4. The bottom 30% of the poster is a completely empty solid blue #1f5fbf band with nothing in it.
Palette strictly limited to: light grey #b4b6b4, cream white #f2efe6, blue #1f5fbf, skin beige #d8b48c, black #111014.
Avoid: text, letters, numbers, logos, real brands, real or famous people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 7. Sablés Reptiliens

`id` : `sables_reptiliens` · slogan : **« La recette de nos ancêtres. Pas des vôtres. »**

Clin d'œil au Directeur, qui révèle sa peau verte à la fin du niveau.

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a kindly grandmother with a grey bun, shown from the chest up, warmly holding out a plate of round butter shortbread cookies; she smiles sweetly, but her eyes are yellow with vertical slit reptile pupils and a small forked tongue peeks out of her smile.
Background: solid green #2e9e44. The bottom 30% of the poster is a completely empty solid black #111014 band with nothing in it.
Palette strictly limited to: green #2e9e44, yellow #f2c230, cookie beige #d8b48c, cream white #f2efe6, black #111014.
Avoid: text, letters, numbers, logos, real brands, real or famous people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 8. Café Réveillé

`id` : `cafe_reveille` · slogan : **« Réveillez-vous ! »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a big steaming coffee cup seen from slightly above; the surface of the coffee forms one huge wide-open eye with a blue iris staring straight at the viewer; in the background, a row of small white sheep sleeping.
Background: solid dark brown #5a3a22. The bottom 30% of the poster is a completely empty solid orange #e8741c band with nothing in it.
Palette strictly limited to: dark brown #5a3a22, orange #e8741c, cream white #f2efe6, blue #1f5fbf, black #111014.
Avoid: text, letters, numbers, logos, real brands, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 9. Chips Illumi

`id` : `chips_illumi` · slogan : **« Un triangle. Coïncidence ? »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: big triangular chips stacked into a perfect pyramid, the top chip glowing with bright yellow light rays like a sacred revelation; a torn-open chip bag lies at the base of the pyramid.
Background: solid magenta #c2307a. The bottom 30% of the poster is a completely empty solid black #111014 band with nothing in it.
Palette strictly limited to: magenta #c2307a, yellow #f2c230, orange #e8741c, cream white #f2efe6, black #111014.
Avoid: text, letters, numbers, logos, real brands, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 10. Lessive Profonde

`id` : `lessive_profonde` · slogan : **« Lave en profondeur. Ne laisse aucune trace. »**

Clin d'œil aux Costards : ce sont leurs vestes dans le tambour.

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a white front-loading washing machine seen head-on, its big round window showing black business suits, red neckties and black sunglasses spinning in dark water; a red detergent bottle stands next to the machine.
Background: solid blue #1f5fbf. The bottom 30% of the poster is a completely empty solid orange #e8741c band with nothing in it.
Palette strictly limited to: blue #1f5fbf, orange #e8741c, red #d8231f, cream white #f2efe6, black #111014.
Avoid: text, letters, numbers, logos, real brands, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 11. Coquillettes du Nouvel Ordre

`id` : `coquillettes_nouvel_ordre` · slogan : **« Toutes alignées. Toutes pareilles. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a large blue globe with white latitude and longitude grid lines at the top of the image; below it, nine identical big elbow macaroni pieces with tiny legs standing in three perfect ranks, all saluting the globe.
Background: solid yellow #f2c230. The bottom 30% of the poster is a completely empty solid blue #1f5fbf band with nothing in it.
Palette strictly limited to: yellow #f2c230, blue #1f5fbf, pasta beige #e8c878, cream white #f2efe6, black #111014.
Avoid: text, letters, numbers, logos, real brands, real flags, real political symbols, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 12. Dentifrice Sans-Fluor

`id` : `dentifrice_sans_fluor` · slogan : **« Vos dents ne seront pas contrôlées. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a giant cartoon molar tooth with a proud defiant grin, flexing muscular arms, standing next to a toothpaste tube; above its head floats a single water droplet inside a red crossed-out circle.
Background: solid cream white #f2efe6. The bottom 30% of the poster is a completely empty solid red #d8231f band with nothing in it.
Palette strictly limited to: cream white #f2efe6, red #d8231f, blue #1f5fbf, light grey #b4b6b4, black #111014.
Avoid: text, letters, numbers, logos, real brands, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

## 13. Piles Lune Truquée

`id` : `piles_lune_truquee` · slogan : **« Énergie illimitée. Alunissage non garanti. »**

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: a moon landscape that is obviously a film set: a cardboard grey crater floor lit by two big studio spotlights on tripods, a movie clapperboard in one corner; in the middle, a giant battery standing upright like a rocket, a small plain white flag planted next to it; a yellow crescent moon hanging from a visible string.
Background: solid black #111014. The bottom 30% of the poster is a completely empty solid yellow #f2c230 band with nothing in it.
Palette strictly limited to: black #111014, yellow #f2c230, light grey #b4b6b4, cream white #f2efe6.
Avoid: text, letters, numbers, logos, real brands, real flags, real people, astronauts, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

---

## Bonus — affiches du magasin

### 14. Carte de fidélité

`id` : `carte_fidelite` · titre : **« Carte fidélité HYPER »** · slogan : **« Chaque carte ouvre une porte. »**

Signalétique déguisée : les cartes Argent, Or et Platine sont les clés du
niveau. `HYPER` est le nom provisoire du magasin, à remplacer s'il en trouve un.

```text
Vintage 1990s French supermarket promotional poster, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, cheerful wholesome advertising tone with a subtle sinister conspiracy twist. One large central subject, readable from far away. Portrait 2:3.
Subject: three plastic loyalty cards fanned out like a winning poker hand, one silver, one gold, one pale platinum, each with a small star sparkle, held by a hand in a black business suit sleeve; behind them, a heavy door slightly ajar with bright light spilling through the gap.
Background: solid dark slate #2f3541. The bottom 30% of the poster is a completely empty solid red #d8231f band with nothing in it.
Palette strictly limited to: dark slate #2f3541, red #d8231f, yellow #f2c230, light grey #b4b6b4, pale blue grey #cfd8e2, black #111014.
Avoid: text, letters, numbers, logos, real brands, real bank card designs, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

### 15. Magazine Vérité

`id` : `mag_verite` · slogan : **« Ce qu'ils vous cachent. »**

Pour le kiosque « Presse libre » de la galerie, raccord avec la couverture
déjà en rayon.

```text
Vintage 1990s French newsstand promotional poster for a sensationalist magazine, flat screen-print illustration, bold simple shapes, thick black outlines, flat colors only, no gradients, high contrast, dramatic tabloid tone. One large central subject, readable from far away. Portrait 2:3.
Subject: a giant human eye with a blue iris peering through a keyhole in a dark door, dramatic yellow light spilling out of the keyhole in rays.
Background: solid red #d8231f. The bottom 30% of the poster is a completely empty solid black #111014 band with nothing in it.
Palette strictly limited to: red #d8231f, yellow #f2c230, blue #1f5fbf, cream white #f2efe6, black #111014.
Avoid: text, letters, numbers, logos, real brands, real magazine layouts, real people, photorealism, 3D render, gradients, shading texture, noise, grain, halftone dots, fine details, watermark, signature.
```

---

## Ensuite (côté code)

Une fois les images déposées dans `raw/` :

```bash
./.venv-refs/bin/python3 tools/textures/generate_affiches.py
```

puis reconstruire et exporter `niveau_v2`. Le détail (recadrage, texte en
police pixel, atlas unique de 512 × 512, placement sur les têtes de gondole) est
dans [Harmonisation des assets](../../docs/pipeline/harmonisation-assets.md#affiches-de-marques).
Les slogans affichés en jeu sont ceux de `AFFICHES` dans le script : sans
accents, et parfois raccourcis pour tenir dans 100 px.
