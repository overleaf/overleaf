// @ts-check
import logger from '@overleaf/logger'
import zlib from 'node:zlib'
import Settings from '@overleaf/settings'
import Path from 'node:path'
import fs from 'node:fs'
import CLSICacheHandler from './CLSICacheHandler.js'
import Errors from './Errors.js'
import { callbackify, promisify } from 'node:util'
import {
  AddFileOperation,
  Change,
  EditFileOperation,
  File,
  MoveFileOperation,
  Snapshot,
} from 'overleaf-editor-core'
import { fetchString, RequestFailedError } from '@overleaf/fetch-utils'
import { setTimeout } from 'node:timers/promises'
import ResourceWriter from './ResourceWriter.js'
import UrlCache from './UrlCache.js'
import OError from '@overleaf/o-error'
import ClsiMetrics from './Metrics.js'
import { promiseMapSettledWithLimit } from '@overleaf/promise-utils'
import Metrics from '@overleaf/metrics'
import TikzManager from './TikzManager.js'
import DraftModeManager from './DraftModeManager.js'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export const clearCacheCb = callbackify(clearCache)

/**
 * @param {string} projectId
 * @param {string} userId
 * @return {Promise<void>}
 */
export async function clearCache(projectId, userId) {
  const { dir } = snapshotPath(projectId, userId)
  try {
    await fs.promises.rm(dir, { recursive: true, force: true })
  } catch (err) {
    if (isENOENT(err)) return
    logger.warn(
      { err, projectId, userId },
      'compile from cache: failed to clear history cache'
    )
  }
}

/**
 * @param {string} projectId
 * @param {string} userId
 * @return {{ dir: string, path: string, resyncPath: string }}
 */
function snapshotPath(projectId, userId) {
  const dir = Path.join(
    Settings.path.clsiCacheDir,
    userId ? `${projectId}-${userId}` : projectId
  )

  const path = Path.join(dir, 'history.json.gz')
  const resyncPath = Path.join(dir, 'history-resync.json.gz')
  return { dir, path, resyncPath }
}

/**
 * @param {unknown} err
 * @return {boolean}
 */
function isENOENT(err) {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT'
}

/**
 * @param {string} projectId
 * @param {string} userId
 * @param {number} remoteBaseVersion
 * @param {boolean} populateClsiCache
 * @return {Promise<{rawSnapshot: import('overleaf-editor-core/lib/types.js').RawSnapshot, globalBlobs: string[], fullSync: boolean,localBaseVersion: number, dirty: string[]}>}
 */
async function loadSnapshot(
  projectId,
  userId,
  remoteBaseVersion,
  populateClsiCache
) {
  const { path, resyncPath } = snapshotPath(projectId, userId)
  let maxLocalBaseVersion = -1
  for (const candidate of [path, resyncPath]) {
    try {
      const fullSync = candidate === resyncPath
      return await loadSnapshotFromFile(candidate, remoteBaseVersion, fullSync)
    } catch (err) {
      if (err instanceof Errors.MissingUpdatesError) {
        maxLocalBaseVersion = Math.max(
          maxLocalBaseVersion,
          err.info.baseHistoryVersion
        )
      } else if (!isENOENT(err)) {
        logger.warn(
          { err, projectId, userId },
          'compile from cache: cannot read history from disk'
        )
      }
    }
  }
  if (populateClsiCache) {
    try {
      return await loadSnapshotFromClsiCache(
        projectId,
        userId,
        remoteBaseVersion
      )
    } catch (err) {
      if (err instanceof Errors.MissingUpdatesError) {
        maxLocalBaseVersion = Math.max(
          maxLocalBaseVersion,
          err.info.baseHistoryVersion
        )
      } else if (!isENOENT(err)) {
        logger.warn(
          { err, projectId, userId },
          'compile from cache: cannot download from clsi-cache'
        )
      }
    }
  }
  throw new Errors.MissingUpdatesError('needs more updates', {
    baseHistoryVersion: maxLocalBaseVersion,
  })
}

