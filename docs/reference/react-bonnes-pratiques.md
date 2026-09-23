---
title: React 19.2 — bonnes pratiques du projet
tags: [reference, react, ui]
status: stable
updated: 2026-09-23
---

# React 19.2 — bonnes pratiques du projet

Ces règles s'appliquent à tout code React du dépôt, qu'il soit écrit par
l'agent principal ou par un sous-agent. Elles ne remplacent pas la
documentation de React : elles disent ce que **ce projet** en retient, et
pourquoi.

Règles sœurs : [structure](react-structure.md), [CSS](react-css.md),
[composition](react-composition.md).

## Le contexte qui change tout

React n'est ici qu'un **calque posé sur une boucle de jeu**. La boucle tourne à
pas fixe, en TypeScript pur, et ne connaît pas React ; elle écrit dans le store
zustand (`game/state.ts`), et l'interface le lit (invariant #2).

```
boucle de jeu ──écrit──▶ store zustand ──lu par──▶ composants React
     (60 Hz)              (10 Hz max)               (jamais l'inverse)
```

Trois conséquences qui priment sur tout le reste :

- **Aucun `setState` par frame**, aucun `requestAnimationFrame` dans un
  composant. Une valeur qui bouge en continu est publiée à 10 Hz au plus.
- **Aucun état de jeu dans React.** Un `useState` qui contiendrait des PV ou une
  position casserait le déterminisme et le rejeu d'input.
- **React ne s'abonne jamais à un acteur XState.** La machine de flux pousse son
  état dans le store, l'interface lit le store. `@xstate/react` est exclu.

Le détail du pont est dans le skill `react-hud-bridge`.

## Version et API retenues

React et React DOM **19.2.8**.

| API | Statut | Pourquoi |
|---|---|---|
| `useEffectEvent` (19.2) | **à utiliser** | un gestionnaire lancé par un effet lit l'état courant sans réabonner l'effet |
| `useSyncExternalStore` | à utiliser | pour une source externe qui n'est pas zustand (`core/loadingProgress.ts`) |
| `ref` comme prop | à utiliser | `forwardRef` est inutile depuis React 19 |
| `<Context value>` | si un contexte devient nécessaire | `<Context.Provider>` est l'ancienne forme |
| React Compiler | **absent** | pas de mémoïsation automatique : voir plus bas |
| `<Activity>` (19.2) | non utilisé | un écran quitté est démonté exprès — c'est la machine de flux qui décide de ce qui existe |
| Actions, `useActionState`, `use` | non utilisés | pas de serveur, pas de formulaire, pas de Suspense sur des données |

## Composants

- **Une fonction nommée, exportée par nom.** Pas d'export par défaut, pas de
  `React.FC`, pas de `defaultProps`.
- **Props typées par une `interface NomProps`**, déstructurées dans la
  signature, avec leurs valeurs par défaut :

  ```tsx
  export function Button({ variant = "default", children, ...rest }: ButtonProps) {
  ```

- **Pur au rendu.** Le corps d'un composant ne modifie rien hors de lui : pas
  d'écriture dans le store, pas d'appel au moteur, pas de `localStorage`. Ces
  effets vont dans un gestionnaire d'évènement ou, s'ils synchronisent avec
  l'extérieur, dans un effet.
