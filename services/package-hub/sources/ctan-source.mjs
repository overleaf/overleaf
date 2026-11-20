import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { STATE_DIR } from '../job-queue.mjs'
import {
  MAX_ARCHIVE_BYTES,
  MKTEXLSR_BIN,
  PDFLATEX_BIN,
  TEXMFLOCAL,
  inspectAndExtractArchive,
  isPathEqualOrInside,
  isProtectedPackage,
  resolveSafeTexmfPath,
  runCommandSafe,
  sha256File,
  validatePackageName,
} from '../security-utils.mjs'
import { stateStore } from '../state-store.mjs'
import { downloadArchiveFromMirrors } from './texlive-source.mjs'

const CTAN_CACHE_FILE = path.join(STATE_DIR, 'ctan-cache.json')
const CTAN_API_BASE = 'https://ctan.org/json/2.0'
const CTAN_DIRECT_MIRRORS = [
  'https://mirrors.tuna.tsinghua.edu.cn/CTAN',
  'https://mirror.ox.ac.uk/sites/ctan.org',
  'https://ctan.math.utah.edu/ctan/tex-archive',
  'https://mirrors.ctan.org',
]

let lastWorkingCtanMirror = null

// Highlighted CTAN entries cached immediately for browsing while live lookup fetches any package from ctan.org
const SEED_CTAN_PACKAGES = [
  {
    name: 'moderncv',
    version: '2.4.1',
    shortdesc: 'A modern curriculum vitae class',
    author: 'Xavier Danaux',
    license: 'lppl1.3c',
    ctanPath: '/macros/latex/contrib/moderncv',
    homepage: 'https://ctan.org/pkg/moderncv',
    topics: ['cv', 'class'],
    size_kb: 420,
  },
  {
    name: 'tcolorbox',
    version: '6.3.0',
    shortdesc: 'Coloured boxes, for LaTeX examples and theorems, etc.',
    author: 'Thomas F. Sturm',
    license: 'lppl1.3c',
    ctanPath: '/macros/latex/contrib/tcolorbox',
    homepage: 'https://ctan.org/pkg/tcolorbox',
    topics: ['box', 'theorem', 'colour'],
    size_kb: 1850,
  },
  {
    name: 'tikz-cd',
    version: '1.0',
    shortdesc: 'Create commutative diagrams with TikZ',
    author: 'Augusto Stoffel',
    license: 'gpl3',
    ctanPath: '/graphics/pgf/contrib/tikz-cd',
    homepage: 'https://ctan.org/pkg/tikz-cd',
    topics: ['diagram', 'pgf-tikz', 'commut-diag'],
    size_kb: 140,
  },
  {
    name: 'minted',
    version: '3.2.0',
    shortdesc: 'Highlighted source code for LaTeX',
    author: 'Geoffrey M. Poore',
    license: 'lppl1.3c',
    ctanPath: '/macros/latex/contrib/minted',
    homepage: 'https://ctan.org/pkg/minted',
    topics: ['code-listing', 'syntax-highlighting'],
    size_kb: 310,
  },
  {
    name: 'cleveref',
    version: '0.21.4',
    shortdesc: 'Intelligent cross-referencing',
    author: 'Toby Cubitt',
    license: 'lppl',
    ctanPath: '/macros/latex/contrib/cleveref',
    homepage: 'https://ctan.org/pkg/cleveref',
    topics: ['cross-ref'],
    size_kb: 85,
  },
  {
    name: 'algpseudocode',
    version: '1.2',
    shortdesc: 'Layout for algorithmicx pseudocode',
    author: 'Szász János',
    license: 'lppl',
    ctanPath: '/macros/latex/contrib/algorithmicx',
    homepage: 'https://ctan.org/pkg/algorithmicx',
    topics: ['algorithms'],
    size_kb: 64,
  },
  {
    name: 'tabularray',
    version: '2024A',
    shortdesc: 'Typeset tabulars and arrays with LaTeX3',
    author: 'Jianrui Lyu',
    license: 'lppl1.3c',
    ctanPath: '/macros/latex/contrib/tabularray',
    homepage: 'https://ctan.org/pkg/tabularray',
    topics: ['tables'],
    size_kb: 245,
  },
  {
    name: 'siunitx',
    version: '3.3.19',
    shortdesc: 'A comprehensive (SI) units package',
    author: 'Joseph Wright',
    license: 'lppl1.3c',
    ctanPath: '/macros/latex/contrib/siunitx',
    homepage: 'https://ctan.org/pkg/siunitx',
    topics: ['units', 'numbers', 'tables'],
    size_kb: 520,
  },
]

