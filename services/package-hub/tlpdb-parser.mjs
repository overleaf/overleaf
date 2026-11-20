import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  TEXLIVE_ARCH,
  TEXLIVE_ROOT,
  isProtectedPackage,
} from './security-utils.mjs'

const TLPKG_DIR = path.join(TEXLIVE_ROOT, 'tlpkg')
const LOCAL_TLPDB_PATH = path.join(TLPKG_DIR, 'texlive.tlpdb')
const CATALOGUE_TLPDB_PATH = path.join(TLPKG_DIR, 'texlive-catalogue-only.tlpdb')

function findRemoteMainTlpdbPath() {
  try {
    const entries = fs.readdirSync(TLPKG_DIR)
    const main = entries.find(e => e.startsWith('texlive.tlpdb.main.'))
    return main ? path.join(TLPKG_DIR, main) : null
  } catch {
    return null
  }
}

/**
 * Parse a raw TLPDB text file into a Map<pkgName, entryObj>.
 */
export function parseTlpdbContent(content, { includeFiles = true } = {}) {
  const map = new Map()
  const lines = content.split('\n')
  let current = null
  let section = null // 'runfiles' | 'docfiles' | 'srcfiles' | 'binfiles' | null

  const commit = () => {
    if (!current || !current.name) return
    map.set(current.name, current)
    current = null
    section = null
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line === '') {
      commit()
      continue
    }

    if (line[0] === ' ') {
      // Indented file line belonging to current section
      if (includeFiles && current && section === 'runfiles') {
        const filePath = line.trim().split(' ')[0]
        if (filePath && current.runfiles.length < 150) {
          current.runfiles.push(filePath)
        }
      } else if (includeFiles && current && section === 'docfiles') {
        const filePath = line.trim().split(' ')[0]
        if (filePath && current.docfiles.length < 50) {
          current.docfiles.push(filePath)
        }
      }
      continue
    }

    section = null
    const spaceIdx = line.indexOf(' ')
    const key = spaceIdx === -1 ? line : line.slice(0, spaceIdx)
    const val = spaceIdx === -1 ? '' : line.slice(spaceIdx + 1)

    if (key === 'name') {
      if (current) commit()
      current = {
        name: val.trim(),
        category: 'Package',
        revision: 0,
        shortdesc: '',
        longdesc: '',
        containersize: 0,
        containerchecksum: '',
        runfilesSizePages: 0,
        depends: [],
        rawDepends: [],
        runfiles: [],
        docfiles: [],
        catalogueVersion: '',
        catalogueLicense: '',
        homepage: '',
        repository: '',
        ctanPath: '',
        topics: [],
        relocated: false,
      }
      continue
    }

    if (!current) continue

    switch (key) {
      case 'category':
        current.category = val.trim()
        break
      case 'revision':
        current.revision = Number(val.trim()) || 0
        break
      case 'shortdesc':
        current.shortdesc = val.trim()
        break
      case 'longdesc':
        current.longdesc = current.longdesc ? `${current.longdesc} ${val.trim()}` : val.trim()
        break
      case 'containersize':
        current.containersize = Number(val.trim()) || 0
        break
      case 'containerchecksum':
        current.containerchecksum = val.trim()
        break
      case 'relocated':
        current.relocated = val.trim() === '1'
        break
      case 'depend': {
        const dep = val.trim()
        if (!dep) break
        if (dep.endsWith('.ARCH')) {
          current.rawDepends.push(`${dep.slice(0, -5)}.${TEXLIVE_ARCH}`)
        } else if (!dep.includes('.')) {
          current.depends.push(dep)
          current.rawDepends.push(dep)
        }
        break
      }
      case 'runfiles': {
        section = 'runfiles'
        const m = val.match(/size=(\d+)/)
        if (m) current.runfilesSizePages = Number(m[1]) || 0
        break
      }
      case 'docfiles':
        section = 'docfiles'
        break
      case 'srcfiles':
      case 'binfiles':
        section = key
        break
      case 'catalogue-version':
        current.catalogueVersion = val.trim()
        break
      case 'catalogue-license':
        current.catalogueLicense = val.trim()
        break
      case 'catalogue-contact-home':
        current.homepage = val.trim()
        break
      case 'catalogue-contact-repository':
        current.repository = val.trim()
        break
      case 'catalogue-ctan':
        current.ctanPath = val.trim()
        break
      case 'catalogue-topics':
        current.topics = val.trim().split(/\s+/).filter(Boolean)
        break
      default:
        break
    }
  }
  commit()
  return map
}

function isUserFacingPackage(entry) {
  if (!entry || !entry.name) return false
  if (entry.name.startsWith('00texlive')) return false
  if (entry.name.includes('.')) return false // skip .x86_64-linux / .doc / .source binary split entries
  if (entry.category === 'Collection' || entry.category === 'Scheme') return false
  return true
}

/**
 * In-memory cached catalog with mtime invalidation on local texlive.tlpdb.
 */
