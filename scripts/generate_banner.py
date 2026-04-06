#!/usr/bin/env python3
"""
Generate assets/banner.png — two-column layout, 1024x516 px.

Usage:
    python3 scripts/generate_banner.py            # regenerate
    python3 scripts/generate_banner.py --compare  # regenerate + diff image

Requirements:
    pip install pillow cairosvg

Fonts/icons are downloaded on first run to assets/fonts/ and assets/icons/.
Skill, track, and platform counts are read live from the repo tree.
To add a track: append one entry to TRACKS and re-run.
"""

from __future__ import annotations

import io
import shutil
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT       = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "assets"
FONTS_DIR  = ASSETS_DIR / "fonts"
ICONS_DIR  = ASSETS_DIR / "icons"

W, H    = 1024, 516
SPLIT_X = 659

LEFT_BG  = (35, 35, 35)   # measured from original banner
RIGHT_BG = (247, 25, 99)  # #F71963 -- official VTEX brand pink
WHITE    = (255, 255, 255)
GRAY     = (170, 167, 165)

TRACKS: list[tuple[str, str]] = [
    ("Architecture", "compass"),
    ("FastStore",    "store"),
    ("Payment",      "shield-check"),
    ("VTEX IO",      "box"),
    ("Marketplace",  "refresh-cw"),
    ("Headless",     "cloud"),
]

_FONT_URLS = {
    "DMSans-ExtraBold.ttf": (
        "https://raw.githubusercontent.com/googlefonts/dm-fonts/"
        "main/Sans/fonts/ttf/DMSans24pt-ExtraBold.ttf"
    ),
    "DMSans-Regular.ttf": (
        "https://raw.githubusercontent.com/googlefonts/dm-fonts/"
        "main/Sans/fonts/ttf/DMSans24pt-Regular.ttf"
    ),
}

_SYS_REGULAR = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
_SYS_BOLD = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def _download(dest: Path, url: str) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  down {dest.name}")
    urllib.request.urlretrieve(url, dest)
    return dest


