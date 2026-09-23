---
title: React — composition
tags: [reference, react, ui]
status: stable
updated: 2026-09-23
---

# React — composition

Une interface se construit en **assemblant de petits composants**, pas en
configurant un gros. Lu de haut en bas, le JSX d'un écran doit ressembler à sa
mise en page : on voit un cadre, un titre, deux boutons, sans devoir lire les
fonctions qui les fabriquent.

Règles sœurs : [structure](react-structure.md), [CSS](react-css.md),
[bonnes pratiques React 19.2](react-bonnes-pratiques.md).

## Un écran se lit comme sa mise en page

```tsx
export function DeathScreen({ onReplay, onReturnToMenu }: DeathScreenProps) {
  const flowState = useGameStore((s) => s.flowState);
  if (flowState !== "dead") return null;

  return (
    <Screen tone="alert">
      <TvStatic />
      <Scanlines variant="bars" />
      <CornerFrame className={styles.panel}>
        <StatusFlag blinking>SIGNAL PERDU</StatusFlag>
        <ScreenTitle>STREAM COUPÉ</ScreenTitle>
        …
        <ButtonRow>
          <Button variant="primary" onClick={onReplay}>▶ RECONNECTER</Button>
          <Button onClick={onReturnToMenu}>◀ RETOUR AU MENU</Button>
        </ButtonRow>
      </CornerFrame>
    </Screen>
  );
}
```

Le rouge ne vient d'aucune prop passée aux boutons : `tone="alert"` le pose sur
la racine et la cascade CSS le transmet (voir [CSS](react-css.md#les-tons-décran)).

## Les enfants d'abord

Un composant qui enveloppe du contenu le reçoit en `children`. Il ne reçoit pas
un tableau de descriptions à dérouler.

```tsx
// Oui : le parent compose
<OptionSection title="CHAMP DE VISION" hint="Valeur au repos…">
  <RangeField … />
</OptionSection>

// Non : le composant devine la structure à partir d'une config
<OptionSection title="CHAMP DE VISION" kind="range" min={60} max={100} … />
```

Quand un composant a **deux régions** distinctes à remplir, la seconde est une
prop nommée qui reçoit du JSX (un « emplacement »). Exemple réel : `MainMenu`
reçoit `devTools`, que `bootChoice.ts` ne remplit qu'en développement — le
menu ne sait rien des outils de dev, il leur laisse une place. Au-delà de deux
régions, c'est probablement deux composants.

## Chaque feuille lit ses propres données

Dans le HUD, **le parent ne lit rien du store** : il place des widgets, et chaque
widget sélectionne exactement ce qu'il affiche.

```tsx
export function Hud() {
  return (
    <>
      <HudCorner position="topRight">
        <LiveCam />
        <ViewerCount />
        <HeroLine />
      </HudCorner>
      <HudCorner position="bottomLeft">
        <LoyaltyCards />
        <HealthPanel />
      </HudCorner>
      <HudCorner position="bottomRight">
        <AmmoPanel />
      </HudCorner>
    </>
  );
}
```

C'est de la composition **et** de la performance : quand les munitions changent,
seul `AmmoPanel` re-rend. L'ancien `Hud` lisait neuf valeurs pour les
redistribuer, et re-rendait tout le calque au moindre changement de l'une
d'elles — ce qui use le budget de 10 rendus par seconde de l'invariant #2.

## Les primitives d'identité

Toute l'interface partage une identité, rangée dans `components/` — « signal intercepté » : cadres à coins
de visée, voyant REC, lignes de balayage. Elle est portée par des primitives, pas
recopiée d'écran en écran.

| Primitive | Rôle |
|---|---|
| `Screen` | racine plein écran d'un écran modal : fond, ton, centrage, capture de la souris |
| `Scanlines`, `Vignette`, `TvStatic` | effets de fond, empilés comme enfants de `Screen` |
| `CornerFrame` | panneau à quatre coins de visée |
| `RecIndicator` | voyant rouge clignotant et son libellé |
| `ScreenTitle` | titre lumineux d'un écran |
| `StatusFlag` | étiquette d'état encadrée (« SIGNAL PERDU ») |
| `Button`, `ButtonRow` | le bouton de l'interface et sa rangée |

Une primitive **ne lit pas le store** et ne sait pas dans quel écran elle vit : elle
reçoit ses données en props et sa couleur par la cascade.

## Variantes : une prop énumérée par axe

```tsx
<Button variant="primary">   // "default" | "primary" | "danger"
<Button size="large">        // "default" | "large"
```

Pas de soupe de booléens (`primary`, `danger`, `big`, `ghost`) dont on ne sait
pas lesquels peuvent se combiner. Un axe = une union ; deux axes = deux props.

## Quand ne pas abstraire

- **Deux occurrences qui peuvent diverger restent deux.** On factorise à la
  troisième, ou quand la ressemblance est une règle de conception (l'identité
  visuelle partagée) et non une coïncidence.
- **Une pièce qui ne sert qu'à un écran reste dans son dossier**
  (`screens/mainMenu/NewsTicker/NewsTicker.tsx`), même si elle paraît générique.

## Anti-patterns

| Anti-pattern | Pourquoi c'est un problème | À la place |
|---|---|---|
| Un composant-dieu qui lit tout le store et redistribue | re-rend tout pour chaque valeur | des feuilles qui lisent leurs données |
| Une fonction `renderLigne()` qui renvoie du JSX | ni état, ni clé, ni nom dans le profileur | un composant `<Ligne />` |
| Un objet `d` qui regroupe les données pour les passer plus bas | une indirection de plus, et un objet neuf à chaque rendu | passer les valeurs, ou laisser l'enfant les lire |
| Une prop booléenne par cas particulier | combinaisons invalides silencieuses | une union énumérée |
| `cloneElement`, parcours de `children` | couplage invisible au contenu | une prop explicite, un emplacement |
| Un contexte pour éviter deux niveaux de props | dépendance cachée | les props, tant qu'on reste sous trois niveaux |
| Une copie d'un composant voisin avec trois valeurs changées | quatre boutons qui divergent en silence | une primitive avec une variante |
