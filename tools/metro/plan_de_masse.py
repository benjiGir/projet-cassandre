"""Atelier N0, sans tracé de niveau : le plan du métro vient au lot N2.

see: docs/4-technique/outillage-multi-niveaux.md#atelier-du-métro
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Space:
    id: str
    nom: str
    x: tuple[float, float]
    y: tuple[float, float]
    z: float
    hauteur: float
    rampe: tuple[str, float, float] | None = None

    @property
    def largeur(self) -> float:
        return self.x[1] - self.x[0]

    @property
    def profondeur(self) -> float:
        return self.y[1] - self.y[0]


ALL = [Space("atelier", "Atelier du pipeline métro", (-6, 6), (-8, 8), -5, 4)]
