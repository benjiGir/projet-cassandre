---
name: fixed-timestep-loop
description: Boucle de jeu à pas fixe avec interpolation du rendu, accumulateur, clamp du delta, capture d'input, hitstop et test de déterminisme. Charger pour toute tâche touchant src/core/ ou toute logique temporelle.
---

# Boucle à pas fixe

## Implémentation de référence

```ts
const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.25;

let accumulator = 0;
let last = performance.now();

function frame(now: number) {
  requestAnimationFrame(frame);

  let frameTime = (now - last) / 1000;
  last = now;
  if (frameTime > MAX_FRAME) frameTime = MAX_FRAME;
  accumulator += frameTime;

  input.beginFrame();

  while (accumulator >= FIXED_DT) {
    snapshotPrevious();
    physics.step();
    updateGameplay(FIXED_DT * time.scale);   // time.scale = hitstop
    accumulator -= FIXED_DT;
  }

  input.endFrame();

  interpolateVisuals(accumulator / FIXED_DT);
  fx.update(frameTime);            // temps réel, hors pas fixe
  renderer.render(scene, camera);
}
```

## Contrat

| Aspect | Règle |
|---|---|
| Entrées | déterministes : RNG seedé, aucun `Date.now()` dans le pas fixe |
| Paramètres exposés | `FIXED_DT`, `MAX_FRAME`, `time.scale` |
| Sorties de diagnostic | steps/frame, `accumulator` résiduel, `frameTime` p50/p99 |
| Stabilité temporelle | identique à 30, 60, 144 Hz d'affichage |

## Ce qui s'interpole et ce qui ne s'interpole pas

| Élément | Interpolé ? |
|---|---|
| Position des entités | oui, `lerp(prev, curr, alpha)` |
| Rotation des entités | oui, `slerp` |
| **Rotation de la caméra** | **non** — lue au taux d'affichage |
| Position de la caméra | oui (elle suit le corps du joueur) |
| Screenshake, flash, particules décoratives | non — temps réel |

Interpoler la rotation caméra ajoute jusqu'à 16 ms de latence perçue à la
visée. C'est l'erreur la plus coûteuse et la plus difficile à diagnostiquer
après coup, parce qu'elle se ressent sans se voir.

## Hitstop

Le hitstop scale `dt` de gameplay. Il ne saute **jamais** de step physique :

```ts
// Correct
updateGameplay(FIXED_DT * time.scale);   // scale → 0.05 pendant 3 frames

// Faux — désynchronise la physique du gameplay
if (time.hitstopFrames > 0) { time.hitstopFrames--; return; }
```

## Test de déterminisme

À livrer avec toute modification de la boucle :

```ts
function testDeterminism() {
  const inputs = recordedSequence;        // 600 frames
  const a = simulate(inputs, seed: 42);
  const b = simulate(inputs, seed: 42);
  assert(distance(a.state, b.state) < 1e-6);
}
```

Si ça casse : cherche `Math.random()` non seedé, `Date.now()`, `performance.now()`
lu dans le pas fixe, ou une lecture d'input hors accumulateur.

## Anti-patterns

- Delta non clampé → le joueur change d'onglet, revient, traverse trois murs
- `world.step()` appelé dans le rendu → physique dépendante du framerate
- Input lu directement dans `updateGameplay` au lieu d'être accumulé →
  perte d'events sur les frames à steps multiples
- Timers en secondes calculés sur `frameTime` au lieu du nombre de steps
