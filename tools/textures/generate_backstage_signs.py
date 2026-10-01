"""Atlas des repères du parcours personnel → parking → bureaux."""
import json
from pathlib import Path
from PIL import Image, ImageDraw
from generate_labels import BLACK, BLUE, GREEN, ORANGE, WHITE, draw_text, text_width, palette_image

OUT = Path(__file__).resolve().parents[2] / "assets_src/textures"
BANDS = (
    ("personnel", "PERSONNEL", BLUE, WHITE),
    ("parking", "PARKING EMPLOYES >", BLUE, WHITE),
    ("or", "CARTE OR AU PARKING", ORANGE, BLACK),
    ("voiture", "VOITURE DE DIRECTION", ORANGE, BLACK),
    ("direction", "RESERVE DIRECTION", BLUE, WHITE),
    ("retour", "< PERSONNEL / BUREAUX", GREEN, WHITE),
    ("sav", "ATELIER SAV", BLUE, WHITE),
    ("cctv", "CAMERA PARKING : DIRECTION", BLUE, WHITE),
)


def main():
    image = Image.new("RGB", (128, 128), BLACK)
    draw = ImageDraw.Draw(image)
    meta = {}
    for index, (name, text, background, ink) in enumerate(BANDS):
        y = index * 16
        draw.rectangle((0, y + 1, 127, y + 14), fill=background)
        scale = 1
        # Arrow glyphs use the existing pixel alphabet.
        label = text.replace(">", "+").replace("<", "-").replace("/", "-")
        label = label.replace("+", " ")
        draw_text(image, label, (128 - text_width(label, scale)) // 2, y + 5, ink, scale)
        if ">" in text:
            draw.polygon(((119,y+3),(126,y+8),(119,y+13),(119,y+10),(115,y+10),(115,y+6),(119,y+6)), fill=ink)
        if "<" in text:
            draw.polygon(((8,y+3),(1,y+8),(8,y+13),(8,y+10),(12,y+10),(12,y+6),(8,y+6)), fill=ink)
        meta[name] = [0, y, 128, 16]
    image.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGB").save(OUT / "sig_personnel.png")
    (OUT / "sig_personnel.json").write_text(json.dumps({"regions": meta}, indent=2) + "\n")


if __name__ == "__main__":
    main()