- **Un composant qui ne doit rien afficher retourne `null`**, au début, avant
  tout JSX (`DeathScreen` hors de l'état `dead`).

## État

- **Minimal.** Ce qui se calcule à partir des props ou du store se calcule au
  rendu, il ne se stocke pas.
- **Pas d'état pour ce que le CSS sait faire.** Survol, focus, appui : `:hover`,
  `:focus-visible`, `:active`. Un `useState` de survol re-rend le composant à
  chaque passage de souris pour rien.
- **Pas de copie de props dans l'état.**
- **Une source externe mutable se lit par un abonnement** — le store zustand, ou
  `useSyncExternalStore` — jamais en lisant une variable de module au rendu en
  espérant qu'un autre rendu passera.

La seule exception assumée est le panneau de tuning (`dev/tuning/`), qui édite
des objets de config mutables lus par la boucle : il passe par
`useConfigEditor`, qui mute puis force le rendu. Ce motif ne sort pas de `dev/`.

## Effets

Un effet **synchronise avec quelque chose qui n'est pas React** : un écouteur sur
`window`, un minuteur, le verrouillage du pointeur. Il a toujours un nettoyage.

Ce qui n'est **pas** un effet :

- réagir à un clic — c'est le gestionnaire du clic ;
- calculer une valeur à partir d'une autre — c'est le rendu ;
- réinitialiser un état quand une prop change — c'est une `key`.

Quand le gestionnaire d'un écouteur a besoin de l'état courant, il passe par
`useEffectEvent` au lieu d'ajouter cet état aux dépendances (ce qui
détacherait et rattacherait l'écouteur à chaque changement) :

```tsx
const onKey = useEffectEvent((e: KeyboardEvent) => { if (listening) capture(e); });

useEffect(() => {
  const listener = (e: KeyboardEvent) => onKey(e);
  window.addEventListener("keydown", listener);
  return () => window.removeEventListener("keydown", listener);
}, []);
```

Exemples réels : `screens/options/controls/ControlsTab/useInputCapture.ts` (capture de la touche à
remapper) et `dev/tuning/TuningPanel/TuningPanel.tsx` (ouverture à la touche `` ` ``).

Un Effect Event ne s'appelle que depuis un effet (ou un rappel qu'il installe) :
on ne le passe ni en prop, ni directement à une API qui le conserverait, et il
n'apparaît jamais dans un tableau de dépendances.

## Lire le store

- **Un sélecteur par valeur primitive :**

  ```tsx
  const hp = useGameStore((s) => s.debug.playerHp);
  ```

- **Un sélecteur peut calculer, s'il rend une primitive.** `AmmoPanel` lit
  `(s) => ammoLabel(s.debug)` : une chaîne, comparée par valeur — le panneau ne
  re-rend que si le texte affiché change.
- **Jamais un sélecteur qui construit un nouvel objet ou un nouveau tableau.**
  zustand 5 compare les résultats par référence : un sélecteur qui renvoie
  `{ hp, maxHp }` renvoie un objet neuf à chaque appel, et React boucle jusqu'à
  lever « Maximum update depth exceeded ». Deux valeurs, deux sélecteurs.
- **Chaque widget lit ce qu'il affiche.** Un parent qui lit neuf valeurs pour les
  redistribuer re-rend tout le HUD dès que l'une d'elles bouge — voir
  [composition](react-composition.md#chaque-feuille-lit-ses-propres-données).

## Mémoïsation

Pas de React Compiler, donc pas de mémoïsation automatique — et pas de
`useMemo`/`useCallback`/`memo` par réflexe non plus. On en pose un quand une
mesure le justifie (profileur React, règle des 10 rendus par seconde du HUD), ou
quand une identité stable est exigée par une API. Avec `useEffectEvent`, ce
second cas est devenu rare.

## Évènements

- Les props de rappel s'appellent `onQuelqueChose`, les fonctions qui les
  implémentent `handleQuelqueChose`.
- Une flèche en ligne est permise pour un appel simple
  (`onClick={() => setTab("controles")}`). Au-delà d'une ligne, elle devient une
  fonction nommée.

## Listes et rendu conditionnel

- **Clé stable et unique**, tirée des données (`action`, `preset.id`). L'index
  n'est acceptable que pour une liste qui ne se réordonne jamais.
- **`&&` seulement avec un booléen.** `{count && <X />}` affiche `0` quand la
  liste est vide ; on écrit `{count > 0 && <X />}`.

## Accessibilité

- Tout bouton est un `<button type="button">` (le composant `Button` le pose).
- Des onglets ont `role="tablist"` / `role="tab"` et `aria-selected`.
- Un interrupteur a `aria-pressed` ; un choix exclusif est un
  `role="radiogroup"` de `role="radio"` avec `aria-checked` (`ChoiceGroup`).
- Un curseur (`<input type="range">`) a un nom accessible : un `<label>`
  associé, ou `aria-label` quand le titre visible est ailleurs (`RangeField`).
- **Pas de `<form>`** dans l'interface : sa soumission recharge la page.

Ces attributs servent aussi de crochets au CSS — voir [CSS](react-css.md#variantes-et-états).

## TypeScript

- `import type` pour ce qui n'est qu'un type.
- Pas de `any`. Un `switch` sur une union se termine par un
  `default: return value satisfies never` pour échouer à la compilation quand un
  cas s'ajoute.
- Les unions de libellés (`"argent" | "or" | "platine"`) viennent du module qui
  les définit, jamais recopiées.

## Commentaires

Le code dit quoi, le commentaire dit pourquoi — et seulement quand ce n'est pas
évident (skill `code-comment-policy`). Un composant commence par un commentaire
court qui dit **à quoi il sert et ce qu'il ne doit pas faire**, suivi d'une ancre
`see:` vers la doc. L'historique des mesures et des essais va dans `docs/`, pas
dans le fichier.
