// Deux vues d'un même appui (pas fixe vs taux d'affichage), deux Sets, deux
// règles de vidage différentes — voir la doc pour le pourquoi.
// see: docs/systems/boucle-de-jeu.md#entrée-synchronisée-au-pas-fixe

/**
 * Actions de GAMEPLAY rebindables. Les touches de debug (`F9`/`F10`/`KeyV`/
 * `KeyB` dans `game/loop/updateFx.ts`) sont volontairement absentes — jamais
 * montrées au joueur, jamais persistées, jamais rebindables via cette API.
 *
 * see: docs/reference/controles.md
 */
export type GameAction =
  | "moveForward"
  | "moveBack"
  | "moveLeft"
  | "moveRight"
  | "sprint"
  | "jump"
  | "fire"
  | "switchMelee"
  | "switchPistol"
  | "switchShotgun"
  | "use";

/**
 * Table de bindings par défaut — identique aux codes historiques de
 * `captureInputFrame` (aucune régression de comportement). Fonctionne déjà
 * en AZERTY (ZQSD) tel quel : `KeyboardEvent.code` identifie la position
 * physique de la touche, indépendante du layout — voir la doc pour le détail
 * vérifié et les mécanismes de remapping.
 *
 * see: docs/reference/controles.md#pourquoi-ça-marche-déjà-en-azerty
 */
export const DEFAULT_BINDINGS: Record<GameAction, string> = {
  moveForward: "KeyW",
  moveBack: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  sprint: "ShiftLeft",
  jump: "Space",
  fire: "Mouse0",
  switchMelee: "Digit1",
  // Le pistolet s'intercale en 2 et repousse le pompe en 3, l'ordre classique
  // du genre (poing, pistolet, fusil). Un joueur qui avait déjà rebindé garde
  // ses touches : `localStorage` gagne sur cette table.
  switchPistol: "Digit2",
  switchShotgun: "Digit3",
  use: "KeyE",
};

/** Ordre d'affichage canonique, pour qu'une UI de rebinding itère sans avoir
 * à redéfinir son propre ordre (celui-ci reprend l'ordre historique de
 * `captureInputFrame`). */
export const ALL_ACTIONS: GameAction[] = Object.keys(DEFAULT_BINDINGS) as GameAction[];

/**
 * Libellés humains, en français — pour une future UI de rebinding
 * (agent `shell`, hors scope ici). Volontairement séparés de `GameAction`
 * pour ne jamais coupler le nom technique de l'action à son affichage.
 */
export const ACTION_LABELS: Record<GameAction, string> = {
  moveForward: "Avancer",
  moveBack: "Reculer",
  moveLeft: "Aller à gauche",
  moveRight: "Aller à droite",
  sprint: "Sprint",
  jump: "Sauter",
  fire: "Tirer",
  switchMelee: "Arme : pied-de-biche",
  switchPistol: "Arme : pistolet",
  switchShotgun: "Arme : pompe",
  use: "Utiliser",
};

/**
 * Libellés courts pour les codes sans lettre imprimée évidente — `KeyW`/
 * `Digit1` etc. sont dérivés génériquement par `formatKeyCode`.
 *
 * LIMITE CONNUE (pour `shell`) : ces libellés sont dérivés du NOM du code
 * (convention QWERTY), pas du glyphe réel affiché sur la touche physique —
 * `formatKeyCode("KeyW")` reste `"W"` même en AZERTY. Alternatives et
 * pourquoi ce n'est pas corrigé ici : voir la doc.
 *
 * see: docs/reference/controles.md#limite-libellés-de-touches-en-azerty
 */
const CODE_LABELS: Record<string, string> = {
  Space: "Espace",
  ShiftLeft: "Maj (gauche)",
  ShiftRight: "Maj (droite)",
  ControlLeft: "Ctrl (gauche)",
  ControlRight: "Ctrl (droite)",
  AltLeft: "Alt (gauche)",
  AltRight: "Alt droite (AltGr)",
  Mouse0: "Clic gauche",
  Mouse2: "Clic droit",
};

