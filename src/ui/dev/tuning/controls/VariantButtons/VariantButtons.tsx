export interface VariantButtonsProps<N extends string> {
  names: readonly N[];
  onApply: (name: N) => void;
  /** Libellé d'un bouton ; par défaut « Variante X ». */
  label?: (name: N) => string;
}

/** Un bouton par profil A/B d'un harnais. */
export function VariantButtons<N extends string>({ names, onApply, label = (name) => `Variante ${name}` }: VariantButtonsProps<N>) {
  return (
    <>
      {names.map((name) => (
        <button key={name} type="button" onClick={() => onApply(name)}>
          {label(name)}
        </button>
      ))}
    </>
  );
}