/**
 * @param {string} projectId
 * @param {string} userId
 * @param {number} remoteBaseVersion
 * @return {Promise<{rawSnapshot: import('overleaf-editor-core/lib/types.js').RawSnapshot, globalBlobs: string[], fullSync: boolean,localBaseVersion: number, dirty: string[]}>}
 */
async function loadSnapshotFromClsiCache(projectId, userId, remoteBaseVersion) {
  const { dir, resyncPath } = snapshotPath(projectId, userId)
  await fs.promises.mkdir(dir, { recursive: true })
  const ok = await CLSICacheHandler.downloadHistorySnapshot(
    projectId,
    userId,
    dir
  )
  if (!ok) {
    throw new Errors.MissingUpdatesError('needs full sync', {
      baseHistoryVersion: -1,
    })
  }
  logger.debug(
    { projectId, userId },
    'compile from cache: restored history from clsi-cache'
  )
  return await loadSnapshotFromFile(resyncPath, remoteBaseVersion, true)
}

/**
 * @param {string} path
 * @param {number} remoteBaseVersion
 * @param {boolean} fullSync
 * @return {Promise<{rawSnapshot: import('overleaf-editor-core/lib/types.js').RawSnapshot, globalBlobs: string[], localBaseVersion: number, fullSync: boolean, dirty: string[]}>}
 */
async function loadSnapshotFromFile(path, remoteBaseVersion, fullSync) {
  let blob = await fs.promises.readFile(path)
  blob = await gunzip(blob)
  const {
    rawSnapshot,
    globalBlobs,
    localBaseVersion,
    dirty = [], // added later, provide a default value.
  } = JSON.parse(blob.toString('utf-8'))
  if (localBaseVersion < remoteBaseVersion) {
    throw new Errors.MissingUpdatesError('missing updates', {
      baseHistoryVersion: localBaseVersion,
    })
  }
  return { rawSnapshot, globalBlobs, localBaseVersion, fullSync, dirty }
}

/**
 * @param {string} projectId
 * @param {string} userId
 * @param {Snapshot} snapshot
 * @param {number} localBaseVersion
 * @param {string[]} globalBlobs
 * @param {string[]} dirty
 * @return {Promise<void>}
 */
async function saveSnapshot(
  projectId,
  userId,
  snapshot,
  localBaseVersion,
  globalBlobs,
  dirty
) {
  const { dir, path } = snapshotPath(projectId, userId)
  await fs.promises.mkdir(dir, { recursive: true })
  const tmp = path + '~'
  await fs.promises.writeFile(
    tmp,
    await gzip(
      JSON.stringify({
        globalBlobs,
        localBaseVersion,
        rawSnapshot: snapshot.toRaw(),
        dirty,
      }),
      // use cheapest gzip compression level
      { level: 1 }
    ),
    { flag: 'wx' }
  )
  await fs.promises.rename(tmp, path)
}

/**
 * @param {string} projectId
 * @param {string} userId
 * @return {Promise<void>}
 */
async function deleteResyncSnapshot(projectId, userId) {
  const { resyncPath } = snapshotPath(projectId, userId)
  try {
    await fs.promises.unlink(resyncPath)
  } catch (err) {
    if (!isENOENT(err)) {
      logger.warn(
        { err, projectId, userId },
        'compile from cache: failed to clear history-resync.json.gz'
      )
    }
  }
}

/**
 * @param {string} compileDir
 * @param {string} subDir
 * @param {Map<string, boolean>} entries
 * @return {Promise<Map<string, boolean>>}
 */
async function discoverExistingEntries(
  compileDir,
  subDir = '.',
  entries = new Map()
) {
  const dirents = await fs.promises.readdir(Path.join(compileDir, subDir), {
    withFileTypes: true,
  })
  for (const dirent of dirents) {
    const path = Path.join(subDir, dirent.name)
    if (dirent.isDirectory()) {
      await discoverExistingEntries(compileDir, path, entries)
    } else if (dirent.isFile()) {
      entries.set(path, false)
    } else if (
      dirent.isSymbolicLink() ||
      dirent.isFIFO() ||
      dirent.isSocket()
    ) {
      // should not happen, delete right away
      logger.warn(
        { compileDir, subDir, dirent },
        'compile from cache: found blocked dirent'
      )
      await fs.promises.unlink(Path.join(compileDir, path))
    } else {
      throw new OError('unexpected dir entry', { compileDir, subDir, dirent })
    }
  }
  entries.set(subDir, true)
  return entries
}

