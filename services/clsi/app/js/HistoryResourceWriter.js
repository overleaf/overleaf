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
  BlobStoreBase,
  Change,
  EditFileOperation,
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
import Png2Pdf from './Png2Pdf.js'

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

/**
 * @param {string} path
 * @return {boolean}
 */
function isPng(path) {
  return Path.extname(path).toLowerCase() === '.png'
}

/**
 * Returns true if the PNG file size (bytes) is below the conversion threshold
 * @param {number} fileSize
 * @returns {boolean}
 */

function pngBelowSizeThreshold(fileSize) {
  return fileSize < Settings.png2pdfMinFileSizeBytes
}

export const clearCacheCb = callbackify(clearCache)

/**
 * @param {string} projectId
 * @param {string} userId
 * @param {string} cacheKey
 * @return {Promise<void>}
 */
export async function clearCache(projectId, userId, cacheKey) {
  const { dir } = snapshotPath(cacheKey)
  try {
    await fs.promises.rm(dir, { recursive: true, force: true })
  } catch (err) {
    if (isENOENT(err)) return
    logger.warn(
      { err, projectId, userId, cacheKey },
      'compile from cache: failed to clear history cache'
    )
  }
}

/**
 * @param {string} cacheKey
 * @return {{ dir: string, path: string, resyncPath: string, slowPngPath: string }}
 */
function snapshotPath(cacheKey) {
  const dir = Path.join(Settings.path.clsiCacheDir, cacheKey)

  const path = Path.join(dir, 'history.json.gz')
  const resyncPath = Path.join(dir, 'history-resync.json.gz')
  // The set of PNGs the last compile flagged as slow (needing png2pdf). Written
  // after the compile (the info is only available then), read on the next sync.
  const slowPngPath = Path.join(dir, 'png2pdf-slow.json')
  return { dir, path, resyncPath, slowPngPath }
}

/**
 * Persist the list of "slow" PNG paths (those that could not be fast-copied and
 * would benefit from png2pdf conversion) learned from the compile that just ran,
 * so the next sync can convert only those files. Best-effort: a failure here just
 * means the next sync falls back to the previous list (or converts nothing new).
 *
 * @param {string} cacheKey
 * @param {string[]} slowPngs
 * @return {Promise<void>}
 */
export async function saveSlowPngList(cacheKey, slowPngs) {
  const { dir, slowPngPath } = snapshotPath(cacheKey)
  const tmp = slowPngPath + '~'
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(tmp, JSON.stringify(slowPngs))
  await fs.promises.rename(tmp, slowPngPath)
}

/**
 * @param {string} cacheKey
 * @return {Promise<string[]>}
 */
