const _ = require('lodash')
const { NotFoundError, ResourceGoneError } = require('../Errors/Errors')
const ClsiCacheHandler = require('./ClsiCacheHandler')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const UserGetter = require('../User/UserGetter')
const Settings = require('@overleaf/settings')
const { fetchJson, RequestFailedError } = require('@overleaf/fetch-utils')

/**
 * Get the most recent build and metadata
 *
 * Internal: internal metadata; External: fine to send to user as-is.
 *
 * @param projectId
 * @param userId
 * @param filename
 * @param signal
 * @return {Promise<{internal: {location: string}, external: {zone: string, shard: string, isUpToDate: boolean, lastUpdated: Date, size: number, allFiles: string[]}}>}
 */
async function getLatestBuildFromCache(projectId, userId, filename, signal) {
  const [
    { location, lastModified: lastCompiled, zone, shard, size, allFiles },
    lastUpdatedInRedis,
    { lastUpdated: lastUpdatedInMongo },
  ] = await Promise.all([
    ClsiCacheHandler.getLatestOutputFile(projectId, userId, filename, signal),
    DocumentUpdaterHandler.promises.getProjectLastUpdatedAt(projectId),
    ProjectGetter.promises.getProject(projectId, { lastUpdated: 1 }),
  ])

  const lastUpdated =
    lastUpdatedInRedis > lastUpdatedInMongo
      ? lastUpdatedInRedis
      : lastUpdatedInMongo
  const isUpToDate = lastCompiled >= lastUpdated

  return {
    internal: {
      location,
    },
    external: {
      isUpToDate,
      lastUpdated,
      size,
      allFiles,
      shard,
      zone,
    },
  }
}

class MetaFileExpiredError extends NotFoundError {}

async function getLatestCompileResult(projectId, userId) {
  const signal = AbortSignal.timeout(15_000)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await tryGetLatestCompileResult(projectId, userId, signal)
    } catch (err) {
      if (err instanceof MetaFileExpiredError) {
        continue
      }
      throw err
    }
  }
  throw new NotFoundError()
}

async function tryGetLatestCompileResult(projectId, userId, signal) {
  const {
    internal: { location: metaLocation },
    external: { isUpToDate, allFiles, zone, shard: clsiCacheShard },
  } = await getLatestBuildFromCache(
    projectId,
    userId,
    'output.overleaf.json',
    signal
  )
  if (!isUpToDate) throw new ResourceGoneError()

  let meta
  try {
    meta = await fetchJson(metaLocation, {
      signal: AbortSignal.timeout(5 * 1000),
    })
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      throw new MetaFileExpiredError(
        'build expired between listing and reading'
      )
    }
    throw err
  }

  const [, editorId, buildId] = metaLocation.match(
    /\/build\/([a-f0-9-]+?)-([a-f0-9]+-[a-f0-9]+)\//
  )
  const { ranges, contentId, clsiServerId, compileGroup, size, options } = meta

  let baseURL = `/project/${projectId}`
  if (userId) {
    baseURL += `/user/${userId}`
  }

  const outputFiles = allFiles
    .filter(path => path !== 'output.overleaf.json' && path !== 'output.tar.gz')
    .map(path => {
      const f = {
        url: `${baseURL}/build/${editorId}-${buildId}/output/${path}`,
        downloadURL: `/download/project/${projectId}/build/${editorId}-${buildId}/output/cached/${path}`,
        build: buildId,
        path,
        type: path.split('.').pop(),
      }
      if (path === 'output.pdf') {
        Object.assign(f, {
          size,
          editorId,
        })
        if (clsiServerId !== clsiCacheShard) {
          // Enable PDF caching and attempt to download from VM first.
          // (clsi VMs do not have the editorId in the path on disk, omit it).
          Object.assign(f, {
            url: `${baseURL}/build/${buildId}/output/output.pdf`,
            ranges,
            contentId,
          })
        }
      }
      return f
    })

  return {
    allFiles,
    zone,
    outputFiles,
    compileGroup,
    clsiServerId,
    clsiCacheShard,
    options,
  }
}

/**
 * Collect metadata and prepare the clsi-cache for the given project.
 *
 * @param projectId
 * @param userId
 * @param sourceProjectId
 * @param templateId
 * @param templateVersionId
 * @return {Promise<void>}
 */
async function prepareClsiCache(
  projectId,
  userId,
  { sourceProjectId, templateId, templateVersionId }
) {
  const { variant } = await SplitTestHandler.promises.getAssignmentForUser(
    userId,
    'populate-clsi-cache'
  )
  if (variant !== 'enabled') return

  const features = await UserGetter.promises.getUserFeatures(userId)
  if (features.compileGroup !== 'priority') return

  const signal = AbortSignal.timeout(5_000)
  let lastUpdated
  let shard = _.shuffle(Settings.apis.clsiCache.instances)[0].shard
  if (sourceProjectId) {
    try {
      ;({
        external: { lastUpdated, shard },
      } = await getLatestBuildFromCache(
        sourceProjectId,
        userId,
        'output.tar.gz',
        signal
      ))
    } catch (err) {
      if (err instanceof NotFoundError) return // nothing cached yet
      throw err
    }
  }
  try {
    await ClsiCacheHandler.prepareCacheSource(projectId, userId, {
      sourceProjectId,
      templateId,
      templateVersionId,
      shard,
      lastUpdated,
      signal,
    })
  } catch (err) {
    if (err instanceof NotFoundError) return // nothing cached yet/expired.
    throw err
  }
}

module.exports = {
  getLatestBuildFromCache,
  getLatestCompileResult,
  prepareClsiCache,
}
