import { useGameStore } from "../../../../game/hud/state";
import { cycleWeapon } from "../../../../game/player/weapons/weaponSelection";
import { Button } from "../../../components/controls/Button/Button";
import { ButtonRow } from "../../../components/controls/ButtonRow/ButtonRow";
import { Hud } from "../../../hud/Hud/Hud";
import styles from "./WeaponCarouselPreview.module.css";

function cyclePreview(steps: number) {
  const state = useGameStore.getState();
  const view = state.weaponCarousel;
  const active = cycleWeapon(view.active, view.available, steps);
  state.setWeaponCarousel({ ...view, active, revision: view.revision + 1 });
  state.setDebug({ activeWeapon: active });
}

export function WeaponCarouselPreview() {
  return (
    <>
      <div className={styles.controls}>
        <ButtonRow>
          <Button onClick={() => cyclePreview(-1)}>Arme précédente</Button>
          <Button onClick={() => cyclePreview(1)}>Arme suivante</Button>
        </ButtonRow>
      </div>
      <Hud />
    </>
  );
}
