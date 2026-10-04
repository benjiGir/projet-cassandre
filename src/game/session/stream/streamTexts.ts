// see: docs/2-fonctionnel/histoire.md#le-chat

/**
 * Textes du direct : pseudos, messages du chat et messages de don. Tout est
 * écrit à l'avance et tiré par le flux RNG du stream (invariant #12) : aucun
 * texte n'est généré en jeu.
 *
 * Règles d'écriture : pseudos inventés, aucune personne, marque ou plateforme
 * réelle, aucune théorie du complot réelle, des trolls satiriques sans
 * insulte. Le chat ne donne jamais une information nécessaire pour avancer.
 */

/** Ce que le direct peut commenter. */
export type ChatTopic =
  | "kill"
  | "serie"
  | "boss"
  | "secret"
  | "casse"
  | "degats"
  | "toilettes"
  | "carte"
  | "moment"
  | "calme"
  | "ambiance"
  | "touristes";

/** Un message libre, ou celui d'un habitué reconnaissable. */
export type ChatLine = string | { readonly pseudo: string; readonly text: string };

/** Le habitué qui défend le magasin d'un peu trop près. */
const HUMAIN = "definitivement_humain";
/** Le fidèle qui croit tout, et davantage. */
const JEANMI = "JeanMi_du_38";

export const PSEUDOS: readonly string[] = [
  "xX_Sceptik_Xx", "veritas_1987", "lezard_curieux", "kevin_la_preuve", "mamie_gamer",
  "le_doute_raisonnable", "caddie_fou", "promo_du_jeudi", "pixel_baveux", "404_cerveau",
  "ticket_de_caisse", "rayon_frais", "pas_un_bot", "sang_chaud_garanti", "oeil_ouvert_73",
  "tonton_wifi", "la_verite_svp", "gondole_en_tete", "insomniaque_du_59", "chef_de_rayon",
  "poulet_roti_fan", "dubitatif_pro", "neon_qui_grésille", "sac_de_caisse", "reveille_moi",
  "premier_degre", "zoom_x200", "croissant_tiede", "vigile_en_pause", "client_mystere",
];

