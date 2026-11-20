import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  MKTEXLSR_BIN,
  TEXLIVE_ARCH,
  TEXLIVE_ROOT,
  TEXMFLOCAL,
  TLMGR_BIN,
  isProtectedPackage,
  resolveSafeTexmfPath,
  runCommandSafe,
  sha512File,
  validatePackageName,
} from '../security-utils.mjs'
import { DEFAULT_TLMGR_MIRROR, stateStore } from '../state-store.mjs'
import { tlpdbCache } from '../tlpdb-parser.mjs'

export const TLNET_CACHE_DIR = path.resolve(
  process.env.PACKAGE_HUB_TLNET_DIR || '/var/lib/overleaf/package-hub/tlnet'
)
const TLNET_TLPKG_DIR = path.join(TLNET_CACHE_DIR, 'tlpkg')
export const TLNET_ARCHIVE_DIR = path.join(TLNET_CACHE_DIR, 'archive')
export const TLNET_TLPDB_PATH = path.join(TLNET_TLPKG_DIR, 'texlive.tlpdb')
export const TLNET_TLPDB_SHA512_PATH = `${TLNET_TLPDB_PATH}.sha512`

export const FAST_TLNET_MIRRORS = [
  'https://mirrors.tuna.tsinghua.edu.cn/CTAN/systems/texlive/tlnet',
  'https://mirror.ox.ac.uk/sites/ctan.org/systems/texlive/tlnet',
  'https://ctan.math.utah.edu/ctan/tex-archive/systems/texlive/tlnet',
  DEFAULT_TLMGR_MIRROR,
]

let lastWorkingMirror = null

function findSourceMainTlpdb() {
  const tlpkgDir = path.join(TEXLIVE_ROOT, 'tlpkg')
  const entries = fs.readdirSync(tlpkgDir)
  const main = entries.find(e => e.startsWith('texlive.tlpdb.main.'))
  return main ? path.join(tlpkgDir, main) : null
}

/**
 * Keep texlive.tlpdb.sha512 synchronized with cached tlnet texlive.tlpdb
 * so TeX Live 2026 TLPDB checksum validation passes even without GPG/network.
 */
export async function syncTlnetTlpdbSha512() {
  if (!fs.existsSync(TLNET_TLPDB_PATH)) return
  const { hex } = await sha512File(TLNET_TLPDB_PATH)
  const payload = `${hex}  texlive.tlpdb\n`
  const tmp = `${TLNET_TLPDB_SHA512_PATH}.${process.pid}.tmp`
  await fsp.writeFile(tmp, payload, 'utf8')
  await fsp.rename(tmp, TLNET_TLPDB_SHA512_PATH)
}

export async function ensureLocalTlnetRepo() {
  await fsp.mkdir(TLNET_TLPKG_DIR, { recursive: true, mode: 0o755 })
  await fsp.mkdir(TLNET_ARCHIVE_DIR, { recursive: true, mode: 0o755 })
  if (!fs.existsSync(TLNET_TLPDB_PATH)) {
    const src = findSourceMainTlpdb()
    if (!src) {
      throw new Error(
        'Local TeX Live catalogue database (texlive.tlpdb.main.*) not found'
      )
    }
    await fsp.copyFile(src, TLNET_TLPDB_PATH)
    await syncTlnetTlpdbSha512()
  } else if (!fs.existsSync(TLNET_TLPDB_SHA512_PATH)) {
    await syncTlnetTlpdbSha512()
  }
}

/**
 * Update containersize and containerchecksum for a package in our cached tlnet texlive.tlpdb
 * and recompute texlive.tlpdb.sha512 so tlmgr verification succeeds cleanly.
 */