class TlpdbCache {
  constructor() {
    this.localMtimeMs = -1
    this.remoteMainPath = null
    this.remotePackages = null
    this.localPackages = null
    this.unifiedTexliveList = null
    this.unifiedTexliveMap = null
    this.loadPromise = null
  }

  async ensureLoaded(force = false) {
    if (this.loadPromise) {
      return this.loadPromise
    }

    let currentMtime = 0
    try {
      const st = await fsp.stat(LOCAL_TLPDB_PATH)
      currentMtime = st.mtimeMs
    } catch {
      currentMtime = 0
    }

    if (!force && this.unifiedTexliveMap && this.localMtimeMs === currentMtime) {
      return
    }

    this.loadPromise = this._reload(currentMtime).finally(() => {
      this.loadPromise = null
    })
    return this.loadPromise
  }

  async _reload(currentMtime) {
    // Load remote main TLPDB once (huge ~20MB file) or fallback to catalogue-only
    if (!this.remotePackages) {
      const mainPath = findRemoteMainTlpdbPath()
      this.remoteMainPath = mainPath
      const sourcePath =
        mainPath && fs.existsSync(mainPath)
          ? mainPath
          : fs.existsSync(CATALOGUE_TLPDB_PATH)
            ? CATALOGUE_TLPDB_PATH
            : null
      if (sourcePath) {
        const content = await fsp.readFile(sourcePath, 'utf8')
        this.remotePackages = parseTlpdbContent(content, { includeFiles: true })
      } else {
        this.remotePackages = new Map()
      }
    }

    // Reload local TLPDB whenever its mtime changes
    if (fs.existsSync(LOCAL_TLPDB_PATH)) {
      const localContent = await fsp.readFile(LOCAL_TLPDB_PATH, 'utf8')
      this.localPackages = parseTlpdbContent(localContent, { includeFiles: true })
    } else {
      this.localPackages = new Map()
    }
    this.localMtimeMs = currentMtime

    const unifiedMap = new Map()
    const allNames = new Set([
      ...this.remotePackages.keys(),
      ...this.localPackages.keys(),
    ])

    for (const name of allNames) {
      const remote = this.remotePackages.get(name)
      const local = this.localPackages.get(name)
      const primary = local || remote
      if (!isUserFacingPackage(primary)) continue

      const installed = Boolean(local)
      const localRev = local?.revision || 0
      const remoteRev = remote?.revision || localRev
      const updateAvailable = installed && remoteRev > localRev

      const version =
        (remote?.catalogueVersion || local?.catalogueVersion) ||
        String(remoteRev || localRev || '1.0')
      const installedVersion = installed
        ? local.catalogueVersion || String(local.revision)
        : null

      const sizeBytes =
        primary.containersize ||
        (primary.runfilesSizePages ? primary.runfilesSizePages * 4096 : 0)
      const sizeKb = Math.max(1, Math.round(sizeBytes / 1024))

      unifiedMap.set(name, {
        id: `texlive:${name}`,
        name,
        source: 'texlive',
        category: primary.category || 'Package',
        revision: remoteRev || localRev,
        localRevision: localRev || null,
        remoteRevision: remoteRev || null,
        version,
        installed_version: installedVersion,
        installed,
        update_available: updateAvailable,
        protected: isProtectedPackage(name),
        shortdesc: primary.shortdesc || remote?.shortdesc || '',
        description:
          primary.shortdesc ||
          remote?.shortdesc ||
          primary.longdesc ||
          remote?.longdesc ||
          'TeX Live package',
        longdesc: primary.longdesc || remote?.longdesc || '',
        license: primary.catalogueLicense || remote?.catalogueLicense || 'unknown',
        author: '',
        homepage:
          primary.homepage ||
          remote?.homepage ||
          primary.repository ||
          remote?.repository ||
          (primary.ctanPath || remote?.ctanPath
            ? `https://ctan.org/pkg/${encodeURIComponent(name)}`
            : ''),
        ctanPath: primary.ctanPath || remote?.ctanPath || '',
        topics: primary.topics?.length ? primary.topics : remote?.topics || [],
        size_kb: sizeKb,
        dependencies: Array.from(
          new Set([...(primary.depends || []), ...(remote?.depends || [])])
        ),
        runfiles: local?.runfiles?.length ? local.runfiles : remote?.runfiles || [],
      })
    }

    const list = Array.from(unifiedMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    this.unifiedTexliveMap = unifiedMap
    this.unifiedTexliveList = list
  }

  async getAllTexlivePackages() {
    await this.ensureLoaded()
    return this.unifiedTexliveList
  }

  async getTexlivePackage(name) {
    await this.ensureLoaded()
    return this.unifiedTexliveMap.get(name) || null
  }

  async getLocalEntry(name) {
    await this.ensureLoaded()
    return this.localPackages.get(name) || null
  }

  async getRemoteEntry(name) {
    await this.ensureLoaded()
    return this.remotePackages.get(name) || null
  }

  invalidate() {
    this.localMtimeMs = -1
  }
}

export const tlpdbCache = new TlpdbCache()
