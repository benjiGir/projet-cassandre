import { playEnemySfx, playSfx } from "../../../core/audio/audio";
import type { EnemyVoice } from "../../../core/audio/audioTypes";
import { enemySpriteLayout } from "../../../render/sprites/enemySprites";
import { directorConfig } from "../../entities/director/directorConfig";
import type { EnemyEntity, EntityConfig } from "../../entities/shared/enemyEntity";
import type { EnemyManager } from "../../entities/shared/enemyManager";
import { suitConfig } from "../../entities/suit/suitConfig";
import type { FxFrame } from "./fxFrame";

interface FlashingSprite {
  updateFlash(dt: number): void;
  setFlash(intensity: number, duration: number): void;
}

/** Ce qui distingue la présentation d'une famille d'ennemis d'une autre. */
interface EnemyPresentation<TEnemy> {
  readonly sprites: ReadonlyMap<number, FlashingSprite>;
  /** Voix de l'ennemi : chaque espèce a la sienne, le Rampant siffle là où le Costard interpelle. */
  voice(enemy: TEnemy): EnemyVoice | undefined;
  hitFlashDuration(enemy: TEnemy): number;
  /** Secousse de caméra quand un de ces ennemis touche le joueur. */
  readonly playerHitShake: { readonly amplitude: number; readonly duration: number };
  /** Événements propres à la famille, présentés après les blessures et avant les morts. */
  beforeDeaths?(): void;
}

/**
 * Présente ce que les ennemis d'un gestionnaire ont fait depuis l'image
 * précédente, puis vide ses files. Rend `true` si l'un d'eux a touché le joueur.
 */
function presentEnemyEvents<TEnemy extends EnemyEntity<EntityConfig>>(
  { engine, realDt }: FxFrame,
  manager: EnemyManager<TEnemy>,
  presentation: EnemyPresentation<TEnemy>,
): boolean {
  // Décroissance TEMPS RÉEL du flash de dégâts — jamais au pas fixe.
  for (const sprite of presentation.sprites.values()) sprite.updateFlash(realDt);

  // Pas de sprite dédié à l'alerte : la pose d'alerte de l'atlas suffit, le son est le seul canal de plus.
  for (const event of manager.alertEvents) playEnemySfx("alert", presentation.voice(event.enemy));
  // Le son de télégraphie part AVANT les dégâts : `attackTelegraphDuration`
  // (>= 0.2 s) sépare ce point de la résolution de l'attaque dans `runAttack`.
  for (const event of manager.telegraphEvents) playEnemySfx("telegraph", presentation.voice(event.enemy));
  for (const event of manager.shotEvents) playEnemySfx("shot", presentation.voice(event.enemy));
  for (const event of manager.hurtEvents) {
    presentation.sprites.get(event.enemy.id)?.setFlash(1, presentation.hitFlashDuration(event.enemy));
    playEnemySfx("hurt", presentation.voice(event.enemy));
  }
  presentation.beforeDeaths?.();
  for (const event of manager.deathEvents) {
    if (event.gibs) {
      // Bout portant au pompe : gibs À LA PLACE de l'animation de mort. L'ennemi
      // reste "dead"/"corpse" côté simulation, seul le RENDU change ici.
      engine.fx.spawnGibs(event.point, event.direction);
      playSfx("enemy_gib");
    } else {
      engine.fx.spawnBloodPool(event.enemy.position);
    }
    engine.hitmarker.trigger("kill");
    playEnemySfx("death", presentation.voice(event.enemy));
    // Les vues et le premier kill sont déjà décidés dans le pas fixe.
  }
  const playerWasHit = manager.playerHitEvents.length > 0;
  for (const event of manager.playerHitEvents) {
    // Pas de decal : le joueur bouge en permanence.
    engine.fx.spawnImpactParticles(event.point, event.normal, "shotgun", "flesh");
    engine.fx.triggerShake(presentation.playerHitShake.amplitude, presentation.playerHitShake.duration);
  }
  manager.clearFrameEvents();
  return playerWasHit;
}

/** Présentation des ennemis ordinaires. */
export function presentSuitEvents(frame: FxFrame): boolean {
  const { session } = frame;
  return presentEnemyEvents(frame, session.suitManager, {
    sprites: session.suitSprites,
    voice: (suit) => suit.kind,
    hitFlashDuration: (suit) => suit.cfg.hitFlashDuration,
    playerHitShake: { amplitude: suitConfig.playerHitShakeAmplitude, duration: suitConfig.playerHitShakeDuration },
  });
}

/** Le Directeur : le lot commun, plus sa révélation. Il ne laisse jamais de gibs, seulement une flaque. */
export function presentDirectorEvents(frame: FxFrame): boolean {
  const { engine, session } = frame;
  const manager = session.directorManager;
  return presentEnemyEvents(frame, manager, {
    sprites: session.directorSprites,
    voice: () => undefined,
    hitFlashDuration: () => directorConfig.hitFlashDuration,
    playerHitShake: {
      amplitude: directorConfig.playerHitShakeAmplitude,
      duration: directorConfig.playerHitShakeDuration,
    },
    beforeDeaths: () => {
      for (const event of manager.revealEvents) {
        // Bascule costume humain -> reptilien, UNE FOIS ici (événement
        // discret) : la peau `revele` de la planche, ou à défaut (planche de
        // repli) une teinte — voir `Director.tintColor`/`revealed`.
        const sprite = session.directorSprites.get(event.enemy.id);
        const revealedAtlas = engine.directorSheet.atlases.revele;
        if (revealedAtlas) sprite?.setAtlas(revealedAtlas, enemySpriteLayout(engine.directorSheet, revealedAtlas));
        else sprite?.setTint(event.enemy.tintColor);
        engine.fx.triggerShake(directorConfig.revealShakeAmplitude, directorConfig.revealShakeDuration);
      }
    },
  });
}