/**
 * Formate un code brut (`"KeyW"`, `"Space"`, `"Mouse0"`...) en libellé
 * court affichable. Fallback générique pour tout code inconnu (y compris un
 * futur rebind vers une touche jamais vue ici) : toujours affichable, jamais
 * `undefined`. Voir la doc de `CODE_LABELS` pour sa limite connue en AZERTY.
 */
export function formatKeyCode(code: string): string {
  const known = CODE_LABELS[code];
  if (known) return known;
  if (code.startsWith("Key")) return code.slice("Key".length); // "KeyW" -> "W"
  if (code.startsWith("Digit")) return code.slice("Digit".length); // "Digit1" -> "1"
  return code;
}

const BINDINGS_STORAGE_KEY = "cassandre.keybinds";

/**
 * Charge les bindings depuis `localStorage`, en repartant des défauts pour
 * toute action absente/invalide (layout ancien, action ajoutée depuis la
 * dernière sauvegarde). Jamais de throw : un `localStorage` corrompu,
 * indisponible (mode privé strict) ou absent (environnement de test) doit
 * dégrader silencieusement vers les défauts, pas bloquer le boot.
 */
function loadStoredBindings(): Record<GameAction, string> {
  const bindings = { ...DEFAULT_BINDINGS };
  if (typeof localStorage === "undefined") return bindings;
  try {
    const raw = localStorage.getItem(BINDINGS_STORAGE_KEY);
    if (!raw) return bindings;
    const parsed = JSON.parse(raw) as Partial<Record<GameAction, string>>;
    for (const action of ALL_ACTIONS) {
      const code = parsed[action];
      if (typeof code === "string" && code.length > 0) bindings[action] = code;
    }
  } catch {
    // JSON invalide ou accès refusé : défauts déjà en place ci-dessus.
  }
  return bindings;
}

/** Symétrique de `loadStoredBindings`, même garde-fous. */
function saveStoredBindings(bindings: Record<GameAction, string>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Quota dépassé / mode privé strict : la session continue avec le
    // binding en mémoire, seule la persistance inter-session est perdue.
  }
}

class InputManager {
  private keysDown = new Set<string>();

  /**
   * Fronts EN ATTENTE D'UN PAS FIXE. Vidés uniquement quand au moins un pas
   * fixe a tourné pendant la frame. Lus par `consumeJustPressed`.
   */
  private edgesPendingFixedStep = new Set<string>();

  /**
   * Fronts DE LA FRAME D'AFFICHAGE COURANTE. Vidés à chaque fin de frame,
   * inconditionnellement. Lus par `wasJustPressed`.
   */
  private edgesThisDisplayFrame = new Set<string>();

  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  private canvas: HTMLCanvasElement | null = null;
  private pointerLocked = false;

  /** Pas fixes exécutés depuis le dernier `beginFrame`. Voir `endFrame`. */
  private fixedStepsThisFrame = 0;

