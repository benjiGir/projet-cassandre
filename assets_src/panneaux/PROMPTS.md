# Panneaux d'histoire — prompts de génération d'image

Huit illustrations : quatre pour l'intro, quatre pour la fin du niveau
« Inventaire exceptionnel ». L'intention de chacune est dans
`docs/2-fonctionnel/histoire.md`. Les prompts sont en anglais : c'est la langue
que les générateurs suivent le mieux. Les légendes restent en français, parce
que **c'est le jeu qui les affiche sous l'image, pas l'IA qui les dessine**.

## Pourquoi les prompts sont faits comme ça

En jeu, un panneau est réduit à **640 × 360 px**, ramené à 64 couleurs, puis
agrandi en gros pixels francs, comme l'image du jeu. D'où cinq règles, répétées
dans chaque prompt :

1. **Le même style que le portrait du héros** : pixel art peint à la main façon
   jeu PC des années 90, pixels durs, palette terreuse, formes lisibles.
2. **Le même héros.** Chaque prompt où il apparaît redonne sa description, et
   l'image de référence est à joindre : `docs/assets/portrait-stream-planche-v1.png`.
3. **Aucun texte dans l'image.** Enseignes, écrans, tickets et affiches portent
   des formes vides ou des traits abstraits. Un texte d'IA réduit à 640 px
   devient une bouillie, et il serait en anglais.
4. **Deux lumières seulement** : le vert maladif des écrans et l'orange des
   lampes au sodium. C'est ce qui relie les huit images entre elles.
5. **Cadré pour du 16:9.** Beaucoup de générateurs ne sortent que du 3:2 :
   l'outil recadre au centre, donc rien d'important près des bords haut et bas.

Trois éléments reviennent d'une image à l'autre et doivent rester identiques :

| Élément | Description à garder |
|---|---|
| L'enseigne Hyper Varan | Un varan rouge enroulé en anneau, suivi d'une rangée de blocs rouges vides à la place des lettres |
| L'emblème du ticket | Une empreinte à trois griffes dans un cercle |
| La caméra du héros | Une petite caméra d'action à voyant rouge, fixée sur une sangle de poitrine |

Selon le générateur :

- **ChatGPT, Gemini, Ideogram** : coller le prompt tel quel, joindre l'image de
  référence, demander le format paysage le plus large proposé.
- **Midjourney** : joindre la référence en `--cref`, remplacer la ligne `Avoid:`
  par `--no text, letters, ...` et ajouter `--ar 16:9`.
- **Stable Diffusion / Flux** : la ligne `Avoid:` va dans le prompt négatif.

## Avant de déposer une image

- **Test de réduction** : afficher l'image à 640 px de large. Si le sujet ne se
  lit plus, régénérer.
- Aucun texte parasite, aucune fausse interface reconnaissable, aucun logo
  existant, aucun visage connu : règle de satire du projet.
- Le héros est bien celui du portrait : nez long, barbe de trois jours, sweat
  olive, tee-shirt orange rouille.
- Au moins **1280 px de large**. L'outil refuse en dessous.
- Noter le générateur utilisé et ses conditions d'usage : la ligne « Panneaux
  d'histoire » du registre `assets_src/LICENCES_ASSETS.md` les attend.

## Déposer et voir le résultat

1. Enregistrer l'image dans `assets_src/panneaux/raw/<id>.png` (`.jpg` et
   `.webp` sont acceptés), avec l'`id` indiqué sur chaque panneau.
2. Lancer l'outil. Il recadre, réduit, écrit `public/assets/story/<id>.png` et
   met à jour la liste des panneaux livrés. Aucun fichier du jeu n'est à
   modifier à la main ; un panneau sans image garde son aplat numéroté.

   ```bash
   ./.venv-refs/bin/python3 tools/textures/generate_panneaux.py
   ```

3. Regarder le résultat sans lancer de partie : `?uiPreview=storyIntro` et
   `?uiPreview=storyOutro` sur le serveur de dev.

Les légendes ci-dessous sont recopiées de
`src/game/session/presentation/storyPanels.ts`, qui fait foi.

---

## 1. La chambre

