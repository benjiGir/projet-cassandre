export const PROP_FRAGMENT_VARIANTS = {
  SOBRE: { speedScale: 1, liftScale: 1 },
  DYNAMIQUE: { speedScale: 1.3, liftScale: 1.15 },
};

export const propDebrisConfig = {
  capacityPerMaterial: 96,
  maxFlight: 5,
  surfaceOffset: 0.018,
  residueCapacity: 32,
  residueReach: 3,
  residueSize: 1.25,
  wallRestitution: 0.22,
  ...PROP_FRAGMENT_VARIANTS.SOBRE,
};