  /**
   * Bindings action → code, chargés depuis `localStorage` DÈS LA
   * CONSTRUCTION de `InputManager` (donc au chargement du module, avant
   * même `attach()`) — la contrainte du livrable demandait la persistance
   * prête "avant que `attach()` ne soit utile" ; charger dans un
   * initialiseur de champ plutôt que dans `attach()` le garantit sans
   * dépendre de l'ordre d'appel de `main.ts`.
   */
  private bindings: Record<GameAction, string> = loadStoredBindings();

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    canvas.addEventListener("click", this.requestPointerLock);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // `keysDown` filtre l'auto-répétition du clavier : un seul front par appui
    // physique, alimentant les deux vues.
    if (!this.keysDown.has(e.code)) {
      this.edgesPendingFixedStep.add(e.code);
      this.edgesThisDisplayFrame.add(e.code);
    }
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };

  /**
   * Les boutons souris alimentent les MÊMES `keysDown` / `edgesPendingFixedStep`
   * / `edgesThisDisplayFrame` que le clavier, sous des codes synthétiques
   * (`"Mouse0"`, `"Mouse2"`) : le pattern à deux sets est déjà générique sur une
   * clé `string`, dupliquer un mécanisme parallèle pour la souris n'apporterait
   * rien. `isDown`, `consumeJustPressed` et `wasJustPressed` fonctionnent donc
   * immédiatement avec ces codes, sans méthode publique supplémentaire.
   */
  private onMouseDown = (e: MouseEvent) => {
    // Comme `onMouseMove` : ignoré hors pointer lock, sinon le clic qui
    // déclenche `requestPointerLock` compterait lui-même comme un tir.
    if (!this.pointerLocked) return;
    const code = e.button === 0 ? "Mouse0" : e.button === 2 ? "Mouse2" : null;
    if (!code) return;
    if (!this.keysDown.has(code)) {
      this.edgesPendingFixedStep.add(code);
      this.edgesThisDisplayFrame.add(code);
    }
    this.keysDown.add(code);
  };

  private onMouseUp = (e: MouseEvent) => {
    const code = e.button === 0 ? "Mouse0" : e.button === 2 ? "Mouse2" : null;
    if (!code) return;
    // Inconditionnel, contrairement à `onMouseDown` : on veut toujours pouvoir
    // relâcher un bouton, jamais rester bloqué "appuyé" (ex. pointer lock perdu
    // entre le down et le up).
    this.keysDown.delete(code);
  };

  /** Le clic droit (Mouse2) ouvrirait sinon le menu contextuel du navigateur. */
  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private requestPointerLock = () => {
    this.canvas?.requestPointerLock().catch(() => {
      // Refusé par le navigateur (pas assez d'interaction, contexte non éligible...) : sans gravité.
    });
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  isDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  /**
   * Front montant de la frame d'affichage COURANTE, lecture non destructive.
   * Vrai sur exactement une frame d'affichage par appui physique, que cette
   * frame ait exécuté 0, 1 ou N pas fixes.
   *
   * Réservé au code lu au taux d'affichage (`interpolateVisuals`, `updateFx`).
   * Plusieurs lecteurs peuvent l'observer dans la même frame sans se voler
   * l'événement.
   *
   * NE JAMAIS appeler depuis un pas fixe : le contenu de ce set dépend du taux
   * de rafraîchissement, donc le lire dans le pas fixe rendrait la simulation
   * non déterministe. Le pas fixe utilise `consumeJustPressed`.
   */
  wasJustPressed(code: string): boolean {
    return this.edgesThisDisplayFrame.has(code);
  }

  /**
   * Front montant en attente, lecture DESTRUCTIVE : le premier appelant
   * l'obtient, les suivants non.
   *
   * C'est la lecture correcte depuis un pas fixe. Une frame d'affichage peut
   * exécuter 0, 1 ou N pas fixes ; sans consommation, un appui déclencherait
   * N sauts sur une frame lente (30 Hz d'affichage → 2 pas fixes → double saut).
   *
   * Les deux vues sont indépendantes : consommer ici ne masque rien à
   * `wasJustPressed`. Un même appui peut donc légitimement déclencher un saut
   * (pas fixe) et un effet visuel (taux d'affichage) sans que l'un prive
   * l'autre.
   */
  consumeJustPressed(code: string): boolean {
    return this.edgesPendingFixedStep.delete(code);
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  /**
   * Read once per render frame, outside the fixed step — camera look must
   * track the mouse at display rate or aiming gains perceptible latency.
   */
  consumeMouseDelta(): { dx: number; dy: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  // Couche par ACTION (rebindable), pure traduction vers les méthodes par
  // code ci-dessus — voir la doc pour le contrat de déterminisme.
  // see: docs/reference/controles.md#persistance-et-couche-par-action

  /** Miroir de `isDown`, indexé par action plutôt que par code. */
  isActionDown(action: GameAction): boolean {
    return this.isDown(this.bindings[action]);
  }

  /**
   * Miroir de `consumeJustPressed`, indexé par action. C'est la lecture
   * correcte depuis un pas fixe (front consommé une seule fois).
   */
  consumeActionJustPressed(action: GameAction): boolean {
    return this.consumeJustPressed(this.bindings[action]);
  }

  /**
   * Miroir de `wasJustPressed`, indexé par action. Lecture non destructive
   * au taux d'affichage — NE JAMAIS appeler depuis un pas fixe, même
   * contrainte que `wasJustPressed`.
   */
  wasActionJustPressed(action: GameAction): boolean {
    return this.wasJustPressed(this.bindings[action]);
  }

  /** Code actuellement lié à `action` (ex. `"KeyW"`, `"Mouse0"`). Pour une UI
   * de rebinding : `` `${ACTION_LABELS[action]} : ${formatKeyCode(input.getBinding(action))}` ``. */
  getBinding(action: GameAction): string {
    return this.bindings[action];
  }

  /** Snapshot de tous les bindings courants (copie — muter le résultat n'a
   * aucun effet), pour qu'une UI liste toutes les actions d'un coup. */
  getAllBindings(): Record<GameAction, string> {
    return { ...this.bindings };
  }

  /**
   * Remappe `action` vers `code` et persiste immédiatement en
   * `localStorage`. Effet immédiat : les lectures suivantes de
   * `isActionDown`/`consumeActionJustPressed`/`wasActionJustPressed` pour
   * cette action utilisent aussitôt le nouveau code.
   *
   * NE VALIDE AUCUN CONFLIT (deux actions pouvant partager le même code
   * après ce rebind) : ce n'est pas le rôle du moteur d'input de décider si
   * une UI doit l'interdire, l'avertir, ou l'autoriser (ex. AZERTY où un
   * joueur pourrait vouloir dupliquer volontairement une touche). Laissé à
   * `shell`.
   *
   * N'appelle jamais ceci depuis le pas fixe : c'est un réglage, pas de la
   * simulation (voir la doc de tête du fichier / invariant fixed-timestep).
   */
  rebind(action: GameAction, code: string) {
    this.bindings = { ...this.bindings, [action]: code };
    saveStoredBindings(this.bindings);
  }

  /** Réinitialise TOUS les bindings aux valeurs par défaut et persiste. */
  resetBindings() {
    this.bindings = { ...DEFAULT_BINDINGS };
    saveStoredBindings(this.bindings);
  }

  beginFrame() {
    // Les events sont accumulés par les listeners au fil de l'eau ; il n'y a
    // rien à collecter ici. On remet seulement à zéro le compteur de pas
    // fixes, qui conditionne le nettoyage des fronts montants.
    this.fixedStepsThisFrame = 0;
  }

  /** Appelé par la boucle au début de chaque pas fixe. */
  beginFixedStep() {
    this.fixedStepsThisFrame++;
  }

  /**
   * Clôture la frame d'affichage. DOIT être le DERNIER appel de la frame,
   * après `interpolateVisuals`/`updateFx`/`render` — sinon ces callbacks
   * perdraient les fronts montants qu'ils doivent lire. Les deux sets ont
   * des règles de vidage différentes (l'un inconditionnel, l'autre
   * conditionné aux pas fixes exécutés) : voir la doc.
   *
   * see: docs/systems/boucle-de-jeu.md#entrée-synchronisée-au-pas-fixe
   */
  endFrame() {
    this.edgesThisDisplayFrame.clear();
    if (this.fixedStepsThisFrame > 0) this.edgesPendingFixedStep.clear();
  }
}

export const input = new InputManager();