function stripXmlTags(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function collectDirFiles(dir, baseDir = dir) {
  const out = []
  let entries = []
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) {
      out.push(...(await collectDirFiles(full, baseDir)))
    } else if (entry.isFile()) {
      out.push(path.relative(baseDir, full))
    }
  }
  return out
}

class CtanCache {
  constructor() {
    this.map = new Map()
    this.loaded = false
  }

  async init() {
    if (this.loaded) return
    for (const item of SEED_CTAN_PACKAGES) {
      this.map.set(item.name, item)
    }
    try {
      const raw = await fsp.readFile(CTAN_CACHE_FILE, 'utf8')
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item?.name) this.map.set(item.name, item)
        }
      }
    } catch {}
    this.loaded = true
  }

  async save() {
    try {
      await fsp.mkdir(STATE_DIR, { recursive: true, mode: 0o755 })
      const tmp = `${CTAN_CACHE_FILE}.${process.pid}.tmp`
      await fsp.writeFile(
        tmp,
        JSON.stringify(Array.from(this.map.values()), null, 2),
        'utf8'
      )
      await fsp.rename(tmp, CTAN_CACHE_FILE)
    } catch {}
  }
}

const ctanCache = new CtanCache()

async function fetchCtanPackageJson(name) {
  if (!validatePackageName(name)) return null
  const url = `${CTAN_API_BASE}/pkg/${encodeURIComponent(name)}`
  const res = await runCommandSafe(
    '/usr/bin/curl',
    ['-fsSL', '--connect-timeout', '6', '--max-time', '12', url],
    { timeoutMs: 15000 }
  )
  if (res.code !== 0 || !res.stdout) return null
  try {
    const raw = JSON.parse(res.stdout)
    const authors = Array.isArray(raw.copyright)
      ? raw.copyright.map(c => c.owner).filter(Boolean).join(', ')
      : ''
    const ctanPath = raw.ctan?.path || `/macros/latex/contrib/${raw.id || name}`
    const pkg = {
      name: raw.id || name,
      version: raw.version?.number || '1.0',
      shortdesc: raw.caption || '',
      longdesc: stripXmlTags(raw.descriptions?.[0]?.text || ''),
      author: authors || 'CTAN Contributor',
      license: Array.isArray(raw.license)
        ? raw.license.join(', ')
        : raw.license || 'unknown',
      ctanPath,
      ctanIsDir: Boolean(raw.ctan?.file !== true || ctanPath),
      homepage:
        raw.home ||
        `https://ctan.org/pkg/${encodeURIComponent(raw.id || name)}`,
      repository: raw.repository || '',
      topics: Array.isArray(raw.topics) ? raw.topics : [],
      size_kb: 128,
    }
    await ctanCache.init()
    ctanCache.map.set(pkg.name, pkg)
    await ctanCache.save()
    return pkg
  } catch {
    return null
  }
}

