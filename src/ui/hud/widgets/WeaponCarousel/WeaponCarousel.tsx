import { useGameStore } from "../../../../game/hud/state";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { WeaponSlot } from "./WeaponSlot/WeaponSlot";
import { carouselOffset, WEAPON_LABELS } from "./weaponCarouselPresentation";
import styles from "./WeaponCarousel.module.css";

// Affiche la sélection publiée par le jeu ; ne capture aucune entrée.
// see: docs/4-technique/interface-react.md#carrousel-darmes
export function WeaponCarousel() {
  const view = useGameStore((state) => state.weaponCarousel);
  const playing = useGameStore((state) => state.flowState === "playing");
  if (!playing || !view.visible || view.available.length === 0) return null;
  const activeIndex = view.available.indexOf(view.active);

  return (
    <section className={styles.carousel} aria-label="Sélection d’arme">
      <CornerFrame className={styles.panel}>
        <div className={styles.header}>
          <span>ARSENAL</span>
          <span className={styles.positions} aria-hidden="true">
            {view.available.map((weapon) => (
              <span key={weapon} className={styles.position} data-selected={weapon === view.active} />
            ))}
          </span>
          <span className={styles.hint}>◀ MOLETTE ▶</span>
        </div>
        <ul className={styles.slots} aria-label="Armes disponibles">
          {view.available.map((weapon, index) => (
            <WeaponSlot
              key={weapon}
              weapon={weapon}
              offset={carouselOffset(index, activeIndex, view.available.length)}
            />
          ))}
        </ul>
        <p className={styles.name} aria-live="polite">
          {WEAPON_LABELS[view.active]}
        </p>
      </CornerFrame>
    </section>
  );
}
