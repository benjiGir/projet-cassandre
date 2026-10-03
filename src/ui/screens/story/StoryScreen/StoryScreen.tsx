import { useGameStore } from "../../../../game/hud/state";
import { StoryPanels } from "../StoryPanels/StoryPanels";

export interface StoryScreenProps {
  /** L'état du flux pendant lequel cet écran s'affiche. */
  sequence: "intro" | "outro";
  doneLabel: string;
  onDone: () => void;
}

// Affiche les panneaux de la séquence en cours. Il ne décide ni de la séquence
// ni de la suite : la couche de session pose les panneaux et reçoit `onDone`.
// see: docs/4-technique/interface-react.md#panneaux-dhistoire
export function StoryScreen({ sequence, doneLabel, onDone }: StoryScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  const panels = useGameStore((s) => s.story);
  if (flowState !== sequence || !panels) return null;

  return <StoryPanels panels={panels} doneLabel={doneLabel} onDone={onDone} />;
}