async function fetchCtanSearch(query) {
  const url = `${CTAN_API_BASE}/search?phrase=${encodeURIComponent(query)}&max=20`
  const res = await runCommandSafe(
    '/usr/bin/curl',
    ['-fsSL', '--connect-timeout', '6', '--max-time', '12', url],
    { timeoutMs: 15000 }
  )
  if (res.code !== 0 || !res.stdout) return []
  try {
    const parsed = JSON.parse(res.stdout)
    const hits = Array.isArray(parsed.hits) ? parsed.hits : []
    const results = []
    for (const h of hits) {
      if (h.path && h.path.startsWith('/pkg/')) {
        const name = h.path.replace('/pkg/', '')
        if (!validatePackageName(name)) continue
        results.push({
          name,
          version: 'ctan',
          shortdesc: h.title || name,
          description: h.title || h.text || '',
          author: '',
          license: 'ctan',
          ctanPath: `/macros/latex/contrib/${name}`,
          homepage: `https://ctan.org/pkg/${encodeURIComponent(name)}`,
          topics: [],
          size_kb: 100,
        })
      }
    }
    return results
  } catch {
    return []
  }
}

function toPackageDto(item) {
  const installedRec = stateStore.getState().ctanPackages?.[item.name]
  return {
    id: `ctan:${item.name}`,
    name: item.name,
    source: 'ctan',
    category: 'Package',
    version: item.version || 'ctan',
    installed_version: installedRec?.version || null,
    installed: Boolean(installedRec),
    update_available: false,
    protected: isProtectedPackage(item.name),
    shortdesc: item.shortdesc || '',
    description:
      item.shortdesc || item.longdesc || 'CTAN repository package',
    longdesc: item.longdesc || '',
    license: item.license || 'unknown',
    author: item.author || '',
    homepage:
      item.homepage ||
      `https://ctan.org/pkg/${encodeURIComponent(item.name)}`,
    ctanPath: item.ctanPath || '',
    topics: item.topics || [],
    size_kb: installedRec?.size_kb || item.size_kb || 128,
    dependencies: [],
    runfiles: installedRec?.files || [],
  }
}

function getCtanMirrorOrder() {
  const raw = []
  if (lastWorkingCtanMirror) raw.push(lastWorkingCtanMirror)
  raw.push(...CTAN_DIRECT_MIRRORS)
  return Array.from(new Set(raw.map(u => u.replace(/\/+$/, ''))))
}

async function tryDownloadCtanZip(candidatePaths, zipPath, ctx) {
  const mirrors = getCtanMirrorOrder()
  let lastErr = null

  for (const mirror of mirrors) {
    for (const cPath of candidatePaths) {
      const cleanPath = String(cPath || '').replace(/^\/+/, '')
      if (!cleanPath) continue
      const zipUrl = `${mirror}/${cleanPath}.zip`
      if (!zipUrl.startsWith('https://')) continue

      ctx?.appendLog?.(`Trying CTAN archive ${zipUrl}...`)
      const partPath = `${zipPath}.part`
      const dlRes = await runCommandSafe(
        '/usr/bin/curl',
        [
          '-fsSL',
          '--proto',
          '=https',
          '--connect-timeout',
          '8',
          '--max-time',
          '60',
          '-o',
          partPath,
          zipUrl,
        ],
        { timeoutMs: 70000 }
      )
      if (dlRes.code === 0 && fs.existsSync(partPath)) {
        const st = await fsp.stat(partPath)
        if (st.size > 0) {
          await fsp.rename(partPath, zipPath)
          lastWorkingCtanMirror = mirror
          return { url: zipUrl, size: st.size }
        }
      }
      try {
        await fsp.unlink(partPath)
      } catch {}
      lastErr = new Error(dlRes.stderr?.trim() || `HTTP ${dlRes.code}`)
    }
  }

  return { error: lastErr }
}

/**
 * Sandboxed fallback for extracting a tlnet .tar.xz archive into texmf-local/tex/latex/ctan/<pkg>
 * when a CTAN package has no .zip distribution (single-file or tlnet-only).
 */
