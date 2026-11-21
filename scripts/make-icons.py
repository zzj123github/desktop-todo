"""生成 build/icon.ico 与 build/tray.ico（陶土方 + 白色勾）。

构建资产脚本（一次性，可重复运行）；design/ 无 ico 资产，图标按 design/app 品牌样式生成。
用法：<bundled python with Pillow> scripts/make-icons.py
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"

ACCENT = (217, 119, 87, 255)  # --accent #D97757
ON_ACCENT = (255, 253, 250, 255)  # --on-accent #FFFDFA
CLEAR = (0, 0, 0, 0)

APP_SIZES = [16, 24, 32, 40, 48, 64, 128, 256]
TRAY_SIZES = [16, 20, 24, 32, 40, 48]


def rounded_square(size: int, radius_ratio: float = 0.24) -> Image.Image:
    scale = 8  # 超采样，保证圆角与勾边缘平滑
    big = size * scale
    img = Image.new("RGBA", (big, big), CLEAR)
    draw = ImageDraw.Draw(img)
    radius = int(big * radius_ratio)
    draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=radius, fill=ACCENT)

    # 白色对勾：三点折线，圆头，宽约边长的 11%
    stroke = max(2, int(big * 0.105))
    points = [
        (int(big * 0.28), int(big * 0.53)),
        (int(big * 0.44), int(big * 0.69)),
        (int(big * 0.74), int(big * 0.34)),
    ]
    draw.line(points, fill=ON_ACCENT, width=stroke, joint="curve")
    r = stroke / 2
    for x, y in points:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=ON_ACCENT)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    app_images = [rounded_square(s) for s in APP_SIZES]
    app_images[-1].save(BUILD / "icon.ico", format="ICO", sizes=[(s, s) for s in APP_SIZES])
    app_images[-1].save(BUILD / "icon.png", format="PNG")
    tray_images = [rounded_square(s, radius_ratio=0.3) for s in TRAY_SIZES]
    tray_images[-1].save(BUILD / "tray.ico", format="ICO", sizes=[(s, s) for s in TRAY_SIZES])
    tray_images[-1].save(BUILD / "tray.png", format="PNG")
    print("wrote", BUILD / "icon.ico", BUILD / "icon.png", BUILD / "tray.ico", BUILD / "tray.png")


if __name__ == "__main__":
    main()
