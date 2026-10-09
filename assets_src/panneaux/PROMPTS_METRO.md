# Panneaux d'histoire du métro — prompts de génération d'image

Huit illustrations : quatre pour l'intro, quatre pour la fin du niveau
« Trafic interrompu ». L'intention de chacune est dans
`docs/2-fonctionnel/histoire-metro.md`, section « Les panneaux ». Les règles de
[`PROMPTS.md`](PROMPTS.md) s'appliquent toutes : pas de texte dans l'image,
cadrage 16:9, test de réduction à 640 px, au moins 1280 px de large.

**Huit originaux générés le 2026-10-09** avec l'outil OpenAI imagegen intégré à
Codex, déposés dans `assets_src/panneaux/raw/metro_*.png`. La
[planche de contrôle](metro-planche-640.png) montre chaque panneau réduit à
640 × 360 et 64 couleurs par le traitement de `generate_panneaux.py`. Les
[prompts employés, références et empreintes des fichiers](metro-generation.json)
conservent la trace de génération. La tour est générée en premier ; les
retouches corrigent le plan à quatre stations, sa photographie, la taille et
la position des emblèmes, la lumière froide de la fin et le reflet du téléphone.

Les légendes ci-dessous sont recopiées de
`src/game/session/presentation/storyPanels.ts`, qui fait foi. Aperçu sans
lancer de partie : `?uiPreview=storyIntro&level=metro` et
`?uiPreview=storyOutro&level=metro` sur le serveur de dev.

## Garder le style de la fin du niveau 1

Le bloc de style est celui du niveau 1, mot pour mot. Ce qui tient vraiment la
cohérence, ce sont les images jointes :

| À joindre | Pour quels panneaux | Ce qu'elle fixe |
|---|---|---|
| `docs/assets/portrait-stream-planche-v1.png` | tous ceux où le héros apparaît | le visage et la tenue |
| `assets_src/panneaux/raw/outro_4.png` | 1 et 2 | la chambre, le mur de ficelles, la photo de la tour, le grain de l'image |
| `assets_src/panneaux/raw/intro_3.png` | 3 et 4 | la nuit, le sol mouillé, le sodium, le héros de dos |
| `assets_src/panneaux/raw/outro_1.png` | 5 à 8 | l'aube, le héros abîmé, le harnais de la caméra |

Utiliser le même générateur que pour le niveau 1, si possible dans la même
conversation. Générer le **panneau 8 en premier** et le joindre ensuite aux
panneaux 3 et 7 : la tour doit être la même partout.

## Ce qui change : la lumière de l'arrivée

L'intro garde les deux lumières du niveau 1, le vert des écrans et l'orange du
sodium. La fin passe au **bleu froid** : aube gris-bleu, vapeur blanche,
lumière blanche du hall. C'est la couleur de la plateforme dans la palette du
niveau (`docs/assets/board-metro.md`, famille « Privée »). Le seul point chaud
qui reste est le voyant rouge de la caméra.

Éléments qui reviennent et doivent rester identiques :

| Élément | Description à garder |
|---|---|
| L'emblème | L'empreinte à trois griffes dans un cercle, celle du ticket. **Toujours petite, jamais au centre** |
| La caméra du héros | Une petite caméra d'action à voyant rouge, sur un harnais de poitrine noir |
| La bouche de métro | Un escalier entre deux murets, une grille en fer, un bandeau bleu pétrole à blocs vides |
| Le plan de la ligne | Un seul trait épais en deux courbes opposées, quatre points |
| La tour | Verre ardoise sombre, une annexe basse sur un flanc, peu de fenêtres allumées, aucun nom |
| Le compte vérifié | Un petit sceau rond bleu pâle avec une coche |

---

## 1. La réclamation

