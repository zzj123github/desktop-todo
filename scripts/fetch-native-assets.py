"""下载 Electron 与 better-sqlite3 的原生二进制（本机网络对 GitHub release 直连不稳定时使用）。

背景：本机 Node/Python 可访问 npmmirror 的 binaries 镜像，但 github.com/releases 下载会
`ECONNRESET`；本脚本从镜像取与 package.json 版本匹配的 Electron 包和 better-sqlite3 的
electron-ABI 预编译 .node，解到 node_modules 下。仅在开发机初始化时运行一次；产物不入库。
镜像失败时会自动回退到 GitHub release 直链（CI 上通常直连可用）。

用法：
  <python> scripts/fetch-native-assets.py [--skip-electron] [--electron-version 40.10.2] [--abi 143]
"""
from __future__ import annotations

import argparse
import io
import tarfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIRROR_ELECTRON = "https://npmmirror.com/mirrors/electron/"
MIRROR_BETTER_SQLITE3 = "https://npmmirror.com/mirrors/better-sqlite3/"
USER_AGENT = {"User-Agent": "Mozilla/5.0 (desktop-todo bootstrap)"}


def download(url: str, fallback: str | None = None) -> bytes:
    try:
        request = urllib.request.Request(url, headers=USER_AGENT)
        with urllib.request.urlopen(request, timeout=180) as response:
            return response.read()
    except Exception as exc:  # 镜像不可用时回退 GitHub release 直链
        if fallback is None:
            raise
        print(f"  mirror failed: {exc}")
        print(f"  fallback {fallback}")
        return download(fallback)


def extract_zip_into(data: bytes, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        archive.extractall(target)


def extract_tar_into(data: bytes, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        archive.extractall(target)


def local_electron_cache(version: str) -> Path | None:
    cache_root = Path.home() / "AppData" / "Local" / "electron" / "Cache"
    if not cache_root.exists():
        return None
    name = f"electron-v{version}-win32-x64.zip"
    for candidate in cache_root.glob(f"*/{name}"):
        if candidate.is_file() and candidate.stat().st_size > 50 * 1024 * 1024:
            return candidate
    return None


def fetch_electron(version: str) -> None:
    target = ROOT / "node_modules" / ".pnpm" / f"electron@{version}" / "node_modules" / "electron"
    if not target.exists():
        raise SystemExit(f"electron package not found: {target}")
    cached = local_electron_cache(version)
    if cached is not None:
        print("use local cache", cached)
        data = cached.read_bytes()
    else:
        url = f"{MIRROR_ELECTRON}{version}/electron-v{version}-win32-x64.zip"
        fallback = f"https://github.com/electron/electron/releases/download/v{version}/electron-v{version}-win32-x64.zip"
        print("download", url)
        data = download(url, fallback)
    print(f"  {len(data) / 1024 / 1024:.1f} MB -> {target / 'dist'}")
    extract_zip_into(data, target / "dist")
    (target / "path.txt").write_text("electron.exe", encoding="utf-8")
    print("electron ready:", target / "dist" / "electron.exe")


def fetch_better_sqlite3(version: str, abi: int) -> None:
    target = ROOT / "node_modules" / ".pnpm" / f"better-sqlite3@{version}" / "node_modules" / "better-sqlite3"
    if not target.exists():
        raise SystemExit(f"better-sqlite3 package not found: {target}")
    asset = f"better-sqlite3-v{version}-electron-v{abi}-win32-x64.tar.gz"
    url = f"{MIRROR_BETTER_SQLITE3}v{version}/{asset}"
    fallback = f"https://github.com/WiseLibs/better-sqlite3/releases/download/v{version}/{asset}"
    print("download", url)
    data = download(url, fallback)
    print(f"  {len(data) / 1024:.0f} KB -> {target / 'build'}")
    extract_tar_into(data, target)
    print("better-sqlite3 ready:", target / "build" / "Release" / "better_sqlite3.node")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--electron-version", default="40.10.2")
    parser.add_argument("--better-sqlite3-version", default="12.11.1")
    parser.add_argument("--abi", default=143, type=int)
    parser.add_argument(
        "--skip-electron",
        action="store_true",
        help="只取 better-sqlite3 预编译 .node（CI 上 electron-builder 会自行下载 Electron）",
    )
    args = parser.parse_args()
    if not args.skip_electron:
        fetch_electron(args.electron_version)
    fetch_better_sqlite3(args.better_sqlite3_version, args.abi)


if __name__ == "__main__":
    main()
