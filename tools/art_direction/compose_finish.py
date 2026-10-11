"""Compose les comparaisons de finition à partir des captures du jeu."""
from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/assets/finition-da"
FONT = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 18)
STORE = [("parking", "Parking extérieur"), ("muscle", "Véhicules et béton"),
         ("souterrain", "Parking souterrain"), ("service", "Raccord de service"),
         ("galerie", "Galerie commerciale"), ("hub", "Raccord de vente"),
         ("secret1", "Laboratoire photo"), ("secret3", "Passage technique")]
METRO = [("rue", "Rue d’arrivée"), ("place", "Place et fontaine"),
         ("boutiques", "Façades et commerces"), ("cour", "Accès de service"),
         ("voiture", "Véhicule du quartier"), ("commande", "Commande du quai")]


def sheet(filename, rows):
    image = Image.new("RGB", (1288, 40 + len(rows) * 392), "#131b21")
    draw = ImageDraw.Draw(image)
    draw.text((12, 10), "AVANT", fill="#b8c5c8", font=FONT)
    draw.text((656, 10), "APRÈS — même éclairage", fill="#a5ddd0", font=FONT)
    for index, (level, name, title) in enumerate(rows):
        y = 40 + index * 392
        draw.text((12, y), title, fill="#e8e7df", font=FONT)
        for column, state in enumerate(("avant", "apres")):
            with Image.open(OUT / f"{level}-{name}-{state}.png") as capture:
                image.paste(capture.convert("RGB"), (column * 644, y + 24))
    image.save(OUT / filename)


if __name__ == "__main__":
    sheet("magasin-comparaison.png", [("magasin", *row) for row in STORE[:4]])
    sheet("magasin-details.png", [("magasin", *row) for row in STORE[4:]])
    sheet("metro-comparaison.png", [("metro", *row) for row in METRO[:3]])
    sheet("metro-details.png", [("metro", *row) for row in METRO[3:]])
    sheet("apercu.png", [("magasin", *STORE[2]), ("metro", *METRO[2])])
    for source, target in (("finition_magasin.png", "blender-magasin.png"),
                           ("finition_quartier.png", "blender-metro.png")):
        shutil.copy2(ROOT / "renders/_cassandre" / source, OUT / target)