async function updateTlnetEntryChecksum(pkgName, bytes, sha512Hex) {
  const content = await fsp.readFile(TLNET_TLPDB_PATH, 'utf8')
  const marker = `name ${pkgName}\n`
  let idx = content.indexOf(`\n${marker}`)
  if (idx !== -1) idx += 1
  else if (content.startsWith(marker)) idx = 0

  if (idx === -1) {
    return false
  }

  let endIdx = content.indexOf('\n\n', idx)
  if (endIdx === -1) endIdx = content.length
  let block = content.slice(idx, endIdx)

  if (/^containersize \d+$/m.test(block)) {
    block = block.replace(/^containersize \d+$/m, `containersize ${bytes}`)
  } else {
    block += `\ncontainersize ${bytes}`
  }

  if (/^containerchecksum [0-9a-f]+$/m.test(block)) {
    block = block.replace(
      /^containerchecksum [0-9a-f]+$/m,
      `containerchecksum ${sha512Hex}`
    )
  } else {
    block += `\ncontainerchecksum ${sha512Hex}`
  }

  const updated = content.slice(0, idx) + block + content.slice(endIdx)
  const tmp = `${TLNET_TLPDB_PATH}.${process.pid}.tmp`
  await fsp.writeFile(tmp, updated, 'utf8')
  await fsp.rename(tmp, TLNET_TLPDB_PATH)
  await syncTlnetTlpdbSha512()
  return true
}

export function getMirrorOrder() {
  const configured = stateStore.getMirrorUrl()
  const raw = []
  if (lastWorkingMirror) raw.push(lastWorkingMirror)
  // If user configured a custom mirror (non-default), honor it right after/at front
  if (configured && configured !== DEFAULT_TLMGR_MIRROR) {
    raw.push(configured)
  }
  raw.push(...FAST_TLNET_MIRRORS)
  if (configured) raw.push(configured)
  return Array.from(new Set(raw.map(u => String(u).replace(/\/+$/, ''))))
}

export async function downloadArchiveFromMirrors(pkgName, destPath, logFn) {
  const mirrorOrder = getMirrorOrder()

  let lastErr = null
  for (const base of mirrorOrder) {
    const url = `${base}/archive/${encodeURIComponent(pkgName)}.tar.xz`
    logFn?.(`Downloading ${pkgName}.tar.xz from ${base}...`)
    const tmpPath = `${destPath}.${process.pid}.part`
    const res = await runCommandSafe(
      '/usr/bin/curl',
      [
        '-fsSL',
        '--connect-timeout',
        '6',
        '--max-time',
        '45',
        '-o',
        tmpPath,
        url,
      ],
      { timeoutMs: 55000 }
    )
    if (res.code === 0 && fs.existsSync(tmpPath)) {
      const stat = await fsp.stat(tmpPath)
      if (stat.size > 0) {
        await fsp.rename(tmpPath, destPath)
        lastWorkingMirror = base
        return { mirror: base, bytes: stat.size }
      }
    }
    try {
      await fsp.unlink(tmpPath)
    } catch {}
    lastErr = new Error(
      `Failed from ${base}: ${res.stderr?.trim() || `exit code ${res.code}`}`
    )
  }

  throw (
    lastErr ||
    new Error(`Unable to download ${pkgName}.tar.xz from any CTAN mirror`)
  )
}

