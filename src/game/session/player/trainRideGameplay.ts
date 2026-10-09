import type { GameEngine } from "../gameEngine";
import { RIDE_ENTRY_DOOR, RIDE_EXIT_DOOR } from "../../level/trainRide/trainRideConfig";
import { spawnSuitAt } from "../spawning";
import { showHudMessage } from "./feedback";

// see: docs/4-technique/prototype-voyage-rame.md#horloge-et-mouvement
export function updateTrainRideGym(engine: GameEngine, dt: number, use: boolean): void {
  const session = engine.session,
    gym = session.trainRideGym;
  if (!gym) return;
  const position = session.player.position;
  const aboard = Math.abs(position.x) < 1.45 && Math.abs(position.z) < 22.5;
  if (use && position.distanceTo(gym.control) < 2) gym.system.enqueue("depart");
  gym.system.update(
    dt,
    gym.doors.stateOf(RIDE_ENTRY_DOOR) === "closed" && gym.doors.stateOf(RIDE_EXIT_DOOR) === "closed",
    aboard,
  );
  for (const event of gym.system.takeEvents()) {
    switch (event) {
      case "depart":
        gym.doors.lock(RIDE_ENTRY_DOOR);
        gym.doors.lock(RIDE_EXIT_DOOR);
        showHudMessage("Départ — les portes se ferment");
        break;
      case "wave":
        if (gym.waveSpawned) break;
        gym.waveSpawned = true;
        spawnSuitAt(engine, session, -0.5, 0.1, 0, "costard", true);
        spawnSuitAt(engine, session, 0.5, 0.1, 3, "rampant", true);
        spawnSuitAt(engine, session, -0.4, 0.1, 5, "rampant", true);
        showHudMessage("Des intrus dans la rame !");
        break;
      case "arrived":
        gym.doors.unlock(RIDE_EXIT_DOOR, position);
        gym.doors.open(RIDE_EXIT_DOOR, position);
        showHudMessage("Arrivée — sortie sur le quai à droite");
        break;
      case "reset":
        gym.doors = gym.resetDoors();
        session.doorSystem = gym.doors;
        gym.doors.lock(RIDE_EXIT_DOOR);
        showHudMessage("Voyage remis à zéro — E dans la cabine");
        break;
    }
  }
}
