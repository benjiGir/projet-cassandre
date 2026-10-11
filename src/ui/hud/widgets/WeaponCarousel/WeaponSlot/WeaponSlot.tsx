import { useGameStore } from "../../../../../game/hud/state";
import { cssVars } from "../../../../lib/styleHelpers";
import { WeaponIcon } from "../WeaponIcon/WeaponIcon";
import { carouselAmmo, WEAPON_LABELS } from "../weaponCarouselPresentation";
import type { CarouselWeapon } from "../weaponCarouselPresentation";
import styles from "./WeaponSlot.module.css";

interface WeaponSlotProps {
  weapon: CarouselWeapon;
  offset: number;
}

export function WeaponSlot({ weapon, offset }: WeaponSlotProps) {
  const ammo = useGameStore((state) => carouselAmmo(weapon, state.debug));
  const selected = offset === 0;
  return (
    <li
      className={styles.slot}
      aria-label={WEAPON_LABELS[weapon]}
      aria-current={selected ? "true" : undefined}
      aria-hidden={Math.abs(offset) > 1}
      style={cssVars({ "--slot-offset": offset, "--slot-scale": selected ? 1 : 0.85 })}
    >
      <WeaponIcon weapon={weapon} />
      <span className={styles.ammo} data-empty={ammo === "0"} aria-label={`Munitions : ${ammo}`}>
        {ammo}
      </span>
    </li>
  );
}