def _load_font(key: str, size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONTS_DIR / key
    if not path.exists():
        url = _FONT_URLS.get(key)
        if url:
            try:
                _download(path, url)
            except Exception as exc:
                print(f"  ! Font download failed ({exc}), using system font")
    if path.exists():
        try:
            return ImageFont.truetype(str(path), size)
        except Exception:
            pass
    for fp in (_SYS_BOLD if bold else _SYS_REGULAR):
        try:
            return ImageFont.truetype(fp, size)
        except Exception:
            pass
    return ImageFont.load_default(size=size)


_LUCIDE_CDN = "https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/{name}.svg"


def _ensure_icon(name: str) -> Path:
    path = ICONS_DIR / f"{name}.svg"
    if not path.exists():
        ICONS_DIR.mkdir(parents=True, exist_ok=True)
        print(f"  down {name}.svg")
        urllib.request.urlretrieve(_LUCIDE_CDN.format(name=name), path)
    return path


def _svg_to_pil(svg_path: Path, size: int, color: str = "white") -> Image.Image:
    import cairosvg
    # Lucide SVGs use stroke="currentColor". cairosvg resolves currentColor
    # against the element's `color` attribute, so a bytes-replace is sufficient
    # (safe: Lucide never puts 'currentColor' inside text nodes).
    svg = svg_path.read_bytes().replace(b"currentColor", color.encode())
    png = cairosvg.svg2png(bytestring=svg, output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def _count_skills()    -> int: return len(list((ROOT / "tracks").glob("*/skills/*/skill.md")))
def _count_tracks()    -> int: return len([d for d in (ROOT / "tracks").iterdir() if d.is_dir()])
def _count_platforms() -> int:
    e = ROOT / "exports"
    return len([d for d in e.iterdir() if d.is_dir()]) if e.is_dir() else 5


# All Y values are top-of-glyph (anchor="lt"), pixel-measured from the
# original 1024x516 banner. Tune with --compare if a font change shifts them.
TITLE_LINES   = ["VTEX", "Skills"]
TITLE_X       = 56
TITLE_Y       = 72
TITLE_SIZE    = 90
TITLE_LEADING = 14

ICON_SIZE    = 56
ICON_ROW_Y   = 282
ICON_FIRST_X = 72
ICON_STEP    = 108

LABEL_Y    = 360
LABEL_SIZE = 18

FOOTER_TEXT = "Works with Cursor · GitHub Copilot · Claude · AGENTS.md · OpenCode · Kiro"
FOOTER_X    = 30
FOOTER_Y    = 445
FOOTER_SIZE = 16

STATS_X    = 718
STATS_Y1   = 125
STATS_Y2   = 195
STATS_Y3   = 265
STATS_SIZE = 46


def generate_banner(dest: Path) -> None:
    print("Generating banner ...")

    print("Loading fonts ...")
    font_title  = _load_font("DMSans-ExtraBold.ttf", TITLE_SIZE, bold=True)
    font_stats  = _load_font("DMSans-ExtraBold.ttf", STATS_SIZE, bold=True)
    font_label  = _load_font("DMSans-Regular.ttf",   LABEL_SIZE)
    font_footer = _load_font("DMSans-Regular.ttf",   FOOTER_SIZE)

    img  = Image.new("RGB", (W, H), LEFT_BG)
    draw = ImageDraw.Draw(img)

    draw.rectangle([(SPLIT_X, 0), (W - 1, H - 1)], fill=RIGHT_BG)

    y = TITLE_Y
    for line in TITLE_LINES:
        draw.text((TITLE_X, y), line, font=font_title, fill=WHITE, anchor="lt")
        bb = draw.textbbox((TITLE_X, y), line, font=font_title, anchor="lt")
        y += (bb[3] - bb[1]) + TITLE_LEADING

    print("Rendering icons ...")
    for i, (label, icon_name) in enumerate(TRACKS):
        cx = ICON_FIRST_X + i * ICON_STEP
        ix = cx - ICON_SIZE // 2
        icon_img = _svg_to_pil(_ensure_icon(icon_name), ICON_SIZE)
        img.paste(icon_img, (ix, ICON_ROW_Y), mask=icon_img)
        lbb = draw.textbbox((0, 0), label, font=font_label, anchor="lt")
        draw.text((cx - (lbb[2] - lbb[0]) // 2, LABEL_Y), label, font=font_label, fill=WHITE, anchor="lt")

    draw.text((FOOTER_X, FOOTER_Y), FOOTER_TEXT, font=font_footer, fill=GRAY, anchor="lt")

    for stat_text, stat_y in [
        (f"{_count_skills()} skills",       STATS_Y1),
        (f"{_count_tracks()} tracks",       STATS_Y2),
        (f"{_count_platforms()} platforms", STATS_Y3),
    ]:
        draw.text((STATS_X, stat_y), stat_text, font=font_stats, fill=WHITE, anchor="lt")

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PNG")
    print(f"ok {dest.relative_to(ROOT)}")


def _compare(ref: Path, gen: Path, out: Path) -> None:
    from PIL import ImageFont as _IFont

    PW, PH = 1024, 516
    LH, B, GAP, PAD = 44, 4, 12, 16
    TW = PAD + B + PW + B + GAP + B + PW + B + PAD
    TH = PAD + LH + B + PH + B + PAD

    lbl_font = None
    for fp in ["/System/Library/Fonts/Helvetica.ttc",
               "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        try:
            lbl_font = _IFont.truetype(fp, 20); break
        except Exception:
            pass
    if lbl_font is None:
        lbl_font = _IFont.load_default(size=20)

    canvas = Image.new("RGB", (TW, TH), (20, 20, 20))
    draw   = ImageDraw.Draw(canvas)

    def _panel(img_path: Path, left: bool, title: str, bdr: tuple, lbg: tuple) -> None:
        panel = Image.open(img_path).convert("RGB").resize((PW, PH), Image.LANCZOS)
        ox = PAD if left else PAD + B + PW + B + GAP
        draw.rectangle([ox, PAD, ox + B + PW + B, PAD + LH], fill=lbg)
        bb = draw.textbbox((0, 0), title, font=lbl_font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        draw.text(
            (ox + (B + PW + B - tw) // 2, PAD + (LH - th) // 2),
            title, fill=(255, 255, 255), font=lbl_font,
        )
        by = PAD + LH
        draw.rectangle([ox, by, ox + B + PW + B, by + B + PH + B], fill=bdr)
        canvas.paste(panel, (ox + B, by + B))

    _panel(ref, True,  "REFERENCE  (original)",             (59, 130, 246), (37, 99, 235))
    _panel(gen, False, "GENERATED  (generate_banner.py)",   (34, 197, 94),  (22, 163, 74))

    canvas.save(out, "PNG")
    print(f"ok {out.relative_to(ROOT)}")


def main() -> None:
    banner    = ASSETS_DIR / "banner.png"
    reference = ASSETS_DIR / "banner_reference.png"

    if banner.exists() and not reference.exists():
        shutil.copy2(banner, reference)
        print(f"Reference copy: {reference.relative_to(ROOT)}")

    generate_banner(banner)

    if "--compare" in sys.argv:
        if reference.exists():
            _compare(reference, banner, ASSETS_DIR / "banner_comparison.png")
        else:
            print("No reference found -- run once without --compare first.")


if __name__ == "__main__":
    main()