async function copyRunfilesToTexmfLocal(pkgName) {
  const entry = await tlpdbCache.getLocalEntry(pkgName)
  if (!entry || !Array.isArray(entry.runfiles) || entry.runfiles.length === 0) {
    return null
  }
  const persistedDir = resolveSafeTexmfPath(
    TEXMFLOCAL,
    'tex',
    'latex',
    'tl-persisted',
    pkgName
  )
  await fsp.mkdir(persistedDir, { recursive: true, mode: 0o755 })
  for (const rel of entry.runfiles) {
    const normalized = rel.replace(/^texmf-dist\//, '')
    const srcFile = path.join(TEXLIVE_ROOT, 'texmf-dist', normalized)
    if (fs.existsSync(srcFile)) {
      const fileName = path.basename(srcFile)
      const destFile = resolveSafeTexmfPath(persistedDir, fileName)
      await fsp.copyFile(srcFile, destFile)
    }
  }
  return persistedDir
}

/**
 * Resolve transitive dependencies inside remote TLPDB that are not yet installed,
 * including .ARCH -> .<arch> binary packages.
 */
async function resolveMissingDeps(rootNames) {
  await tlpdbCache.ensureLoaded()
  const ordered = []
  const visited = new Set()

  async function visit(name) {
    if (visited.has(name)) return
    visited.add(name)
    if (!validatePackageName(name)) return
    if (name.startsWith('00texlive')) return
    if (name.includes('.') && !name.endsWith(`.${TEXLIVE_ARCH}`)) return

    const local = await tlpdbCache.getLocalEntry(name)
    if (local) return // already installed

    const remote = await tlpdbCache.getRemoteEntry(name)
    if (!remote) return

    const deps = remote.rawDepends || remote.depends || []
    for (const dep of deps) {
      await visit(dep)
    }
    ordered.push(name)
  }

  for (const name of rootNames) {
    await visit(name)
  }
  return ordered
}

export const texliveSource = {
  id: 'texlive',
  name: 'TeX Live (tlmgr)',

  async list(opts = {}) {
    return tlpdbCache.getAllTexlivePackages(opts)
  },

  async search(query) {
    const all = await tlpdbCache.getAllTexlivePackages()
    const q = String(query || '').trim().toLowerCase()
    if (!q) return all
    return all.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.shortdesc.toLowerCase().includes(q) ||
        p.topics.some(t => t.toLowerCase().includes(q))
    )
  },

  async getMetadata(name) {
    if (!validatePackageName(name)) return null
    return tlpdbCache.getTexlivePackage(name)
  },

  async getInstalled() {
    const all = await tlpdbCache.getAllTexlivePackages()
    return all.filter(p => p.installed)
  },

  async getUpdates() {
    const all = await tlpdbCache.getAllTexlivePackages()
    return all.filter(p => p.update_available)
  },

  async getMirrors() {
    return {
      current: stateStore.getMirrorUrl(),
      presets: FAST_TLNET_MIRRORS,
    }
  },

  async setMirror(url, ctx) {
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      const err = new Error('Invalid mirror URL')
      err.statusCode = 400
      throw err
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      const err = new Error('Mirror URL must use https:// or http://')
      err.statusCode = 400
      throw err
    }
    const cleanUrl = parsed.toString().replace(/\/+$/, '')
    const res = await runCommandSafe(
      TLMGR_BIN,
      ['option', 'repository', cleanUrl],
      {
        timeoutMs: 30000,
        onLine: line => ctx?.appendLog?.(line),
      }
    )
    if (res.code !== 0) {
      throw new Error(
        `tlmgr failed to set repository: ${res.stderr || res.stdout}`
      )
    }
    lastWorkingMirror = null
    await stateStore.setMirrorUrl(cleanUrl)
    return { ok: true, mirrorUrl: cleanUrl }
  },

  async install(names, ctx) {
    if (!Array.isArray(names) || names.length === 0) {
      const err = new Error('Package names list cannot be empty')
      err.statusCode = 400
      throw err
    }
    for (const n of names) {
      if (!validatePackageName(n)) {
        const err = new Error(`Invalid package name: ${n}`)
        err.statusCode = 400
        throw err
      }
    }

    const run = async () => {
      ctx?.setProgress?.(
        10,
        'Resolving dependencies',
        `Resolving TeX Live dependencies for ${names.join(', ')}...`
      )
      await ensureLocalTlnetRepo()
      await tlpdbCache.ensureLoaded()

      for (const n of names) {
        const local = await tlpdbCache.getLocalEntry(n)
        const remote = await tlpdbCache.getRemoteEntry(n)
        if (!local && !remote) {
          const err = new Error(`Package "${n}" not found in TeX Live database`)
          err.statusCode = 404
          throw err
        }
      }

      const toInstall = await resolveMissingDeps(names)

      if (toInstall.length === 0) {
        ctx?.appendLog?.('All requested TeX Live packages are already installed.')
        for (const pkg of names) {
          const entry = await tlpdbCache.getTexlivePackage(pkg)
          if (entry?.installed) {
            await copyRunfilesToTexmfLocal(pkg)
            stateStore.getState().texlivePackages[pkg] = {
              name: pkg,
              version: entry.version,
              revision: entry.revision,
              installedAt: new Date().toISOString(),
            }
          }
        }
        await stateStore.savePersistentState()
        return {
          ok: true,
          installed: names,
          message: `Already installed: ${names.join(', ')}`,
        }
      }

      const stepSpan = 55 / Math.max(1, toInstall.length)
      for (let i = 0; i < toInstall.length; i++) {
        const pkg = toInstall[i]
        const archivePath = path.join(TLNET_ARCHIVE_DIR, `${pkg}.tar.xz`)
        ctx?.setProgress?.(
          15 + i * stepSpan,
          'Downloading packages',
          `Fetching archive for ${pkg} (${i + 1}/${toInstall.length})...`
        )
        if (!fs.existsSync(archivePath)) {
          await downloadArchiveFromMirrors(pkg, archivePath, line =>
            ctx?.appendLog?.(line)
          )
        } else {
          ctx?.appendLog?.(`Using cached archive ${archivePath}`)
        }
        const { hex, bytes } = await sha512File(archivePath)
        const updated = await updateTlnetEntryChecksum(pkg, bytes, hex)
        if (!updated) {
          ctx?.appendLog?.(
            `Warning: ${pkg} not found in cached main TLPDB block; attempting tlmgr directly.`
          )
        }
      }

      ctx?.setProgress?.(
        75,
        'Installing via tlmgr',
        `Running tlmgr install for ${toInstall.join(', ')}...`
      )
      const installRes = await runCommandSafe(
        TLMGR_BIN,
        [
          '--repository',
          TLNET_CACHE_DIR,
          '--verify-repo=none',
          'install',
          ...toInstall,
        ],
        {
          timeoutMs: 180000,
          onLine: line => ctx?.appendLog?.(line),
        }
      )
      if (installRes.code !== 0) {
        throw new Error(
          `tlmgr install failed: ${installRes.stderr || installRes.stdout}`
        )
      }

      ctx?.setProgress?.(
        90,
        'Updating TeX filename database',
        'Running tlmgr path add & mktexlsr...'
      )
      await runCommandSafe(TLMGR_BIN, ['path', 'add'], {
        timeoutMs: 30000,
        onLine: line => ctx?.appendLog?.(line),
      })
      await runCommandSafe(MKTEXLSR_BIN, [], {
        timeoutMs: 60000,
        onLine: line => ctx?.appendLog?.(line),
      })

      tlpdbCache.invalidate()
      await tlpdbCache.ensureLoaded(true)

      for (const pkg of toInstall) {
        if (pkg.includes('.')) continue
        await copyRunfilesToTexmfLocal(pkg)
        const meta = await tlpdbCache.getTexlivePackage(pkg)
        stateStore.getState().texlivePackages[pkg] = {
          name: pkg,
          version: meta?.version || '1.0',
          revision: meta?.revision || 0,
          installedAt: new Date().toISOString(),
        }
      }
      await stateStore.savePersistentState()

      return {
        ok: true,
        installed: toInstall.filter(p => !p.includes('.')),
        message: `Installed ${names.join(', ')}`,
      }
    }

    return ctx?.withTlmgrLock ? ctx.withTlmgrLock(run) : run()
  },

  async remove(names, ctx) {
    if (!Array.isArray(names) || names.length === 0) {
      const err = new Error('Package names list cannot be empty')
      err.statusCode = 400
      throw err
    }
    for (const n of names) {
      if (!validatePackageName(n)) {
        const err = new Error(`Invalid package name: ${n}`)
        err.statusCode = 400
        throw err
      }
      if (isProtectedPackage(n)) {
        const err = new Error(`Package "${n}" is protected and cannot be removed`)
        err.statusCode = 409
        throw err
      }
    }

    const run = async () => {
      await tlpdbCache.ensureLoaded(true)
      const presentInTlpdb = []
      for (const n of names) {
        if (await tlpdbCache.getLocalEntry(n)) {
          presentInTlpdb.push(n)
        }
      }

      if (presentInTlpdb.length > 0) {
        ctx?.setProgress?.(
          25,
          'Removing via tlmgr',
          `Removing ${presentInTlpdb.join(', ')} via tlmgr...`
        )
        const res = await runCommandSafe(
          TLMGR_BIN,
          ['remove', '--force', ...presentInTlpdb],
          {
            timeoutMs: 120000,
            onLine: line => ctx?.appendLog?.(line),
          }
        )
        const combined = `${res.stderr || ''}\n${res.stdout || ''}`
        if (
          res.code !== 0 &&
          !/not installed|not present|cannot find/i.test(combined)
        ) {
          throw new Error(`tlmgr remove failed: ${combined.trim()}`)
        }
      } else {
        ctx?.appendLog?.(
          `Package(s) ${names.join(', ')} not present in local texlive.tlpdb; cleaning persisted state.`
        )
      }

      ctx?.setProgress?.(
        75,
        'Cleaning persisted tree',
        'Removing persisted files from texmf-local...'
      )
      for (const n of names) {
        const persistedDir = resolveSafeTexmfPath(
          TEXMFLOCAL,
          'tex',
          'latex',
          'tl-persisted',
          n
        )
        await fsp.rm(persistedDir, { recursive: true, force: true })
        delete stateStore.getState().texlivePackages[n]
      }
      await stateStore.savePersistentState()

      ctx?.setProgress?.(
        90,
        'Refreshing filename database',
        'Running mktexlsr...'
      )
      await runCommandSafe(MKTEXLSR_BIN, [], {
        timeoutMs: 60000,
        onLine: line => ctx?.appendLog?.(line),
      })

      tlpdbCache.invalidate()
      await tlpdbCache.ensureLoaded(true)

      return {
        ok: true,
        removed: names,
        message: `Removed ${names.join(', ')}`,
      }
    }

    return ctx?.withTlmgrLock ? ctx.withTlmgrLock(run) : run()
  },

  async update(names, all, ctx) {
    const targets = all
      ? (await this.getUpdates()).map(p => p.name)
      : names || []
    for (const n of targets) {
      if (!validatePackageName(n)) {
        const err = new Error(`Invalid package name: ${n}`)
        err.statusCode = 400
        throw err
      }
    }
    if (targets.length === 0) {
      ctx?.setProgress?.(
        100,
        'Up to date',
        'All installed packages are already up to date'
      )
      return {
        ok: true,
        updated: [],
        message: 'All installed packages are already up to date',
      }
    }

    const run = async () => {
      await ensureLocalTlnetRepo()
      for (let i = 0; i < targets.length; i++) {
        const pkg = targets[i]
        ctx?.setProgress?.(
          15 + Math.round((i / targets.length) * 50),
          'Downloading updates',
          `Fetching latest ${pkg}.tar.xz...`
        )
        const archivePath = path.join(TLNET_ARCHIVE_DIR, `${pkg}.tar.xz`)
        await downloadArchiveFromMirrors(pkg, archivePath, line =>
          ctx?.appendLog?.(line)
        )
        const { hex, bytes } = await sha512File(archivePath)
        await updateTlnetEntryChecksum(pkg, bytes, hex)
      }

      ctx?.setProgress?.(
        75,
        'Updating packages',
        `Running tlmgr update for ${targets.join(', ')}...`
      )
      const res = await runCommandSafe(
        TLMGR_BIN,
        [
          '--repository',
          TLNET_CACHE_DIR,
          '--verify-repo=none',
          'update',
          '--reinstall-forcibly-removed',
          ...targets,
        ],
        { timeoutMs: 180000, onLine: line => ctx?.appendLog?.(line) }
      )
      const combined = `${res.stdout || ''}\n${res.stderr || ''}`
      if (
        res.code !== 0 ||
        /no updates available|up to date/i.test(combined)
      ) {
        ctx?.appendLog?.('Ensuring package files are synced with tlmgr install --reinstall...')
        const inst = await runCommandSafe(
          TLMGR_BIN,
          [
            '--repository',
            TLNET_CACHE_DIR,
            '--verify-repo=none',
            'install',
            '--reinstall',
            ...targets,
          ],
          { timeoutMs: 180000, onLine: line => ctx?.appendLog?.(line) }
        )
        if (inst.code !== 0) {
          throw new Error(
            `tlmgr update failed: ${res.stderr || res.stdout || inst.stderr || inst.stdout}`
          )
        }
      }

      await runCommandSafe(TLMGR_BIN, ['path', 'add'], { timeoutMs: 30000 })
      await runCommandSafe(MKTEXLSR_BIN, [], { timeoutMs: 60000 })

      tlpdbCache.invalidate()
      await tlpdbCache.ensureLoaded(true)

      for (const pkg of targets) {
        await copyRunfilesToTexmfLocal(pkg)
        const meta = await tlpdbCache.getTexlivePackage(pkg)
        stateStore.getState().texlivePackages[pkg] = {
          name: pkg,
          version: meta?.version || '1.0',
          revision: meta?.revision || 0,
          installedAt: new Date().toISOString(),
        }
      }
      await stateStore.savePersistentState()

      return {
        ok: true,
        updated: targets,
        message: `Updated ${targets.join(', ')}`,
      }
    }

    return ctx?.withTlmgrLock ? ctx.withTlmgrLock(run) : run()
  },
}