export const CHAT_LINES: Readonly<Record<ChatTopic, readonly ChatLine[]>> = {
  kill: [
    "il l'a pas raté",
    "pauvre vigile, il faisait que son travail",
    "c'est des acteurs, ça se voit à la chute",
    "le costume est intact, bizarre",
    "un de moins, un clip de plus",
    "ok ça c'était propre",
    "il vise mieux qu'il argumente",
    "le sang est trop rouge, fake",
    "je clippe",
    "il a même pas dit bonjour",
    "bah bravo, qui va ranger maintenant",
    "les effets sont pas mal pour un petit budget",
    { pseudo: HUMAIN, text: "ce collaborateur avait une famille. enfin, une couvée." },
    { pseudo: HUMAIN, text: "violence gratuite envers un personnel dévoué" },
    { pseudo: JEANMI, text: "regardez sa nuque au ralenti !! des écailles !!" },
    { pseudo: JEANMI, text: "je vous l'avais dit en 2019" },
  ],
  serie: [
    "TROIS D'UN COUP",
    "il s'est réveillé le Réveil",
    "ok là je reste",
    "le ménage est fait dans le rayon",
    "c'est plus une enquête c'est un inventaire",
    "le montage va être facile",
    { pseudo: HUMAIN, text: "les ressources humaines vont être débordées" },
    { pseudo: JEANMI, text: "IL LES A TOUS EUS, PARTAGEZ" },
  ],
  boss: [
    "LA PEAU",
    "attendez quoi",
    "c'est un masque, c'est forcément un masque",
    "ok le maquillage est incroyable",
    "j'ai eu peur pour de vrai",
    "le patron est un lézard, je répète, le patron est un lézard",
    "meilleur épisode de la chaîne",
    "bon c'est un costume dans un costume",
    { pseudo: HUMAIN, text: "ceci est une affection cutanée tout à fait banale" },
    { pseudo: JEANMI, text: "JE LE SAVAIS JE LE SAVAIS JE LE SAVAIS" },
  ],
  secret: [
    "comment il a trouvé ça",
    "une pièce cachée dans un magasin, normal",
    "c'est un local technique, calmez-vous",
    "il fouille mieux que la douane",
    "ok ça c'est louche même pour moi",
    "il y a toujours une pièce derrière la pièce",
    { pseudo: HUMAIN, text: "cet espace n'est pas ouvert à la clientèle" },
    { pseudo: JEANMI, text: "notez l'emplacement, ils vont le murer demain" },
  ],
  casse: [
    "il casse tout, il rembourse rien",
    "le rayon a rien fait",
    "qui paye la vitrine",
    "ça c'est pour l'audience, avouez",
    "le bruit est satisfaisant",
    "moins dix pour cent sur la casse",
    "il enquête avec les mains",
    "la preuve était dans le carton, sûrement",
    { pseudo: HUMAIN, text: "toute dégradation sera facturée" },
    { pseudo: JEANMI, text: "cassez tout, la vérité est derrière" },
  ],
  degats: [
    "aïe",
    "il a pris cher",
    "il saigne pour de vrai ou c'est du sirop",
    "bois de l'eau champion",
    "ça fait dix minutes qu'il dit que ça va",
    "le Réveil va faire une sieste",
    "il encaisse comme un caddie",
    "mets-toi à couvert, c'est gratuit",
    { pseudo: HUMAIN, text: "nos équipes maîtrisent parfaitement la situation" },
    { pseudo: JEANMI, text: "tiens bon, on est deux cents derrière toi" },
  ],
  toilettes: [
    "il a vraiment fait ça en direct",
    "contenu premium",
    "l'enquête avance",
    "les mains, les mains !",
    "je me désabonne. non je rigole. presque.",
    { pseudo: HUMAIN, text: "nos sanitaires sont nettoyés toutes les heures" },
  ],
  carte: [
    "une carte de fidélité, quel butin",
    "il cumule des points au moins ?",
    "ça ouvre quoi, le rayon premium ?",
    "fidèle à un magasin qui veut le tuer",
    { pseudo: HUMAIN, text: "cette carte est strictement personnelle" },
    { pseudo: JEANMI, text: "gardez-la, c'est une pièce à conviction" },
  ],
  moment: [
    "l'annonce elle parlait de lui ??",
    "c'est scripté, obligé",
    "ok ça fait froid dans le dos",
    "ils savent qu'il est là",
    "coïncidence. sûrement.",
    "il y a un stagiaire au micro qui s'amuse",
    { pseudo: HUMAIN, text: "nous vous prions d'excuser ce léger incident" },
    { pseudo: JEANMI, text: "ILS LE REGARDENT. ILS NOUS REGARDENT." },
  ],
  calme: [
    "il se passe quoi là",
    "zzz",
    "bon, on visite ou on enquête",
    "je vais me faire un café",
    "rendors-toi, le Réveil",
    "c'est un magasin fermé la nuit, incroyable révélation",
    "trois minutes de carrelage, merci",
    "j'ai vu plus d'action au rayon yaourts",
    "il est perdu, avouez",
    "quelqu'un a le plan du magasin ?",
    "je reste pour voir s'il trouve la sortie",
    "on s'ennuie, casse un truc",
    { pseudo: HUMAIN, text: "tout est calme. tout est parfaitement normal." },
    { pseudo: JEANMI, text: "le silence est une preuve aussi" },
  ],
  ambiance: [
    "fake",
    "premier",
    "salut le chat",
    "ça vient d'où cette musique d'ascenseur",
    "le son est correct pour une fois",
    "il a toujours le même sweat",
    "deux cents abonnés et il parle comme s'il en avait deux millions",
    "moi je crois que le magasin est juste fermé",
    "les néons me donnent mal à la tête",
    "quelqu'un sait où il a acheté sa caméra",
    "il y a un vrai sujet sur les prix par contre",
    "je regarde ça au lieu de dormir",
    "attention derrière toi. non je rigole.",
    { pseudo: HUMAIN, text: "bonsoir, je suis un spectateur ordinaire à sang chaud" },
    { pseudo: HUMAIN, text: "ce magasin est très bien noté par ses clients" },
    { pseudo: JEANMI, text: "partagez avant que ça soit supprimé" },
  ],
  touristes: [
    "c'est quel jeu ?",
    "les graphismes datent un peu non",
    "c'est en direct ou c'est un vieux jeu",
    "je viens d'arriver, c'est qui le gars",
    "on dirait un jeu de quand j'étais petit",
    "pourquoi tout est en gros pixels",
    "c'est une pub pour un supermarché ?",
    "ah c'est un vrai gars ? j'ai cru à un jeu",
  ],
};