`id` : `metro_intro_1` · légende : **« Chaîne suspendue. Revenus retenus. J'ai préparé une réclamation. / Et je sais où la déposer. »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference, and same level of detail, pixel size and colour treatment as the supplied scene reference, which is an earlier panel of the same series. Dry satirical tone, never horror. Lit by two accents only: sickly green monitor glow and one warm sodium-orange line from a street lamp through the blind. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image): the same original fictional French amateur video streamer, about 36, long slightly crooked nose, thick dark eyebrows, short tousled dark brown hair, three-day beard, brown eyes, worn olive zip hoodie over a muted rust-orange T-shirt. A fading yellowish bruise on one cheek and a small sticking plaster on the brow, left over from a fight a few days earlier. No headset, glasses or helmet.
Scene: interior, night, lights off, the same small cluttered rented bedroom as in the scene reference: a desk with two monitors, a black mesh office chair, empty energy-drink cans, a bookshelf with a hanging plant, a window with a slatted blind, and a whole wall covered with pinned photographs, till receipts and clippings joined by taut red string around one central photograph of a supermarket facade at night. Medium shot, three-quarter view from the side. The streamer stands at the wall, face in profile, determined and pleased with himself. With one hand he presses a large unfolded transit map flat against the wall; the other hand holds an uncapped red marker. The map is an invented diagram: one single thick line that snakes in two wide opposite curves, with four round station dots and no other line. From the last dot he has drawn a dashed red extension by hand, running off the edge of the map toward a pinned photograph of a tall dark glass office tower. A red string runs from the supermarket photograph, across the map, to the tower photograph. Behind him the main monitor shows a large grey padlock pictogram on a dark screen and casts the green glow that lights the scene. On the unmade bed in the foreground, laid out ready: a crowbar and a black chest harness holding a small action camera. Every pinned paper is blank or covered in abstract scribbles.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real transit maps, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 2. Le retour

`id` : `metro_intro_2` · légende : **« Je relance un direct pour protester. La suspension saute aussitôt. / Ils ont reculé. Et mon premier abonné est revenu. »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference, and same level of detail, pixel size and colour treatment as the supplied scene reference, which is an earlier panel of the same series. Dry satirical tone, never horror. Lit by two accents only: a bright sickly green monitor glow that floods the room, and one warm sodium-orange line from a street lamp through the blind. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image): the same original fictional French amateur video streamer, about 36, long slightly crooked nose, thick dark eyebrows, short tousled dark brown hair, three-day beard, brown eyes, worn olive zip hoodie over a muted rust-orange T-shirt. A fading yellowish bruise on one cheek and a small sticking plaster on the brow. No headset, glasses or helmet.
Scene: interior, night, the same small cluttered rented bedroom as in the scene reference, with its wall of pinned photographs and red string on the left. Side view of the streamer at his desk. He has just started a live broadcast: the small webcam on top of the monitor shows a red light. He leans back in his black mesh office chair with both fists raised, laughing in open-mouthed triumph, certain that he has won. The main monitor shows a large padlock pictogram, now open, its shackle swung up, glowing bright green. Under the padlock, one glowing notification bar holds a coin pictogram and, beside it, a small round pale-blue seal with a plain tick, followed by a short blank bar. The second monitor shows his own small video window. Green light falls on his face, on the cans on the desk and on the wall behind him.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 3. La bouche de métro

`id` : `metro_intro_3` · légende : **« Fermée « pour travaux ». Les gonds de la grille sont graissés. / Douze spectateurs. C'est un début. »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference, and same level of detail, pixel size and colour treatment as the supplied scene reference, which is an earlier panel of the same series. Dry satirical tone, never horror. Lit by two accents only: a sickly green light rising from the metro stairway, and warm sodium-orange lamp posts and shop windows. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image, seen from behind in three-quarter view): the same original fictional French amateur video streamer, short tousled dark brown hair, worn olive zip hoodie, dark jeans, the black straps of a chest harness crossing his back. No headset or helmet.
Scene: exterior, wide establishing shot, night, just after rain. A narrow street in a provincial French town: flat matte apartment facades with shutters and small balconies, a closed laundromat and a corner grocery with warm lit windows, a bus shelter, one parked boxy 1990s van, tall sodium lamp posts, wet pavement reflecting the lamps. In the middle distance, the entrance of an underground metro station: a stairway sinking into the pavement between two low stone parapets with handrails, closed at the top by an iron bar gate with one pale sheet of paper fixed to it. Above the gate, a horizontal petrol-teal sign band carries a row of blank pale blocks in place of letters. A faint cold greenish light rises from the bottom of the stairs, behind the bars. Far away above the rooftops, the dark silhouette of a single tall glass office tower with a few lit windows. Deep slate-blue sky with a few stars. In the foreground, small in the frame, the streamer stands facing the entrance, a crowbar hanging from one hand; the red recording light of the action camera on his chest spills a small red glow onto his sleeve and is the brightest point of the image.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real metro signs or transit logos, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 4. Le carton-titre