async function loadSlowPngList(cacheKey) {
  const { slowPngPath } = snapshotPath(cacheKey)
  try {
    const blob = await fs.promises.readFile(slowPngPath, 'utf-8')
    const list = JSON.parse(blob)
    return Array.isArray(list) ? list : []
  } catch (err) {
    if (!isENOENT(err)) {
      logger.warn(
        { err, cacheKey },
        'compile from cache: cannot read slow-png list'
      )
    }
    return []
  }
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
 * @param {string} cacheKey
 * @param {number} remoteBaseVersion
 * @param {boolean} populateClsiCache
 * @return {Promise<{rawSnapshot: import('overleaf-editor-core/lib/types.js').RawSnapshot, globalBlobs: string[], fullSync: boolean,localBaseVersion: number, dirty: string[], png2pdf: boolean}>}
 */
async function loadSnapshot(
  projectId,
  userId,
  cacheKey,
  remoteBaseVersion,
  populateClsiCache
) {
  const { path, resyncPath } = snapshotPath(cacheKey)
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
          { err, projectId, userId, cacheKey },
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
        cacheKey,
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
          { err, projectId, userId, cacheKey },
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
 * @param {string} cacheKey
 * @param {number} remoteBaseVersion
 * @return {Promise<{rawSnapshot: import('overleaf-editor-core/lib/types.js').RawSnapshot, globalBlobs: string[], fullSync: boolean,localBaseVersion: number, dirty: string[], png2pdf: boolean}>}
 */
async function loadSnapshotFromClsiCache(
  projectId,
  userId,
  cacheKey,
  remoteBaseVersion
) {
  const { dir, resyncPath } = snapshotPath(cacheKey)
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
 * @return {Promise<{rawSnapshot: import('overleaf-editor-core/lib/types.js').RawSnapshot, globalBlobs: string[], localBaseVersion: number, fullSync: boolean, dirty: string[], png2pdf: boolean}>}
 */
async function loadSnapshotFromFile(path, remoteBaseVersion, fullSync) {
  let blob = await fs.promises.readFile(path)
  blob = await gunzip(blob)
  const {
    rawSnapshot,
    globalBlobs,
    localBaseVersion,
    dirty = [], // added later, provide a default value.
    png2pdf = false, // the png2pdf mode used for the last sync, added later.
  } = JSON.parse(blob.toString('utf-8'))
  if (localBaseVersion < remoteBaseVersion) {
    throw new Errors.MissingUpdatesError('missing updates', {
      baseHistoryVersion: localBaseVersion,
    })
  }
  return {
    rawSnapshot,
    globalBlobs,
    localBaseVersion,
    fullSync,
    dirty,
    png2pdf,
  }
}

/**
 * @param {string} cacheKey
 * @param {Snapshot} snapshot
 * @param {number} localBaseVersion
 * @param {string[]} globalBlobs
 * @param {string[]} dirty
 * @param {boolean} png2pdf the png2pdf mode used for this sync
 * @return {Promise<void>}
 */
async function saveSnapshot(
  cacheKey,
  snapshot,
  localBaseVersion,
  globalBlobs,
  dirty,
  png2pdf
) {
  const { dir, path } = snapshotPath(cacheKey)
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
        png2pdf,
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
 * @param {string} cacheKey
 * @return {Promise<void>}
 */
async function deleteResyncSnapshot(projectId, userId, cacheKey) {
  const { resyncPath } = snapshotPath(cacheKey)
  try {
    await fs.promises.unlink(resyncPath)
  } catch (err) {
    if (!isENOENT(err)) {
      logger.warn(
        { err, projectId, userId, cacheKey },
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
 * @param {Record<string, number>} stats
 * @return {Promise<{baseHistoryVersion: number, resourceList: {path: string}[]}>}
 */
export async function syncResourcesToDisk(
  projectId,
  userId,
  request,
  compileDir,
  timings,
  stats
) {
  // - logged in user: <project-id>-<user-id>
  // - anonymous user: <project-id>
  // - conversion job: <uuid>
  const cacheKey = Path.basename(compileDir)
  const remoteBaseVersion = request.baseHistoryVersion
  let rawSnapshot,
    globalBlobs,
    localBaseVersion,
    source,
    dirty,
    fullSync,
    lastPng2pdf
  try {
    ;({
      rawSnapshot,
      globalBlobs,
      fullSync,
      localBaseVersion,
      dirty,
      png2pdf: lastPng2pdf,
    } = await loadSnapshot(
      projectId,
      userId,
      cacheKey,
      remoteBaseVersion,
      request.populateClsiCache
    ))
    source = fullSync ? 'clsi-cache' : 'local'
    logger.debug(
      { projectId, userId, cacheKey, localBaseVersion, remoteBaseVersion },
      'compile from cache: using existing snapshot'
    )
  } catch (err) {
    if (!request.rawSnapshot) throw err
    if (!(err instanceof Errors.MissingUpdatesError)) {
      logger.warn(
        { err, projectId, userId, cacheKey },
        'compile from cache: bad local history state during full resync'
      )
    }
    logger.debug(
      { projectId, userId, cacheKey },
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

  const pngModeChanged = lastPng2pdf !== request.png2pdf

  const blobStore = new BlobStore(
    request.historyId,
    request.filestoreBlobPrefix,
    request.clsiPerfVariant,
    globalBlobs
  )

  // Decide which PNGs to convert. A PNG is converted when a previous compile
  // flagged it as "slow" and it is large enough to be worth converting; keeping
  // that decision here means the sync loop below just checks membership.
  const png2pdfActive = request.png2pdf && Png2Pdf.isEnabled()
  // todo: generated for every project for analytics, filter to only  request.png2pdf && Png2Pdf.isEnabled() once rollout completes
  const slowPngs = new Set(await loadSlowPngList(cacheKey))

  // for analytics purposes, we want to generate candidate list for all projects, regardless if they are in fastPNG mode
  let shouldConvert = new Set()
  for (const path of snapshot.getFilePathnames()) {
    if (!isPng(path) || !slowPngs.has(path)) continue
    // Avoid doing unnecessary work converting small PNGs.
    const fileSize = snapshot.getFile(path)?.getByteLength() || 0
    if (pngBelowSizeThreshold(fileSize)) {
      Metrics.inc('png2pdf-skipped-small')
      continue
    }
    shouldConvert.add(path)
  }

  // for analytics to determine if a project could have converted PNG's, even if they arent in the rollout
  if (shouldConvert.size > 0) {
    stats['optimisable-png-count'] = shouldConvert.size
    stats.projectHasUnconvertedPngs = 1
  }

  // only actually convert if png2pdf was enabled and user compile is eligible
  if (!png2pdfActive) {
    shouldConvert = new Set()
  }

  // On a png2pdf mode switch, also re-serve PNGs that a previous compile already
  // optimised. Once converted, a PNG is no longer flagged slow (it is included
  // as a PDF), so it drops off the slow-list; without this it would revert to
  // the original when toggling png2pdf off and back on. The optimised variant is
  // served from the <cachePath>.opt cache, so this is a cheap local cache stat.
  if (png2pdfActive && pngModeChanged) {
    const candidates = snapshot
      .getFilePathnames()
      .filter(path => isPng(path) && !shouldConvert.has(path))
    await promiseMapSettledWithLimit(
      Settings.parallelFileDownloads,
      candidates,
      async path => {
        const hash = snapshot.getFile(path)?.getHash()
        if (!hash) return
        const url = blobStore.getBlobURL(hash).href
        const cached = await UrlCache.promises.isConversionCached(
          projectId,
          url,
          new Date(0)
        )
        if (cached) shouldConvert.add(path)
      }
    )
  }

  const changedPaths = []
  if (fullSync) {
    changedPaths.push(...snapshot.getFilePathnames())
    logger.debug(
      { projectId, userId, cacheKey },
      'compile from cache: full sync'
    )
  } else {
    const dedupe = new Set(dirty)
    if (request.draft) {
      dedupe.add(request.rootResourcePath)
    }
    if (pngModeChanged) {
      // When the png2pdf mode changed since the last sync, the on-disk images are in the wrong variant (optimized vs original). Re-sync them so they are converted (served from the <cachePath>.opt cache) or restored to the original png.
      for (const path of snapshot.getFilePathnames()) {
        if (isPng(path)) dedupe.add(path)
      }
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
    // Include PNGs known to be slow for png2pdf conversion. The presence of
    // an optimised (.opt) cache entry means the conversion was already
    // attempted (success or failure), so we skip those and never retry.
    // The .opt cache is keyed by content hash, so a new PNG at the same path
    // has no entry and is attempted.
    for (const path of shouldConvert) {
      if (dedupe.has(path)) continue
      const hash = snapshot.getFile(path)?.getHash()
      if (!hash) continue
      const url = blobStore.getBlobURL(hash).href
      const attempted = await UrlCache.promises.isConversionCached(
        projectId,
        url,
        new Date(0)
      )
      if (!attempted) dedupe.add(path)
    }
    changedPaths.push(...dedupe)
    logger.debug(
      { projectId, userId, cacheKey, changedPaths },
      'compile from cache: incremental sync'
    )
  }

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
  const pngFilesToConvert = []

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
        const destPath = Path.join(compileDir, path)
        try {
          const fallbackURL = null // no fallback
          const lastModified = new Date(0) // content is static
          // PNGs selected for conversion go through a batch conversion process
          // first (see shouldConvert above).
          if (shouldConvert.has(path)) {
            const toConvert = await UrlCache.promises.downloadUrlToFile(
              projectId,
              url,
              fallbackURL,
              destPath,
              lastModified,
              // Avoid sharing the conversion file between two users.
              cacheKey
            )
            if (toConvert) {
              pngFilesToConvert.push(toConvert)
            }
          } else {
            await UrlCache.promises.downloadUrlToFile(
              projectId,
              url,
              fallbackURL,
              destPath,
              lastModified
            )
          }
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

  if (pngFilesToConvert.length) {
    const cacheDir = UrlCache.getProjectCacheDir(projectId)
    try {
      await Png2Pdf.convertPngFilesInCacheDir(
        projectId,
        cacheDir,
        pngFilesToConvert.map(f => Path.relative(cacheDir, f.conversionPath)),
        stats,
        timings
      )
    } catch (err) {
      logger.warn(
        { err, projectId, userId, count: pngFilesToConvert.length },
        'png2pdf conversion failed, using original png(s)'
      )
    }
    for (const f of pngFilesToConvert) {
      try {
        await UrlCache.promises.commitConversion(
          f.conversionPath,
          f.cachePath,
          f.destPath
        )
      } catch (err) {
        logger.err(
          { err, projectId, userId, path: f.destPath },
          'error copying file for resources'
        )
        Metrics.inc('download-failed')
      }
    }
  }
  const baseHistoryVersion = localBaseVersion + changes.length
  if (
    fullSync ||
    changes.length ||
    wasDirty ||
    dirty.length ||
    pngModeChanged
  ) {
    await saveSnapshot(
      cacheKey,
      snapshot,
      baseHistoryVersion,
      globalBlobs,
      dirty,
      request.png2pdf
    )
  }
  if (fullSync) {
    await deleteResyncSnapshot(projectId, userId, cacheKey)
  }
  return {
    baseHistoryVersion,
    resourceList: snapshot.getFilePathnames().map(path => ({ path })),
  }
}

class BlobStore extends BlobStoreBase {
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
    super()
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
  async fetchString(hash) {
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
}
