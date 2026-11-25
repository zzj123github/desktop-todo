/**
 * 安装包版本与旧产物清理（mac / win 打包共用）。
 *
 * 约定（用户 2026-11-24）：每打一版新安装包，package.json 末位版本号 +1，
 * 成功出包后删除 release/ 里不等于当前版本的旧 DesktopTodo 安装包及其 .blockmap。
 *
 *   bumpPatchVersion() → '1.0.1'
 *   cleanOldReleaseArtifacts('1.0.1') → 删掉 DesktopTodo-1.0.0-* 等
 */
const fs = require('node:fs')
const path = require('node:path')
const { root } = require('./electron-runtime.cjs')

const PKG_PATH = path.join(root, 'package.json')
const RELEASE_DIR = path.join(root, 'release')

/** 匹配 electron-builder 产物名：DesktopTodo-<semver>-….dmg|.exe|.blockmap */
const ARTIFACT_RE = /^DesktopTodo-(\d+\.\d+\.\d+)-.+\.(dmg|exe|blockmap)$/

function readPackage() {
  return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'))
}

function writePackage(pkg) {
  // 保持与仓库一致的 2 空格缩进 + 末尾换行，避免无意义 diff
  fs.writeFileSync(PKG_PATH, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

/**
 * package.json 的 patch（末位）+1。例：1.0.0 → 1.0.1。
 * @returns {string} 新版本号
 */
function bumpPatchVersion() {
  const pkg = readPackage()
  const parts = String(pkg.version || '').split('.')
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
    throw new Error(`package.json version 不是 x.y.z：${pkg.version}`)
  }
  const next = `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`
  const prev = pkg.version
  pkg.version = next
  writePackage(pkg)
  console.log(`[release-version] ${prev} → ${next}（package.json patch +1）`)
  return next
}

function currentVersion() {
  return readPackage().version
}

/**
 * 删除 release/ 中版本号 ≠ keepVersion 的 DesktopTodo 安装包与 blockmap。
 * 不解包目录、latest-*.yml、builder-debug.yml 不动（会被下次构建覆盖）。
 * @returns {string[]} 已删除的相对路径
 */
function cleanOldReleaseArtifacts(keepVersion) {
  if (!fs.existsSync(RELEASE_DIR)) return []
  const removed = []
  for (const name of fs.readdirSync(RELEASE_DIR)) {
    const m = ARTIFACT_RE.exec(name)
    if (!m) continue
    if (m[1] === keepVersion) continue
    const full = path.join(RELEASE_DIR, name)
    fs.unlinkSync(full)
    removed.push(path.relative(root, full))
  }
  if (removed.length) {
    console.log(`[release-version] 已删除旧包：\n  - ${removed.join('\n  - ')}`)
  } else {
    console.log('[release-version] 无旧版 DesktopTodo 安装包可删')
  }
  return removed
}

module.exports = {
  bumpPatchVersion,
  cleanOldReleaseArtifacts,
  currentVersion,
  RELEASE_DIR,
  ARTIFACT_RE
}
