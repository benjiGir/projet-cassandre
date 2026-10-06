---
title: Outillage Blender pour plusieurs niveaux
tags: [technique, blender, metro, niveaux]
status: brouillon
updated: 2026-10-06
---

# Outillage Blender pour plusieurs niveaux

## Responsabilité et frontières

Cassandre choisit le générateur, le plan et les sorties d'un niveau.
Les recettes du magasin restent dans `tools/level_v2/` ; le métro dispose
de `tools/metro/`. Les briques Blender, le validateur et l'exporteur sont
partagés. Aucun objet du métro n'entre dans le magasin par cette sélection.

Ce lot N0 prépare le pipeline. Il ne livre pas le tracé du métro, son kit,
sa campagne ou ses trains glTF. Les prototypes de trains restent indépendants.

## Fichiers

| Responsabilité | Fichier |
|---|---|
| Profils et protection des sorties | `tools/blender/level_profiles.py` |
| Commandes et empreinte de scène | `tools/blender/cassandre.py` |
| Interface headless | `tools/blender/cassandre_cli.py` |
| Panneau Blender | `tools/blender/extension/cassandre/__init__.py` |
| Manifestes génériques | `tools/blender/level_spaces.py` |
| Compatibilité du manifeste magasin | `tools/level_v2/espaces_jeu.py` |
| Audit du niveau ouvert | `tools/level_v2/audit_niveau.py` |
| Atelier technique métro | `tools/metro/build_metro.py` |
| Emprise de l'atelier | `tools/metro/plan_de_masse.py` |

## Place dans la boucle

Ces outils fonctionnent hors du jeu, dans Blender ou dans Python pour les
manifestes. Ils ne modifient ni le pas fixe ni la boucle de rendu. Le jeu lit
les GLB et manifestes exportés ; l'entrée jouable du métro vient au blockout.

## Données et contrats

### Sélection du niveau

Les profils `hypermarche` et `metro` déclarent chacun le répertoire source,
le générateur, le plan, le fichier Blender, le GLB et le manifeste.

`build(niveau=...)` peut changer de niveau dans la session : la scène modifiée
est d'abord copiée en sécurité. Sans choix explicite, Cassandre utilise le
marqueur `cassandre_niveau` de la scène, puis le nom de fichier `metro`.
Les scènes historiques sans marqueur conservent le choix du magasin.

`check`, `status` et `export` vérifient le choix explicite contre le niveau
ouvert. Un désaccord avec un marqueur ou un nom canonique est une erreur.
Construire est le seul moyen de changer ce choix sans ouvrir un autre fichier.
Les vues de dessus et les altitudes des prises de vue suivent le plan ouvert.
Le panneau de l'extension offre le choix Magasin/Métro pour ses commandes.

Les plans sont importés sous des noms distincts, `_cassandre_plan_hypermarche`
et `_cassandre_plan_metro`. Un `plan_de_masse` déjà chargé par le magasin
ne peut donc pas être réutilisé par erreur pour le métro.

### Sorties

| Profil | Source par défaut | GLB par défaut | Manifeste |
|---|---|---|---|
| `hypermarche` | `assets_src/blender/niveau_v2.blend` | `public/assets/levels/niveau_v2.glb` | `public/assets/levels/niveau_v2.espaces.json` |
| `metro` | metro.blend dans `assets_src/blender/` | metro.glb dans `public/assets/levels/` | metro.espaces.json dans `public/assets/levels/` |

Les sorties métro par défaut seront créées au blockout ; N0 utilise les
candidats isolés dans `renders/metro_n0/`.

Une sortie `out=...` permet les candidats isolés. Les trois chemins réservés
à l'autre profil sont refusés avant toute construction ou export. Les chemins
arbitraires de candidats restent sous la responsabilité de leur auteur.

Le log conserve le message d'un `SystemExit` textuel et les dernières lignes
d'un échec, même quand la commande ne retient normalement qu'un préfixe.
La CLI renvoie un code non nul sur échec ou argument invalide.

