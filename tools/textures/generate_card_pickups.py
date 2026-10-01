"""Cartes de fidélité ramassables, sprites RGBA 128×80.

    .venv-refs/bin/python3 tools/textures/generate_card_pickups.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

from generate_labels import draw_text, hexc


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/assets/sprites/cards"
SIZE = (128, 80)
INK = hexc("#17222e")
WHITE = hexc("#f5f2e8")
STYLES = {
    "argent": ("ARGENT", "#b7c5cc", "#e6edef", "#7d8e9d", "#36556c", 1),
    "or": ("OR", "#e7b84b", "#ffe69a", "#a87027", "#624121", 2),
    "platine": ("PLATINE", "#9ce0df", "#dcffff", "#4d939f", "#23475d", 3),
}


def card_sprite(style):
    label, base, light, shade, band, rank = style
    image = Image.new("RGBA", SIZE)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((4, 4, 123, 75), radius=6, fill=INK)
    draw.rounded_rectangle((6, 6, 121, 73), radius=4, fill=base)
    draw.line((10, 7, 117, 7), fill=light)
    draw.line((10, 72, 117, 72), fill=shade)
    draw.rectangle((7, 11, 120, 25), fill=band)
    draw_text(image, "FIDELITE", 13, 15, WHITE, scale=2)

    # Puce : contacts visibles même quand les lettres n'occupent que deux pixels.
    draw.rounded_rectangle((13, 32, 35, 48), radius=2, fill=INK)
    draw.rectangle((15, 34, 33, 46), fill="#f7d576")
    draw.rectangle((21, 37, 27, 43), outline="#8f662f")
    draw.line((15, 38, 21, 38), fill="#8f662f")
    draw.line((15, 42, 21, 42), fill="#8f662f")
    draw.line((27, 38, 33, 38), fill="#8f662f")
    draw.line((27, 42, 33, 42), fill="#8f662f")
    draw.line((24, 34, 24, 37), fill="#8f662f")
    draw.line((24, 43, 24, 46), fill="#8f662f")

    # Insigne et nombre d'étoiles : le rang se distingue aussi sans la couleur.
    for i in range(rank):
        x = 104 - 10 * i
        draw.polygon([(x, 34), (x + 2, 37), (x + 5, 38), (x + 2, 40),
                      (x, 43), (x - 2, 40), (x - 5, 38), (x - 2, 37)], fill=band)
    draw_text(image, label, 13, 55, INK, scale=2)
    draw_text(image, f"0{rank}", 102, 56, INK, scale=2)
    draw.line((13, 68, 71, 68), fill=shade)
    draw.line((13, 69, 44, 69), fill=shade)
    return image


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, style in STYLES.items():
        card_sprite(style).save(OUT / f"{name}.png")
    print(f"3 cartes générées dans {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
