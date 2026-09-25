---
title: React — structure et rangement de src/ui
tags: [reference, react, ui]
status: stable
updated: 2026-09-23
---

# React — structure et rangement de src/ui

`src/ui/` contient l'interface React et **rien d'autre** : des composants, leurs
feuilles de style, les hooks et les petites fonctions pures qui ne servent qu'à
eux. Un module qui persiste un réglage, pilote le moteur ou décide d'une règle de
jeu vit ailleurs, même s'il n'a qu'un seul appelant dans l'interface.

Règles sœurs : [bonnes pratiques React 19.2](react-bonnes-pratiques.md),
[CSS](react-css.md), [composition](react-composition.md).

## L'arbre

```
src/ui/
  App.tsx                  racine montée en jeu : HUD + écrans de fin
  gameFlowMachine.ts       machine XState du flux d'écran (ADR 0019)
  theme/tokens.css         palette, polices, tons, --vpx — importé une fois par main.ts
  lib/                     .ts partagés par toute l'interface : cx(), cssVars(), formatViews()
  components/              primitives d'identité visuelle, sans store
    layout/    Screen/  CornerFrame/
    effects/   Scanlines/  Vignette/  TvStatic/
    text/      ScreenTitle/  StatusFlag/  RecIndicator/
    controls/  Button/  ButtonRow/
  hud/                     le calque en jeu
    Hud/
    primitives/  HudCorner/  HudLabel/  HudValue/
    widgets/     LiveCam/  ViewerCount/  HealthPanel/  AmmoPanel/  LoyaltyCards/  HeroLine/
    overlays/    HudMessage/  FpsCounter/
    lib/         hudFormat.ts
  screens/
    mainMenu/  loading/  death/  levelComplete/
    options/     OptionsScreen/  OptionsTabs/  controls/  display/  fields/
  dev/                     outils de développement, absents du build de prod
    DebugPanel/  LevelMenu/  ZoneChooserLink/  devPreview/
    tuning/      TuningPanel/  sections/  controls/  layout/  lib/
```

Les deux fichiers à la racine sont les deux **racines** de l'interface : l'arbre
React monté en jeu et la machine qui décide quel écran existe. Tout le reste est
rangé.

## Trois sortes de dossiers

La casse dit ce qu'est un dossier, sans avoir à l'ouvrir :

| Sorte | Nom | Contient | Exemple |
|---|---|---|---|
| **Composant** | PascalCase, le nom de l'export | son `.tsx`, son `.module.css`, les `.ts` qui ne servent qu'à lui | `LoadingScreen/` : `LoadingScreen.tsx`, `LoadingScreen.module.css`, `useLoadingStatus.ts`, `loadingQuips.ts` |
| **Famille** | minuscules, un rôle | des dossiers de composants qui jouent le même rôle | `widgets/`, `fields/`, `effects/` |
| **Bibliothèque** | `lib/` | les `.ts` partagés par plusieurs composants d'un même domaine | `hud/lib/hudFormat.ts`, `dev/tuning/lib/tuningFields.ts` |

Trois règles de rangement en découlent :

- **Un dossier par composant, toujours.** Un composant et sa feuille de style
  vivent ensemble : on ne modifie jamais l'un sans ouvrir l'autre.
- **Un `.ts` vit au plus près de ceux qui l'utilisent.** Dans le dossier du
  composant s'il n'a qu'un utilisateur (`useInputCapture.ts` dans
  `ControlsTab/`), dans le `lib/` du domaine s'il en a plusieurs
  (`hudFormat.ts`, lu par `HealthPanel` et `AmmoPanel`), dans `src/ui/lib/` s'il
  sert à plusieurs domaines (`formatViews`, lu par le HUD et deux écrans).
- **Une famille naît quand un niveau déborde.** Au-delà d'une demi-douzaine
  d'entrées, on regroupe par rôle ; en dessous, on ne crée pas de famille pour
  un seul composant. Un écran est toujours une famille (`screens/death/`) : il a
  vocation à grandir, l'écran d'options a commencé avec un seul fichier.

## Ce qui va où

| Dossier | Contenu | Peut importer |
|---|---|---|
| `theme/` | les jetons CSS | rien |
| `lib/` | fonctions TypeScript sans React, utiles à plusieurs domaines | rien |
| `components/` | primitives visuelles réutilisables : `Screen`, `CornerFrame`, `Button`… | `lib/` seulement |
| `hud/` | widgets du calque en jeu | `components/`, `lib/`, `game/state` |
| `screens/<écran>/` | un écran modal et ce qui n'appartient qu'à lui | `components/`, `lib/`, `game/state`, les API publiques de `core/` et de `game/graphicsSettings.ts` |
| `dev/` | panneaux et harnais de développement | tout, mais **n'est utilisé que derrière `import.meta.env.DEV`** |

Ce que ce tableau interdit, et pourquoi :

- **Une primitive de `components/` ne lit jamais le store.** Si elle le lisait, on
  ne pourrait plus la poser dans un écran d'aperçu, un menu ou un test sans monter
  tout l'état du jeu. Les données arrivent par les props.
