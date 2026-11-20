import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

function detectInstalledTexliveRoot() {
  if (process.env.TEXLIVE_ROOT) {
    return path.resolve(process.env.TEXLIVE_ROOT)
  }
  try {
    const years = fs
      .readdirSync('/usr/local/texlive')
      .filter(name => /^\d{4}$/.test(name))
      .sort()
      .reverse()
    for (const year of years) {
      const candidate = path.join('/usr/local/texlive', year)
      if (fs.existsSync(path.join(candidate, 'tlpkg', 'texlive.tlpdb'))) {
        return candidate
      }
    }
    if (years.length > 0) {
      return path.join('/usr/local/texlive', years[0])
    }
  } catch {
    // fallback below
  }
  return '/usr/local/texlive/2026'
}

function detectTexliveArch(tlRoot) {
  if (process.env.TEXLIVE_ARCH) {
    return process.env.TEXLIVE_ARCH
  }
  const preferred = process.arch === 'arm64' ? 'aarch64-linux' : 'x86_64-linux'
  try {
    const binDir = path.join(tlRoot, 'bin')
    const entries = fs.readdirSync(binDir).filter(e => !e.startsWith('.'))
    if (entries.includes(preferred)) {
      return preferred
    }
    if (entries.length > 0) {
      return entries[0]
    }
  } catch {
    // fallback below
  }
  return preferred
}

export const TEXMFLOCAL = path.resolve(
  process.env.TEXMFLOCAL || '/usr/local/texlive/texmf-local'
)
export const TEXLIVE_ROOT = detectInstalledTexliveRoot()
export const TEXMFDIST = path.resolve(
  process.env.TEXMFDIST || path.join(TEXLIVE_ROOT, 'texmf-dist')
)
export const TEXLIVE_ARCH = detectTexliveArch(TEXLIVE_ROOT)
export const TLMGR_BIN = process.env.TLMGR_BIN || '/usr/local/bin/tlmgr'
export const MKTEXLSR_BIN = process.env.MKTEXLSR_BIN || '/usr/local/bin/mktexlsr'
export const KPSEWHICH_BIN = process.env.KPSEWHICH_BIN || '/usr/local/bin/kpsewhich'
export const PDFLATEX_BIN = process.env.PDFLATEX_BIN || '/usr/local/bin/pdflatex'

export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024 // 200 MB
export const PACKAGE_NAME_RE = /^[a-zA-Z0-9._-]+$/

/**
 * Core TeX Live and Overleaf packages that must never be removed via UI/API.
 */
export const PROTECTED_PACKAGES = new Set([
  'latex',
  'latex-base',
  'latex-bin',
  'amsmath',
  'amscls',
  'amsfonts',
  'hyperref',
  'graphics',
  'graphicx',
  'tools',
  'oberdiek',
  'etoolbox',
  'l3kernel',
  'l3packages',
  'l3backend',
  'pdftex',
  'xetex',
  'luatex',
  'kpathsea',
  'texlive.infra',
  'texlive.infra.x86_64-linux',
  'texlive.infra.aarch64-linux',
  `texlive.infra.${TEXLIVE_ARCH}`,
  'texlive-scripts',
  'scheme-basic',
  'collection-basic',
  'collection-latex',
  'cm',
  'lm',
  'ec',
  'babel',
  'geometry',
  'url',
  'xcolor',
])

export function validatePackageName(name) {
  if (typeof name !== 'string') return false
  if (name.length < 1 || name.length > 128) return false
  if (!PACKAGE_NAME_RE.test(name)) return false
  if (name === '.' || name === '..' || name.includes('..')) return false
  return true
}

export function isProtectedPackage(name) {
  if (!name || typeof name !== 'string') return false
  const lower = name.toLowerCase()
  if (PROTECTED_PACKAGES.has(lower) || PROTECTED_PACKAGES.has(name)) {
    return true
  }
  if (
    lower.startsWith('00texlive') ||
    lower.startsWith('collection-') ||
    lower.startsWith('scheme-')
  ) {
    return true
  }
  return false
}

export function isPathEqualOrInside(targetPath, baseDir) {
  const resolvedBase = path.resolve(baseDir)
  const resolvedTarget = path.resolve(targetPath)
  return (
    resolvedTarget === resolvedBase ||
    resolvedTarget.startsWith(resolvedBase + path.sep)
  )
}

/**
 * Safely resolve a target path under TEXMFLOCAL (or custom baseDir) and verify no symlink escape.
 */
