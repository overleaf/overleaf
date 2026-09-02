/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import UrlFetcher from './UrlFetcher.js'

import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import fs from 'node:fs'
import Path from 'node:path'
import { callbackify } from 'node:util'
import Metrics from '@overleaf/metrics'

const PENDING_DOWNLOADS = new Map()

function getProjectDir(projectId) {
  return Path.join(Settings.path.clsiCacheDir, projectId)
}

function getCachePath(projectId, url, lastModified) {
  // The url is a filestore URL.
  // It is sufficient to look at the path and mtime for uniqueness.
  const mtime = (lastModified && lastModified.getTime()) || 0
  const key = new URL(url).pathname.replace(/\//g, '-') + '-' + mtime
  return Path.join(getProjectDir(projectId), key)
}

async function clearProject(projectId, options) {
  const timer = new Metrics.Timer('url_cache', {
    status: options?.reason || 'unknown',
    path: 'delete',
  })
  await fs.promises.rm(getProjectDir(projectId), {
    force: true,
    recursive: true,
  })
  timer.done()
}

async function createProjectDir(projectId) {
  await fs.promises.mkdir(getProjectDir(projectId), { recursive: true })
}

async function tryCopyFile(src, dest) {
  try {
    await fs.promises.copyFile(src, dest)
    return true
  } catch (err) {
    if (err.code === 'ENOENT') return false
    throw err
  }
}

/**
 * Copy a url's file from the cache into destPath, downloading it first if it is
 * not cached yet.
 *
 * When `conversionSuffix` is set, the optimized result is cached alongside the
 * original at `<cachePath>.opt`. The file is downloaded to a per-user conversion
 * path and NOT copied to destPath: the caller is expected to process it (e.g.
 * convert a slow png to pdf) and then commit it with commitConversion (which
 * renames it onto `<cachePath>.opt`). In that case a
 * `{ conversionPath, cachePath, destPath }` handle is returned for the files that
 * were freshly downloaded (a cache hit returns undefined, as the already-final
 * file has been copied to destPath).
 *
 * @param {string} projectId
 * @param {string} url
 * @param {string|null} fallbackURL
 * @param {string} destPath
 * @param {Date} lastModified
 * @param {string} [conversionSuffix] when set the download is deferred to a
 *   conversion path for processing + commitConversion instead of being copied
 *   to destPath
 * @return {Promise<{ conversionPath: string, cachePath: string, destPath: string }|undefined>}
 */
async function downloadUrlToFile(
  projectId,
  url,
  fallbackURL,
  destPath,
  lastModified,
  conversionSuffix = ''
) {
  // When converting, the optimized result is cached alongside the original at
  // `<cachePath>.opt`, so switching modes can reuse either variant.
  const cachePath =
    getCachePath(projectId, url, lastModified) +
    (conversionSuffix ? '.opt' : '')

  {
    const timer = new Metrics.Timer('url_cache', {
      status: 'cache-hit',
      path: 'copy',
    })
    let copied = await tryCopyFile(cachePath, destPath)
    if (!copied && fallbackURL) {
      copied = await tryCopyFile(
        getCachePath(projectId, fallbackURL, lastModified) +
          (conversionSuffix ? '.opt' : ''),
        destPath
      )
    }
    // the metric is only updated if the file is present in the cache
    if (copied) {
      timer.done()
      return
    }
  }

  const conversionPath = cachePath + conversionSuffix
  {
    const timer = new Metrics.Timer('url_cache', {
      status: 'cache-miss',
      path: 'download',
    })
    try {
      await download(url, fallbackURL, conversionPath)
    } finally {
      timer.done()
    }
  }

  if (conversionSuffix) {
    return { conversionPath, cachePath, destPath }
  }

  {
    const timer = new Metrics.Timer('url_cache', {
      status: 'cache-miss',
      path: 'copy',
    })
    await fs.promises.copyFile(cachePath, destPath)
    timer.done()
  }
}

/**
 * Download a url to `targetPath`. UrlFetcher writes atomically (to its own
 * `targetPath + '~'` then renames onto targetPath). Concurrent downloads of the
 * same target are deduplicated.
 */
async function download(url, fallbackURL, targetPath) {
  let pending = PENDING_DOWNLOADS.get(targetPath)
  if (pending) {
    return pending
  }

  pending = UrlFetcher.promises.pipeUrlToFileWithRetry(
    url,
    fallbackURL,
    targetPath
  )
  PENDING_DOWNLOADS.set(targetPath, pending)
  try {
    await pending
  } finally {
    PENDING_DOWNLOADS.delete(targetPath)
  }
}

/**
 * Commit a converted cache file: atomically rename it onto the cache path, then
 * copy it to the destination.
 *
 * @param {string} conversionPath
 * @param {string} cachePath
 * @param {string} destPath
 * @return {Promise<void>}
 */
async function commitConversion(conversionPath, cachePath, destPath) {
  await fs.promises.rename(conversionPath, cachePath)
  const timer = new Metrics.Timer('url_cache', {
    status: 'cache-miss',
    path: 'copy',
  })
  await fs.promises.copyFile(cachePath, destPath)
  timer.done()
}

/**
 * Whether an optimised (png2pdf-converted) variant of a url is already cached.
 * The `.opt` entry is written by commitConversion even when the conversion
 * failed (holding the original bytes), so its presence means a conversion has
 * already been attempted for this content and should not be attempted again.
 *
 * @param {string} projectId
 * @param {string} url
 * @param {Date} lastModified
 * @return {Promise<boolean>}
 */
async function isConversionCached(projectId, url, lastModified) {
  const cachePath = getCachePath(projectId, url, lastModified) + '.opt'
  try {
    await fs.promises.access(cachePath)
    return true
  } catch (err) {
    if (err.code === 'ENOENT') return false
    logger.warn(
      { err, projectId, url, cachePath },
      'failure checking cache for converted file'
    )
    return false
  }
}

export default {
  clearProject: callbackify(clearProject),
  createProjectDir: callbackify(createProjectDir),
  downloadUrlToFile: callbackify(downloadUrlToFile),
  getProjectCacheDir: getProjectDir,
  promises: {
    clearProject,
    createProjectDir,
    downloadUrlToFile,
    commitConversion,
    isConversionCached,
  },
}
