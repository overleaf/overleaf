// @ts-check
import crypto from 'node:crypto'
import fs from 'node:fs'
import Path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { crc32, createGzip, createGunzip } from 'node:zlib'
import tarFs from 'tar-fs'
import _ from 'lodash'
import {
  fetchNothing,
  fetchStream,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import logger from '@overleaf/logger'
import Metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import { MeteredStream } from '@overleaf/stream-utils'
import OutputCacheManager from './OutputCacheManager.js'
import ResourceWriter from './ResourceWriter.js'
import OError from '@overleaf/o-error'

const { CACHE_SUBDIR } = OutputCacheManager
const { isExtraneousFile } = ResourceWriter

const TIMEOUT = 5_000
/**
 * @type {Map<string, number>}
 */
const lastFailures = new Map()
const TIMING_BUCKETS = [
  0, 10, 100, 1000, 2000, 5000, 10000, 15000, 20000, 30000,
]
const MAX_ENTRIES_IN_OUTPUT_TAR = 100
const MAX_BLG_FILES = 50
const OBJECT_ID_REGEX = /^[0-9a-f]{24}$/

const MIGRATE_FROM = new Date('2026-01-14').getTime()
const MIGRATE_UNTIL = new Date('2026-01-21').getTime()

/**
 * @param {string} projectId
 * @return {{shard: string, url: string}|undefined}
 */
function getAvailableShard(projectId) {
  // Layout of mongodb object id bytes:
  // [timestamp 4bytes][random per machine 5bytes][counter 3bytes]
  //                                          [32bit       4bytes]
  const last4Bytes = Buffer.from(projectId, 'hex').subarray(8, 12)
  const counter = last4Bytes.readUInt32BE()

  let shards = Settings.apis.clsiCache.shards.slice(
    0,
    Settings.apis.clsiCache.currentShards
  )
  const now = Date.now()
  if (
    now > MIGRATE_FROM &&
    now < MIGRATE_UNTIL &&
    (counter % 100) / 100 <
      (MIGRATE_UNTIL - now) / (MIGRATE_UNTIL - MIGRATE_FROM)
  ) {
    shards = Settings.apis.clsiCache.shards.slice(
      0,
      Settings.apis.clsiCache.desiredShards
    )
  }

  let i = 0
  while (shards.length > 0) {
    const idx = crc32(`${projectId}-${i++}`) % shards.length
    const candidate = shards[idx]
    if (!isCircuitBreakerTripped(candidate.url)) return candidate
    shards.splice(idx, 1)
  }
  return undefined
}

/**
 * @param {string} url
 * @return {boolean}
 */
function isCircuitBreakerTripped(url) {
  const lastFailure = lastFailures.get(url) ?? 0
  if (lastFailure) {
    // Circuit breaker that avoids retries for 5-20s.
    const retryDelay = TIMEOUT * (1 + 3 * Math.random())
    if (performance.now() - lastFailure < retryDelay) {
      return true
    }
  }
  return false
}

/**
 * @param {string} url
 */
function tripCircuitBreaker(url) {
  lastFailures.set(url, performance.now()) // The shard is unhealthy. Refresh timestamp of last failure.
}

/**
 * @param {string} url
 */
function closeCircuitBreaker(url) {
  lastFailures.delete(url) // The shard is back up.
}

/**
 * @param {Object} opts
 * @param {string} opts.projectId
 * @param {string} opts.userId
 * @param {string} opts.buildId
 * @param {string} opts.editorId
 * @param {[{path: string}]} opts.outputFiles
 * @param {string} opts.compileGroup
 * @param {Record<string, number>} opts.stats
 * @param {Record<string, number>} opts.timings
 * @param {Record<string, any>} opts.options
 * @return {string | undefined}
 */
function notifyCLSICacheAboutBuild({
  projectId,
  userId,
  buildId,
  editorId,
  outputFiles,
  compileGroup,
  stats,
  timings,
  options,
}) {
  if (!Settings.apis.clsiCache.enabled) return undefined
  if (!OBJECT_ID_REGEX.test(projectId)) return undefined
  const shardCfg = getAvailableShard(projectId)
  if (!shardCfg) return undefined
  const { url, shard } = shardCfg

  /**
   * @param {{path: string}[]} files
   */
  const enqueue = files => {
    const body = Buffer.from(
      JSON.stringify({
        projectId,
        userId,
        buildId,
        editorId,
        files,
        downloadHost: Settings.apis.clsi.downloadHost,
        clsiServerId: Settings.apis.clsi.clsiServerId,
        compileGroup,
        stats,
        timings,
        options,
      })
    )
    const bodySize = body.byteLength
    if (bodySize > 10_000_000) {
      const outputPDF = files.find(f => f.path === 'output.pdf')
      logger.warn(
        {
          projectId,
          userId,
          bodySize,
          nFiles: files.length,
          outputPDFSize:
            outputPDF && Buffer.from(JSON.stringify(outputPDF)).byteLength,
          nPDFCachingRanges:
            outputPDF &&
            'ranges' in outputPDF &&
            Array.isArray(outputPDF.ranges) &&
            outputPDF.ranges.length,
        },
        'large clsi-cache request'
      )
    }
    Metrics.count('clsi_cache_enqueue_files', files.length)
    fetchNothing(`${url}/enqueue`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
    })
      .then(() => {
        closeCircuitBreaker(url)
      })
      .catch(err => {
        tripCircuitBreaker(url)
        logger.warn(
          { err, projectId, userId, buildId, shard },
          'enqueue for clsi-cache failed'
        )
      })
  }

  // PDF preview
  enqueue(
    outputFiles
      .filter(
        f =>
          f.path === 'output.pdf' ||
          f.path === 'output.log' ||
          f.path === 'output.synctex.gz'
      )
      .concat(
        outputFiles.filter(f => f.path.endsWith('.blg')).slice(0, MAX_BLG_FILES)
      )
      .map(f => {
        const lean = { path: f.path }
        if (f.path === 'output.pdf') {
          Object.assign(lean, _.pick(f, 'path', 'size', 'contentId', 'ranges'))
        }
        return lean
      })
  )

  // Compile Cache
  buildTarball({ projectId, userId, buildId, outputFiles })
    .then(() => {
      enqueue([{ path: 'output.tar.gz' }])
    })
    .catch(err => {
      logger.warn(
        { err, projectId, userId, buildId, shard },
        'build output.tar.gz for clsi-cache failed'
      )
    })

  return shard
}

