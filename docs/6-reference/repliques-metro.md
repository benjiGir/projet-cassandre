---
title: Catalogue de répliques du métro
tags: [reference, dialogues, niveau-2, direct]
status: brouillon
updated: 2026-10-09
---

# Catalogue de répliques du métro

Tout ce qui se dit dans « Trafic interrompu » : le héros, les haut-parleurs
du réseau, le compte vérifié et le chat. C'est le lot H2 de `PLAN_V2.md`.

**Ces textes sont en jeu, en texte seul, et attendent votre relecture.**
Aucun n'a de prise de voix. Une réplique en texte seul ne s'affiche que si
les sous-titres sont activés. Le cadre d'écriture est la
[bible du métro](../2-fonctionnel/histoire-metro.md) : le niveau ne révèle
rien, la plateforme n'est jamais nommée, le compte vérifié ne menace pas.

Pour changer une ligne, modifiez son texte dans le fichier cité en tête de
section. Les identifiants sont des contrats : ne les renommez pas.

## Le héros

Source : `src/game/session/presentation/heroLines.ts`, section « Métro ».
Les répliques de combat, d'armes et de soins du premier niveau continuent de
jouer ; elles ne sont pas reprises ici.

### Départ et mort

| Identifiant | Quand | Texte |
|---|---|---|
| `metro_depart` | 1,5 s après le carton « TRAFIC INTERROMPU » | Interrompu pour qui ? Je descends demander. |
| `metro_mort_rame` | Fauché par une rame | J'aurais dû attendre la suivante. |

### Lieux

Première visite, après 1,5 s sans combat. Le lieu est le `nom` du plan de
masse (`metro_blockout.espaces.json`) : un tunnel découpé en cent tronçons
reste un seul lieu.

| Identifiant | Lieu | Indice de la bible | Texte |
|---|---|---|---|
| `metro_billets` | Salle des billets | Le plan s'arrête trop tôt | Le plan de la ligne S s'arrête au Dépôt. On verra bien. |
| `metro_descente` | Escalier vers les quais | — | Personne dans l'escalier. Je n'ai jamais descendu aussi vite. |
| `metro_quais` | Quais | La ligne sert à quelqu'un | Quai désert, lumières allumées. Pour qui ? |
| `metro_tunnel_a` | Tunnel A | Quelque chose chauffe | Il fait tiède, là-dedans. Les murs transpirent plus que moi. |
| `metro_galeries` | Galeries techniques | Les conduites chaudes | Des conduites partout. Pas une seule de froide. |
| `metro_vestiaire` | Local des agents | — | Un vestiaire d'agents. Ils se changent en quoi, au juste ? |
| `metro_tunnel_b` | Tunnel B | Quelque chose chauffe | Second tunnel. Même chaleur, mêmes rails, toujours pas de travaux. |
| `metro_depot` | Dépôt | — | Le Dépôt. Terminus officiel. Alors qu'attend cette rame ? |
| `metro_poste` | Poste d'aiguillage | Une branche absente du plan | Sur le tableau, une branche que le plan ne montre pas. |
| `metro_machinerie` | Machinerie | La chaleur vient d'ailleurs | Ce ventilateur souffle vers le réseau. Pas vers la sortie. |
| `metro_local_ventilation` | Local derrière le ventilateur | — | Un local derrière le ventilateur. Quelqu'un aime la tranquillité. |
| `metro_fret` | À bord de la rame de fret | Le magasin n'était pas seul | Des bacs de produits frais. Les mêmes qu'au magasin. |
| `metro_privee` | Quai privé | On est chez quelqu'un | Quai privé. Pas un nom, pas un horaire. |
| `metro_remontee` | Remontée vers le parvis | Elle vient de là | Ça monte. Et l'air ne rafraîchit pas. |
| `metro_parvis` | Parvis de la tour | Elle vient de là | La tour. De la vapeur aux grilles, et pas une enseigne. |

Le quartier n'a pas de lieu dans le plan de masse : la réplique de départ
le couvre.

### Moments scriptés

