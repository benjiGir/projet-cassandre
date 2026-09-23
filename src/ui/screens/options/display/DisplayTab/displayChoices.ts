import type { FiltrageTexture } from "../../../../../render/renderer";
import type { Choice } from "../../fields/ChoiceGroup/ChoiceGroup";

/**
 * Les trois modes de filtrage, décrits par ce qu'on VOIT et jamais par le nom
 * de la technique : c'est ce menu qui permet enfin de juger l'ADR 0027 en
 * jouant, sans console.
 * see: docs/decisions/0027-filtrage-des-textures-reduites.md
 */
export const FILTRAGE_CHOICES: ReadonlyArray<Choice<FiltrageTexture>> = [
  {
    id: "nearest",
    label: "Gros pixel partout, y compris au loin",
    hint: "Réglage d'origine du jeu. Les surfaces lointaines scintillent un peu plus quand la caméra bouge.",
  },
  {
    id: "mipmap",
    label: "Gros pixel de près, lissé au loin",
    hint: "Moins de scintillement au loin. Les sols vus de biais restent flous.",
  },
  {
    id: "aniso",
    label: "Gros pixel de près, net même en rasant",
    hint: "Comme ci-dessus, en plus net sur les sols et couloirs vus de côté. Réglage actuel du jeu.",
  },
];
