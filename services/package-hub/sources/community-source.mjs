import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { STATE_DIR } from '../job-queue.mjs'
import { runCommandSafe, validatePackageName } from '../security-utils.mjs'
import { tlpdbCache } from '../tlpdb-parser.mjs'
import { ctanSource } from './ctan-source.mjs'
import { customSource } from './custom-source.mjs'
import { texliveSource } from './texlive-source.mjs'

const MANIFESTS_FILE = path.join(STATE_DIR, 'community-manifests.json')

const DEFAULT_MANIFESTS = [
  {
    id: 'ml-researcher-pack',
    name: 'ml-researcher-pack',
    version: '1.2.0',
    description: 'Core packages for ML paper writing (NeurIPS / ICML / ICLR workflows)',
    author: 'COSL Research Community',
    url: 'builtin://ml-researcher-pack.json',
    packages: ['amsmath', 'booktabs', 'cleveref', 'pgfplots', 'enumitem', 'microtype', 'hyperref', 'xcolor'],
    custom_files: [],
    last_synced_at: '2026-11-19T00:00:00.000Z',
  },
  {
    id: 'thesis-essentials',
    name: 'thesis-essentials',
    version: '2.0.0',
    description: 'Formatting, margins, headers, bibliographies, and acronyms for graduate theses',
    author: 'COSL Research Community',
    url: 'builtin://thesis-essentials.json',
    packages: ['geometry', 'setspace', 'fancyhdr', 'titlesec', 'tocloft', 'biblatex', 'csquotes', 'acronym'],
    custom_files: [],
    last_synced_at: '2026-11-19T00:00:00.000Z',
  },
  {
    id: 'tikz-power-user',
    name: 'tikz-power-user',
    version: '1.4.0',
    description: 'Vector diagrams, plots, circuit schematics, and commutative graphs with TikZ & PGF',
    author: 'COSL Graphics Collective',
    url: 'builtin://tikz-power-user.json',
    packages: ['pgf', 'pgfplots', 'circuitikz', 'tikz-cd', 'forest', 'xcolor'],
    custom_files: [],
    last_synced_at: '2026-11-19T00:00:00.000Z',
  },
  {
    id: 'ieee-academic-suite',
    name: 'ieee-academic-suite',
    version: '1.1.0',
    description: 'Standard packages required across IEEE conference and transactions templates',
    author: 'COSL Engineering Labs',
    url: 'builtin://ieee-academic-suite.json',
    packages: ['IEEEtran', 'cite', 'amsmath', 'amsfonts', 'array', 'url', 'graphicx'],
    custom_files: [],
    last_synced_at: '2026-11-19T00:00:00.000Z',
  },
  {
    id: 'physics-quantum-pack',
    name: 'physics-quantum-pack',
    version: '1.0.0',
    description: 'Bra-ket notation, SI units, tensors, and mathematical physics typesetting',
    author: 'COSL Physics Group',
    url: 'builtin://physics-quantum-pack.json',
    packages: ['physics', 'siunitx', 'braket', 'tensor', 'mathtools', 'bm'],
    custom_files: [],
    last_synced_at: '2026-11-19T00:00:00.000Z',
  },
]

function validateManifestPayload(raw, manifestUrl) {
  if (!raw || typeof raw !== 'object') {
    const err = new Error('Manifest must be a JSON object')
    err.statusCode = 400
    throw err
  }
  const name = String(raw.name || '').trim()
  if (!validatePackageName(name)) {
    const err = new Error('Manifest "name" must match ^[a-zA-Z0-9._-]+$')
    err.statusCode = 400
    throw err
  }
  const packages = Array.isArray(raw.packages)
    ? raw.packages.map(p => String(p).trim()).filter(Boolean)
    : []
  for (const p of packages) {
    if (!validatePackageName(p)) {
      const err = new Error(`Invalid package name inside manifest: ${p}`)
      err.statusCode = 400
      throw err
    }
  }
  const customFiles = Array.isArray(raw.custom_files)
    ? raw.custom_files.map(u => String(u).trim()).filter(Boolean)
    : []
  for (const u of customFiles) {
    if (!u.startsWith('https://')) {
      const err = new Error(`Community custom_files must use https:// URLs (got ${u})`)
      err.statusCode = 400
      throw err
    }
  }

  return {
    id: name,
    name,
    version: String(raw.version || '1.0.0').trim(),
    description: String(raw.description || 'Community curated LaTeX package set').trim(),
    author: String(raw.author || 'community').trim(),
    url: manifestUrl || raw.url || `custom://${name}.json`,
    packages,
    custom_files: customFiles,
    last_synced_at: new Date().toISOString(),
  }
}

