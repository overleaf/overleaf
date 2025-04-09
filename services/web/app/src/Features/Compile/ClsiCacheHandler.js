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
      'output.overleaf.json',
      'output.tar.gz',
    ].includes(filename) ||
    filename.endsWith('.blg')
  ) {
    throw new InvalidNameError('bad filename')
  }
}

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

  for (const { url, zone } of Settings.apis.clsiCache.instances) {
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
  getLatestOutputFile,
  prepareCacheSource,
}
