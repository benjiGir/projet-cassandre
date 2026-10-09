import type { StoryPanel } from "../../hud/hudTypes";
import deliveredImages from "./storyImages.json";

// see: docs/2-fonctionnel/histoire.md#les-huit-panneaux

export interface LevelStory {
  readonly intro: readonly StoryPanel[];
  readonly outro: readonly StoryPanel[];
}

/** Dossier des panneaux sous `public/`, rempli par `tools/textures/generate_panneaux.py`. */
export const STORY_IMAGE_DIR = "assets/story";

const delivered: ReadonlySet<string> = new Set(deliveredImages);

/** L'image n'est référencée que si l'outil l'a livrée ; sinon la visionneuse pose un aplat numéroté. */
function panel(id: string, alt: string, caption: readonly string[]): StoryPanel {
  return { id, image: delivered.has(id) ? `${STORY_IMAGE_DIR}/${id}.png` : null, alt, caption };
}

// Prompts des images : assets_src/panneaux/PROMPTS.md. Le texte est posé par
// le jeu, jamais par l'image.
const NIVEAU_V2: LevelStory = {
  intro: [
    panel("intro_1", "Le héros dans sa chambre, devant un mur de documents reliés par des ficelles rouges.", [
      "Ici le Réveil du peuple. Deux cents abonnés.",
      "Deux cents personnes qui savent regarder.",
    ]),
    panel("intro_2", "Un ticket de caisse froissé sous une lampe, un emblème entouré au feutre rouge.", [
      "Regardez ce ticket. Cet emblème n'est sur aucun autre.",
      "Et ce soir, le magasin ferme « pour inventaire exceptionnel ».",
    ]),
    panel("intro_3", "Le parking de nuit, le héros de dos face à l'enseigne Hyper Varan qui grésille.", [
      "Hyper Varan. « Le sang-froid des prix bas. »",
      "Trois spectateurs. Ça suffit pour un direct.",
    ]),
    panel("intro_4", "Les portes du magasin, une affiche scotchée sur la vitre, une lueur verte derrière.", [
      "INVENTAIRE EXCEPTIONNEL",
    ]),
  ],
  outro: [
    panel("outro_1", "Le héros sort par l'issue de secours à l'aube, une carte Platine levée dans la main.", [
      "Je suis dehors. J'ai tout filmé.",
      "Cette fois, ils vont être obligés de regarder.",
    ]),
    panel("outro_2", "Le héros devant son écran, où défile une colonne de messages moqueurs.", [
      "« Beaux effets spéciaux. » « Les acteurs jouent mal. »",
      "« Rendors-toi, le Réveil. »",
    ]),
    panel("outro_3", "Un avertissement rouge à l'écran, le héros qui sourit de toutes ses dents.", [
      "« Votre vidéo ne respecte pas nos règles. » Démonétisée.",
      "Ils ont peur. C'est la preuve que j'ai raison.",
    ]),
    panel(
      "outro_4",
      "La chambre dans le noir, un cadenas à l'écran, une ficelle rouge tendue vers une tour de verre.",
      ["Chaîne suspendue. Revenus retenus.", "Un dernier don, signé de la plateforme : « Merci pour le contenu. »"],
    ),
  ],
};

// see: docs/2-fonctionnel/histoire-metro.md#les-panneaux
// Prompts des images : assets_src/panneaux/PROMPTS_METRO.md.
const METRO: LevelStory = {
  intro: [
    panel("metro_intro_1", "Le héros punaise un plan de métro au mur de ficelles, un cadenas à l'écran derrière lui.", [
      "Chaîne suspendue. Revenus retenus. J'ai préparé une réclamation.",
      "Et je sais où la déposer.",
    ]),
    panel("metro_intro_2", "Le héros lève les poings devant son écran, où le cadenas vient de s'ouvrir.", [
      "Je relance un direct pour protester. La suspension saute aussitôt.",
      "Ils ont reculé. Et mon premier abonné est revenu.",
    ]),
    panel("metro_intro_3", "Une rue mouillée la nuit, le héros de dos face à une bouche de métro grillée.", [
      "Fermée « pour travaux ». Les gonds de la grille sont graissés.",
      "Douze spectateurs. C'est un début.",
    ]),
    panel(
      "metro_intro_4",
      "La grille de la bouche de métro, une affichette jaunie, une lueur verte en bas des marches.",
      ["TRAFIC INTERROMPU"],
    ),
  ],
  outro: [
    panel("metro_outro_1", "Le héros sort de terre sur un parvis à l'aube, dans la vapeur, et lève la tête.", [
      "Terminus. Aucun nom sur les plaques.",
      "Il fait chaud, ici. Vous ne trouvez pas ?",
    ]),
    panel("metro_outro_2", "Par-dessus l'épaule du héros, son téléphone : un compteur qui déborde, un chat plein.", [
      "Jamais eu autant de spectateurs. Je ne reconnais aucun pseudo.",
      "« C'est quand, la saison 2 ? »",
    ]),
    panel("metro_outro_3", "Le téléphone en gros plan, un seul message épinglé, marqué d'un sceau de compte vérifié.", [
      "Un message de premier_abonne. Compte vérifié, maintenant.",
      "« Bienvenue. »",
    ]),
    panel("metro_outro_4", "Le héros de dos au pied d'une tour de verre, les portes du hall ouvertes devant lui.", [
      "Pas de nom sur la façade. Pas de gardien à la porte.",
      "J'ai une réclamation à déposer.",
    ]),
  ],
};

const STORIES: Readonly<Record<string, LevelStory>> = {
  niveau_v2: NIVEAU_V2,
  metro: METRO,
};

/** Panneaux d'intro et de fin du niveau, `null` s'il n'en a pas. */
export function levelStory(levelId: string): LevelStory | null {
  return STORIES[levelId] ?? null;
}