`id` : `intro_1` · légende : **« Ici le Réveil du peuple. Deux cents abonnés. / Deux cents personnes qui savent regarder. »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference. Dry satirical tone, never horror. Lit by two accents only: sickly green monitor glow and warm sodium-orange light. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image): the same original fictional French amateur video streamer, about 36, long slightly crooked nose, thick dark eyebrows, short tousled dark brown hair, three-day beard, brown eyes, worn olive zip hoodie over a muted rust-orange T-shirt. Ordinary civilian build. No headset, glasses, helmet or weapon.
Scene: interior, a small cluttered rented bedroom at night. Medium shot, slightly low angle. The streamer sits on a cheap swivel chair turned three-quarters toward the viewer, arms crossed, confident lopsided smirk, lit from the side by the green glow of two monitors. Behind him the whole wall is covered with pinned photographs, till receipts and newspaper clippings joined by taut red string, all converging on one photograph of a supermarket facade. On the desk: a cheap microphone on a boom arm, a small webcam, a few energy-drink cans. A warm orange street lamp shows through the window blind. Every pinned paper is blank or covered in abstract scribbles.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 2. L'indice

`id` : `intro_2` · légende : **« Regardez ce ticket. Cet emblème n'est sur aucun autre. / Et ce soir, le magasin ferme "pour inventaire exceptionnel". »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference. Dry satirical tone, never horror. Lit by two accents only: sickly green monitor glow and one warm orange desk lamp. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Scene: extreme close-up, three-quarter top-down view of a desk under a single warm desk lamp. Two hands in worn olive hoodie cuffs hold a long crumpled supermarket till receipt flat on the desk. The receipt carries rows of small abstract dashes instead of text and, near the bottom, one small printed emblem: a three-clawed footprint inside a ring. The emblem has been circled several times with a red marker pen, and the uncapped red marker lies beside it. In the dark background, outside the pool of lamp light, a monitor shows a photograph of closed glass shop doors with one blank sheet of paper taped to them; its green glow catches the edge of the hands.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 3. Le parking

`id` : `intro_3` · légende : **« Hyper Varan. "Le sang-froid des prix bas." / Trois spectateurs. Ça suffit pour un direct. »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference. Dry satirical tone, never horror. Lit by two accents only: sickly green light from inside the store and warm sodium-orange lamp posts. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image, seen from behind): the same original fictional French amateur video streamer, short tousled dark brown hair, worn olive zip hoodie. A small action camera with a red recording light is clipped to a chest strap over the hoodie. No headset, helmet or weapon.
Scene: exterior, wide establishing shot, night. A large half-empty supermarket car park with a few boxy 1990s cars and tall sodium lamp posts. In the distance, the long low white facade of a provincial French hypermarket stuck in its 1990s decor; its glass entrance doors are lit from inside with a cold greenish light. Above the entrance, a big red illuminated roof sign: a monitor lizard curled into a ring, followed by a row of blank red letter blocks, one block flickering dark. Starry sky, deep blue-violet horizon. In the foreground, seen from behind and small in the frame, the streamer stands facing the store; the red recording light on his chest strap is the brightest point of the image.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 4. Le carton-titre

`id` : `intro_4` · légende : **« INVENTAIRE EXCEPTIONNEL »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference. Dry satirical tone, never horror. Lit by two accents only: sickly green light leaking from inside the store and warm sodium-orange light from behind the viewer. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Scene: exterior, night, straight-on close shot of the automatic glass entrance doors of a hypermarket. The doors are shut, with a thin vertical gap between them leaking cold green light. One white sheet of paper is taped to the glass at eye level with four strips of tape, slightly crooked, covered with a few abstract grey lines instead of text. Faintly reflected in the glass: the dark silhouette of a man in a hoodie and the single red dot of a recording light on his chest. A simple, symmetrical, quiet composition with large plain dark areas.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 5. La sortie

