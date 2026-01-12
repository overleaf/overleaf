import _ from 'lodash'
import { NotFoundError, ResourceGoneError } from '../Errors/Errors.js'
import ClsiCacheHandler from './ClsiCacheHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import UserGetter from '../User/UserGetter.mjs'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { fetchJson, RequestFailedError } from '@overleaf/fetch-utils'
import Metrics from '@overleaf/metrics'
import Features from '../../infrastructure/Features.mjs'
import ClsiManager from './ClsiManager.mjs'
import Crypto from 'node:crypto'
import ClsiCookieManagerFactory from './ClsiCookieManager.mjs'
import { ObjectId } from '../../infrastructure/mongodb.mjs'

const ClsiCookieManager = ClsiCookieManagerFactory(
  Settings.apis.clsi?.backendGroupName
)

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
    external: {
      isUpToDate,
      allFiles,
      zone,
      shard: clsiCacheShard,
      size: jsonSize,
    },
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
  Metrics.count('clsi_cache_egress', jsonSize, 1, {
    path: ClsiCacheHandler.getEgressLabel('output.overleaf.json'),
  })

  const [, editorId, buildId] = metaLocation.match(
    /\/build\/([a-f0-9-]+?)-([a-f0-9]+-[a-f0-9]+)\//
  )
  const {
    ranges,
    contentId,
    clsiServerId,
    compileGroup,
    size,
    options,
    stats,
    timings,
  } = meta

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
    stats,
    timings,
  }
}

/**
 * Collect metadata and prepare the clsi-cache for the given project.
 *
 * Returns true when downloaded; false when download failed; undefined when
 * disabled for env/user;
 *
 * @param projectId
 * @param userId
 * @param sourceProjectId
 * @param templateVersionId
 * @param imageName
 * @return {Promise<boolean|undefined>}
 */
async function prepareClsiCache(
  projectId,
  userId,
  { sourceProjectId, templateVersionId, imageName }
) {
  if (!Features.hasFeature('saas')) return undefined
  const features = await UserGetter.promises.getUserFeatures(userId)
  if (features.compileGroup !== 'priority') return undefined

  const signal = AbortSignal.timeout(ClsiCacheHandler.TIMEOUT)
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
      if (err instanceof NotFoundError) return false // nothing cached yet
      throw err
    }
  }
  try {
    await ClsiCacheHandler.prepareCacheSource(projectId, userId, {
      sourceProjectId,
      templateVersionId,
      imageName,
      shard,
      lastUpdated,
      signal,
    })
  } catch (err) {
    if (err instanceof NotFoundError) return false // nothing cached yet/expired.
    throw err
  }
  return true
}

async function createTemplateClsiCache({
  templateVersionId,
  project,
  fileEntries,
  docEntries,
}) {
  const compileGroup = Settings.defaultFeatures.compileGroup
  const compileBackendClass = Settings.apis.clsi.submissionBackendClass
  const submissionId = new ObjectId().toString()
  const editorId = Crypto.randomUUID()
  const options = {
    editorId,
    compileGroup,
    compileBackendClass,
    timeout: 60,
    syncType: 'full',
    compileFromClsiCache: false,
    populateClsiCache: true,
    enablePdfCaching: false,
    pdfCachingMinChunkSize: 0,
    metricsPath: 'clsi-cache-template',
  }
  const req = ClsiManager._finaliseRequest(
    submissionId,
    options,
    project,
    Object.fromEntries(
      docEntries.map(doc => [
        doc.path,
        { _id: doc.doc._id, lines: doc.docLines.split('\n') },
      ])
    ),
    Object.fromEntries(fileEntries.map(file => [file.path, file.file]))
  )
  let clsiServerId = await ClsiCookieManager.promises.getServerId(
    submissionId,
    undefined,
    compileGroup,
    compileBackendClass
  )
  const { imageName } = project
  try {
    let status, buildId, clsiCacheShard
    ;({ status, buildId, clsiCacheShard, clsiServerId } =
      await ClsiManager.promises.sendExternalRequest(
        submissionId,
        req,
        options
      ))
    if (status !== 'success') {
      logger.warn(
        { status, templateVersionId, imageName },
        'compiling template failed'
      )
      return
    }
    if (!clsiCacheShard) {
      // The circuit breaker tripped for all clsi -> clsi-cache shards. Try again later.
      return
    }
    await ClsiCacheHandler.exportSubmissionAsTemplate(
      clsiCacheShard,
      submissionId,
      editorId + '-' + buildId,
      templateVersionId,
      imageName
    )
  } finally {
    await ClsiManager.promises.deleteAuxFiles(
      submissionId,
      null,
      options,
      clsiServerId
    )
  }
}

export default {
  getLatestBuildFromCache,
  getLatestCompileResult,
  prepareClsiCache,
  createTemplateClsiCache,
}
