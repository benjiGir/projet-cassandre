import { Button } from "../../../components/controls/Button/Button";
import { CornerFrame } from "../../../components/layout/CornerFrame/CornerFrame";
import { Screen } from "../../../components/layout/Screen/Screen";
import { ScreenTitle } from "../../../components/text/ScreenTitle/ScreenTitle";
import { Scanlines } from "../../../components/effects/Scanlines/Scanlines";
import { Vignette } from "../../../components/effects/Vignette/Vignette";
import styles from "./LevelSelectScreen.module.css";

export interface LevelChoiceView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly locked: boolean;
}

interface LevelSelectScreenProps {
  options: readonly LevelChoiceView[];
  onChoose: (id: string) => void;
  onBack: () => void;
}

export function LevelSelectScreen({ options, onChoose, onBack }: LevelSelectScreenProps) {
  return <Screen>
    <Scanlines /><Vignette />
    <CornerFrame className={styles.panel}>
      <ScreenTitle className={styles.title}>CHOISIR LE DIRECT</ScreenTitle>
      {options.map((option) => <div className={styles.level} key={option.id}>
        <Button size="large" disabled={option.locked} onClick={() => onChoose(option.id)}>
          {option.locked ? "▣ " : "▶ "}{option.label}
        </Button>
        <p>{option.description}</p>
      </div>)}
      <Button onClick={onBack}>◀ RETOUR AU MENU</Button>
    </CornerFrame>
  </Screen>;
}
