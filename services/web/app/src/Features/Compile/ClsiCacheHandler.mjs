import _ from 'lodash'
import {
  fetchNothing,
  fetchRedirectWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import OError from '@overleaf/o-error'
import { NotFoundError, InvalidNameError } from '../Errors/Errors.js'
import Features from '../../infrastructure/Features.mjs'
import Path from 'node:path'

const TIMEOUT = 4_000

/**
 * @type {Map<string, number>}
 */
const lastFailures = new Map()

/**
 * Keep in sync with validateFilename in services/clsi-cache/app/js/utils.js
 *
 * @param {string} filename
 */
function validateFilename(filename) {
  if (filename.split('/').includes('..')) {
    throw new InvalidNameError('path traversal')
  }
  if (
    !(
      [
        'output.blg',
        'output.log',
        'output.pdf',
        'output.synctex.gz',
        'output.overleaf.json',
        'output.tar.gz',
      ].includes(filename) || filename.endsWith('.blg')
    )
  ) {
    throw new InvalidNameError('bad filename')
  }
}

/**
 * Keep in sync with getIngressLabel in services/clsi-cache/app/js/utils.js
 *
 * @param {string} fsPath
 * @return {string}
 */
function getEgressLabel(fsPath) {
  if (fsPath.endsWith('.blg')) {
    // .blg files may have custom names and can be in nested folders.
    return 'output.blg'
  }
  // The rest is limited to 5 file names via validateFilename: output.pdf, etc.
  return fsPath
}

/**
 * Clear the cache on all clsi-cache instances.
 *
 * @param projectId
 * @param userId
 * @return {Promise<void>}
 */
async function clearCache(projectId, userId) {
  if (!Features.hasFeature('saas')) return

  let path = `/project/${projectId}`
  if (userId) {
    path += `/user/${userId}`
  }
  path += '/output'

  await Promise.all(
    Settings.apis.clsiCache.instances.map(async ({ url, shard }) => {
      const u = new URL(url)
      u.pathname = path
      try {
        await fetchNothing(u, {
          method: 'DELETE',
          signal: AbortSignal.timeout(TIMEOUT),
        })
      } catch (err) {
        throw OError.tag(err, 'clear clsi-cache', { url, shard })
      }
    })
  )
}

/**
 * Get an output file from a specific build.
 *
 * @param projectId
 * @param userId
 * @param buildId
 * @param filename
 * @param signal
 * @return {Promise<{size: number, zone: string, shard: string, location: string, lastModified: Date, allFiles: string[]}>}
 */
async function getOutputFile(
  projectId,
  userId,
  buildId,
  filename,
  signal = AbortSignal.timeout(TIMEOUT)
) {
  validateFilename(filename)
  if (!/^[a-f0-9-]+$/.test(buildId)) {
    throw new InvalidNameError('bad buildId')
  }

  let path = `/project/${projectId}`
  if (userId) {
    path += `/user/${userId}`
  }
  path += `/build/${buildId}/search/output/${filename}`
  return getRedirectWithFallback(projectId, userId, path, signal)
}

/**
 * Get an output file from the most recent build.
 *
 * @param projectId
 * @param userId
 * @param filename
 * @param signal
 * @return {Promise<{size: number, zone: string, shard: string, location: string, lastModified: Date, allFiles: string[]}>}
 */
async function getLatestOutputFile(
  projectId,
  userId,
  filename,
  signal = AbortSignal.timeout(TIMEOUT)
) {
  validateFilename(filename)

  let path = `/project/${projectId}`
  if (userId) {
    path += `/user/${userId}`
  }
  path += `/latest/output/${filename}`
  return getRedirectWithFallback(projectId, userId, path, signal)
}

/**
 * Request the given path from any of the clsi-cache instances.
 *
 * Some of them might be down temporarily. Try the next one until we receive a redirect or 404.
 *
 * This function is similar to the Coordinator in the clsi-cache, notable differences:
 * - all the logic for sorting builds is in clsi-cache (re-used by clsi and web)
 * - fan-out (1 client performs lookup on many clsi-cache instances) is "central" in clsi-cache, resulting in better connection re-use
 * - we only cross the k8s cluster boundary via an internal GCLB once ($$$)
 *
 * @param projectId
 * @param userId
 * @param path
 * @param signal
 * @return {Promise<{size: number, zone: string, shard: string, location: string, lastModified: Date, allFiles: string[]}>}
 */
async function getRedirectWithFallback(
  projectId,
  userId,
  path,
  signal = AbortSignal.timeout(TIMEOUT)
) {
  // Avoid hitting the same instance first all the time.
  const instances = _.shuffle(Settings.apis.clsiCache.instances)
  for (const { url, shard } of instances) {
    if (signal.aborted) {
      break // Stop trying the next backend when the signal has expired.
    }
    const lastFailure = lastFailures.get(url) ?? 0
    if (lastFailure) {
      // Circuit breaker that avoids retries for 4-16s.
      const retryDelay = TIMEOUT * (1 + 3 * Math.random())
      if (performance.now() - lastFailure < retryDelay) {
        continue
      }
    }

    const u = new URL(url)
    u.pathname = path
    try {
      const {
        location,
        response: { headers },
      } = await fetchRedirectWithResponse(u, {
        signal,
      })
      lastFailures.delete(url) // The shard is back up.
      let allFilesRaw = headers.get('X-All-Files')
      if (!allFilesRaw.startsWith('[')) {
        allFilesRaw = Buffer.from(allFilesRaw, 'base64url').toString()
      }
      // Success, return the cache entry.
      return {
        location,
        zone: headers.get('X-Zone'),
        shard: headers.get('X-Shard') || 'cache',
        lastModified: new Date(headers.get('X-Last-Modified')),
        size: parseInt(headers.get('X-Content-Length'), 10),
        allFiles: JSON.parse(allFilesRaw),
      }
    } catch (err) {
      if (err instanceof RequestFailedError && err.response.status === 404) {
        lastFailures.delete(url) // The shard is back up.
        break // No clsi-cache instance has cached something for this project/user.
      }
      lastFailures.set(url, performance.now()) // The shard is unhealthy. Refresh timestamp of last failure.
      logger.warn(
        { err, projectId, userId, url, shard },
        'getLatestOutputFile from clsi-cache failed'
      )
      // This clsi-cache instance is down, try the next backend.
    }
  }
  throw new NotFoundError('nothing cached yet')
}

/**
 * Populate the clsi-cache for the given project/user with the provided source
 *
 * This is either another project, or a template (id+version).
 *
 * @param projectId
 * @param userId
 * @param sourceProjectId
 * @param templateVersionId
 * @param imageName
 * @param lastUpdated
 * @param shard
 * @param signal
 * @return {Promise<void>}
 */
async function prepareCacheSource(
  projectId,
  userId,
  { sourceProjectId, templateVersionId, imageName, lastUpdated, shard, signal }
) {
  imageName = Path.basename(imageName)
  const url = new URL(
    `/project/${projectId}/user/${userId}/import-from`,
    Settings.apis.clsiCache.instances.find(i => i.shard === shard).url
  )
  try {
    await fetchNothing(url, {
      method: 'POST',
      json: {
        sourceProjectId,
        lastUpdated,
        templateVersionId,
        imageName,
      },
      signal,
    })
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      throw new NotFoundError()
    }
    throw err
  }
}

/**
 * Populate the clsi-cache for a template using a submission build
 *
 * @param clsiCacheShard
 * @param submissionId
 * @param buildId
 * @param templateVersionId
 * @param imageName
 * @return {Promise<void>}
 */
async function exportSubmissionAsTemplate(
  clsiCacheShard,
  submissionId,
  buildId,
  templateVersionId,
  imageName
) {
  imageName = Path.basename(imageName)
  const url = new URL(
    `/submission/${submissionId}/build/${buildId}/export-as-template`,
    Settings.apis.clsiCache.instances.find(i => i.shard === clsiCacheShard).url
  )
  try {
    await fetchNothing(url, {
      method: 'POST',
      json: {
        templateVersionId,
        imageName,
      },
      // clsi-cache will poll up-to 15s for the output to be copied from clsi.
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      throw new NotFoundError()
    }
    throw err
  }
}

export default {
  TIMEOUT,
  getEgressLabel,
  clearCache,
  getOutputFile,
  getLatestOutputFile,
  prepareCacheSource,
  exportSubmissionAsTemplate,
}