/**
 * @param {string} compileDir
 * @param {Snapshot} snapshot
 * @param {Map<string, boolean>} entriesDepthFirst
 */
async function removeExtraneousEntries(
  compileDir,
  snapshot,
  entriesDepthFirst
) {
  const keepFolders = new Set(['.'])
  for (const [path, isDir] of entriesDepthFirst) {
    const shouldBeFile = !!snapshot.getFile(path)
    if (isDir) {
      if (!shouldBeFile) {
        // directory can stay directory
        if (keepFolders.has(path)) {
          // folder is still in use
          keepFolders.add(Path.dirname(path))
        } else {
          // empty folder
          await fs.promises.rmdir(Path.join(compileDir, path))
          entriesDepthFirst.delete(path)
        }
        continue
      }
      // a folder turned into a file
      // before: foo/bar.txt/baz.txt
      //             ^^^^^^^ folder
      // now:    foo/bar.txt
      //             ^^^^^^^ file
      const needle = path + '/'
      for (const [child, childIsDir] of entriesDepthFirst) {
        if (!child.startsWith(needle)) continue
        if (childIsDir) {
          await fs.promises.rmdir(Path.join(compileDir, child))
        } else {
          await fs.promises.unlink(Path.join(compileDir, child))
        }
        entriesDepthFirst.delete(child)
      }
      await fs.promises.rmdir(Path.join(compileDir, path))
      entriesDepthFirst.delete(path)
      continue
    }
    if (shouldBeFile || !ResourceWriter.isExtraneousFile(path)) {
      // resource or cached file
      keepFolders.add(Path.dirname(path))
      continue
    }
    await fs.promises.unlink(Path.join(compileDir, path))
    entriesDepthFirst.delete(path)
  }
}

/**
 * @param {string} compileDir
 * @param {string} path
 * @param {Map<string, boolean>} entriesDepthFirst
 */
async function ensureHasParentFolder(compileDir, path, entriesDepthFirst) {
  const parentFolderPath = Path.dirname(path)
  if (entriesDepthFirst.has(parentFolderPath)) return
  await ensureHasParentFolder(compileDir, parentFolderPath, entriesDepthFirst)
  await fs.promises.mkdir(Path.join(compileDir, parentFolderPath))
  entriesDepthFirst.set(parentFolderPath, true)
}

/**
 * @param {import('overleaf-editor-core/lib/types.js').RawOperation[][]} raw
 * @return {Change[]}
 */
function changesFromRawChangeOperations(raw) {
  return raw.map(o => Change.mustFromRaw({ operations: o, timestamp: '0' }))
}

/**
 * @param {string} projectId
 * @param {string} userId
 * @param {Object} request
 * @param {string} compileDir
 * @param {Record<string, number>} timings
 * @return {Promise<{baseHistoryVersion: number, resourceList: {path: string}[]}>}
 */
