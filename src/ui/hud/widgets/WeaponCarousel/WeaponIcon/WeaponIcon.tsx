import type { CarouselWeapon } from "../weaponCarouselPresentation";
import styles from "./WeaponIcon.module.css";

interface WeaponIconProps {
  weapon: CarouselWeapon;
}

const SILHOUETTES: Record<CarouselWeapon, { body: string; detail: string }> = {
  none: {
    body: "M20 4h21v14l8 7 29 5 5 5v5H14v-7l6-10z",
    detail: "M23 8h14v3H23zM23 14h14v3H23zM24 21h15v3H24zM17 35h63v3H17z",
  },
  melee: {
    body: "M13 32 66 7h11l7 6-2 8-8 5-5-5 6-4-1-3h-6L16 39h-7l-4-5 3-9 6-3 3 5-5 3z",
    detail: "M16 32 65 9h5L17 35zM77 13h4v7h-4z",
  },
  pistol: {
    body: "M12 7h68v12H45l-2 7H32l-7 14H12l8-21h-8zM32 19l-2 8h8l3-8z",
    detail: "M17 10h58v3H17zM64 5h7v3h-7zM17 29h11v3H17zM15 34h10v3H15z",
  },
  shotgun: {
    body: "M3 21 24 13l12 3h55v7H60v5H35l-9 11H13l8-12-6-1-12 7z",
    detail: "M34 18h56v2H34zM52 24h30v3H52zM7 23l14-6 3 3-17 7zM38 24h13v3H38z",
  },
  flare: {
    body: "M15 9h64v15H43l-3 8H29l-5 10H13l8-18h-6zM30 24l-2 6h7l3-6z",
    detail: "M20 12h22v9H20zM45 12h29v3H45zM54 17h20v3H54zM16 34h10v3H16zM47 7h8v3h-8z",
  },
};

export function WeaponIcon({ weapon }: WeaponIconProps) {
  const paths = SILHOUETTES[weapon];
  return (
    <svg className={styles.icon} viewBox="0 0 96 44" aria-hidden="true" shapeRendering="crispEdges">
      <path d={paths.body} fill="currentColor" />
      <path d={paths.detail} className={styles.detail} />
    </svg>
  );
}