async function extractTarXzFallback(pkg, tarXzPath, targetDir, tmpDir) {
  const listRes = await runCommandSafe('/usr/bin/tar', ['-Jtvf', tarXzPath], {
    timeoutMs: 30000,
  })
  if (listRes.code !== 0) {
    throw new Error(`Invalid tar.xz archive for ${pkg}: ${listRes.stderr || listRes.stdout}`)
  }

  let totalBytes = 0
  for (const line of listRes.stdout.split('\n')) {
    if (!line.trim()) continue
    const m = line.match(/^\s*([ldcbphs-][rwxstST-]{9})\s+\S+\s+(\d+)\s+\S+\s+\S+\s+(.+)$/)
    if (!m) continue
    const perms = m[1]
    const size = Number(m[2] || 0)
    const entry = m[3].split(' -> ')[0]
    if (perms.startsWith('l') || perms.startsWith('h')) {
      throw new Error(`Symlink/hardlink rejected in archive: ${entry}`)
    }
    const norm = entry.replace(/\\/g, '/')
    if (norm.startsWith('/') || norm.split('/').includes('..')) {
      throw new Error(`Unsafe archive path rejected: ${entry}`)
    }
    totalBytes += size
    if (totalBytes > MAX_ARCHIVE_BYTES) {
      throw new Error(`Archive size (${totalBytes}) exceeds limit (${MAX_ARCHIVE_BYTES})`)
    }
  }

  const unpackDir = path.join(tmpDir, 'unpack-tlnet')
  await fsp.mkdir(unpackDir, { recursive: true })
  const extRes = await runCommandSafe(
    '/usr/bin/tar',
    ['-xJf', tarXzPath, '--no-same-owner', '--no-same-permissions', '-C', unpackDir],
    { timeoutMs: 60000 }
  )
  if (extRes.code !== 0) {
    throw new Error(`Failed to extract ${pkg}.tar.xz: ${extRes.stderr || extRes.stdout}`)
  }

  const collected = []
  async function walkCopy(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const lst = await fsp.lstat(full)
      if (lst.isSymbolicLink() || !isPathEqualOrInside(full, unpackDir)) {
        continue
      }
      if (lst.isDirectory()) {
        await walkCopy(full)
      } else if (lst.isFile()) {
        const rel = path.relative(unpackDir, full).replace(/\\/g, '/')
        // Skip tlpkg/tlpobj metadata; install TeX/BibTeX runtime files flatly or cleanly under targetDir
        if (rel.startsWith('tlpkg/')) continue
        const cleanRel = rel.replace(/^(?:texmf-dist\/)?(?:tex\/latex\/[^/]+\/|tex\/latex\/|tex\/generic\/|tex\/)/, '')
        const destFile = resolveSafeTexmfPath(targetDir, cleanRel)
        await fsp.mkdir(path.dirname(destFile), { recursive: true })
        await fsp.copyFile(full, destFile)
        collected.push(path.relative(targetDir, destFile))
      }
    }
  }
  await walkCopy(unpackDir)
  return collected
}