export async function syncResourcesToDisk(
  projectId,
  userId,
  request,
  compileDir,
  timings
) {
  const remoteBaseVersion = request.baseHistoryVersion
  let rawSnapshot, globalBlobs, localBaseVersion, source, dirty, fullSync
  try {
    ;({ rawSnapshot, globalBlobs, fullSync, localBaseVersion, dirty } =
      await loadSnapshot(
        projectId,
        userId,
        remoteBaseVersion,
        request.populateClsiCache
      ))
    source = fullSync ? 'clsi-cache' : 'local'
    logger.debug(
      { projectId, userId, localBaseVersion, remoteBaseVersion },
      'compile from cache: using existing snapshot'
    )
  } catch (err) {
    if (!request.rawSnapshot) throw err
    if (!(err instanceof Errors.MissingUpdatesError)) {
      logger.warn(
        { err, projectId, userId },
        'compile from cache: bad local history state during full resync'
      )
    }
    logger.debug(
      { projectId, userId },
      'compile from cache: using incoming snapshot'
    )
    source = 'remote'
    localBaseVersion = remoteBaseVersion
    rawSnapshot = request.rawSnapshot
    globalBlobs = []
    dirty = []
    fullSync = true
  }
  globalBlobs = Array.from(new Set(globalBlobs.concat(request.globalBlobs)))

  const snapshot = Snapshot.fromRaw(rawSnapshot)

  const changes = changesFromRawChangeOperations(
    request.rawChangeOperations.slice(localBaseVersion - remoteBaseVersion)
  )
  const applyAllStart = performance.now()
  snapshot.applyAll(changes)
  timings.snapshotApplyAll = Math.ceil(performance.now() - applyAllStart)
  if (!ClsiMetrics.shouldSkipMetrics(request)) {
    ClsiMetrics.snapshotApplyAllDurationSeconds.observe(
      { group: request.compileGroup, source },
      timings.snapshotApplyAll / 1_000
    )
  }

  const entriesDepthFirst = await discoverExistingEntries(compileDir)
  await removeExtraneousEntries(compileDir, snapshot, entriesDepthFirst)

  const changedPaths = []
  if (fullSync) {
    changedPaths.push(...snapshot.getFilePathnames())
    logger.debug({ projectId, userId }, 'compile from cache: full sync')
  } else {
    const dedupe = new Set(dirty)
    if (request.draft) {
      dedupe.add(request.rootResourcePath)
    }
    for (const change of changes) {
      for (const operation of change.getOperations()) {
        if (operation instanceof AddFileOperation) {
          dedupe.add(operation.pathname)
        } else if (operation instanceof MoveFileOperation) {
          dedupe.add(operation.pathname)
          if (!operation.isRemoveFile()) dedupe.add(operation.newPathname)
        } else if (operation instanceof EditFileOperation) {
          dedupe.add(operation.pathname)
        }
      }
    }
    // Restore deleted files
    for (const path of snapshot.getFilePathnames()) {
      if (!entriesDepthFirst.has(path)) dedupe.add(path)
    }
    changedPaths.push(...dedupe)
    logger.debug(
      { projectId, userId, changedPaths },
      'compile from cache: incremental sync'
    )
  }

  const blobStore = new BlobStore(
    request.historyId,
    request.filestoreBlobPrefix,
    request.clsiPerfVariant,
    globalBlobs
  )
  const loadEagerStart = performance.now()
  await snapshot.loadFiles('eager', blobStore)
  timings.snapshotLoadEager = Math.ceil(performance.now() - loadEagerStart)
  if (!ClsiMetrics.shouldSkipMetrics(request)) {
    ClsiMetrics.snapshotLoadEagerDurationSeconds.observe(
      { group: request.compileGroup, source },
      timings.snapshotLoadEager / 1_000
    )
  }
  for (const path of changedPaths) {
    const file = snapshot.getFile(path)
    if (!file) continue // deleted, handled by removeExtraneousEntries
    await ensureHasParentFolder(compileDir, path, entriesDepthFirst)
  }

  const wasDirty = dirty.length > 0
  dirty = []
  let createCacheFolder
  // Use Promise.allSettled to ensure that all writes have stopped when we exit.
  const allDone = await promiseMapSettledWithLimit(
    Settings.parallelFileDownloads,
    changedPaths,
    async path => {
      const file = snapshot.getFile(path)
      if (!file) return // deleted, handled by removeExtraneousEntries

      let content = file.getContent({ filterTrackedDeletes: true })
      if (typeof content === 'string') {
        if (path === request.rootResourcePath) {
          if (request.draft) {
            content = DraftModeManager.PREFIX + content
            dirty.push(path)
          }
          await TikzManager.writeOutputFileIfNeeded(
            compileDir,
            snapshot,
            content
          )
        }
        await fs.promises.writeFile(
          Path.join(compileDir, path),
          content,
          'utf-8'
        )
      } else {
        const hash = file.getHash()
        if (!hash) {
          throw new OError('unexpected file without content and hash', { path })
        }
        if (!createCacheFolder) {
          createCacheFolder = UrlCache.promises.createProjectDir(projectId)
        }
        await createCacheFolder
        const url = blobStore.getBlobURL(hash).href
        try {
          const fallbackURL = null // no fallback
          const lastModified = new Date(0) // content is static
          await UrlCache.promises.downloadUrlToFile(
            projectId,
            url,
            fallbackURL,
            Path.join(compileDir, path),
            lastModified
          )
        } catch (err) {
          logger.err(
            { err, projectId, path, resourceUrl: url },
            'error downloading file for resources'
          )
          Metrics.inc('download-failed')
        }
      }
    }
  )
  for (const [idx, result] of allDone.entries()) {
    if (result.status === 'fulfilled') continue
    const path = changedPaths[idx]
    throw OError.tag(result.reason, 'write failed', { path })
  }
  const baseHistoryVersion = localBaseVersion + changes.length
  if (fullSync || changes.length || wasDirty || dirty.length) {
    await saveSnapshot(
      projectId,
      userId,
      snapshot,
      baseHistoryVersion,
      globalBlobs,
      dirty
    )
  }
  if (fullSync) {
    await deleteResyncSnapshot(projectId, userId)
  }
  return {
    baseHistoryVersion,
    resourceList: snapshot.getFilePathnames().map(path => ({ path })),
  }
}