Source des déclenchements : `src/game/level/blockout/metroEncounterEvents.ts`.
Ces répliques passent devant les autres et ne se disent qu'une fois.

| Identifiant | Quand | Texte |
|---|---|---|
| `metro_sans_titre` | Après les deux annonces de la salle des billets | Pas de ticket. J'ai mieux : des témoins. |
| `metro_premier_passage` | Une rame passe à sa hauteur, lui sur le quai | Trafic interrompu. Ça, c'était quoi, alors ? |
| `metro_nichee` | La meute du coude des galeries est tombée | Ils dormaient contre les tuyaux chauds. Frileux, les collègues. |
| `metro_aiguillage` | Aiguillage rétabli | Aiguillage rétabli. Reste à voir vers où. |
| `metro_courant` | Courant rétabli | Le courant est revenu. Quelqu'un va recevoir la facture. |
| `metro_depart_refuse` | Départ demandé sans aiguillage ou sans courant | Rien ne bouge. Il manque un aiguillage, ou du courant. |
| `metro_depart_rame` | La rame de fret part | Livraison express. Le colis, c'est moi. |
| `metro_rame_vague_1` | Première vague à bord | Ça gratte sur le toit. Drôles de contrôleurs. |
| `metro_rame_vague_2` | Seconde vague à bord | Encore ! Ils voyagent sans billet, eux aussi. |
| `metro_arrivee` | Arrivée au quai privé | Terminus. Tout le monde descend. Surtout moi. |

### Rames et compte vérifié

| Identifiant | Quand | Texte |
|---|---|---|
| `metro_traversee` | Première traversée de voie réussie | On regarde à gauche, à droite. Et on court. |
| `metro_ennemi_fauche` | Premier ennemi fauché par une rame | Fallait rester derrière la ligne jaune. |
| `metro_arret_urgence` | Premier arrêt d'urgence tiré | L'arrêt d'urgence. J'en rêvais depuis l'école. |
| `metro_don_verifie` | Premier don du compte vérifié | Compte vérifié ! J'ai un allié dans la place. |

## Annonces

Source : `src/game/session/presentation/metroAnnouncements.ts`. Une voix
calme, sur le motif du voyageur sans titre de transport. Chaque annonce
compte comme un « moment » pour le direct.

| Identifiant | Qui parle | Quand | Texte |
|---|---|---|---|
| `sans_titre` | MUE · LIGNE S | Entrée en salle des billets | Un voyageur sans titre de transport est signalé en salle des billets. |
| `camera` | MUE · LIGNE S | 4,5 s plus tard | Merci d'éteindre votre caméra. MUE vous souhaite une agréable soirée. |
| `trafic` | MUE · LIGNE S | Arrivée sur les quais | En raison de travaux, aucune rame ne circule sur la ligne S. |
| `depot` | MUE · LIGNE S | Entrée au dépôt | Le dépôt est fermé au public. Le voyageur sans titre y est attendu. |
| `voie_service` | MUE · RÉGULATION | Aiguillage rétabli | Voie de service rétablie. Les refuges restent à la disposition des agents. |
| `depart` | RAME DE SERVICE | La rame part | Cette rame ne prend pas de voyageurs. Départ immédiat. |
| `controle` | RAME DE SERVICE | Première vague, 10 s de voyage | Un contrôle des titres de transport va avoir lieu dans cette rame. |
| `controle_suite` | RAME DE SERVICE | Seconde vague, 30 s de voyage | Le contrôle se poursuit. Merci de votre coopération. |
| `terminus` | RAME DE SERVICE | Arrivée | Terminus. Merci de ne rien oublier à bord. Ni personne. |

## Le compte vérifié

Source : `MYSTERY_TEXTS` dans `src/game/session/stream/streamTexts.ts` ;
conditions dans `src/game/session/stream/streamFeed.ts`. `premier_abonne`
porte désormais une coche de compte vérifié, dans l'alerte de don et dans le
chat. Il vouvoie. Aucune étape ne dépend d'une réplique dite : couper les
sous-titres ne change pas le portefeuille.