`id` : `metro_intro_4` · légende : **« TRAFIC INTERROMPU »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference, and same level of detail, pixel size and colour treatment as the supplied scene reference, which is an earlier panel of the same series. Dry satirical tone, never horror. Lit by two accents only: sickly green light coming up from the bottom of the stairs, and warm sodium-orange light from behind the viewer. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Scene: exterior, night, straight-on close shot of the iron bar gate that closes the top of a metro stairway. The two leaves of the gate are shut, with a thin vertical gap between them. One sheet of paper, yellowed and warped by months of rain, is fixed to the bars at eye level with four strips of tape, slightly crooked, covered with a few abstract grey lines instead of text. Through the bars, the steps go down between ivory-tiled walls into darkness, and a cold green light comes up from below. The lamp behind the viewer throws the long dark shadow of a man in a hoodie across the bars and down the steps; one tiny red dot, the reflection of his recording light, shines on the glossy tiles. A simple, symmetrical, quiet composition with large plain dark areas.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real metro signs or transit logos, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 5. Le parvis

`id` : `metro_outro_1` · légende : **« Terminus. Aucun nom sur les plaques. / Il fait chaud, ici. Vous ne trouvez pas ? »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference, and same level of detail, pixel size and colour treatment as the supplied scene reference, which is an earlier panel of the same series. Dry satirical tone, never horror. Lit by a cold blue-grey dawn with one thin pink-orange line on the horizon, and by drifting white steam; the only saturated point is a small red recording light. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image): the same original fictional French amateur video streamer, about 36, long slightly crooked nose, thick dark eyebrows, short tousled dark brown hair, three-day beard, brown eyes, worn olive zip hoodie over a muted rust-orange T-shirt, dark jeans. A small action camera with a red recording light sits on a black chest harness over the hoodie. He is battered as in the lower rows of the reference: bruised cheek, split lip, a little blood on the brow, stylised and not gory. Hoodie blackened with soot and grease.
Scene: exterior, dawn, medium-wide shot at ground level. A wide, empty, immaculate forecourt paved with large pale stone slabs, with long ventilation grilles set into the ground; thick white steam rises from the grilles and drifts across the frame. In the centre, a bare stairway comes up out of the ground between two smooth pale stone parapets, with no sign on it. On one parapet, small and off-centre, a plain metal plaque engraved only with a tiny emblem: a three-clawed footprint inside a ring. The streamer has just climbed the last step, exhausted, a crowbar hanging from one hand, his head tilted back to look at something very high above him, outside the frame. Behind him, half hidden by the steam, only the ground floor of a large dark glass building is visible; everything above it is cut off by the top of the image.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real buildings, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 6. Les nouveaux venus