class BlobStore {
  /** @type {string} */
  #historyId
  /** @type {string[]} */
  #globalBlobs
  /** @type {string} */
  #filestoreBlobPrefix
  /** @type {string} */
  #clsiPerfVariant

  /**
   * @param {string} historyId
   * @param {string} filestoreBlobPrefix
   * @param {string} clsiPerfVariant
   * @param {string[]} globalBlobs
   */
  constructor(historyId, filestoreBlobPrefix, clsiPerfVariant, globalBlobs) {
    this.#historyId = historyId
    this.#filestoreBlobPrefix = filestoreBlobPrefix
    this.#clsiPerfVariant = clsiPerfVariant
    this.#globalBlobs = globalBlobs
  }

  /**
   * @param {string} hash
   * @return {URL}
   */
  getBlobURL(hash) {
    const u = new URL(Settings.apis.filestore.url)
    if (this.#filestoreBlobPrefix) {
      u.pathname = `${this.#filestoreBlobPrefix}/${hash}`
    } else if (this.#clsiPerfVariant) {
      u.host = Settings.apis.clsiPerf.host
      u.pathname = `/variant/${this.#clsiPerfVariant}/hash/${hash}`
    } else if (this.#globalBlobs.includes(hash)) {
      u.pathname = `/history/global/hash/${hash}`
    } else {
      u.pathname = `/history/project/${this.#historyId}/hash/${hash}`
    }
    return u
  }

  /**
   * @param {string} hash
   * @return {Promise<string>}
   */
  async getString(hash) {
    if (hash === File.EMPTY_FILE_HASH) return ''
    const u = this.getBlobURL(hash)
    let remainingAttempts = 3
    while (true) {
      try {
        return await fetchString(u, { signal: AbortSignal.timeout(3_000) })
      } catch (err) {
        if (err instanceof RequestFailedError && err.response.status === 404) {
          throw new Errors.NotFoundError()
        }
        remainingAttempts--
        if (remainingAttempts <= 0) throw err
        logger.warn(
          { err, url: u.href, remainingAttempts },
          'compile from cache: history blob download failed'
        )
        await setTimeout(100)
      }
    }
  }

  /**
   * @param {string} hash
   * @return {Promise<any>}
   */
  async getObject(hash) {
    const string = await this.getString(hash)
    return JSON.parse(string)
  }
}
