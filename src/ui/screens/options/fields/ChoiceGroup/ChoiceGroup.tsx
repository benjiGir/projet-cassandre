import { cx } from "../../../../lib/styleHelpers";
import styles from "./ChoiceGroup.module.css";

export interface Choice<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

export interface ChoiceGroupProps<T extends string> {
  label: string;
  value: T;
  choices: ReadonlyArray<Choice<T>>;
  layout?: "row" | "column";
  onChange: (value: T) => void;
}

export function ChoiceGroup<T extends string>({ label, value, choices, layout = "row", onChange }: ChoiceGroupProps<T>) {
  return (
    <div className={cx(styles.group, styles[layout])} role="radiogroup" aria-label={label}>
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          role="radio"
          aria-checked={value === choice.id}
          className={cx(styles.choice, !choice.hint && styles.compact)}
          onClick={() => onChange(choice.id)}
        >
          {choice.hint ? (
            <>
              <span className={styles.choiceLabel}>{choice.label}</span>
              <span className={styles.choiceHint}>{choice.hint}</span>
            </>
          ) : (
            choice.label
          )}
        </button>
      ))}
    </div>
  );
}
