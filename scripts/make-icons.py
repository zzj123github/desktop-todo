"""生成打包/托盘图标（陶土方 + 白色勾）。

构建资产脚本（一次性，可重复运行）；design/ 无 ico/icns 资产，图标按 design/app 品牌样式生成。
用法：
  <python> scripts/make-icons.py          # 生成全部平台资产
  <python> scripts/make-icons.py --check  # 只报告会写入的文件，不落盘

产物：
  build/icon.ico                 Windows 安装包 / exe 图标（多尺寸 16–256，满版圆角方）
  build/icon.png                 macOS 应用图标源（1024，按 macOS 规范四周留白 + 大圆角）
  build/tray.ico                 Windows 托盘图标（多尺寸 16–48）
  build/tray.png                 Windows 托盘 PNG（48，dev 回退）
  build/trayTemplate.png         macOS 菜单栏模板图标 1x（18，黑 + alpha，系统自动适配深浅色）
  build/trayTemplate@2x.png      macOS 菜单栏模板图标 2x（36）
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"

ACCENT = (217, 119, 87, 255)  # --accent #D97757
ON_ACCENT = (255, 253, 250, 255)  # --on-accent #FFFDFA
CLEAR = (0, 0, 0, 0)
TEMPLATE_INK = (0, 0, 0, 255)

APP_SIZES = [16, 24, 32, 40, 48, 64, 128, 256]
TRAY_SIZES = [16, 20, 24, 32, 40, 48]
# macOS 图标：1024 画布，内容四周留白约 9.8%、圆角约为内容的 22.5%（Big Sur 之后的视觉规范）
MAC_ICON_SIZE = 1024
MAC_ICON_INSET_RATIO = 0.0977
MAC_ICON_RADIUS_RATIO = 0.225
# macOS 菜单栏：18pt 高（@2x 36），模板图标只用 alpha 表达形状
MAC_TRAY_SIZE = 18


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


def mac_app_icon(size: int = MAC_ICON_SIZE) -> Image.Image:
    """macOS 应用图标：满版圆角方在 macOS Dock 里会显得比其它 App 大一圈，按规范留白。"""
    inset = round(size * MAC_ICON_INSET_RATIO)
    content = size - inset * 2
    canvas = Image.new("RGBA", (size, size), CLEAR)
    canvas.paste(rounded_square(content, radius_ratio=MAC_ICON_RADIUS_RATIO), (inset, inset))
    return canvas


def mac_tray_template(size: int = MAC_TRAY_SIZE) -> Image.Image:
    """macOS 菜单栏模板图标：透明底 + 纯黑圆角方框 + 对勾（系统按菜单栏深浅自动着色）。"""
    scale = 16
    big = size * scale
    img = Image.new("RGBA", (big, big), CLEAR)
    draw = ImageDraw.Draw(img)
    stroke = max(2, round(big * 0.085))
    # 圆角方框：外轮廓留 stroke/2，避免描边被画布裁掉
    pad = stroke // 2
    radius = round(big * 0.27)
    draw.rounded_rectangle(
        [pad, pad, big - 1 - pad, big - 1 - pad], radius=radius, outline=TEMPLATE_INK, width=stroke
    )
    # 方框内对勾：三点折线，圆头
    points = [
        (round(big * 0.29), round(big * 0.52)),
        (round(big * 0.43), round(big * 0.66)),
        (round(big * 0.71), round(big * 0.36)),
    ]
    draw.line(points, fill=TEMPLATE_INK, width=stroke, joint="curve")
    r = stroke / 2
    for x, y in points:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=TEMPLATE_INK)
    return img.resize((size, size), Image.LANCZOS)


OUTPUT_NAMES = [
    "icon.ico",
    "icon.png",
    "tray.ico",
    "tray.png",
    "trayTemplate.png",
    "trayTemplate@2x.png",
]


def main() -> None:
    if "--check" in sys.argv[1:]:
        for name in OUTPUT_NAMES:
            print("would write", BUILD / name)
        return

    BUILD.mkdir(parents=True, exist_ok=True)
    app_images = [rounded_square(s) for s in APP_SIZES]
    app_images[-1].save(BUILD / "icon.ico", format="ICO", sizes=[(s, s) for s in APP_SIZES])
    mac_app_icon().save(BUILD / "icon.png", format="PNG")
    tray_images = [rounded_square(s, radius_ratio=0.3) for s in TRAY_SIZES]
    tray_images[-1].save(BUILD / "tray.ico", format="ICO", sizes=[(s, s) for s in TRAY_SIZES])
    tray_images[-1].save(BUILD / "tray.png", format="PNG")
    mac_tray_template(MAC_TRAY_SIZE).save(BUILD / "trayTemplate.png", format="PNG")
    mac_tray_template(MAC_TRAY_SIZE * 2).save(BUILD / "trayTemplate@2x.png", format="PNG")
    print("wrote", ", ".join(f"build/{name}" for name in OUTPUT_NAMES))


if __name__ == "__main__":
    main()
