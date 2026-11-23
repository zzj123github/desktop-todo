"""下载 Electron 与 better-sqlite3 的原生二进制（本机/CI 网络对 GitHub release 直连不稳定时使用）。

背景：Electron 的 postinstall 与 better-sqlite3 的 prebuild 默认走 GitHub release，网络受限时
会 `ECONNRESET` / 长时间挂起；本脚本从 npmmirror 镜像取与 package.json 版本匹配的
Electron 包和 better-sqlite3 的 electron-ABI 预编译 .node，解到 node_modules 下。
产物不入库。

平台：
- Windows（win32-x64）：Electron 解到 `node_modules/.pnpm/electron@x/node_modules/electron/dist`
  并写 `path.txt=electron.exe`；better-sqlite3 解到其包目录（沿用 M6 交付流程）。
- macOS（darwin-arm64）：Electron zip 解包时保留 `Electron.app` 内的符号链接
  （zipfile 默认会把符号链接写成普通文件，这里手动处理）；better-sqlite3 解到包目录。
  macOS 版本只支持 Apple 芯片（arm64），打包入口 scripts/dist-mac.cjs 固定取 arm64；
  `--arch` 参数仍保留，便于其他平台或实验场景指定架构（Intel 芯片 Mac 不在支持范围）。

用法：
  <python> scripts/fetch-native-assets.py                  # 取当前平台/架构的 Electron + better-sqlite3
  <python> scripts/fetch-native-assets.py --skip-electron  # 只取 better-sqlite3 预编译 .node（CI 用）
  <python> scripts/fetch-native-assets.py --arch arm64       # 指定架构（macOS 只用 arm64）
  <python> scripts/fetch-native-assets.py --local <file>   # 离线：从本地 tar.gz 安装 better-sqlite3
Python 3.8+；镜像失败自动回退 GitHub release 直链；两者都不可用时回退系统 curl 下载。
"""
from __future__ import annotations

import argparse
import io
import os
import platform
import stat
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIRROR_ELECTRON = "https://npmmirror.com/mirrors/electron/"
MIRROR_BETTER_SQLITE3 = "https://npmmirror.com/mirrors/better-sqlite3/"
USER_AGENT = {"User-Agent": "Mozilla/5.0 (desktop-todo bootstrap)"}

ELECTRON_PACKAGE = "node_modules/.pnpm/electron@{version}/node_modules/electron"
BETTER_SQLITE3_PACKAGE = (
    "node_modules/.pnpm/better-sqlite3@{version}/node_modules/better-sqlite3"
)


def default_arch() -> str:
    machine = platform.machine().lower()
    if machine in ("arm64", "aarch64"):
        return "arm64"
    if machine in ("x86_64", "amd64", "x64"):
        return "x64"
    raise SystemExit(f"不支持的 CPU 架构：{machine}")


def platform_key() -> str:
    if sys.platform.startswith("win"):
        return "win32"
    if sys.platform == "darwin":
        return "darwin"
    if sys.platform.startswith("linux"):
        return "linux"
    raise SystemExit(f"不支持的平台：{sys.platform}")


