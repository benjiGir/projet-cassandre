import { create } from "zustand";

interface DebugState {
  fps: number;
  /** Position des yeux du joueur, m. */
  position: { x: number; y: number; z: number };
  entityCount: number;
  /** Pas fixes exécutés pendant la dernière frame d'affichage (spirale de rattrapage si > 2 durablement). */
  steps: number;

  // Diagnostic du character controller — imposé en permanence par le skill
  // `rapier-character-controller`. Un `isGrounded` qui clignote sur terrain
  // plat signale un problème de snap-to-ground.
  isGrounded: boolean;
  /** Vitesse horizontale, m/s. */
  horizontalSpeed: number;
  /** Vitesse verticale, m/s. */
  verticalSpeed: number;
  /** Collisions du dernier `computeColliderMovement`. */
  numCollisions: number;
  /** Normale du sol sous les pieds. */
  groundNormal: { x: number; y: number; z: number };

  // État de vie du joueur (Phase 3, ennemi Costard). Affiché dans le panneau
  // de debug ET, depuis la Phase 6, dans le vrai HUD de prod (`ui/Hud.tsx`,
  // sélecteur fin dédié — voir sa doc). 100/100 est un point de départ
  // ARBITRAIRE pour rendre les dégâts observables en playtest, PAS un choix
  // de tuning arrêté : le tuning (PV max, dégâts par attaque, régénération
  // éventuelle...) appartient à l'humain, pas à cette tâche.
  playerHp: number;
  playerMaxHp: number;

  // Munitions du pompe (Phase 3, retour playtest : « au bout d'un moment je
  // ne peux plus tirer avec » — le pool fini (`shotgunStartingAmmo`,
  // `weapons.ts`) fonctionnait comme prévu, mais était invisible : rien
  // n'affichait la valeur, un tir à sec ne se distinguait pas d'un bug.
  // Même discipline que `playerHp` ci-dessus : lu au pas fixe, écrit via le
  // `setDebug` déjà throttlé à 10 Hz dans `main.ts`, pas de setter dédié.
  shotgunAmmo: number;
  shotgunMaxAmmo: number;

  // Arme active (Phase 6) — `WeaponSystem.activeWeapon` recopié tel quel
  // (même union de types, dupliquée ici plutôt qu'importée : `game/state.ts`
  // ne dépend d'aucun autre module de `src/game/*`, comme le reste de ce
  // fichier — voir le même choix pour `playerHp`/`shotgunAmmo` qui ne
  // dépendent pas non plus des types de `weapons.ts`). Écrit dans le même
  // `setDebug` throttlé à 10 Hz que `shotgunAmmo` ci-dessus ; le HUD de prod
  // s'en sert pour savoir QUOI afficher comme munitions ("PIED-DE-BICHE",
  // "À MAINS NUES", ou un compte de cartouches).
  activeWeapon: "none" | "melee" | "shotgun";

  // Compteur de secrets (Phase 5, critère de validation du plan : "trouve au
  // moins 1 secret sur 2"). Même discipline que `playerHp`/`shotgunAmmo` :
  // écrit ponctuellement à l'événement (un secret trouvé n'arrive pas à
  // 60 Hz), pas au pas fixe.
  secretsFound: number;
  secretsTotal: number;

  // Compteur de « vues » (Phase 6, HUD façon overlay de stream — voir
  // `ui/Hud.tsx`). C'est la BLAGUE du HUD, pas un score neutre : le
  // personnage est un youtubeur complotiste à 200 abonnés, ses kills
  // deviennent des "clips qui buzzent". Incrémenté PONCTUELLEMENT dans les
  // boucles `deathEvents` de `main.ts` (Costard + Directeur confondus dans
  // le même compteur — le plan ne demande qu'UN compteur), jamais au pas
  // fixe. Valeur de départ ARBITRAIRE (quelques spectateurs en direct,
  // cohérent avec "200 abonnés" plutôt qu'un flatteur zéro) — comme
  // `playerHp: 100`, un point de départ à confirmer par l'humain, pas un
  // choix de tuning arrêté.
  views: number;
}

interface GameState {
  debug: DebugState;
  /**
   * Écriture THROTTLÉE À 10 Hz MAXIMUM depuis la boucle (invariant #2).
   * Jamais un appel par frame : React n'entre pas dans la boucle de jeu.
   */
  setDebug: (partial: Partial<DebugState>) => void;
  /**
   * Écrit les PV courants du joueur dans `debug.playerHp`. À appeler
   * PONCTUELLEMENT, au moment d'un dégât réel (une touche d'ennemi, pas un
   * appel par frame/pas fixe) — même risque que `setDebug`, qui est déjà
   * throttlé à 10 Hz ailleurs dans `main.ts` : un `setState` par frame
   * consomme le budget de perf React avant d'avoir commencé (invariant #2,
   * skill `react-hud-bridge`). Un dégât n'arrive pas à 60 Hz, donc aucun
   * throttling supplémentaire n'est nécessaire ici tant que l'appelant
   * respecte cette règle.
   */
  setPlayerHp: (hp: number) => void;
  /** Incrémente `debug.secretsFound` de 1 — même discipline ponctuelle que `setPlayerHp`, appelé UNE FOIS par secret nouvellement trouvé. */
  incrementSecretsFound: () => void;
  /** Fixe `debug.secretsTotal` — appelé une fois au chargement d'un niveau (voir `LevelStats.secretCount`). */
  setSecretsTotal: (total: number) => void;
  /** Incrémente `debug.views` de `amount` — même discipline ponctuelle que `incrementSecretsFound`, appelé UNE FOIS par kill (Costard ou Directeur) dans les boucles `deathEvents` de `main.ts`. `amount` est décidé par l'appelant (le gag du "clip qui buzz" varie le gain, voir `main.ts`), pas fixé ici. */
  incrementViews: (amount: number) => void;