export const ctanSource = {
  id: 'ctan',
  name: 'CTAN Mirrors',

  async list() {
    await ctanCache.init()
    const installedMap = stateStore.getState().ctanPackages || {}
    for (const [name, rec] of Object.entries(installedMap)) {
      if (!ctanCache.map.has(name)) {
        ctanCache.map.set(name, rec)
      }
    }
    return Array.from(ctanCache.map.values())
      .map(toPackageDto)
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  async search(query) {
    await ctanCache.init()
    const q = String(query || '').trim()
    const localHits = Array.from(ctanCache.map.values()).filter(
      p =>
        !q ||
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.shortdesc || '').toLowerCase().includes(q.toLowerCase())
    )
    if (!q || q.length < 2) {
      return localHits.map(toPackageDto)
    }

    const [exact, remoteHits] = await Promise.all([
      validatePackageName(q) ? fetchCtanPackageJson(q) : Promise.resolve(null),
      fetchCtanSearch(q),
    ])

    const merged = new Map()
    for (const item of localHits) merged.set(item.name, toPackageDto(item))
    if (exact) merged.set(exact.name, toPackageDto(exact))
    for (const h of remoteHits) {
      if (!merged.has(h.name)) {
        ctanCache.map.set(h.name, h)
        merged.set(h.name, toPackageDto(h))
      }
    }
    return Array.from(merged.values())
  },

  async getMetadata(name) {
    if (!validatePackageName(name)) return null
    await ctanCache.init()
    let item = ctanCache.map.get(name)
    const live = await fetchCtanPackageJson(name)
    if (live) item = live
    return item ? toPackageDto(item) : null
  },

  async install(names, ctx) {
    if (!Array.isArray(names) || names.length === 0) {
      const err = new Error('Package names list cannot be empty')
      err.statusCode = 400
      throw err
    }

    const installed = []
    for (let i = 0; i < names.length; i++) {
      const pkg = names[i]
      if (!validatePackageName(pkg)) {
        const err = new Error(`Invalid package name: ${pkg}`)
        err.statusCode = 400
        throw err
      }

      ctx?.setProgress?.(
        10 + Math.round((i / names.length) * 60),
        'Querying CTAN metadata',
        `Resolving CTAN metadata for ${pkg}...`
      )
      const meta = (await fetchCtanPackageJson(pkg)) ||
        ctanCache.map.get(pkg) || {
          name: pkg,
          ctanPath: `/macros/latex/contrib/${pkg}`,
          version: 'ctan',
        }

      const cleanCtanPath = String(
        meta.ctanPath || `macros/latex/contrib/${pkg}`
      ).replace(/^\/+/, '')
      const candidatePaths = Array.from(
        new Set([cleanCtanPath, `macros/latex/contrib/${pkg}`])
      )

      const tmpDir = await fsp.mkdtemp(`/tmp/pkg-hub-ctan-${pkg}-`)
      const zipPath = path.join(tmpDir, `${pkg}.zip`)

      try {
        ctx?.setProgress?.(
          25 + Math.round((i / names.length) * 50),
          'Downloading CTAN archive',
          `Downloading ${pkg} over HTTPS from CTAN mirror...`
        )

        const targetDir = resolveSafeTexmfPath(
          TEXMFLOCAL,
          'tex',
          'latex',
          'ctan',
          pkg
        )
        await fsp.rm(targetDir, { recursive: true, force: true })
        await fsp.mkdir(targetDir, { recursive: true, mode: 0o755 })

        let sha256 = ''
        let archiveBytes = 0
        let files = []

        const dl = await tryDownloadCtanZip(candidatePaths, zipPath, ctx)
        if (dl.size && fs.existsSync(zipPath)) {
          sha256 = await sha256File(zipPath)
          archiveBytes = dl.size
          ctx?.appendLog?.(
            `Verified HTTPS download ${dl.url} sha256=${sha256} (${archiveBytes} bytes)`
          )

          ctx?.setProgress?.(
            60 + Math.round((i / names.length) * 20),
            'Extracting sandboxed archive',
            `Extracting ${pkg} into ${targetDir}...`
          )
          files = await inspectAndExtractArchive(
            zipPath,
            `${pkg}.zip`,
            targetDir
          )

          // If the CTAN package ships .ins + .dtx without prebuilt .sty/.cls, compile .ins cleanly
          const hasStyOrCls = files.some(
            f => f.endsWith('.sty') || f.endsWith('.cls')
          )
          if (!hasStyOrCls) {
            const insFiles = files.filter(f => f.endsWith('.ins'))
            for (const insRel of insFiles) {
              const insDir = path.dirname(path.join(targetDir, insRel))
              const insBase = path.basename(insRel)
              ctx?.appendLog?.(`Generating style files from ${insRel}...`)
              let genRes = await runCommandSafe(
                PDFLATEX_BIN,
                ['-interaction=nonstopmode', '-no-shell-escape', insBase],
                { cwd: insDir, timeoutMs: 30000, onLine: l => ctx?.appendLog?.(l) }
              )
              if (genRes.code !== 0) {
                genRes = await runCommandSafe(
                  '/usr/local/bin/pdftex',
                  ['-interaction=nonstopmode', '-no-shell-escape', insBase],
                  { cwd: insDir, timeoutMs: 30000, onLine: l => ctx?.appendLog?.(l) }
                )
              }
            }
            files = await collectDirFiles(targetDir)
          }
        } else {
          // Fallback: fetch packed <pkg>.tar.xz directly from fast CTAN/tlnet HTTPS mirror
          ctx?.appendLog?.(
            `CTAN .zip unavailable (${dl.error?.message || 'not found'}); falling back to tlnet archive/${pkg}.tar.xz...`
          )
          const tarXzPath = path.join(tmpDir, `${pkg}.tar.xz`)
          const tlDl = await downloadArchiveFromMirrors(pkg, tarXzPath, l =>
            ctx?.appendLog?.(l)
          )
          sha256 = await sha256File(tarXzPath)
          archiveBytes = tlDl.bytes
          ctx?.setProgress?.(
            60 + Math.round((i / names.length) * 20),
            'Extracting tlnet archive fallback',
            `Extracting ${pkg}.tar.xz into ${targetDir}...`
          )
          files = await extractTarXzFallback(pkg, tarXzPath, targetDir, tmpDir)
        }

        if (files.length === 0) {
          throw new Error(`No installable files found in downloaded archive for ${pkg}`)
        }

        stateStore.getState().ctanPackages[pkg] = {
          name: pkg,
          version: meta.version || 'ctan',
          description: meta.shortdesc || meta.longdesc || 'CTAN package',
          license: meta.license || 'unknown',
          author: meta.author || '',
          homepage:
            meta.homepage ||
            `https://ctan.org/pkg/${encodeURIComponent(pkg)}`,
          ctanPath: meta.ctanPath || `/${cleanCtanPath}`,
          size_kb: Math.max(1, Math.round(archiveBytes / 1024)),
          sha256,
          files,
          installedAt: new Date().toISOString(),
        }
        installed.push(pkg)
      } finally {
        await fsp.rm(tmpDir, { recursive: true, force: true })
      }
    }

    ctx?.setProgress?.(
      90,
      'Refreshing TeX filename database',
      'Running mktexlsr...'
    )
    const refresh = () =>
      runCommandSafe(MKTEXLSR_BIN, [], {
        timeoutMs: 60000,
        onLine: l => ctx?.appendLog?.(l),
      })
    await (ctx?.withTlmgrLock ? ctx.withTlmgrLock(refresh) : refresh())
    await stateStore.savePersistentState()

    return {
      ok: true,
      installed,
      message: `Installed CTAN package(s): ${installed.join(', ')}`,
    }
  },

  async update(names, ctx) {
    const targets =
      Array.isArray(names) && names.length > 0
        ? names
        : Object.keys(stateStore.getState().ctanPackages || {})
    if (targets.length === 0) {
      return {
        ok: true,
        updated: [],
        message: 'No CTAN packages to update',
      }
    }
    const res = await this.install(targets, ctx)
    return {
      ok: true,
      updated: res.installed,
      message: `Updated CTAN package(s): ${targets.join(', ')}`,
    }
  },

  async remove(names, ctx) {
    if (!Array.isArray(names) || names.length === 0) {
      const err = new Error('Package names list cannot be empty')
      err.statusCode = 400
      throw err
    }
    for (const pkg of names) {
      if (!validatePackageName(pkg)) {
        const err = new Error(`Invalid package name: ${pkg}`)
        err.statusCode = 400
        throw err
      }
      if (isProtectedPackage(pkg)) {
        const err = new Error(`Package "${pkg}" is protected and cannot be removed`)
        err.statusCode = 409
        throw err
      }
      const targetDir = resolveSafeTexmfPath(
        TEXMFLOCAL,
        'tex',
        'latex',
        'ctan',
        pkg
      )
      await fsp.rm(targetDir, { recursive: true, force: true })
      delete stateStore.getState().ctanPackages[pkg]
    }
    await stateStore.savePersistentState()
    const refresh = () =>
      runCommandSafe(MKTEXLSR_BIN, [], {
        timeoutMs: 60000,
        onLine: l => ctx?.appendLog?.(l),
      })
    await (ctx?.withTlmgrLock ? ctx.withTlmgrLock(refresh) : refresh())
    return {
      ok: true,
      removed: names,
      message: `Removed CTAN package(s): ${names.join(', ')}`,
    }
  },
}