/**
 * @param {Object} opts
 * @param {string} opts.projectId
 * @param {string} opts.userId
 * @param {string} opts.buildId
 * @param {[{path: string}]} opts.outputFiles
 * @return {Promise<void>}
 */
async function buildTarball({ projectId, userId, buildId, outputFiles }) {
  const timer = new Metrics.Timer('clsi_cache_build', 1, {}, TIMING_BUCKETS)
  const outputDir = Path.join(
    Settings.path.outputDir,
    userId ? `${projectId}-${userId}` : projectId,
    CACHE_SUBDIR,
    buildId
  )

  const files = outputFiles.filter(f => !isExtraneousFile(f.path))
  if (files.length > MAX_ENTRIES_IN_OUTPUT_TAR) {
    Metrics.inc('clsi_cache_build_too_many_entries')
    throw new OError('too many output files for output.tar.gz', {
      nFiles: files.length,
    })
  }
  Metrics.count('clsi_cache_build_files', files.length)

  const path = Path.join(outputDir, 'output.tar.gz')
  try {
    await pipeline(
      tarFs.pack(outputDir, { entries: files.map(f => f.path) }),
      createGzip(),
      fs.createWriteStream(path)
    )
  } catch (err) {
    try {
      await fs.promises.unlink(path)
    } catch (e) {}
    throw err
  } finally {
    timer.done()
  }
}

/**
 * @param {string} projectId
 * @param {string} userId
 * @param {string} editorId
 * @param {string} buildId
 * @param {string} outputDir
 * @return {Promise<boolean>}
 */
