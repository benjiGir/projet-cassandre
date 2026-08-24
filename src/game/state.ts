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

  // État de vie du joueur (Phase 3, ennemi Costard). Affiché UNIQUEMENT dans
  // ce panneau de debug pour l'instant — pas un HUD Phase 6, un chiffre
  // suffit pour évaluer le critère humain de fin de phase ("on recule, on
  // circule, on ne reste pas planté"). 100/100 est un point de départ
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

  /**
   * Message HUD transitoire (feedback ponctuel : badge ramassé, porte
   * verrouillée/déverrouillée...). `null` = rien affiché. Écrit à
   * l'occurrence de l'événement (pas au pas fixe, même discipline que
   * `setPlayerHp`) ; l'auto-effacement après un délai est géré côté
   * appelant (`main.ts`, `setTimeout`), pas ici — ce store reste un simple
   * conteneur d'état, aucune logique de timing.
   */
  hudMessage: string | null;
  showHudMessage: (text: string | null) => void;
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
  },
  setDebug: (partial) => set((state) => ({ debug: { ...state.debug, ...partial } })),
  setPlayerHp: (hp) => set((state) => ({ debug: { ...state.debug, playerHp: hp } })),

  hudMessage: null,
  showHudMessage: (text) => set({ hudMessage: text }),
}));