class CommunityRegistry {
  constructor() {
    this.manifests = new Map()
    this.loaded = false
  }

  async init() {
    if (this.loaded) return
    for (const m of DEFAULT_MANIFESTS) {
      this.manifests.set(m.name, structuredClone(m))
    }
    try {
      const raw = await fsp.readFile(MANIFESTS_FILE, 'utf8')
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item?.name) this.manifests.set(item.name, item)
        }
      }
    } catch {}
    this.loaded = true
  }

  async save() {
    await fsp.mkdir(STATE_DIR, { recursive: true, mode: 0o755 })
    const tmp = `${MANIFESTS_FILE}.${process.pid}.tmp`
    await fsp.writeFile(
      tmp,
      JSON.stringify(Array.from(this.manifests.values()), null, 2) + '\n',
      'utf8'
    )
    await fsp.rename(tmp, MANIFESTS_FILE)
  }
}

const registry = new CommunityRegistry()

export const communitySource = {
  id: 'community',
  name: 'Community Package Sets',

  async listManifests() {
    await registry.init()
    await tlpdbCache.ensureLoaded()
    const customList = await customSource.list()
    const customSet = new Set(customList.map(c => c.name))
    const ctanList = await ctanSource.list()
    const ctanInstalled = new Set(ctanList.filter(c => c.installed).map(c => c.name))

    const out = []
    for (const m of registry.manifests.values()) {
      const packageStatuses = []
      let installedCount = 0
      for (const pkgName of m.packages) {
        const tl = await tlpdbCache.getTexlivePackage(pkgName)
        const isInstalled = Boolean(tl?.installed || ctanInstalled.has(pkgName) || customSet.has(pkgName))
        if (isInstalled) installedCount++
        packageStatuses.push({
          name: pkgName,
          installed: isInstalled,
          source: tl ? 'texlive' : customSet.has(pkgName) ? 'custom' : 'ctan',
        })
      }
      out.push({
        ...m,
        installedCount,
        totalCount: m.packages.length,
        allInstalled: m.packages.length > 0 && installedCount === m.packages.length,
        packageStatuses,
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  },

  async list() {
    const manifests = await this.listManifests()
    return manifests.map(m => ({
      id: `community:${m.name}`,
      name: m.name,
      source: 'community',
      category: 'Community Pack',
      version: m.version,
      installed_version: m.allInstalled ? m.version : null,
      installed: m.allInstalled,
      update_available: false,
      protected: false,
      shortdesc: m.description,
      description: `${m.description} (${m.installedCount}/${m.totalCount} packages installed)`,
      longdesc: `Included packages: ${m.packages.join(', ')}`,
      license: 'manifest',
      author: m.author,
      homepage: m.url?.startsWith('http') ? m.url : '',
      ctanPath: '',
      topics: ['community-pack', 'bundle'],
      size_kb: m.packages.length * 40,
      dependencies: m.packages,
      runfiles: m.custom_files || [],
      manifest: m,
    }))
  },

  async search(query) {
    const all = await this.list()
    const q = String(query || '').trim().toLowerCase()
    if (!q) return all
    return all.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.shortdesc.toLowerCase().includes(q) ||
        p.dependencies.some(d => d.toLowerCase().includes(q))
    )
  },

  async getMetadata(name) {
    if (!validatePackageName(name)) return null
    const list = await this.list()
    return list.find(p => p.name === name) || null
  },

  async registerManifest({ manifestUrl, manifest }) {
    await registry.init()
    let rawManifest = manifest

    if (manifestUrl && !rawManifest) {
      let parsedUrl
      try {
        parsedUrl = new URL(manifestUrl)
      } catch {
        const err = new Error('Invalid manifestUrl')
        err.statusCode = 400
        throw err
      }
      if (parsedUrl.protocol !== 'https:') {
        const err = new Error('Community manifest URL must use https://')
        err.statusCode = 400
        throw err
      }

      const res = await runCommandSafe(
        '/usr/bin/curl',
        ['-fsSL', '--proto', '=https', '--connect-timeout', '10', '--max-time', '20', manifestUrl],
        { timeoutMs: 25000 }
      )
      if (res.code !== 0 || !res.stdout) {
        const err = new Error(
          `Failed to fetch manifest from ${manifestUrl}: ${res.stderr || `exit ${res.code}`}`
        )
        err.statusCode = 400
        throw err
      }
      try {
        rawManifest = JSON.parse(res.stdout)
      } catch {
        const err = new Error('Fetched manifest is not valid JSON')
        err.statusCode = 400
        throw err
      }
    }

    const validated = validateManifestPayload(rawManifest, manifestUrl)
    registry.manifests.set(validated.name, validated)
    await registry.save()
    return validated
  },

  async installManifest(manifestName, ctx) {
    await registry.init()
    const manifest = registry.manifests.get(manifestName)
    if (!manifest) {
      const err = new Error(`Community pack "${manifestName}" not found`)
      err.statusCode = 404
      throw err
    }

    await tlpdbCache.ensureLoaded()
    const texliveQueue = []
    const ctanQueue = []

    ctx.setProgress(5, 'Resolving community pack', `Checking packages in "${manifest.name}" v${manifest.version}...`)
    for (const pkgName of manifest.packages) {
      const tl = await tlpdbCache.getTexlivePackage(pkgName)
      if (tl?.installed) {
        ctx.appendLog(`✓ ${pkgName} already installed`)
      } else if (tl) {
        texliveQueue.push(pkgName)
      } else {
        ctanQueue.push(pkgName)
      }
    }

    if (texliveQueue.length > 0) {
      ctx.setProgress(20, 'Installing TeX Live packages', `Installing from TeX Live: ${texliveQueue.join(', ')}`)
      await texliveSource.install(texliveQueue, ctx)
    }

    if (ctanQueue.length > 0) {
      ctx.setProgress(65, 'Installing CTAN fallback packages', `Installing from CTAN: ${ctanQueue.join(', ')}`)
      await ctanSource.install(ctanQueue, ctx)
    }

    if (Array.isArray(manifest.custom_files) && manifest.custom_files.length > 0) {
      ctx.setProgress(80, 'Installing manifest custom files', `Fetching ${manifest.custom_files.length} custom file(s)...`)
      const tmpDir = await fsp.mkdtemp(`/tmp/pkg-hub-comm-${manifest.name}-`)
      try {
        for (const fileUrl of manifest.custom_files) {
          if (!fileUrl.startsWith('https://')) continue
          const fileName = path.basename(new URL(fileUrl).pathname) || 'custom.sty'
          const destTmp = path.join(tmpDir, fileName)
          const dl = await runCommandSafe(
            '/usr/bin/curl',
            ['-fsSL', '--proto', '=https', '--connect-timeout', '15', '--max-time', '60', '-o', destTmp, fileUrl],
            { timeoutMs: 70000 }
          )
          if (dl.code !== 0) {
            throw new Error(`Failed to download custom file ${fileUrl}`)
          }
          await customSource.installUpload(
            destTmp,
            fileName,
            {
              description: `Included by community pack ${manifest.name}`,
              version: manifest.version,
              userId: ctx.job?.created_by,
              userEmail: ctx.job?.created_by_email,
            },
            ctx
          )
        }
      } finally {
        await fsp.rm(tmpDir, { recursive: true, force: true })
      }
    }

    return {
      ok: true,
      manifest: manifest.name,
      installedTexlive: texliveQueue,
      installedCtan: ctanQueue,
      message: `Community pack "${manifest.name}" v${manifest.version} installed (${manifest.packages.length} packages verified)`,
    }
  },
}
