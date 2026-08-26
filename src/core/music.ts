import { Howl } from "howler";

/**
 * Musique + nappe d'ambiance — Phase 6 (« Habillage »). `core/audio.ts`
 * exclut explicitement ce scope depuis sa création (« aucune musique, aucune
 * nappe d'ambiance, aucune réplique du héros ici — Phase 6, pas dans ce
 * module ») : ce module séparé le comble, sans toucher au pooling/pitch/SFX
 * ponctuels déjà en place là-bas.
 *
 * DEUX PISTES, DEUX RÔLES :
 *  - `ambience` : nappe de fond en boucle (bruit de hypermarché — ballast
 *    fluorescent, ronronnement de groupe froid), jamais duckée, jamais
 *    coupée en jeu — c'est le bruit de la salle, pas un événement.
 *  - `music`    : thème en boucle, DUCKÉ (-6 dB, skill `audio-sfx-pipeline`)
 *    à chaque réplique du héros déclenchée (voir `triggerHeroLine` dans
 *    `main.ts`) — remontée sur 400 ms après. Symbolique tant qu'il n'y a pas
 *    de vraie VO (répliques encore en texte HUD, invariant #9), mais c'est le
 *    comportement audio que demande le plan ; il prendra tout son sens le
 *    jour où une vraie voix remplace le texte.
 *
 * `html5: true` sur LES DEUX (skill `audio-sfx-pipeline` : streaming, jamais
 * pour des SFX courts — ici les deux pistes durent plusieurs secondes et
 * tournent en boucle toute une session, l'inverse exact du cas `SfxPool`
 * de `audio.ts`).
 *
 * PLACEHOLDER SONORE ASSUMÉ (invariant #9 appliqué au son, pas seulement au
 * visuel) : les deux fichiers sous `public/assets/audio/music/` sont
 * SYNTHÉTIQUES (script Python stdlib, même pipeline que les 12 SFX de
 * `audio.ts` — sinus/carrés + bruit filtré, `afconvert` pour le `.m4a`,
 * `oggenc` pour le `.ogg`), générés sans accès réseau (aucun outil de
 * recherche web disponible dans cet environnement). CE NE SONT PAS DES
 * CHOIX DE SOUND DESIGN ARRÊTÉS — à remplacer par un vrai morceau libre de
 * droits dès qu'un humain peut en choisir un, exactement comme les
 * placeholders SFX en attendent depuis la Phase 3.
 *
 * Piège navigateur identique à `audio.ts` (skill `audio-sfx-pipeline`) :
 * contexte audio suspendu tant qu'aucune interaction n'a eu lieu. `Howler`
 * gère déjà l'auto-unlock (`Howler.autoUnlock`) sur le même
 * `click`/`touchend`/`keydown` que celui qui déclenche `requestPointerLock`
 * dans `core/input.ts` — appeler `.play()` avant l'unlock met simplement la
 * lecture en attente, elle démarre dès l'unlock, aucun code supplémentaire
 * nécessaire ici.
 */

const MUSIC_BASE_PATH = "/assets/audio/music";

/** Volume de repos de la musique — assez présent pour exister, jamais au point de couvrir les SFX de combat (priorité gameplay > habillage, hiérarchie du skill retro-fps-invariants). */
const MUSIC_VOLUME = 0.32;
/** -6 dB ≈ ×0.501 (20·log10(0.501) ≈ -6.0), valeur EXACTE demandée par le skill `audio-sfx-pipeline` pour le ducking pendant une réplique. */
const MUSIC_DUCK_VOLUME = MUSIC_VOLUME * 0.501;
/** Nappe d'ambiance : nettement plus discrète que la musique, c'est un bruit de fond, pas un thème. */
const AMBIENCE_VOLUME = 0.18;

/** Durée de la remontée après ducking — valeur EXACTE du skill `audio-sfx-pipeline`. */
const DUCK_RESTORE_MS = 400;
/** Descente rapide au déclenchement d'une réplique — volontairement plus courte que la remontée (une chute lente laisserait la ligne partiellement couverte par la musique à pleine puissance). */
const DUCK_ATTACK_MS = 80;

let ambience: Howl | null = null;
let music: Howl | null = null;

/**
 * Construit les deux `Howl` de fond et démarre leur lecture en boucle.
 * Idempotent (même discipline que `initAudio` dans `audio.ts`) : un second
 * appel ne recrée rien. À appeler UNE FOIS au boot, après `initAudio()`.
 */
export function initMusic() {
  if (ambience || music) return;

  ambience = new Howl({
    src: [`${MUSIC_BASE_PATH}/ambience_hum.ogg`, `${MUSIC_BASE_PATH}/ambience_hum.m4a`],
    html5: true,
    loop: true,
    volume: AMBIENCE_VOLUME,
    onloaderror: () => warnMissingOnce("ambience_hum"),
  });
  music = new Howl({
    src: [`${MUSIC_BASE_PATH}/theme_placeholder.ogg`, `${MUSIC_BASE_PATH}/theme_placeholder.m4a`],
    html5: true,
    loop: true,
    volume: MUSIC_VOLUME,
    onloaderror: () => warnMissingOnce("theme_placeholder"),
  });

  // `.play()` avant unlock est sûr (voir la doc de tête) : Howler met en
  // attente, jamais d'exception.
  try {
    ambience.play();
    music.play();
  } catch {
    // Défensif, même discipline que `SfxPool` dans `audio.ts` : un throw
    // synchrone imprévu ne doit jamais empêcher le reste du boot.
  }
}

const warnedIds = new Set<string>();
function warnMissingOnce(id: string) {
  if (warnedIds.has(id)) return;
  warnedIds.add(id);
  console.warn(`[music] piste "${id}" introuvable sous ${MUSIC_BASE_PATH}/ — le jeu continue sans elle.`);
}

/**
 * Ducking musique -6 dB — descente rapide (`DUCK_ATTACK_MS`). N'agit QUE sur
 * `music`, jamais sur `ambience` (le bruit de fond de la salle n'a pas de
 * raison de baisser quand le héros parle, seul le thème musical pourrait le
 * couvrir). No-op si `initMusic()` n'a pas encore tourné.
 *
 * Descente et remontée sont deux fonctions SÉPARÉES, PAS un minuteur interne
 * à ce module : la durée pendant laquelle la musique doit rester ducquée
 * dépend de la durée d'affichage de la réplique, une donnée que seul
 * l'appelant (`main.ts::triggerHeroLine`) connaît — même séparation des
 * responsabilités que `showHudMessage`/`hudMessage` dans `game/state.ts`
 * (« l'auto-effacement est géré côté appelant, pas ici »). `main.ts` appelle
 * `duckMusicForHeroLine()` au déclenchement, puis planifie
 * `restoreMusicVolume()` via son propre `setTimeout`, au même endroit que
 * celui qui efface le texte de la réplique.
 */
export function duckMusicForHeroLine() {
  music?.fade(music.volume(), MUSIC_DUCK_VOLUME, DUCK_ATTACK_MS);
}

/** Remontée sur 400 ms (`DUCK_RESTORE_MS`, valeur exacte du skill `audio-sfx-pipeline`) — voir la doc de `duckMusicForHeroLine`. */
export function restoreMusicVolume() {
  music?.fade(music.volume(), MUSIC_VOLUME, DUCK_RESTORE_MS);
}
