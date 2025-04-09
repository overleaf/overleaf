const _ = require('lodash')
const {
  fetchNothing,
  fetchRedirectWithResponse,
  RequestFailedError,
} = require('@overleaf/fetch-utils')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const { NotFoundError, InvalidNameError } = require('../Errors/Errors')

function validateFilename(filename) {
  if (
    ![
      'output.blg',
      'output.log',
      'output.pdf',
      'output.synctex.gz',
      'output.overleaf.json',
      'output.tar.gz',
    ].includes(filename) ||
    filename.endsWith('.blg')
  ) {
    throw new InvalidNameError('bad filename')
  }
}

/**
 * Clear the cache on all clsi-cache instances.
 *
 * @param projectId
 * @param userId
 * @return {Promise<void>}
 */
async function clearCache(projectId, userId) {
  let path = `/project/${projectId}`
  if (userId) {
    path += `/user/${userId}`
  }
  path += '/output'

  await Promise.all(
    Settings.apis.clsiCache.instances.map(async ({ url, zone }) => {
      const u = new URL(url)
      u.pathname = path
      try {
        await fetchNothing(u, {
          method: 'DELETE',
          signal: AbortSignal.timeout(15_000),
        })
      } catch (err) {
        throw OError.tag(err, 'clear clsi-cache', { url, zone })
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
 * @return {Promise<{size: number, zone: string, location: string, lastModified: Date, allFiles: string[]}>}
 */
async function getOutputFile(
  projectId,
  userId,
  buildId,
  filename,
  signal = AbortSignal.timeout(15_000)
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
 * @return {Promise<{size: number, zone: string, location: string, lastModified: Date, allFiles: string[]}>}
 */
async function getLatestOutputFile(
  projectId,
  userId,
  filename,
  signal = AbortSignal.timeout(15_000)
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
 * @return {Promise<{size: number, zone: string, location: string, lastModified: Date, allFiles: string[]}>}
 */
async function getRedirectWithFallback(
  projectId,
  userId,
  path,
  signal = AbortSignal.timeout(15_000)
) {
  // Avoid hitting the same instance first all the time.
  const instances = _.shuffle(Settings.apis.clsiCache.instances)
  for (const { url, zone } of instances) {
    const u = new URL(url)
    u.pathname = path
    try {
      const {
        location,
        response: { headers },
      } = await fetchRedirectWithResponse(u, {
        signal,
      })
      // Success, return the cache entry.
      return {
        location,
        zone: headers.get('X-Zone'),
        lastModified: new Date(headers.get('X-Last-Modified')),
        size: parseInt(headers.get('X-Content-Length'), 10),
        allFiles: JSON.parse(headers.get('X-All-Files')),
      }
    } catch (err) {
      if (err instanceof RequestFailedError && err.response.status === 404) {
        break // No clsi-cache instance has cached something for this project/user.
      }
      logger.warn(
        { err, projectId, userId, url, zone },
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
 * @param templateId
 * @param templateVersionId
 * @param lastUpdated
 * @param zone
 * @param signal
 * @return {Promise<void>}
 */
async function prepareCacheSource(
  projectId,
  userId,
  { sourceProjectId, templateId, templateVersionId, lastUpdated, zone, signal }
) {
  const url = new URL(
    `/project/${projectId}/user/${userId}/import-from`,
    Settings.apis.clsiCache.instances.find(i => i.zone === zone).url
  )
  try {
    await fetchNothing(url, {
      method: 'POST',
      json: {
        sourceProjectId,
        lastUpdated,
        templateId,
        templateVersionId,
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

module.exports = {
  clearCache,
  getOutputFile,
  getLatestOutputFile,
  prepareCacheSource,
}
