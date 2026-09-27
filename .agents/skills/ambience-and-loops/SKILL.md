---
name: ambience-and-loops
description: Conception d'ambiances bouclées — nappe, modulation lente, événements sparses, boucle sans couture, signature acoustique par zone. Charger pour toute tâche d'ambiance ou de son long.
---

# Ambiance et boucles

## La structure en trois strates

| Strate | Rôle | Niveau |
|---|---|---|
| **Nappe** | présence continue, le lieu | −18 à −24 dBFS |
| **Modulation** | empêche la fixité | LFO 0.03 à 0.08 Hz |
| **Événements sparses** | vie, imprévisibilité | −30 à −36 dBFS |

Une ambiance sans événements sparses s'entend comme un bruit de fond
d'ordinateur : le cerveau la filtre en trente secondes et le lieu disparaît.

## La modulation lente est ce qui fait « respirer »

Un LFO à 0.045 Hz, soit une oscillation toutes les 22 secondes, sur l'amplitude
de la nappe. Assez lent pour ne pas s'entendre comme un effet, assez présent
pour que l'oreille ne verrouille pas.

```python
lfo = 1.0 + 0.16 * np.sin(2 * np.pi * 0.045 * t(dur))
bed = (hvac + hiss) * lfo + hum
```

**Attention à la durée** : un LFO à 0.06 Hz sur une boucle de 12 s ne complète
même pas un cycle. La modulation ne s'entend alors pas comme une respiration
mais comme une dérive, et la boucle paraît instable. Régler la période pour
qu'elle divise la durée de boucle, ou allonger la boucle.

## La boucle sans couture

C'est le piège classique, et il a la particularité de ne se révéler qu'en jeu,
après coup.

Un bord net produit un clic **à chaque répétition**. Sur une boucle de 14
secondes, ça fait un clic toutes les 14 secondes pendant toute la partie —
assez espacé pour qu'on ne l'attribue pas à l'ambiance, assez régulier pour
devenir insupportable.

`loop_seamless` résout ça par fondu croisé tête-queue :

```python
return loop_seamless(reverb(sig, room=1.1, mix=0.3), xfade=1.5)
```

Le fondu doit être **long** — une seconde et demie sur une nappe. Un fondu
court laisse entendre la transition comme un mouvement.

Conséquence : la boucle finale est plus courte que le signal rendu, de la durée
du fondu. Prévoir la marge.

## Signature acoustique par zone

Chaque zone du niveau a sa réverbération, et c'est ce qui la rend
reconnaissable les yeux fermés.

| Zone | Réverbération | Caractère |
|---|---|---|
| **Parking** | aucune | vent, circulation lointaine, extérieur |
| **Surface de vente** | `room=0.42, damp=3200` | plafond 5 m, béton, néons |
| **Réserve** | `room=0.85, damp=2200` | 7 m, métal, écho long |
| **Bureau** | `room=0.15` | petit, moquette, étouffé |

Le passage d'une zone à l'autre doit **s'entendre**. C'est un repère
d'orientation gratuit, complémentaire des repères visuels de
`level-design-principles`.

## Détails qui vendent le lieu

Pour l'hypermarché la nuit : bourdon 50 et 100 Hz des néons, souffle de
ventilation en bruit brun passe-bas, grincements lointains, cliquetis
sporadiques.

Le bourdon 50 Hz est un détail à fort rendement — c'est la fréquence du secteur
en Europe, et l'oreille l'associe immédiatement à un bâtiment sous tension, vide
et allumé.

## Budget et chargement

L'ambiance est **exclue du sprite audio**. Elle est longue, bouclée, et se
charge en streaming :

```js
const amb = new Howl({ src: ['amb_hypermarche.ogg'], loop: true, html5: true });
```

`html5: true` évite de décoder plusieurs centaines de kilo-octets en mémoire.
Pour les SFX courts, c'est l'inverse : `html5` casserait la latence.