### Manifestes et audit

`manifest()` produit le manifeste du niveau choisi. L'export GLB et le
manifeste sont deux commandes séparées. Le manifeste utilise la conversion
Blender → jeu existante : X inchangé, Y jeu = altitude, Z jeu = −Y Blender,
avec un mètre de marge verticale. Les rampes conservent leurs deux altitudes.
La commande historique `tools/level_v2/espaces_jeu.py` reste disponible.

L'audit lit le plan du profil. Il conserve les contrôles de sol, de bords,
d'interpénétrations, de placement au sol et de spawns. Le contrôle spécifique
du PC sécurité s'applique uniquement au magasin. `check()` renvoie `ok` en
tenant compte des verdicts de validation et du code de sortie de l'audit.

### Atelier du métro

L'atelier contient une seule salle de 12 × 16 m, avec un sol à −5 m,
quatre murs, un plafond à 4 m et un spawn. Il utilise GEO/SHELL, COL et LOGIC,
les unités SI, les proxies cuboid et les couleurs de sommets des helpers.
La scène porte `cassandre_etape=atelier_N0`.

Cette emprise sert à exercer les commandes ; elle ne décide aucune cote du
niveau final. Le [candidat N2](../assets/plan-metro.md) est conservé séparément
dans `tools/metro/layout/plan_n2.py` jusqu'au blockout N5. `plan()` produit
son SVG et son relevé sans changer le fichier Blender ouvert.

### Reconstruction du magasin

`fingerprint()` relève les objets du view layer triés par nom : poses,
propriétés, parents, sommets, polygones, matériaux affectés, UV et couleurs.
Les faces sont triées et leur premier sommet est normalisé, en conservant
leur sens : une différence d'ordre des faces ne change pas l'empreinte.
L'empreinte est écrite à côté de la source dans `<nom>.fingerprint.json`.
Le fichier doit être sauvegardé avant ce relevé. L'empreinte ne remplace pas
une inspection de rendu ou des shaders des matériaux.

Comparer les octets d'un GLB seul n'est pas une preuve de reconstruction :
l'exporteur peut choisir une autre triangulation pour certains polygones.
Le relevé du contenu Blender permet de comparer la géométrie source.
Les traces et résultats de N0 sont dans le [journal](../journal/metro-outillage-2026-10.md).

## Pièges

- Un atelier n'est pas un niveau fini. Le catalogue du jeu reste à préparer.
- Une scène historique renommée n'a pas forcément de marqueur : utilisez
  `niveau="hypermarche"` explicitement pour lever l'ambiguïté.
- `build` vide la scène ; la copie de sécurité reste nécessaire.
- Après modification de scripts, utilisez `C.reload()` avant de les réimporter.
- Recharger l'extension est nécessaire pour faire apparaître son nouveau sélecteur.

## Tests

Aucune suite de tests automatisés n'est ajoutée ni exécutée pour ce lot.
Les constructions, exports, contrôles de contenu et empreintes sont des
relevés de pipeline ; leur résultat est consigné dans le journal.

## Comment vérifier

Depuis Blender :

```python
import cassandre as C
C.build(niveau="metro", out="renders/metro_n0/metro.blend")
C.check(strict=True)
C.shot("dessus:atelier", nom="atelier_metro_n0")
C.export(out="renders/metro_n0/metro.glb")
C.manifest(out="renders/metro_n0/metro.espaces.json")
C.fingerprint()
```

En headless, chaque commande suit le même choix :

```bash
blender -b --factory-startup -P tools/blender/cassandre_cli.py -- build niveau=metro out=renders/metro_n0/metro.blend
blender -b renders/metro_n0/metro.blend -P tools/blender/cassandre_cli.py -- check strict=true
python3 tools/blender/level_spaces.py --niveau metro --out renders/metro_n0/metro.espaces.json
```
