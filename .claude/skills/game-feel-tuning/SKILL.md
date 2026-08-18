---
name: game-feel-tuning
description: Protocole de tuning de la sensation de jeu — paramètres exposés, harnais A/B, replay d'input, checklist de juice. Charger pour toute tâche sur le déplacement, les armes, l'impact ou le retour visuel.
---

# Tuning du feel

## La limite de la délégation

**Aucun agent ne peut juger si un saut est agréable.** Ce skill décrit ce qui
est délégable et ce qui ne l'est pas.

| Délégable | Non délégable |
|---|---|
| Exposer les paramètres proprement | Choisir leur valeur |
| Construire le harnais A/B | Trancher entre les variantes |
| Implémenter hitstop, shake, flash | Décider de leur intensité |
| Mesurer temps d'atteinte, hauteur effective | Dire si c'est « nerveux » ou « mou » |
| Proposer 3 variantes argumentées | Committer une valeur « tunée » |

## Le harnais, livrable obligatoire

Toute intervention sur le feel livre les quatre éléments :

1. **Config unique** — tous les paramètres dans un objet, pas dispersés
2. **Sliders à chaud** dans le panneau de debug
3. **2-3 variantes** nommées avec l'effet perceptuel décrit en une phrase
4. **Replay d'input** — enregistrer 15 s de mouvement, le rejouer sur chaque
   variante pour comparer sur la même séquence

Sans replay, la comparaison A/B est inutilisable : on ne joue jamais deux fois
exactement pareil, et le biais de nouveauté domine.

## Checklist de juice

Ce qui sépare un proto qui donne envie d'un proto mou :

- [ ] Vitesse ~2× un FPS moderne, accélération quasi instantanée
- [ ] Gros contrôle aérien (Quake-like), pas de saut « réaliste »
- [ ] Bob de l'arme + offset de recul sur le viewmodel
- [ ] Hitstop 2-3 frames à l'impact
- [ ] Flash blanc sur l'ennemi touché
- [ ] Knockback proportionnel aux dégâts
- [ ] Screenshake court et sec (amplitude 0.15, 120 ms, décroissance exponentielle)
- [ ] Muzzle flash 2 frames + lumière ponctuelle très courte
- [ ] Douilles éjectées (physique jouet, groupe `DEBRIS`)
- [ ] Sons d'impact dépendants du matériau
- [ ] Des gibs
- [ ] Aucune animation bloquante

## Les deux tests

**Phase 1** — 2 minutes de course et de saut dans la gym, **sans arme ni
ennemi**, et c'est déjà agréable.

**Phase 2** — vider un chargeur sur un mur vide est satisfaisant, **sans
ennemi dans la scène**.

Ces tests isolent volontairement le feel du contenu. Un combat contre des
ennemis masque un déplacement médiocre pendant les premières minutes, puis le
révèle après une heure — trop tard.

## Signal d'alarme

Si le déplacement reste mou après **3 itérations** de valeurs, arrête de tuner.
Le problème est probablement structurel :

- interpolation de la rotation caméra (latence de visée)
- `mousemove` lu dans le pas fixe au lieu du taux d'affichage
- delta non clampé
- `pointerlock` avec accélération souris de l'OS non désactivée

Remonte-le au `director` plutôt que de continuer à changer des nombres.