export function resolveSafeTexmfPath(baseDir, ...segments) {
  const resolvedBase = path.resolve(baseDir)
  const cleanSegments = segments.map(s => String(s || ''))
  for (const seg of cleanSegments) {
    if (!seg || seg.includes('\0') || seg.includes('..')) {
      const err = new Error(`Unsafe path segment rejected: ${seg}`)
      err.statusCode = 400
      throw err
    }
  }
  const target = path.resolve(resolvedBase, ...cleanSegments)
  if (!isPathEqualOrInside(target, resolvedBase)) {
    const err = new Error(`Path traversal rejected: ${target}`)
    err.statusCode = 400
    throw err
  }
  // Check existing path components for symlinks escaping baseDir
  const rel = path.relative(resolvedBase, target)
  const parts = rel ? rel.split(path.sep) : []
  let current = resolvedBase
  for (const part of parts) {
    current = path.join(current, part)
    try {
      const st = fs.lstatSync(current)
      if (st.isSymbolicLink()) {
        const real = fs.realpathSync(current)
        if (!isPathEqualOrInside(real, resolvedBase)) {
          const err = new Error(`Symlink escape rejected: ${current}`)
          err.statusCode = 400
          throw err
        }
      }
    } catch (e) {
      if (e?.code === 'ENOENT') break
      if (e?.statusCode) throw e
    }
  }
  return target
}

/**
 * Execute a binary with argument arrays (never shell interpolation).
 */
export function runCommandSafe(binary, args = [], options = {}) {
  const {
    cwd,
    env,
    timeoutMs = 180000,
    onLine,
  } = options

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stdoutChunks = []
    const stderrChunks = []
    let timedOut = false
    let lineBuf = ''

    const flushLines = chunkStr => {
      if (!onLine) return
      lineBuf += chunkStr
      let idx
      while ((idx = lineBuf.indexOf('\n')) !== -1) {
        const line = lineBuf.slice(0, idx).replace(/\r/g, '').trimEnd()
        lineBuf = lineBuf.slice(idx + 1)
        if (line) onLine(line)
      }
    }

    child.stdout.on('data', chunk => {
      stdoutChunks.push(chunk)
      flushLines(chunk.toString('utf8'))
    })

    child.stderr.on('data', chunk => {
      stderrChunks.push(chunk)
      flushLines(chunk.toString('utf8'))
    })

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true
            child.kill('SIGTERM')
            setTimeout(() => child.kill('SIGKILL'), 2000).unref()
          }, timeoutMs)
        : null

    child.on('error', err => {
      if (timer) clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code, signal) => {
      if (timer) clearTimeout(timer)
      if (onLine && lineBuf.trim()) {
        onLine(lineBuf.trim())
      }
      resolve({
        code: code ?? -1,
        signal,
        timedOut,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      })
    })
  })
}

function validateArchiveEntryPath(entryName) {
  if (!entryName || typeof entryName !== 'string') {
    return 'Empty archive entry name'
  }
  const normalized = entryName.replace(/\\/g, '/')
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    return `Absolute path in archive rejected: ${entryName}`
  }
  const parts = normalized.split('/')
  if (parts.some(p => p === '..')) {
    return `Path traversal in archive rejected: ${entryName}`
  }
  if (entryName.includes('\0')) {
    return `Null byte in archive entry rejected`
  }
  return null
}

/**
 * Inspect an archive (zip or tar.gz/tgz) for path traversal, symlinks, and max size
 * BEFORE extracting into targetDir, then post-verify no symlinks exist.
 */