`id` : `metro_outro_2` · légende : **« Jamais eu autant de spectateurs. Je ne reconnais aucun pseudo. / « C'est quand, la saison 2 ? » »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference, and same level of detail, pixel size and colour treatment as the supplied scene reference, which is an earlier panel of the same series. Dry satirical tone, never horror. Lit by a cold blue-grey dawn and by the cold blue-white glow of a phone screen, with white steam in the air. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image, seen from behind over his shoulder): the same original fictional French amateur video streamer, short tousled dark brown hair, three-day beard on the visible cheek, worn olive zip hoodie blackened with soot, the black strap of a chest harness on his shoulder. A bruise on the visible cheek, stylised and not gory.
Scene: exterior, dawn, the same pale stone forecourt with steam rising from ground grilles. Over-the-shoulder close shot from behind the streamer, who holds a smartphone up in one scraped hand and stares at it, stunned and flattered. The phone shows a generic live-stream layout invented for this image: one small video window showing the steaming forecourt; above it, an eye pictogram followed by a long row of small blank blocks that runs off the edge of the screen; beside it, a tall column of chat messages drawn as stacked blank coloured bars of different lengths, every one of them starting with the same tiny sparkle pictogram. The glow of the phone lights his cheek and the edge of his hood. Beyond the phone, in flat dark tones, the glass facade of a large building fills the background: rows and rows of identical dark windows, none of them lit.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real buildings, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 7. Bienvenue

`id` : `metro_outro_3` · légende : **« Un message de premier_abonne. Compte vérifié, maintenant. / « Bienvenue. » »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference, and same level of detail, pixel size and colour treatment as the supplied scene reference, which is an earlier panel of the same series. Dry satirical tone, never horror. Lit by the cold blue-white glow of a phone screen and a cold blue-grey dawn, with white steam. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Scene: exterior, dawn. Extreme close-up, three-quarter top-down view. Two scraped, soot-stained hands in worn olive hoodie cuffs hold a smartphone. The screen shows an invented live-stream layout: a column of chat messages drawn as stacked blank bars, all dimmed, and one message pinned above them, much larger and brighter: a wide pale-blue bar holding at its left end a small round pale-blue seal with a plain tick, followed by one short blank bar. Nothing else on the screen is highlighted. Under the phone, wet pale stone paving and the edge of a ventilation grille, with steam curling up between the hands. Faintly reflected on the glass of the phone: the tall dark outline of an office tower.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 8. La tour

`id` : `metro_outro_4` · légende : **« Pas de nom sur la façade. Pas de gardien à la porte. / J'ai une réclamation à déposer. »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference, and same level of detail, pixel size and colour treatment as the supplied scene reference, which is an earlier panel of the same series. Dry satirical tone, never horror. Lit by a cold blue-grey dawn, by the cold blue-white light of a lobby, and by white steam; the first pink-orange sunlight touches only the very top of the tower. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image, seen from behind): the same original fictional French amateur video streamer, short tousled dark brown hair, worn olive zip hoodie blackened with soot, dark jeans, the black straps of a chest harness crossing his back.
Scene: exterior, dawn, extreme low-angle shot looking up from a pale stone forecourt. One tall modern office tower of dark slate-blue glass fills the frame and rises out of the top of the image, its vertical lines converging; a lower annex block stands against one of its sides. Almost every window is dark; a few are lit warm. The building carries no name and no sign. Above the entrance, small, a tiny emblem: a three-clawed footprint inside a ring. At the foot of the tower, the glass doors of the lobby stand open, with nobody there, and spill a cold blue-white light across the paving toward the viewer. Columns of white steam rise from ground grilles on both sides. At the bottom centre, small in the frame, the streamer stands facing the doors, a crowbar in one hand, his long shadow stretching behind him. An original invented building that resembles no real tower.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real buildings, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

Variante du panneau 8, si les portes ouvertes en disent trop : remplacer
« stand open, with nobody there, and spill » par « are shut and unguarded, and
let ».

## Avant de déposer une image

En plus de la liste de [`PROMPTS.md`](PROMPTS.md#avant-de-déposer-une-image) :

- L'emblème reste **petit et décentré** (panneaux 5 et 8). S'il devient le
  sujet de l'image, régénérer.
- La tour des panneaux 1, 3, 7 et 8 est la même, et ne rappelle aucune tour
  réelle.
- Aucun plan de métro, logo de transport ou sceau de compte vérifié existant.
- Les panneaux 5 à 8 sont froids : pas de vert d'écran, pas de sodium.
- Fichiers à déposer : `assets_src/panneaux/raw/metro_intro_1.png` à
  `metro_outro_4.png`.
