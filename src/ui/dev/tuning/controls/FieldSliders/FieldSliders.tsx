import type { ConfigEditor } from "../../lib/tuningTypes";
import type { TuningField } from "../../lib/tuningTypes";
import { TuningSlider } from "../TuningSlider/TuningSlider";

export interface FieldSlidersProps<K extends string, T extends Record<K, number>> {
  editor: ConfigEditor<T>;
  fields: ReadonlyArray<TuningField<K>>;
}

export function FieldSliders<K extends string, T extends Record<K, number>>({ editor, fields }: FieldSlidersProps<K, T>) {
  return (
    <>
      {fields.map((field) => (
        <TuningSlider
          key={field.key}
          label={field.label}
          unit={field.unit}
          decimals={field.decimals}
          min={field.min}
          max={field.max}
          step={field.step}
          value={editor.values[field.key]}
          onChange={(value) => editor.set(field.key, value as T[K])}
        />
      ))}
    </>
  );
}