export async function inspectAndExtractArchive(
  archivePath,
  originalName,
  targetDir,
  maxBytes = MAX_ARCHIVE_BYTES
) {
  const lower = (originalName || path.basename(archivePath)).toLowerCase()
  const resolvedTarget = path.resolve(targetDir)
  await fsp.mkdir(resolvedTarget, { recursive: true, mode: 0o755 })

  if (lower.endsWith('.zip')) {
    const [namesRes, listRes] = await Promise.all([
      runCommandSafe('/usr/bin/unzip', ['-Z', '-1', archivePath], {
        timeoutMs: 30000,
      }),
      runCommandSafe('/usr/bin/unzip', ['-Z', '-l', archivePath], {
        timeoutMs: 30000,
      }),
    ])
    if (namesRes.code !== 0 || listRes.code !== 0) {
      const err = new Error(
        `Invalid zip archive: ${listRes.stderr || namesRes.stderr || listRes.stdout || namesRes.stdout}`
      )
      err.statusCode = 400
      throw err
    }

    for (const rawEntry of namesRes.stdout.split('\n')) {
      const entryName = rawEntry.replace(/\r$/, '')
      if (!entryName) continue
      const pathErr = validateArchiveEntryPath(entryName)
      if (pathErr) {
        const err = new Error(pathErr)
        err.statusCode = 400
        throw err
      }
    }

    let totalUncompressed = 0
    for (const line of listRes.stdout.split('\n')) {
      const m = line.match(/^\s*([ldcbps-][rwxstST-]{9})\s+\S+\s+\S+\s+(\d+)\s+/)
      if (!m) continue
      const perms = m[1]
      const size = Number(m[2] || 0)
      if (perms.startsWith('l')) {
        const err = new Error(`Symlink entry in zip archive rejected: ${line.trim()}`)
        err.statusCode = 400
        throw err
      }
      totalUncompressed += size
      if (totalUncompressed > maxBytes) {
        const err = new Error(
          `Archive uncompressed size (${totalUncompressed} bytes) exceeds limit (${maxBytes} bytes)`
        )
        err.statusCode = 413
        throw err
      }
    }

    const extractRes = await runCommandSafe(
      '/usr/bin/unzip',
      ['-q', '-o', archivePath, '-d', resolvedTarget],
      { timeoutMs: 60000 }
    )
    if (extractRes.code !== 0) {
      throw new Error(`Zip extraction failed: ${extractRes.stderr || extractRes.stdout}`)
    }
  } else if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    const listRes = await runCommandSafe('/usr/bin/tar', ['-ztvf', archivePath], {
      timeoutMs: 30000,
    })
    if (listRes.code !== 0) {
      const err = new Error(`Invalid tar.gz archive: ${listRes.stderr || listRes.stdout}`)
      err.statusCode = 400
      throw err
    }

    let totalUncompressed = 0
    for (const line of listRes.stdout.split('\n')) {
      if (!line.trim()) continue
      // tar -tvf format: perms owner/group size date time name...
      const m = line.match(/^\s*([ldcbphs-][rwxstST-]{9})\s+\S+\s+(\d+)\s+\S+\s+\S+\s+(.+)$/)
      if (!m) continue
      const perms = m[1]
      const size = Number(m[2] || 0)
      const rawName = m[3].split(' -> ')[0]
      if (perms.startsWith('l') || perms.startsWith('h')) {
        const err = new Error(`Symlink/hardlink entry in tar archive rejected: ${rawName}`)
        err.statusCode = 400
        throw err
      }
      const pathErr = validateArchiveEntryPath(rawName)
      if (pathErr) {
        const err = new Error(pathErr)
        err.statusCode = 400
        throw err
      }
      totalUncompressed += size
      if (totalUncompressed > maxBytes) {
        const err = new Error(
          `Archive uncompressed size (${totalUncompressed} bytes) exceeds limit (${maxBytes} bytes)`
        )
        err.statusCode = 413
        throw err
      }
    }

    const extractRes = await runCommandSafe(
      '/usr/bin/tar',
      ['-xzf', archivePath, '--no-same-owner', '--no-same-permissions', '-C', resolvedTarget],
      { timeoutMs: 60000 }
    )
    if (extractRes.code !== 0) {
      throw new Error(`tar.gz extraction failed: ${extractRes.stderr || extractRes.stdout}`)
    }
  } else {
    // Single file copy
    const st = await fsp.stat(archivePath)
    if (st.size > maxBytes) {
      const err = new Error(`File size exceeds limit (${maxBytes} bytes)`)
      err.statusCode = 413
      throw err
    }
    const base = path.basename(originalName || archivePath)
    const dest = resolveSafeTexmfPath(resolvedTarget, base)
    await fsp.copyFile(archivePath, dest)
  }

  // Post-extraction verification: walk targetDir and remove/reject any symlinks
  const collectedFiles = []
  async function walkAndVerify(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const lst = await fsp.lstat(fullPath)
      if (lst.isSymbolicLink()) {
        await fsp.rm(fullPath, { recursive: true, force: true })
        const err = new Error(`Post-extraction symlink rejected and removed: ${entry.name}`)
        err.statusCode = 400
        throw err
      }
      if (!isPathEqualOrInside(fullPath, resolvedTarget)) {
        const err = new Error(`Extracted path escaped target directory: ${fullPath}`)
        err.statusCode = 400
        throw err
      }
      if (lst.isDirectory()) {
        await walkAndVerify(fullPath)
      } else if (lst.isFile()) {
        collectedFiles.push(path.relative(resolvedTarget, fullPath))
      }
    }
  }
  await walkAndVerify(resolvedTarget)
  return collectedFiles
}

export async function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  const data = await fsp.readFile(filePath)
  hash.update(data)
  return hash.digest('hex')
}

export async function sha512File(filePath) {
  const hash = crypto.createHash('sha512')
  const data = await fsp.readFile(filePath)
  hash.update(data)
  return { hex: hash.digest('hex'), bytes: data.length }
}
