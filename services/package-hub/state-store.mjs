import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { STATE_DIR } from './job-queue.mjs'
import { TEXMFLOCAL } from './security-utils.mjs'

export const PERSISTENT_STATE_PATH = path.join(
  TEXMFLOCAL,
  'tlpkg',
  'package-hub-state.json'
)
const CONFIG_PATH = path.join(STATE_DIR, 'config.json')
export const DEFAULT_TLMGR_MIRROR = 'https://mirror.ctan.org/systems/texlive/tlnet'

const DEFAULT_PERSISTENT_STATE = {
  version: 1,
  texlivePackages: {}, // name -> { name, version, revision, installedAt, persistedPath }
  ctanPackages: {},    // name -> { name, version, description, license, author, homepage, ctanPath, size_kb, files, installedAt }
  customPackages: {},  // name -> { name, version, description, type, size_kb, files, uploaded_by, installedAt }
  lastReconciledAt: null,
}

const DEFAULT_CONFIG = {
  mirrorUrl: DEFAULT_TLMGR_MIRROR,
  allowAllUsersInstall: true,
  allowAllUsersUpload: true,
}

class StateStore {
  constructor() {
    this.persistentState = structuredClone(DEFAULT_PERSISTENT_STATE)
    this.config = structuredClone(DEFAULT_CONFIG)
    this.loaded = false
  }

  async init() {
    if (this.loaded) return
    await fsp.mkdir(path.dirname(PERSISTENT_STATE_PATH), {
      recursive: true,
      mode: 0o755,
    })
    await fsp.mkdir(STATE_DIR, { recursive: true, mode: 0o755 })

    try {
      const raw = await fsp.readFile(PERSISTENT_STATE_PATH, 'utf8')
      const parsed = JSON.parse(raw)
      this.persistentState = {
        ...structuredClone(DEFAULT_PERSISTENT_STATE),
        ...parsed,
        texlivePackages: parsed.texlivePackages || {},
        ctanPackages: parsed.ctanPackages || {},
        customPackages: parsed.customPackages || {},
      }
    } catch {
      await this.savePersistentState()
    }

    try {
      const rawCfg = await fsp.readFile(CONFIG_PATH, 'utf8')
      const parsedCfg = JSON.parse(rawCfg)
      this.config = { ...structuredClone(DEFAULT_CONFIG), ...parsedCfg }
    } catch {
      await this.saveConfig()
    }

    this.loaded = true
  }

  async savePersistentState() {
    await fsp.mkdir(path.dirname(PERSISTENT_STATE_PATH), {
      recursive: true,
      mode: 0o755,
    })
    const tmp = `${PERSISTENT_STATE_PATH}.${process.pid}.tmp`
    await fsp.writeFile(
      tmp,
      JSON.stringify(this.persistentState, null, 2) + '\n',
      'utf8'
    )
    await fsp.rename(tmp, PERSISTENT_STATE_PATH)
  }

  async saveConfig() {
    await fsp.mkdir(STATE_DIR, { recursive: true, mode: 0o755 })
    const tmp = `${CONFIG_PATH}.${process.pid}.tmp`
    await fsp.writeFile(tmp, JSON.stringify(this.config, null, 2) + '\n', 'utf8')
    await fsp.rename(tmp, CONFIG_PATH)
  }

  getMirrorUrl() {
    return this.config.mirrorUrl || DEFAULT_TLMGR_MIRROR
  }

  async setMirrorUrl(url) {
    this.config.mirrorUrl = url
    await this.saveConfig()
  }

  getState() {
    return this.persistentState
  }

  getConfig() {
    return this.config
  }
}

export const stateStore = new StateStore()
