import { cheats, setNotarget } from "../../../../../game/devtools/cheats";
import { TuningCheckbox } from "../../controls/TuningCheckbox/TuningCheckbox";
import { TuningGroup } from "../../layout/TuningGroup/TuningGroup";
import { TuningNote } from "../../layout/TuningNote/TuningNote";
import { TuningSection } from "../../layout/TuningSection/TuningSection";
import { useConfigEditor } from "../../lib/useConfigEditor";

/** Bascules de dev qui touchent au GAMEPLAY, pas seulement à l'affichage. */
export function DevCheats() {
  // `cheats` est aussi muté par la touche F8 et la console : on le lit en direct.
  const flags = useConfigEditor(cheats);

  return (
    <TuningSection separated>
      <TuningGroup title="Dev">
        <TuningCheckbox
          checked={flags.values.notarget}
          onChange={(on) => {
            setNotarget(on);
            flags.refresh();
          }}
        >
          Ennemis passifs — notarget (F8)
        </TuningCheckbox>
        <TuningNote>
          Les ennemis ne voient plus le joueur et leurs attaques ne font rien : pour parcourir un niveau et le
          regarder. Un rejeu F9/F10 enregistré ainsi ne se rejoue pas à l'identique.
        </TuningNote>
      </TuningGroup>
    </TuningSection>
  );
}