def curl_download(url: str) -> bytes:
    """urllib 的 SSL/网络受限时回退系统 curl（Windows 10+ 与 macOS 都自带）。"""
    result = subprocess.run(
        ["curl", "-sSL", "--max-time", "600", url],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0 or not result.stdout:
        raise RuntimeError(
            f"curl 下载失败（{url}）：{result.stderr.decode('utf-8', 'replace')[:500]}"
        )
    return result.stdout


def download(url: str, fallback: str | None = None) -> bytes:
    """按 urllib → curl（同 URL）→ 回退地址（urllib → curl）的顺序下载。

    本机 Python 可能缺 CA 证书（SSL: CERTIFICATE_VERIFY_FAILED），但系统 curl 正常；
    因此镜像 URL 失败时先用 curl 重试同一地址，再考虑 GitHub release 直链，
    避免在直连 GitHub 很慢的环境里卡住。
    """
    try:
        request = urllib.request.Request(url, headers=USER_AGENT)
        with urllib.request.urlopen(request, timeout=180) as response:
            return response.read()
    except Exception as exc:
        print(f"  download failed: {exc}")
        print("  retry with curl")
        try:
            return curl_download(url)
        except Exception as curl_exc:
            print(f"  curl failed: {curl_exc}")
        if fallback is not None:
            print(f"  fallback {fallback}")
            return download(fallback)
        raise


def extract_zip_into(data: bytes, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for info in archive.infolist():
            mode = info.external_attr >> 16
            destination = target / info.filename
            if stat.S_ISLNK(mode):
                # Electron.app/Frameworks 里有符号链接（Versions/Current 等），
                # zipfile 默认会把链接内容写成普通文件，导致 .app 无法启动
                destination.parent.mkdir(parents=True, exist_ok=True)
                if destination.is_symlink() or destination.exists():
                    destination.unlink()
                os.symlink(archive.read(info).decode("utf-8"), destination)
                continue
            archive.extract(info, target)
            # zipfile 不保留 Unix 权限位：Electron 可执行文件丢了 +x 会导致
            # macOS 启动报「Permission denied」，这里按 zip 记录的 mode 还原
            if stat.S_IMODE(mode):
                os.chmod(destination, stat.S_IMODE(mode))


def extract_tar_into(data: bytes, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        archive.extractall(target)


def local_electron_cache(version: str, arch: str) -> Path | None:
    """Windows：沿用本机 Electron 缓存（%LOCALAPPDATA%/electron/Cache）。"""
    cache_root = Path.home() / "AppData" / "Local" / "electron" / "Cache"
    if not cache_root.exists():
        return None
    name = f"electron-v{version}-win32-{arch}.zip"
    for candidate in cache_root.glob(f"*/{name}"):
        if candidate.is_file() and candidate.stat().st_size > 50 * 1024 * 1024:
            return candidate
    return None


def fetch_electron(version: str, pkey: str, arch: str) -> None:
    target = ROOT / ELECTRON_PACKAGE.format(version=version)
    if not target.exists():
        raise SystemExit(f"electron package not found: {target}")
    asset = f"electron-v{version}-{pkey}-{arch}.zip"
    cached = local_electron_cache(version, arch) if pkey == "win32" else None
    if cached is not None:
        print("use local cache", cached)
        data = cached.read_bytes()
    else:
        url = f"{MIRROR_ELECTRON}{version}/{asset}"
        fallback = f"https://github.com/electron/electron/releases/download/v{version}/{asset}"
        print("download", url)
        data = download(url, fallback)
    print(f"  {len(data) / 1024 / 1024:.1f} MB -> {target / 'dist'}")
    extract_zip_into(data, target / "dist")
    if pkey == "darwin":
        (target / "path.txt").write_text(
            "Electron.app/Contents/MacOS/Electron", encoding="utf-8"
        )
        print("electron ready:", target / "dist" / "Electron.app")
    elif pkey == "win32":
        (target / "path.txt").write_text("electron.exe", encoding="utf-8")
        print("electron ready:", target / "dist" / "electron.exe")
    else:
        (target / "path.txt").write_text("electron", encoding="utf-8")
        print("electron ready:", target / "dist" / "electron")


def better_sqlite3_target(version: str) -> Path:
    target = ROOT / BETTER_SQLITE3_PACKAGE.format(version=version)
    if not target.exists():
        raise SystemExit(f"better-sqlite3 package not found: {target}")
    return target


def install_better_sqlite3_archive(data: bytes, target: Path) -> None:
    print(f"  {len(data) / 1024:.0f} KB -> {target / 'build'}")
    extract_tar_into(data, target)
    print("better-sqlite3 ready:", target / "build" / "Release" / "better_sqlite3.node")


def fetch_better_sqlite3(version: str, abi: int, pkey: str, arch: str) -> None:
    target = better_sqlite3_target(version)
    asset = f"better-sqlite3-v{version}-electron-v{abi}-{pkey}-{arch}.tar.gz"
    url = f"{MIRROR_BETTER_SQLITE3}v{version}/{asset}"
    fallback = f"https://github.com/WiseLibs/better-sqlite3/releases/download/v{version}/{asset}"
    print("download", url)
    install_better_sqlite3_archive(download(url, fallback), target)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--electron-version", default="40.10.2")
    parser.add_argument("--better-sqlite3-version", default="12.11.1")
    parser.add_argument("--abi", default=143, type=int)
    parser.add_argument(
        "--arch", default=None, help="arm64 / x64（默认跟随当前机器；macOS 打包只用 arm64）"
    )
    parser.add_argument(
        "--skip-electron",
        action="store_true",
        help="只取 better-sqlite3 预编译 .node（CI 上 electron-builder 会自行下载 Electron）",
    )
    parser.add_argument(
        "--local",
        default=None,
        help="离线安装 better-sqlite3：直接读取本地 electron-ABI tar.gz（不再联网）",
    )
    args = parser.parse_args()
    pkey = platform_key()
    arch = args.arch or default_arch()
    print(f"platform={pkey} arch={arch} electron={args.electron_version} abi={args.abi}")
    if args.local:
        target = better_sqlite3_target(args.better_sqlite3_version)
        install_better_sqlite3_archive(Path(args.local).read_bytes(), target)
        return
    if not args.skip_electron:
        fetch_electron(args.electron_version, pkey, arch)
    fetch_better_sqlite3(args.better_sqlite3_version, args.abi, pkey, arch)


if __name__ == "__main__":
    main()