- **Un écran ne connaît pas un autre écran.** La navigation passe par les
  callbacks reçus en props (`onBack`, `onReplay`) ; c'est `main.ts`,
  `bootChoice.ts` ou la machine de flux qui décident de la suite.
- **Rien hors de `dev/` n'utilise `dev/` sans garde.** Un import statique est
  permis (`App.tsx`, `main.ts`, `bootChoice.ts`) tant que chaque USAGE est
  derrière `import.meta.env.DEV` : Vite remplace la garde par une constante,
  et le composant de dev quitte le bundle avec son CSS. Une seule branche
  sans garde suffit à tout embarquer — `LevelMenu` est ainsi parti en
  production pendant des semaines par un chemin « inatteignable ». Ça se
  vérifie après `pnpm build` en cherchant un texte ou une couleur propre au
  composant dans `dist/assets`.

## Un écran complet, pour l'exemple

```
screens/options/
  OptionsScreen/     OptionsScreen.tsx   OptionsScreen.module.css
  OptionsTabs/       OptionsTabs.tsx     OptionsTabs.module.css
  controls/          l'onglet CONTRÔLES
    ControlsTab/     ControlsTab.tsx  ControlsTab.module.css  useInputCapture.ts
    KeyBinding/      KeyBinding.tsx   KeyBinding.module.css
    MusicToggle/     MusicToggle.tsx  MusicToggle.module.css
  display/           l'onglet AFFICHAGE
    DisplayTab/      DisplayTab.tsx   DisplayTab.module.css   displayChoices.ts
  fields/            les briques d'un réglage
    OptionSection/  OptionHint/  ChoiceGroup/  RangeField/
```

Une pièce qui sert à **deux** écrans remonte dans `components/`, dans la famille
de son rôle. Tant qu'elle n'en sert qu'un, elle reste dans l'écran : on ne
mutualise pas par anticipation.

## Nommage des fichiers

| Contenu principal | Nom | Exemple |
|---|---|---|
| un composant | PascalCase, identique à l'export et à son dossier | `LiveCam/LiveCam.tsx` exporte `LiveCam` |
| sa feuille de style | même nom + `.module.css` | `LiveCam/LiveCam.module.css` |
| un hook | `useX.ts` | `useLoadingStatus.ts` |
| des fonctions pures, des données | camelCase | `hudFormat.ts`, `loadingQuips.ts` |

Le nom du fichier est le nom de l'export : on retrouve un composant en tapant son
nom dans l'éditeur, sans index à maintenir. Le chemin répète le nom
(`Button/Button.tsx`) : c'est le prix de l'absence d'`index.ts`, et il est
délibéré — voir plus bas.

## Pas de fichier index

**Aucun barrel.** On importe depuis le fichier qui définit la chose — ici depuis
`screens/death/DeathScreen/DeathScreen.tsx` :

```ts
import { Button } from "../../../components/controls/Button/Button";
```

Un `index.ts` qui ré-exporte un dossier ne fait gagner qu'un segment de chemin,
et coûte : des cycles d'import invisibles, un tree-shaking moins net, et un
fichier de plus à tenir à jour à chaque ajout.

## Un composant exporté par fichier

Un fichier exporte **un** composant. Il peut contenir des sous-composants privés
s'ils ne servent qu'à lui et restent courts (une vingtaine de lignes, sans
feuille de style à eux). Au-delà, ou dès qu'un second composant en a besoin, le
sous-composant prend son propre dossier.

Un fichier de composant qui dépasse **150 lignes** est un signal de découpe, pas
une faute : regarde s'il ne contient pas deux composants, ou des données qui
devraient vivre dans un `.ts` à côté.

## Les données ne sont pas du JSX

Une liste de libellés, de phrases ou de champs de réglage vit dans un fichier
`.ts` sans React (`loadingQuips.ts`, `tuningFields.ts`). Le composant l'importe
et la parcourt. On relit alors les données sans le balisage, et on les teste sans
navigateur.

## Ce qui ne vit pas dans src/ui

- **La persistance d'un réglage et son application au moteur** :
  `game/graphicsSettings.ts`, à côté des autres systèmes qu'il pilote. L'écran
  d'options l'appelle, il ne l'héberge pas.
- **L'état de jeu** : `game/state.ts` (zustand). L'interface le lit, la boucle
  l'écrit — voir [bonnes pratiques](react-bonnes-pratiques.md#le-contexte-qui-change-tout).
- **Le choix de l'écran de démarrage** : `app/bootChoice.ts`, qui monte
  `MainMenu`, `OptionsScreen` et `LevelMenu` avant que la partie existe.

## Tests

Les fonctions pures de l'interface (`hud/lib/hudFormat.ts`, `lib/format.ts`)
se testent dans `test/ui/`, qui reproduit l'arborescence de `src/ui/`, en
environnement `node`. Les composants eux-mêmes se vérifient à
l'écran, par le harnais d'aperçu (`?uiPreview=<écran>`, `dev/devPreview/devPreview.tsx`) et
des mesures DOM — voir [HUD et interface](../systems/hud.md).
