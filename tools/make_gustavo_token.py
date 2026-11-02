import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "painel-do-mestre" / "assets" / "handouts" / "h13.jpg"
TARGET = ROOT / "painel-do-mestre" / "assets" / "fichas-mapa" / "gustavo.png"
SIZE = 256
SCALE = 4
CROP_CENTER = (0.60, 0.50)
CROP_SIZE = 0.40


def hexagon(size, inset):
    center = size / 2
    radius = size / 2 - inset
    return [(center + radius * math.cos(math.radians(60 * i - 90)), center + radius * math.sin(math.radians(60 * i - 90))) for i in range(6)]


def main():
    photo = Image.open(SOURCE).convert("RGB")
    width, height = photo.size
    side = int(min(width, height) * CROP_SIZE * 1.6)
    cx, cy = int(width * CROP_CENTER[0]), int(height * CROP_CENTER[1])
    box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    big = SIZE * SCALE
    portrait = photo.crop(box).resize((big, big), Image.LANCZOS).rotate(-90)
    portrait = ImageEnhance.Color(portrait).enhance(0.75)
    portrait = ImageEnhance.Brightness(portrait).enhance(0.9)
    tint = Image.new("RGB", (big, big), (120, 10, 10))
    portrait = Image.blend(portrait, tint, 0.18)

    outer = Image.new("L", (big, big), 0)
    ImageDraw.Draw(outer).polygon(hexagon(big, 6 * SCALE), fill=255)
    inner = Image.new("L", (big, big), 0)
    ImageDraw.Draw(inner).polygon(hexagon(big, 22 * SCALE), fill=255)

    frame = Image.new("RGBA", (big, big), (92, 22, 18, 255))
    token = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    token.paste(frame, (0, 0), outer)
    token.paste(portrait.convert("RGBA"), (0, 0), inner.filter(ImageFilter.GaussianBlur(SCALE)))
    edge = Image.new("L", (big, big), 0)
    ImageDraw.Draw(edge).line(hexagon(big, 14 * SCALE) + [hexagon(big, 14 * SCALE)[0]], fill=255, width=3 * SCALE)
    token.paste(Image.new("RGBA", (big, big), (176, 40, 30, 255)), (0, 0), edge)
    token.resize((SIZE, SIZE), Image.LANCZOS).save(TARGET)
    print(TARGET)


if __name__ == "__main__":
    sys.exit(main())