`id` : `outro_1` · légende : **« Je suis dehors. J'ai tout filmé. / Cette fois, ils vont être obligés de regarder. »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference. Dry satirical tone, never horror. Lit by a pale pink and orange sunrise, with a faint sickly green glow from inside the building. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image): the same original fictional French amateur video streamer, about 36, long slightly crooked nose, thick dark eyebrows, short tousled dark brown hair, three-day beard, brown eyes, worn olive zip hoodie over a muted rust-orange T-shirt. A small action camera with a red recording light is clipped to a chest strap over the hoodie. He is battered as in the lower rows of the reference: bruised cheek, split lip, a little blood on the brow, stylised and not gory.
Scene: exterior, dawn, medium-wide shot. A grey metal emergency exit door at the back of a hypermarket hangs open onto an empty service yard with stacked pallets and a skip. The streamer has just stepped out, exhausted but triumphant, hoodie dusty. He holds up a shiny platinum-grey loyalty card between two fingers toward the viewer like a trophy; a crowbar hangs from his other hand. Behind him the doorway is dark, with a faint green glow deep inside.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 6. Le chat

`id` : `outro_2` · légende : **« "Beaux effets spéciaux." "Les acteurs jouent mal." / "Rendors-toi, le Réveil." »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference. Dry satirical tone, never horror. Lit by the sickly green glow of a monitor and grey early-morning light through a window blind. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image, seen from behind): the same original fictional French amateur video streamer, short tousled dark brown hair, worn olive zip hoodie, dusty and creased.
Scene: interior, the same small cluttered bedroom, early morning. Over-the-shoulder shot from behind the streamer, who sits slumped forward toward his main monitor. The monitor shows a generic live-stream layout invented for this image: one small video window, and beside it a tall column of chat messages drawn as stacked blank coloured bars of different lengths, many ending in a tiny abstract laughing-face pictogram. The wall of pinned papers and red string is visible on the left. The chest camera lies switched off on the desk among empty cans.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 7. La démonétisation

`id` : `outro_3` · légende : **« "Votre vidéo ne respecte pas nos règles." Démonétisée. / Ils ont peur. C'est la preuve que j'ai raison. »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference. Dry satirical tone, never horror. Lit by the harsh red-orange light of a warning on a monitor, replacing the usual green glow. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image): the same original fictional French amateur video streamer, about 36, long slightly crooked nose, thick dark eyebrows, short tousled dark brown hair, three-day beard, brown eyes, worn olive zip hoodie over a muted rust-orange T-shirt. Still bruised: bruised cheek and split lip, stylised and not gory.
Scene: interior, the same small cluttered bedroom. Side view of the streamer at his desk. He points at the monitor with one hand and turns his face to the viewer with a wide, vindicated, triumphant grin, delighted to be persecuted. The monitor shows a large red warning panel: a crossed-out coin pictogram above three blank bars. Red-orange light from the screen falls on his face and on the wall of pinned papers and red string behind him.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```

## 8. La suspension

`id` : `outro_4` · légende : **« Chaîne suspendue. Revenus retenus. / Un dernier don, signé de la plateforme : "Merci pour le contenu." »**

```text
1990s PC game cutscene illustration, hand-painted pixel art, hard chunky pixels with no anti-aliasing, limited earthy palette of about 48 colours, strong readable shapes, clean silhouettes, flat lighting planes with a few hand-dithered transitions. Same art style as the supplied character reference. Dry satirical tone, never horror. Lit by the cold sickly green glow of a single monitor in a dark room, with one warm sodium-orange line from a street lamp through the blind. Landscape, composed for a 16:9 crop: keep every important element inside the central 16:9 band and treat the top and bottom edges as bleed. Must stay readable when reduced to 640 pixels wide.
Character (preserve exactly from the reference image, seen from behind): the same original fictional French amateur video streamer, short tousled dark brown hair, worn olive zip hoodie.
Scene: interior, the same small cluttered bedroom, late at night, lights off. Wide shot from the back of the room. On the desk, the main monitor shows a large grey padlock pictogram on a dark screen; the keyhole of the padlock is a narrow vertical slit, like a reptile's pupil. Under the padlock, one small glowing notification bar with a coin pictogram. The streamer stands at the wall with his back to the viewer, pinning up a new photograph of a tall modern glass office tower, and stretching a fresh red string from the photograph of the supermarket facade to it. Long shadow across the room.
Avoid: any text, letters, numbers, captions, speech bubbles, logos, real brands, real people, real app or website interfaces, watermark, signature, borders or frames, photorealism, 3D render, smooth gradients, soft airbrushed shading, blur, lens flare, gore.
```
