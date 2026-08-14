from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "titles-45"
OUT.mkdir(exist_ok=True)
font_path = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
items = [
    ("Një ditë si NDIHMËS", "top", 68),
    ("Në terren, si ekip", "top", 64),
    ("Saktësi dhe pëlqim", "bottom", 56),
    ("Privatësia, gjithmonë", "top", 60),
    ("Ndihmësi dorëzon · Mbledhësi raporton", "bottom", 48),
]

for index, (label, position, size) in enumerate(items, 1):
    canvas = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(font_path, size)
    box = draw.textbbox((0, 0), label, font=font)
    width, height = box[2] - box[0], box[3] - box[1]
    x = 105 if position == "top" else (1920 - width) // 2
    y = 85 if position == "top" else 890
    pad_x, pad_y = 34, 24
    draw.rounded_rectangle(
        (x - pad_x, y - pad_y, x + width + pad_x, y + height + pad_y),
        radius=24,
        fill=(15, 118, 110, 220) if position == "top" else (20, 28, 40, 220),
    )
    draw.text((x, y - box[1]), label, font=font, fill="white")
    canvas.save(OUT / f"{index:02d}.png")