/** Ce qu'un spectateur écrit avec son don. */
export type DonationTopic = "kill" | "serie" | "boss" | "secret" | "toilettes" | "carte" | "casse" | "generique";

export const DONATION_LINES: Readonly<Record<DonationTopic, readonly string[]>> = {
  generique: [
    "pour ton loyer",
    "achète-toi un deuxième sweat",
    "c'est fake mais c'est bien fait",
    "je crois à rien mais je me marre",
    "continue, t'es mon somnifère préféré",
    "pour la caméra, elle tremble",
    "tiens, pour le psy",
    "montre ta tête plus souvent",
    "je paye pour que tu dises bonjour à ma sœur",
    "premier don de ma vie, déçois-moi pas",
    "garde la monnaie",
    "c'est pas grand-chose mais c'est déjà trop",
    "pour l'essence du retour",
    "mon chat a marché sur le clavier",
  ],
  kill: [
    "pour celui-là, bien joué",
    "un euro par costard, ça va chiffrer",
    "refais-le au ralenti",
    "pour la cravate du monsieur",
    "ok j'avoue, j'ai sursauté",
    "pour tes cartouches",
  ],
  serie: [
    "TROIS D'UN COUP, prends mon argent",
    "pour le nettoyage du rayon",
    "ça valait bien cinq balles",
    "l'action enfin",
  ],
  boss: [
    "LE PATRON EST UN LÉZARD, prends tout",
    "je retire ce que j'ai dit depuis le début",
    "pour le maquilleur, s'il existe",
    "meilleur direct de l'année",
  ],
  secret: [
    "pour le flair",
    "comment t'as trouvé ça, sérieux",
    "une pièce cachée, un don",
    "fouille encore",
  ],
  toilettes: [
    "pour le papier",
    "contenu rare, je soutiens",
    "lave-toi les mains avec ça",
    "je ne sais pas pourquoi je paye pour ça",
  ],
  carte: [
    "pour ta fidélité",
    "tu cumules des points au moins ?",
  ],
  casse: [
    "pour la vitrine",
    "casse le reste, je finance",
  ],
};

/** Le spectateur qui donne trop bien : voir `docs/2-fonctionnel/histoire.md#le-donateur-mystère`. */
export const MYSTERY_DONOR = "premier_abonne";

export type MysteryBeat = "depart" | "carte_argent" | "quai" | "carte_or" | "escalier";

/** Dans l'ordre de l'histoire. */
export const MYSTERY_BEATS: readonly MysteryBeat[] = ["depart", "carte_argent", "quai", "carte_or", "escalier"];

/** Ce qu'il écrit à chaque étape. Les montants sont de l'équilibrage : `streamConfig.mystery`. */
export const MYSTERY_TEXTS: Readonly<Record<MysteryBeat, string>> = {
  depart: "Les portes sont ouvertes ce soir. Entre.",
  carte_argent: "La porte au fond de l'allée centrale. Ça fera de belles images.",
  quai: "Filme ce camion de plus près. Sa cargaison vaut le détour.",
  carte_or: "J'ai vu sa voiture sur la caméra 4. Il est donc là-haut.",
  escalier: "Dernier bureau, au fond. Tu vas battre ton record d'audience.",
};
