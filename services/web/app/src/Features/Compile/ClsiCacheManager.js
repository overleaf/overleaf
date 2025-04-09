const { NotFoundError } = require('../Errors/Errors')
const ClsiCacheHandler = require('./ClsiCacheHandler')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')

/**
 * Get the most recent build and metadata
 *
 * Internal: internal metadata; External: fine to send to user as-is.
 *
 * @param projectId
 * @param userId
 * @param filename
 * @param signal
 * @return {Promise<{internal: {zone: string, location: string}, external: {isUpToDate: boolean, lastUpdated: Date, size: number, allFiles: string[]}}>}
 */
async function getLatestBuildFromCache(projectId, userId, filename, signal) {
  const [
    { location, lastModified: lastCompiled, zone, size, allFiles },
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
      zone,
    },
    external: {
      isUpToDate,
      lastUpdated,
      size,
      allFiles,
    },
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
    'copy-clsi-cache'
  )
  if (variant !== 'enabled') return
  const signal = AbortSignal.timeout(5_000)
  let lastUpdated
  let zone = 'b' // populate template data on zone b
  if (sourceProjectId) {
    try {
      ;({
        internal: { zone },
        external: { lastUpdated },
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
      zone,
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
  prepareClsiCache,
}
