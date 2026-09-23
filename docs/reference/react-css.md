---
title: React — CSS, modules et jetons
tags: [reference, react, ui, css]
status: stable
updated: 2026-09-23
---

# React — CSS, modules et jetons

Le style d'un composant vit dans **une feuille dédiée, à côté de lui**, jamais
dans son code. Vite gère les CSS Modules nativement : rien à installer, rien à
configurer.

Règles sœurs : [structure](react-structure.md),
[bonnes pratiques React 19.2](react-bonnes-pratiques.md),
[composition](react-composition.md).

## La règle, et ses deux seules exceptions

Chaque composant stylé a son `Composant.module.css`, importé sous le nom `styles` :

```tsx
import styles from "./LiveCam.module.css";

<div className={styles.frame}>…</div>
```

**Interdit** dans `src/ui/` :

- une balise `<style>` dans le JSX, ou du CSS dans une chaîne TypeScript ;
- un objet `style={{ … }}` qui porte de la présentation ;
- une bibliothèque de CSS-in-JS.

Les deux exceptions :

1. **Une valeur calculée au rendu** (remplissage d'une barre, progression) passe
   par une propriété personnalisée, posée avec `cssVars()`
   (`lib/styleHelpers.ts`). Le CSS décide quoi en faire :

   ```tsx
   <div className={styles.fill} style={cssVars({ "--fill": ratio })} />
   ```
   ```css
   .fill { width: calc(var(--fill) * 100%); }
   ```

2. **`dev/`** tolère des valeurs brutes dans ses modules (pas de jetons pour un
   panneau de tuning), mais pas de style inline non plus.

Une balise `<style>` dans le JSX réinjecte sa feuille à chaque montage et duplique
les `@keyframes` d'un écran à l'autre ; le style inline casse `:hover`,
`:focus-visible` et les media queries, et pousse vers de l'état React pour
simuler un survol. C'est ce que le code d'avant faisait.

## Les jetons

Les valeurs **partagées** — couleurs de la palette, polices, unité du HUD — sont
des propriétés personnalisées sur `:root`, dans `theme/tokens.css`. Un module ne réécrit pas une couleur de
la palette en dur : il lit le jeton.

Deux étages. La **palette** nomme les couleurs :

| Jetons | Rôle |
|---|---|
| `--phosphor`, `--phosphor-strong`, `--phosphor-bright`, `--phosphor-edge`, `--phosphor-dim`, `--phosphor-faint` | le vert « signal » de toute l'interface |
| `--alert`, `--alert-lamp` | le rouge du REC et des voyants |
| `--amber` | la voix du héros, les touches remappées |
| `--font-mono` | la seule famille de l'interface |
| `--vpx` | un pixel virtuel du HUD, voir plus bas |

Les **jetons sémantiques** disent à quoi sert une couleur, et c'est eux que les
composants lisent : `--text`, `--text-strong`, `--text-dim`, `--title`,
`--title-glow`, `--corner`, `--panel-bg`, `--panel-border`, `--control-bg`,
`--control-bg-hover`, `--control-border`, `--control-edge`, `--glow`,
`--scanline`, `--flag-text`, `--flag-bg`, `--flag-border`, `--screen-bg`. Un
ton d'écran ne redéfinit que ceux-là.

Une valeur qui ne sert qu'à un composant reste dans son module. Elle devient un
jeton le jour où un second composant en a besoin.

## Les tons d'écran

Un écran modal a un ton : `signal` (vert, par défaut) ou `alert` (rouge, écran de
mort). Le ton est **un attribut `data-tone` sur la racine de `Screen`** ;
`tokens.css` y attache un jeu de jetons sémantiques :

```css
[data-tone="alert"] {
  --text: #f3c9c9;
  --title: #ff6b6b;
  --corner: var(--alert);
  --control-edge: #ff8080;
  /* … */
}
```

Tout ce qui est posé dedans — `Button`, `CornerFrame`, `StatusFlag`,
`ScreenTitle`, `Scanlines` — lit `var(--title)`, `var(--corner)`… et prend la
couleur du ton **sans le connaître**. Aucun composant ne fait de
`if (tone === "alert")` en TypeScript : la cascade CSS fait ce travail. Le ton
`signal` est aussi posé sur `:root`, si bien qu'une primitive hors de tout
`Screen` (le cadre de la webcam du HUD) a ses couleurs par défaut.

La même mécanique sert aux variantes : `Button variant="danger"` ne réécrit
aucune règle, il redéfinit `--control-bg-hover` et `--glow` sur lui-même. Et
une primitive se règle par ses variables plutôt que par des props :
`LiveCam` pose `--corner-size`, `--corner-offset` et `--frame-border-width`
sur un `CornerFrame` pour en faire un cadre de webcam.

## L'unité du HUD

Le HUD est dessiné en **pixels virtuels** de l'image 640×360 du jeu :

```css
:root { --vpx: min(calc(100vw / 640), calc(100vh / 360)); }

.value { font-size: calc(var(--vpx) * 16); }
```

Le HUD grandit donc avec la fenêtre dans la même proportion que l'image du jeu
(invariant #4). En `px` fixes, il rapetissait relativement à chaque montée en
résolution : 0,93 % de la hauteur d'écran en 1080p, deux fois moins en 4K.

Tout élément **du HUD** est en `--vpx`. Les écrans modaux sont encore en `px` :
dette connue, ils ne grandissent pas avec la fenêtre.

## Nommer les classes

- **camelCase**, pour s'écrire `styles.panelTitle` sans crochets.
- **Ce que c'est, pas à quoi ça ressemble** : `.caption`, pas `.greenSmallText`.
- **Pas de préfixe** d'écran (`mm-`, `ds-`) : le module isole déjà les noms.

## Variantes et états

Deux mécanismes, un par besoin :

| Besoin | Mécanisme | Exemple |
|---|---|---|
| **Variante** — choisie par le parent | une prop énumérée → une classe | `<Button variant="primary">` |
| **État** — l'élément est pressé, choisi, actif | l'attribut ARIA qui le dit, stylé en CSS | `[aria-pressed="true"]`, `[aria-selected="true"]` |

L'attribut ARIA sert deux fois : il dit l'état aux lecteurs d'écran, et le CSS le
cible. Un `data-*` ne sert que quand aucun attribut ARIA ne décrit l'état
(`data-modified` sur une touche remappée).

Pour assembler des classes, `cx()` (`lib/styleHelpers.ts`) ignore les valeurs
fausses :

```tsx
className={cx(styles.button, styles[variant], className)}
```

## Animations

- **En CSS uniquement**, et de préférence sur `transform` et `opacity` : le
  compositeur les joue même quand le fil principal est bloqué (construction des
  colliders au chargement). Une animation pilotée par un état React s'arrête au
  pire moment.
- **`steps()` pour les clignotements** : un voyant s'allume et s'éteint, il ne
  fond pas.
- Les `@keyframes` vivent dans le module qui s'en sert.

## Le calque et la souris

- Tout ce qui s'affiche **pendant le jeu** a `pointer-events: none` : un clic
  intercepté par le HUD casse la visée (pointer lock).
- Seuls les écrans modaux (`Screen`) réactivent `pointer-events: auto`.

## Le rendu rétro

Le jeu est en gros pixels francs : arêtes nettes, palette réduite, trames plutôt
que dégradés continus. `border-radius` ne sert qu'à dessiner un objet rond (une
tête, un voyant), jamais à adoucir un bouton. Voir le skill `build-engine-look`.

## Surcharger une primitive : l'ordre des imports compte

Un écran ajuste une primitive en lui passant sa propre classe
(`<ScreenTitle className={styles.title}>`). Les deux classes ont la même
spécificité : c'est la feuille chargée **en dernier** qui gagne. D'où une
règle d'écriture, dans chaque fichier : **`import styles` vient en dernier**,
après les composants. Le module de la primitive est alors injecté avant celui
de l'écran, en dev comme dans le bundle.

## La seule feuille globale

`theme/tokens.css` est importé **une fois**, par `main.ts`, et c'est la seule
feuille globale. Pas de remise à zéro générale : passer tout le calque en
`box-sizing: border-box`, par exemple, déplacerait chaque élément dont la
largeur est fixée. Un élément qui a besoin d'une remise à zéro la porte dans
son module (`margin: 0` sur un `<p>` ou un `<h1>`).
