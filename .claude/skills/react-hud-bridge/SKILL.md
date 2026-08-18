---
name: react-hud-bridge
description: Découplage entre la boucle de jeu et l'UI React — store zustand, souscriptions sélectives, throttling, anti-patterns de re-render. Charger pour toute tâche sur le HUD, les menus ou l'état exposé à l'UI.
---

# Pont game loop → React

## Le principe

```
┌─ React (DOM overlay) ──────────┐
│  HUD, menus, pause, debug      │  ← s'abonne, throttlé à 10 Hz
└───────────────┬────────────────┘
                │ zustand — lecture seule côté UI
┌───────────────┴────────────────┐
│  Game loop (TS vanilla)        │  ← écrit, ne lit jamais React
└────────────────────────────────┘
```

**Le game loop n'appelle jamais React.** Il écrit dans le store. Un `setState`
par frame et le budget de performance est consommé avant d'avoir commencé.

## Pattern d'écriture

Le loop écrit hors du cycle React, via `setState` de zustand appelé depuis du
code vanilla :

```ts
// dans le pas fixe — écriture directe, pas de re-render forcé
useGameStore.setState({ hp: player.hp, ammo: player.ammo });
```

Écris uniquement quand la valeur **change réellement**. Zustand ne fait pas de
comparaison profonde par défaut : réécrire `hp: 100` chaque frame déclenche un
re-render chaque frame.

```ts
if (player.hp !== lastPublishedHp) {
  lastPublishedHp = player.hp;
  useGameStore.setState({ hp: player.hp });
}
```

## Pattern de lecture

Sélecteurs fins, un par valeur. Jamais l'objet complet :

```ts
// Correct — ne re-render que si hp change
const hp = useGameStore((s) => s.hp);

// Faux — re-render à chaque écriture du store, quelle qu'elle soit
const state = useGameStore();
```

## Throttling

Pour les valeurs qui changent en continu (position, vitesse, compteur de vues
qui s'anime), publie à **10 Hz maximum** :

```ts
if (now - lastPublish > 100) { publish(); lastPublish = now; }
```

Personne ne perçoit une barre de vie mise à jour 60 fois par seconde.

## Le panneau de debug est l'exception

Il peut afficher à 30 Hz — mais il doit être **démontable en une ligne** et
absent du build de production. C'est le composant qui coûte le plus cher et
qui ne sert qu'au développement.

## Anti-patterns

| Anti-pattern | Conséquence |
|---|---|
| `useFrame` / RAF dans un composant React | boucle dupliquée, désynchronisée |
| Objet complet en sélecteur | re-render sur toute écriture |
| État de jeu stocké dans React | perte du déterminisme, HMR qui casse tout |
| Canvas monté par React | remount = perte du contexte WebGL |
| `<form>` dans l'overlay | comportements de soumission parasites |

## Vérification

Profiling React sur 30 s de jeu actif : **aucun composant HUD au-delà de
10 re-renders par seconde**. Un dépassement est bloquant, pas une optimisation
à repousser.