| Étape | Quand | Don | Texte |
|---|---|---:|---|
| `metro_depart` | 12 s de jeu | 10 € | Bon retour parmi nous. Votre chaîne est rétablie. La station est tout près. |
| `metro_badge` | Premier badge ramassé | 10 € | Badge validé. Nous vous souhaitons un excellent voyage. |
| `metro_passage` | Premier passage de rame vu du quai | 15 € | Très belle image. La prochaine fois, tenez-vous plus près du bord. |
| `metro_fret` | Il monte dans la rame de fret | 25 € | Pourriez-vous filmer ces bacs de plus près ? Merci de votre confiance. |
| `metro_bord` | 20 s de voyage | 50 € | Merci pour cette soirée. Votre audience n'a jamais été aussi fidèle. |

La sixième intervention, « Bienvenue », est sur le troisième panneau de fin.

## Le chat et les dons

Source : `src/game/session/stream/metroStreamTexts.ts`. Le métro a son
propre jeu de lignes, choisi par `textes: "metro"` dans
`src/game/level/catalog/levels.ts`.

| Sujet | Ce qui le lance | Lignes |
|---|---|---:|
| `kill`, `serie` | Un ennemi tombe, trois d'affilée | 14, 8 |
| `degats` | Le héros est touché | 9 |
| `moment` | Une annonce | 9 |
| `train` | Une traversée de voie réussie | 12 |
| `calme`, `ambiance` | Rien de notable | 13, 16 |
| `touristes` | Un bond d'audience : ce sont **les nouveaux** | 10 |
| `secret`, `casse`, `carte`, `toilettes`, `boss` | Rien encore dans ce niveau | 6 à 8 |

Les registres du premier niveau continuent. `definitivement_humain` défend
le réseau (« la ligne S est fermée pour la sécurité de tous »).
`JeanMi_du_38` commente chaque indice plus loin que le héros, sans tomber
juste. Les nouveaux arrivent par la page d'accueil, croient suivre une série
et demandent la saison 2 ; personne ne leur répond. Huit pseudos s'ajoutent
aux trente du magasin.

## Ce qui reste ouvert

- **Votre relecture** de chaque texte, et des cinq montants du compte
  vérifié. Ces montants sont des valeurs de départ : l'équilibrage attend les
  bornes du niveau (lot N8).
- **Les voix.** Le héros et les annonces n'ont pas de prise. La voix des
  annonces MUE reste à choisir par casting.
- **Le décor.** Plusieurs répliques citent un indice que le décor actuel ne
  montre que schématiquement : le plan de ligne, le tableau du poste, les
  bacs de la rame. Ces objets existent ; leur dessin lisible reste à faire.
- **Le premier badge.** Le niveau n'en pose aucun : l'étape `metro_badge`
  dort jusqu'au lot C3.
- **Le Contrôleur, les secrets et les bornes** ne sont pas dans le niveau.
  Leurs répliques s'écriront avec eux. Les deux locaux à l'écart ont une
  réplique de lieu en attendant leur volume de secret.

## Vérifier

Les règles d'écriture sont tenues par des tests : longueur des lignes,
doublons, mots interdits (la couveuse, « vendu »), vouvoiement du compte
vérifié, existence de chaque réplique citée par un scénario, et accord avec
le validateur Blender. Ils sont dans `test/game/session/stream/`,
`test/game/session/progression/levelScriptSetup.test.ts` et
`test/game/level/navigation/levelSpaces.test.ts`.

En jeu, `cassandre.lieu()` rend le lieu courant et les répliques déjà dites ;
`cassandre.economie.journal()` rend les dons reçus.

## Pour aller plus loin

- [Histoire — le métro](../2-fonctionnel/histoire-metro.md) — la bible dont ces textes découlent.
- [Rencontres du métro](../4-technique/rencontres-metro.md) — les déclencheurs et les vagues qui portent les moments scriptés.
- [Catalogue de répliques du premier niveau](repliques-niveau-v2.md) — les répliques communes aux deux niveaux.
