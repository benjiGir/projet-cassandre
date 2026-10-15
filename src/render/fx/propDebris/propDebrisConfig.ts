export const PROP_FRAGMENT_VARIANTS = {
  SOBRE: { speedScale: 1, liftScale: 1 },
  DYNAMIQUE: { speedScale: 1.3, liftScale: 1.15 },
};

export const propDebrisConfig = {
  capacityPerMaterial: 96,
  cardboardCount: 6,
  woodCount: 10,
  maxFlight: 5,
  surfaceOffset: 0.018,
  cardboardDrag: 1.8,
  woodDrag: 0.5,
  wallRestitution: 0.22,
  ...PROP_FRAGMENT_VARIANTS.SOBRE,
};