  /**
   * Message HUD transitoire SYSTÈME (feedback ponctuel factuel : badge
   * ramassé, porte verrouillée/déverrouillée, secret trouvé n/total...).
   * `null` = rien affiché. Écrit à l'occurrence de l'événement (pas au pas
   * fixe, même discipline que `setPlayerHp`) ; l'auto-effacement après un
   * délai est géré côté appelant (`main.ts`, `setTimeout`), pas ici — ce
   * store reste un simple conteneur d'état, aucune logique de timing.
   *
   * DISTINCT de `heroLine` ci-dessous : ce canal n'a AUCUN cooldown — un
   * refus de porte doit s'afficher immédiatement à chaque essai, pas être
   * avalé par le cooldown de 15 s des répliques du héros (skill
   * `audio-sfx-pipeline`). C'est la ligne de partage : de l'INFORMATION
   * (ce qui vient de se passer, objectivement) vs. une RÉPLIQUE (la
   * réaction du personnage, qui peut légitimement être sacrifiée si une
   * autre vient de parler).
   */
  hudMessage: string | null;
  showHudMessage: (text: string | null) => void;

  /**
   * Réplique du héros — canal DÉDIÉ, séparé de `hudMessage` (voir sa doc
   * juste au-dessus pour la ligne de partage information/réplique). Le
   * COOLDOWN GLOBAL DE 15 S (skill `audio-sfx-pipeline`) est appliqué côté
   * appelant (`main.ts::triggerHeroLine`), jamais ici — même principe que
   * `hudMessage` : ce store reste un conteneur d'état passif, toute la
   * logique de timing (cooldown, auto-effacement) vit dans `main.ts`.
   */
  heroLine: string | null;
  showHeroLine: (text: string | null) => void;

  /**
   * Écran de mort (Phase 6). `false` → `true` UNE SEULE FOIS par partie, à
   * l'instant où `playerHp` atteint 0 (voir les boucles `playerHitEvents`
   * dans `main.ts::updateFx`) — jamais réécrit ensuite dans la même partie
   * (pas de résurrection en place, voir `ui/DeathScreen.tsx` pour le
   * mécanisme de "Rejouer" — un rechargement de page complet, qui repart
   * naturellement de `false` ici).
   */
  isDead: boolean;
  setDead: (dead: boolean) => void;

  /**
   * Écran de fin de niveau (Phase 6). `true` quand le joueur a franchi
   * `door_e_exit` APRÈS l'avoir déverrouillée (badge du Directeur) — voir
   * `main.ts` pour la détection par volume (même famille que la détection
   * AABB des secrets). N'existe que sur les niveaux qui ont réellement cette
   * porte (le déclencheur lui-même est gaté côté `main.ts`, ce champ ne
   * fait que refléter l'état une fois déclenché).
   */
  isLevelComplete: boolean;
  setLevelComplete: (complete: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  debug: {
    fps: 0,
    position: { x: 0, y: 0, z: 0 },
    entityCount: 0,
    steps: 0,
    isGrounded: false,
    horizontalSpeed: 0,
    verticalSpeed: 0,
    numCollisions: 0,
    groundNormal: { x: 0, y: 1, z: 0 },
    playerHp: 100,
    playerMaxHp: 100,
    shotgunAmmo: 0,
    shotgunMaxAmmo: 0,
    activeWeapon: "melee",
    secretsFound: 0,
    secretsTotal: 0,
    views: 12,
  },
  setDebug: (partial) => set((state) => ({ debug: { ...state.debug, ...partial } })),
  setPlayerHp: (hp) => set((state) => ({ debug: { ...state.debug, playerHp: hp } })),
  incrementSecretsFound: () =>
    set((state) => ({ debug: { ...state.debug, secretsFound: state.debug.secretsFound + 1 } })),
  setSecretsTotal: (total) => set((state) => ({ debug: { ...state.debug, secretsTotal: total } })),
  incrementViews: (amount) => set((state) => ({ debug: { ...state.debug, views: state.debug.views + amount } })),

  hudMessage: null,
  showHudMessage: (text) => set({ hudMessage: text }),

  heroLine: null,
  showHeroLine: (text) => set({ heroLine: text }),

  isDead: false,
  setDead: (dead) => set({ isDead: dead }),

  isLevelComplete: false,
  setLevelComplete: (complete) => set({ isLevelComplete: complete }),
}));
