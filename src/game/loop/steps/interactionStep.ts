import { input } from "../../../core/input/input";
import { formatKeyCode } from "../../../core/input/inputBindings";
import { toggleShowerWater } from "../../level/sanitaires/douches";
import { showHudMessage, triggerHeroLine } from "../../session/player/feedback";
import { relieveAtSanitaire, trySanitaire } from "../../session/player/sanitaires";
import { DOOR_USE_LINES } from "../../session/presentation/heroLines";
import { grantCard } from "../../session/progression/cards";
import { tryOpenCardDoor, unlockDoor } from "../../session/progression/doors";
import { publishPerkOffer, usePerkKiosk } from "../../session/progression/perks";
import { streamEvent } from "../../session/stream/streamFeed";
import type { GameplayStep } from "./gameplayStep";

/** Touche d'usage : l'objet interactif à portée d'abord, sinon un sanitaire visé, sinon la porte la plus proche. */
export function useInteractions({ engine, session, frame }: GameplayStep): void {
  const consomme = engine.interaction.update(
    frame.use,
    session.gltfLevelSession?.current?.useObjects ?? [],
    session.player.position,
    {
      onMetroBlockoutUse: (name) =>
        session.gltfLevelSession?.current?.metroBlockout?.use(name, session.player.position),
      onTrainUse: (name) => {
        const trains = session.gltfLevelSession?.current?.trains;
        trains?.use(name);
        if (trains?.data.commands.get(name)?.type === "stop") triggerHeroLine(session, "metro_arret_urgence");
      },
      onExitDoorUse: (targetName) => tryOpenCardDoor(session, targetName, "platine"),
      onCardDoorUse: (targetName, required) => tryOpenCardDoor(session, targetName, required),
      onCardPickup: (card) => {
        if (!grantCard(session, card)) return;
        triggerHeroLine(session, `carte_${card}`);
        streamEvent(session, "carte");
      },
      onFrozenStorageUse: (targetName) => {
        if (session.run.unlockedDoors.has(targetName)) return; // déjà ouverte
        unlockDoor(session, targetName, "Rayon surgelés ouvert");
      },
      onDoorUse: (targetName, message, useName) => {
        // Rouvrable : une porte libre peut avoir été REFERMÉE à la main
        // depuis (la coupe-feu), et son bouton doit alors la rouvrir.
        // C'est son état courant qui décide, pas `unlockedDoors`.
        const state = session.level.doorSystem?.stateOf(targetName);
        if (state === "open" || state === "opening") return;
        if (!unlockDoor(session, targetName, message ?? "Passage ouvert")) return;
        const line = DOOR_USE_LINES[useName];
        if (line) triggerHeroLine(session, line);
      },
      onPaMicUse: () => {
        triggerHeroLine(session, "micro_annonces");
      },
      onPunchClockUse: () => {
        triggerHeroLine(session, "pointeuse");
      },
      onSavBellUse: () => {
        triggerHeroLine(session, "sonnette_sav");
      },
      onShowerToggleUse: (name) => {
        const root = session.gltfLevelSession?.current?.root;
        if (!root) return;
        const turnedOn = toggleShowerWater(root, name);
        if (turnedOn === null) return;
        const station = name.slice("use_douche_".length);
        showHudMessage(turnedOn ? `Douche ${station} : eau ouverte` : `Douche ${station} : eau coupée`);
        triggerHeroLine(session, turnedOn ? "douche_ouvre" : "douche_ferme");
      },
      onCameraConsoleUse: (cameraNames) => {
        session.level.cameraView?.activate(cameraNames, frame.yaw, frame.pitch);
      },
      onPerkKioskUse: (offer) => {
        usePerkKiosk(session, offer);
      },
      // `use_toilet` (niveau `hypermarche_complet`, historique) : TOUJOURS
      // une cuvette intacte, jamais de variante cassée — même règle que
      // `sanitaire_*`, voir `game/session/player/sanitaires.ts::relieveAtSanitaire`.
      onToiletUse: () => relieveAtSanitaire(session),
    },
  );
  publishPerkOffer(session, engine.interaction.nearestInRange, formatKeyCode(input.getBinding("use")));

  const consommeSanitaire =
    !consomme &&
    trySanitaire(session, frame.use, session.player.position, session.player.eyeOffset, frame.yaw, frame.pitch);

  if (frame.use && !consomme && !consommeSanitaire) {
    session.level.doorSystem?.actionner(session.player.position);
  }

  const inCameraView = session.level.cameraView?.active ?? false;
  session.level.cameraView?.update(frame);
  if (inCameraView && !session.level.cameraView?.active) triggerHeroLine(session, "camera_quitte");
}