async function downloadOutputDotSynctexFromCompileCache(
  projectId,
  userId,
  editorId,
  buildId,
  outputDir
) {
  if (!Settings.apis.clsiCache.enabled) return false
  if (!OBJECT_ID_REGEX.test(projectId)) return false
  const shardCfg = getAvailableShard(projectId)
  if (!shardCfg) return false
  const { url, shard } = shardCfg

  const timer = new Metrics.Timer(
    'clsi_cache_download',
    1,
    { method: 'synctex' },
    TIMING_BUCKETS
  )
  let stream
  try {
    stream = await fetchStream(
      `${url}/project/${projectId}/${
        userId ? `user/${userId}/` : ''
      }build/${editorId}-${buildId}/search/output/output.synctex.gz`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT),
      }
    )
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      closeCircuitBreaker(url)
      timer.done({ status: 'not-found' })
      return false
    }
    tripCircuitBreaker(url)
    timer.done({ status: 'error' })
    throw OError.tag(err, 'download failed', { shard })
  }
  await fs.promises.mkdir(outputDir, { recursive: true })
  const dst = Path.join(outputDir, 'output.synctex.gz')
  const tmp = dst + crypto.randomUUID()
  try {
    await pipeline(
      stream,
      new MeteredStream(Metrics, 'clsi_cache_egress', {
        path: 'output.synctex.gz',
      }),
      fs.createWriteStream(tmp)
    )
    await fs.promises.rename(tmp, dst)
  } catch (err) {
    if (isENOENT(err)) return false
    tripCircuitBreaker(url)
    try {
      await fs.promises.unlink(tmp)
    } catch {}
    throw OError.tag(err, 'stream failed', { shard })
  }
  closeCircuitBreaker(url)
  timer.done({ status: 'success' })
  return true
}

/**
 * @param {string} projectId
 * @param {string} userId
 * @param {string} compileDir
 * @return {Promise<boolean>}
 */
async function downloadLatestCompileCache(projectId, userId, compileDir) {
  if (!Settings.apis.clsiCache.enabled) return false
  if (!OBJECT_ID_REGEX.test(projectId)) return false
  const shardCfg = getAvailableShard(projectId)
  if (!shardCfg) return false
  const { url, shard } = shardCfg

  const timer = new Metrics.Timer(
    'clsi_cache_download',
    1,
    { method: 'tar' },
    TIMING_BUCKETS
  )
  let stream
  try {
    stream = await fetchStream(
      `${url}/project/${projectId}/${
        userId ? `user/${userId}/` : ''
      }latest/output/output.tar.gz`,
      {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT),
      }
    )
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      closeCircuitBreaker(url)
      timer.done({ status: 'not-found' })
      return false
    }
    tripCircuitBreaker(url)
    timer.done({ status: 'error' })
    throw OError.tag(err, 'download failed', { shard })
  }
  let n = 0
  let abort = false
  try {
    await pipeline(
      stream,
      new MeteredStream(Metrics, 'clsi_cache_egress', {
        path: 'output.tar.gz',
      }),
      createGunzip(),
      tarFs.extract(compileDir, {
        // use ignore hook for counting entries (files+folders) and validation.
        // Include folders as they incur mkdir calls.
        ignore(_, header) {
          if (abort) return true // log once
          n++
          if (n > MAX_ENTRIES_IN_OUTPUT_TAR) {
            abort = true
            logger.warn(
              {
                projectId,
                userId,
                compileDir,
              },
              'too many entries in tar-ball from clsi-cache'
            )
          } else if (header.type !== 'file' && header.type !== 'directory') {
            abort = true
            logger.warn(
              {
                projectId,
                userId,
                compileDir,
                entryType: header.type,
              },
              'unexpected entry in tar-ball from clsi-cache'
            )
          }
          return abort
        },
      })
    )
  } catch (err) {
    if (isENOENT(err)) return false
    tripCircuitBreaker(url)
    throw OError.tag(err, 'stream failed', { shard })
  }
  closeCircuitBreaker(url)
  Metrics.count('clsi_cache_download_entries', n)
  timer.done({ status: 'success' })
  return !abort
}

/**
 * @param {unknown} err
 */
function isENOENT(err) {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT'
}

export default {
  notifyCLSICacheAboutBuild,
  downloadLatestCompileCache,
  downloadOutputDotSynctexFromCompileCache,
}
