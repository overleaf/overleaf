import { callbackify } from 'node:util'
import { callbackifyMultiResult } from '@overleaf/promise-utils'
import {
  fetchStream,
  fetchString,
  fetchStringWithResponse,
  RequestFailedError,
} from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import { Cookie } from 'tough-cookie'
import ClsiCookieManagerFactory from './ClsiCookieManager.mjs'
import ClsiStateManager from './ClsiStateManager.mjs'
import _ from 'lodash'
import ClsiFormatChecker from './ClsiFormatChecker.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import Metrics from '@overleaf/metrics'
import Errors from '../Errors/Errors.js'
import ClsiCacheHandler from './ClsiCacheHandler.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'

// use the redis db with eviction policy enabled
const rclient = RedisWrapper.client('clsi_cookie')

const ClsiCookieManager = ClsiCookieManagerFactory(
  Settings.apis.clsi?.backendGroupName
)
const NewBackendCloudClsiCookieManager = ClsiCookieManagerFactory(
  Settings.apis.clsi_new?.backendGroupName
)

const VALID_COMPILERS = ['pdflatex', 'latex', 'xelatex', 'lualatex']
const OUTPUT_FILE_TIMEOUT_MS = 60000
const CLSI_COOKIES_ENABLED = (Settings.clsiCookie?.key ?? '') !== ''

// The timeout in services/clsi/app.js is 10 minutes, so we'll be on the safe side with 12 minutes
const COMPILE_REQUEST_TIMEOUT_MS = 12 * 60 * 1000

// Enable clsi-cache for all compiles for 20min when detecting low capacity.
const ENABLE_COMPILE_FROM_CACHE_ON_503_MS = 20 * 60 * 1000
let enableCompileFromCacheUntil = 0

function _baseHistoryVersionKey(projectId, userId) {
  return `baseHistoryVersion:${projectId}:${userId}`
}

async function getBaseHistoryVersion(projectId, userId) {
  let v
  try {
    v = await rclient.get(_baseHistoryVersionKey(projectId, userId))
  } catch (err) {
    logger.warn({ err, projectId, userId }, 'failed to get baseHistoryVersion')
    return -1
  }
  if (!v) return -1
  const n = parseInt(v, 10)
  if (Number.isNaN(n)) return -1
  return n
}

async function setBaseHistoryVersion(projectId, userId, baseHistoryVersion) {
  const clsiCacheExpiryInSeconds = 8 * 24 * 60 * 60 // 8 days
  try {
    await rclient.setex(
      _baseHistoryVersionKey(projectId, userId),
      clsiCacheExpiryInSeconds,
      baseHistoryVersion
    )
  } catch (err) {
    logger.warn({ err, projectId, userId }, 'failed to set baseHistoryVersion')
  }
}

async function clearBaseHistoryVersion(projectId, userId) {
  await rclient.del(_baseHistoryVersionKey(projectId, userId))
}

function getNewCompileBackendClass(projectId, compileBackendClass) {
  // Sample x% of projects to move up one bracket.
  if (
    SplitTestHandler.getPercentile(projectId, 'double-compile', 'release') >=
    Settings.apis.clsi_new.sample
  ) {
    return null
  }

  switch (compileBackendClass) {
    case 'c3d':
      return 'n4'
    case 'c4d':
      return 'n4'
    default:
      throw new Error('unknown ?compileBackendClass')
  }
}

/**
 * @param {string} projectId
 * @param {string | null} userId
 * @param {string} compileBackendClass
 * @return {Promise<void>}
 */
async function clearClsiServerId(projectId, userId, compileBackendClass) {
  const jobs = [
    ClsiCookieManager.promises.clearServerId(
      projectId,
      userId,
      compileBackendClass
    ),
  ]
  if (Settings.apis.clsi_new?.url) {
    // Mirror resetting the clsiserverid in both backends.
    const newCompileBackendClass = getNewCompileBackendClass(
      projectId,
      compileBackendClass
    )
    if (newCompileBackendClass) {
      jobs.push(
        NewBackendCloudClsiCookieManager.promises.clearServerId(
          projectId,
          userId,
          newCompileBackendClass
        )
      )
    }
  }
  await Promise.all(jobs)
}

function collectMetricsOnBlgFiles(outputFiles) {
  let topLevel = 0
  let nested = 0
  for (const outputFile of outputFiles) {
    if (outputFile.type === 'blg') {
      if (outputFile.path.includes('/')) {
        nested++
      } else {
        topLevel++
      }
    }
  }
  Metrics.count('blg_output_file', topLevel, 1, { path: 'top-level' })
  Metrics.count('blg_output_file', nested, 1, { path: 'nested' })
}

async function sendRequest(projectId, userId, options) {
  if (options == null) {
    options = {}
  }
  let result = await sendRequestOnce(projectId, userId, options)
  if (result.status === 'missing-updates') {
    // try again with updated baseline
    result = await sendRequestOnce(projectId, userId, {
      ...options,
      baseHistoryVersion: result.baseHistoryVersion,
    })
  } else if (result.status === 'conflict') {
    // Try again, with a full compile
    result = await sendRequestOnce(projectId, userId, {
      ...options,
      syncType: 'full',
    })
  } else if (result.status === 'unavailable') {
    result = await sendRequestOnce(projectId, userId, {
      ...options,
      syncType: 'full',
      forceNewClsiServer: true,
    })
  }
  return result
}

async function sendRequestOnce(projectId, userId, options) {
  let req
  try {
    req = await _buildRequest(projectId, userId, options)
  } catch (err) {
    if (err.message === 'no main file specified') {
      return {
        status: 'validation-problems',
        validationProblems: { mainFile: err.message },
      }
    } else {
      throw OError.tag(err, 'Could not build request to CLSI', {
        projectId,
        options,
      })
    }
  }
  return await _sendBuiltRequest(projectId, userId, req, options)
}

// for public API requests where there is no project id
async function sendExternalRequest(submissionId, clsiRequest, options) {
  if (options == null) {
    options = {}
  }
  return await _sendBuiltRequest(submissionId, null, clsiRequest, options)
}

async function stopCompile(projectId, userId, options) {
  if (options == null) {
    options = {}
  }
  const { compileBackendClass, compileGroup } = options
  const url = _getCompilerUrl(
    compileBackendClass,
    compileGroup,
    projectId,
    userId,
    'compile/stop'
  )
  const opts = { method: 'POST' }
  await _makeRequest(
    projectId,
    userId,
    compileGroup,
    compileBackendClass,
    url,
    opts
  )
}

/**
 * @param {PromiseSettledResult} result
 * @private
 */
function _throwIfRejected(result) {
  if (result.status === 'rejected') {
    throw result.reason
  }
}

async function deleteAuxFiles(projectId, userId, options, clsiserverid) {
  if (options == null) {
    options = {}
  }
  const { compileBackendClass, compileGroup } = options
  const url = _getCompilerUrl(
    compileBackendClass,
    compileGroup,
    projectId,
    userId
  )
  const [
    clsiResult,
    clsiCacheResult,
    documentUpdaterResult,
    clsiServerIdResult,
    baseHistoryVersionResult,
  ] = await Promise.allSettled([
    _makeRequestWithClsiServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      url,
      { method: 'DELETE' },
      clsiserverid
    ),
    ClsiCacheHandler.clearCache(projectId, userId),
    DocumentUpdaterHandler.promises.clearProjectState(projectId),
    clearClsiServerId(projectId, userId, compileBackendClass),
    clearBaseHistoryVersion(projectId, userId),
  ])
  if (clsiCacheResult.status === 'rejected') {
    logger.warn(
      { err: clsiCacheResult.reason, projectId, userId },
      'purge clsi-cache failed'
    )
  }
  if (baseHistoryVersionResult.status === 'rejected') {
    logger.warn(
      { err: baseHistoryVersionResult.reason, projectId, userId },
      'failed to clear baseHistoryVersion'
    )
  }
  _throwIfRejected(clsiResult)
  _throwIfRejected(documentUpdaterResult)
  _throwIfRejected(clsiServerIdResult)
}

async function _sendBuiltRequest(projectId, userId, req, options) {
  if (options.forceNewClsiServer) {
    await clearClsiServerId(projectId, userId, options.compileBackendClass)
  }
  const validationProblems = ClsiFormatChecker.checkRecoursesForProblems(
    req.compile?.resources || []
  )
  if (validationProblems != null) {
    logger.debug(
      { projectId, validationProblems },
      'problems with users latex before compile was attempted'
    )
    return {
      status: 'validation-problems',
      validationProblems,
    }
  }

  const { response, clsiServerId } = await _postToClsi(
    projectId,
    userId,
    req,
    options.compileBackendClass,
    options.compileGroup
  )

  const outputFiles = _parseOutputFiles(
    projectId,
    response && response.compile && response.compile.outputFiles
  )
  collectMetricsOnBlgFiles(outputFiles)
  const compile = response?.compile || {}
  if (compile.baseHistoryVersion) {
    await setBaseHistoryVersion(projectId, userId, compile.baseHistoryVersion)
  }
  return {
    status: compile.status,
    outputFiles,
    clsiServerId,
    buildId: compile.buildId,
    stats: compile.stats,
    timings: compile.timings,
    outputUrlPrefix: compile.outputUrlPrefix,
    clsiCacheShard: compile.clsiCacheShard,
    baseHistoryVersion: compile.baseHistoryVersion,
  }
}

async function _makeRequestWithClsiServerId(
  projectId,
  userId,
  compileGroup,
  compileBackendClass,
  url,
  opts,
  clsiserverid
) {
  if (clsiserverid) {
    // ignore cookies and newBackend, go straight to the clsi node
    const urlWithId = new URL(url)
    urlWithId.searchParams.set('clsiserverid', clsiserverid)

    let body
    try {
      body = await fetchString(urlWithId, opts)
    } catch (err) {
      throw OError.tag(err, 'error making request to CLSI', {
        userId,
        projectId,
      })
    }

    let json
    try {
      json = JSON.parse(body)
    } catch (err) {
      // some responses are empty. Ignore JSON parsing errors.
    }

    _makeNewBackendRequest(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      url,
      opts
    ).catch(err => {
      logger.warn({ err }, 'Error making request to new CLSI backend')
    })

    return { body: json }
  } else {
    return await _makeRequest(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      url,
      opts
    )
  }
}

async function _makeRequest(
  projectId,
  userId,
  compileGroup,
  compileBackendClass,
  url,
  opts
) {
  const currentBackendStartTime = new Date()
  const clsiServerId = await ClsiCookieManager.promises.getServerId(
    projectId,
    userId,
    compileGroup,
    compileBackendClass
  )
  opts.headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (CLSI_COOKIES_ENABLED) {
    const cookie = new Cookie({
      key: Settings.clsiCookie.key,
      value: clsiServerId,
    })
    opts.headers.Cookie = cookie.cookieString()
  }

  const timer = new Metrics.Timer('compile.currentBackend')

  let response, body
  try {
    ;({ body, response } = await fetchStringWithResponse(url, opts))
  } catch (err) {
    throw OError.tag(err, 'error making request to CLSI', {
      projectId,
      userId,
    })
  }

  Metrics.inc(`compile.currentBackend.response.${response.status}`)

  let json
  try {
    json = JSON.parse(body)
  } catch (err) {
    // some responses are empty. Ignore JSON parsing errors
  }

  timer.done()
  let newClsiServerId
  if (CLSI_COOKIES_ENABLED) {
    newClsiServerId = _getClsiServerIdFromResponse(response)
    await ClsiCookieManager.promises.setServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      newClsiServerId,
      clsiServerId
    )
  }
  const currentCompileTime = new Date() - currentBackendStartTime

  // Start new backend request in the background
  const newBackendStartTime = new Date()
  _makeNewBackendRequest(
    projectId,
    userId,
    compileGroup,
    compileBackendClass,
    url,
    opts
  )
    .then(result => {
      if (result == null || !url.pathname.endsWith('/compile')) {
        return
      }
      const current = json.compile
      const {
        body: { compile: next },
        newCompileBackendClass,
      } = result
      const newBackendCompileTime = new Date() - newBackendStartTime
      const statusCodeSame = next.status === current.status
      const timeDifference = newBackendCompileTime - currentCompileTime
      logger.debug(
        {
          statusCodeSame,
          timeDifference,
          currentCompileTime,
          newBackendCompileTime,
          projectId,
        },
        'both clsi requests returned'
      )
      if (
        current.status === 'success' &&
        current.status === next.status &&
        current.stats.isInitialCompile === next.stats.isInitialCompile &&
        current.stats.restoredClsiCache === next.stats.restoredClsiCache
      ) {
        const fraction = next.timings.compileE2E / current.timings.compileE2E
        Metrics.histogram(
          'compile_backend_difference_v1',
          fraction * 100,
          [
            // Increment the version in the metrics name when changing the buckets.
            0,
            10, 20, 30, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
            105, 110, 115, 120,
          ],
          { path: compileBackendClass, method: newCompileBackendClass }
        )
        AnalyticsManager.recordEventForUserInBackground(
          userId,
          'double-compile-result',
          {
            projectId,
            compileBackendClass,
            newCompileBackendClass,
            status: current.status,
            compileTime: current.timings.compileE2E,
            newCompileTime: next.timings.compileE2E,
            clsiServerId: newClsiServerId || clsiServerId,
            newClsiServerId: result.newClsiServerId,
            // Successful compiles are guaranteed to have an output.pdf file.
            pdfSize: current.outputFiles.find(f => f.path === 'output.pdf')
              .size,
            newPdfSize: next.outputFiles.find(f => f.path === 'output.pdf')
              .size,
          }
        )
      }
    })
    .catch(err => {
      logger.warn({ err }, 'Error making request to new CLSI backend')
    })

  return {
    body: json,
    clsiServerId: newClsiServerId || clsiServerId,
  }
}

async function _makeNewBackendRequest(
  projectId,
  userId,
  compileGroup,
  currentCompileBackendClass,
  url,
  opts
) {
  if (Settings.apis.clsi_new?.url == null) {
    return null
  }
  const newCompileBackendClass = getNewCompileBackendClass(
    projectId,
    currentCompileBackendClass
  )
  if (!newCompileBackendClass) return null

  url = new URL(
    url.toString().replace(Settings.apis.clsi.url, Settings.apis.clsi_new.url)
  )
  url.searchParams.set('compileBackendClass', newCompileBackendClass)

  const clsiServerId =
    await NewBackendCloudClsiCookieManager.promises.getServerId(
      projectId,
      userId,
      compileGroup,
      newCompileBackendClass
    )
  opts = {
    ...opts,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  }

  if (CLSI_COOKIES_ENABLED) {
    const cookie = new Cookie({
      key: Settings.clsiCookie.key,
      value: clsiServerId,
    })
    opts.headers.Cookie = cookie.cookieString()
  }

  const timer = new Metrics.Timer('compile.newBackend')

  let response, body
  try {
    ;({ body, response } = await fetchStringWithResponse(url, opts))
  } catch (err) {
    throw OError.tag(err, 'error making request to new CLSI', {
      userId,
      projectId,
    })
  }

  let json
  try {
    json = JSON.parse(body)
  } catch (err) {
    // Some responses are empty. Ignore JSON parsing errors
  }
  timer.done()
  let newClsiServerId
  if (CLSI_COOKIES_ENABLED) {
    newClsiServerId = _getClsiServerIdFromResponse(response)
    await NewBackendCloudClsiCookieManager.promises.setServerId(
      projectId,
      userId,
      compileGroup,
      newCompileBackendClass,
      newClsiServerId,
      clsiServerId
    )
  }
  return {
    response,
    body: json,
    newCompileBackendClass,
    newClsiServerId: clsiServerId || newClsiServerId,
  }
}

function _getCompilerUrl(
  compileBackendClass,
  compileGroup,
  projectId,
  userId,
  action
) {
  const u = new URL(Settings.apis.clsi.url)
  u.pathname = `/project/${projectId}`
  if (userId != null) {
    u.pathname += `/user/${userId}`
  }
  if (action != null) {
    u.pathname += `/${action}`
  }
  u.searchParams.set('compileBackendClass', compileBackendClass)
  u.searchParams.set('compileGroup', compileGroup)
  return u
}

async function _postToClsi(
  projectId,
  userId,
  req,
  compileBackendClass,
  compileGroup
) {
  const url = _getCompilerUrl(
    compileBackendClass,
    compileGroup,
    projectId,
    userId,
    'compile'
  )
  const opts = {
    json: req,
    method: 'POST',
    signal: AbortSignal.timeout(COMPILE_REQUEST_TIMEOUT_MS),
  }
  try {
    const { body, clsiServerId } = await _makeRequest(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      url,
      opts
    )
    return { response: body, clsiServerId }
  } catch (err) {
    if (err instanceof RequestFailedError) {
      if (err.response.status === 413) {
        return { response: { compile: { status: 'project-too-large' } } }
      } else if (err.response.status === 409) {
        try {
          const body = JSON.parse(err.body || '{}')
          if (body.compile?.status === 'missing-updates') {
            return { response: body }
          }
        } catch {}
        return { response: { compile: { status: 'conflict' } } }
      } else if (err.response.status === 423) {
        return { response: { compile: { status: 'compile-in-progress' } } }
      } else if (err.response.status === 502 || err.response.status === 503) {
        enableCompileFromCacheUntil =
          Date.now() + ENABLE_COMPILE_FROM_CACHE_ON_503_MS
        return { response: { compile: { status: 'unavailable' } } }
      } else if (err.response.status === 504) {
        return { response: { compile: { status: 'timedout' } } }
      } else {
        throw new OError('CLSI returned non-success code', {
          projectId,
          userId,
          compileOptions: req.compile.options,
          rootResourcePath: req.compile.rootResourcePath,
          clsiResponse: err.body,
          statusCode: err.response.status,
        })
      }
    } else {
      throw new OError(
        'failed to make request to CLSI',
        {
          projectId,
          userId,
          compileOptions: req.compile.options,
          rootResourcePath: req.compile.rootResourcePath,
        },
        err
      )
    }
  }
}

function _parseOutputFiles(projectId, rawOutputFiles = []) {
  const outputFiles = []
  for (const file of rawOutputFiles) {
    const f = {
      path: file.path, // the clsi is now sending this to web
      url: new URL(file.url).pathname, // the location of the file on the clsi, excluding the host part
      type: file.type,
      build: file.build,
    }
    if (file.path === 'output.pdf') {
      f.contentId = file.contentId
      f.ranges = file.ranges || []
      f.size = file.size
      f.startXRefTable = file.startXRefTable
      f.createdAt = new Date()
    }
    outputFiles.push(f)
  }
  return outputFiles
}

async function _buildRequest(projectId, userId, options) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    compiler: 1,
    imageName: 1,
    'overleaf.history.id': 1,
    ...(options.compileFromHistory ? {} : { rootDoc_id: 1, rootFolder: 1 }),
  })
  if (project == null) {
    throw new Errors.NotFoundError(`project does not exist: ${projectId}`)
  }
  if (!VALID_COMPILERS.includes(project.compiler)) {
    project.compiler = 'pdflatex'
  }
  const historyId = project.overleaf.history.id
  let { baseHistoryVersion } = options

  if (options.compileFromHistory && !baseHistoryVersion) {
    baseHistoryVersion = await getBaseHistoryVersion(projectId, userId)
  }

  if (options.compileFromHistory && baseHistoryVersion === -1) {
    // full sync
    try {
      return await _buildRequestFromHistoryFull(
        projectId,
        historyId,
        options,
        project
      )
    } catch (err) {
      logger.warn(
        { err, projectId, historyId },
        'failed to compose history-full request'
      )
      // fall back to old compile mode
      return await _buildRequest(projectId, userId, {
        ...options,
        compileFromHistory: false,
      })
    }
  } else if (options.compileFromHistory) {
    // incremental sync
    try {
      return await _buildRequestFromHistoryIncremental(
        projectId,
        historyId,
        options,
        project,
        baseHistoryVersion
      )
    } catch (err) {
      logger.warn(
        { err, projectId, historyId, baseHistoryVersion },
        'failed to compose history-incremental request'
      )
      // fall back to old compile mode
      return await _buildRequest(projectId, userId, {
        ...options,
        compileFromHistory: false,
      })
    }
  }

  if (options.incrementalCompilesEnabled || options.syncType != null) {
    // new way, either incremental or full
    const timer = new Metrics.Timer('editor.compile-getdocs-redis')
    let projectStateHash, docUpdaterDocs
    try {
      ;({ projectStateHash, docs: docUpdaterDocs } =
        await getContentFromDocUpdaterIfMatch(projectId, project, options))
    } catch (err) {
      logger.error({ err, projectId }, 'error checking project state')
      // note: we don't bail out when there's an error getting
      // incremental files from the docupdater, we just fall back
      // to a normal compile below
    }
    timer.done()
    // see if we can send an incremental update to the CLSI
    if (docUpdaterDocs != null && options.syncType !== 'full') {
      Metrics.inc('compile-from-redis')
      return _buildRequestFromDocupdater(
        projectId,
        options,
        project,
        projectStateHash,
        docUpdaterDocs
      )
    } else {
      Metrics.inc('compile-from-mongo')
      return await _buildRequestFromMongo(
        projectId,
        options,
        project,
        projectStateHash
      )
    }
  } else {
    // old way, always from mongo
    const timer = new Metrics.Timer('editor.compile-getdocs-mongo')
    const { docs, files } = await _getContentFromMongo(projectId)
    timer.done()
    return _finaliseRequest(projectId, options, project, docs, files)
  }
}

async function getContentFromDocUpdaterIfMatch(projectId, project, options) {
  const projectStateHash = ClsiStateManager.computeHash(project, options)
  const docs = await DocumentUpdaterHandler.promises.getProjectDocsIfMatch(
    projectId,
    projectStateHash
  )
  return { projectStateHash, docs }
}

async function getOutputFileStream(
  projectId,
  userId,
  options,
  clsiServerId,
  buildId,
  outputFilePath
) {
  const { compileBackendClass, compileGroup } = options
  const url = new URL(Settings.apis.clsi.downloadHost)
  url.pathname = `/project/${projectId}/user/${userId}/build/${buildId}/output/${outputFilePath}`
  url.searchParams.set('compileBackendClass', compileBackendClass)
  url.searchParams.set('compileGroup', compileGroup)
  url.searchParams.set('clsiserverid', clsiServerId)
  try {
    const stream = await fetchStream(url, {
      signal: AbortSignal.timeout(OUTPUT_FILE_TIMEOUT_MS),
    })
    return stream
  } catch (err) {
    throw new Errors.OutputFileFetchFailedError(
      'failed to fetch output file from CLSI',
      {
        projectId,
        userId,
        url,
        status: err.response?.status,
      }
    )
  }
}

/**
 * @param {import('overleaf-editor-core/lib/types.js').RawChange[]} changes
 * @return {import('overleaf-editor-core/lib/types.js').RawOperation[][]}
 * @private
 */
function _rawChangeOperationsFromChanges(changes) {
  // omit timestamp (required, back-filled in clsi)
  // omit authors (optional)
  // omit v2Authors (optional)
  // omit origin (optional)
  // omit projectVersion (optional)
  // omit v2DocVersions (optional)
  return changes.map(change => change.operations)
}

/**
 * @param {import('overleaf-editor-core/lib/types.js').RawOperation[][]} rawChangeOperations
 * @return {Set<string>}
 * @private
 */
function _collectGlobalBlobs(rawChangeOperations) {
  const globalBlobs = new Set()
  for (const operations of rawChangeOperations) {
    for (const operation of operations) {
      const hash = operation?.file?.hash
      if (hash && HistoryManager.isGlobalBlob(hash)) {
        globalBlobs.add(hash)
      }
    }
  }
  return globalBlobs
}

function collectGlobalBlobsFromRawSnapshot(rawSnapshot, globalBlobs) {
  for (const { hash, rangesHash } of Object.values(rawSnapshot.files)) {
    if (hash && HistoryManager.isGlobalBlob(hash)) {
      globalBlobs.add(hash)
    }
    if (rangesHash && HistoryManager.isGlobalBlob(rangesHash)) {
      globalBlobs.add(rangesHash)
    }
  }
}

async function _buildRequestFromHistoryFull(
  projectId,
  historyId,
  options,
  project
) {
  await HistoryManager.promises.flushProject(projectId)
  const [
    {
      chunk: {
        history: { snapshot: rawSnapshot, changes: rawChanges },
        startVersion,
      },
    },
    /* ensureNoResyncPending throws */
  ] = await Promise.all([
    HistoryManager.promises.getLatestHistoryWithHistoryId(historyId),
    HistoryManager.promises.ensureNoResyncPending(projectId),
  ])
  const rawChangeOperations = _rawChangeOperationsFromChanges(rawChanges)
  const globalBlobs = _collectGlobalBlobs(rawChangeOperations)
  collectGlobalBlobsFromRawSnapshot(rawSnapshot, globalBlobs)
  options = {
    ...options,
    syncType: 'history-full',
    historyId,
    baseHistoryVersion: startVersion,
    rawSnapshot,
    rawChangeOperations,
    globalBlobs: Array.from(globalBlobs),
  }
  return _finaliseRequest(projectId, options, project, [], [])
}

async function _buildRequestFromHistoryIncremental(
  projectId,
  historyId,
  options,
  project,
  baseHistoryVersion
) {
  await HistoryManager.promises.flushProject(projectId)
  const rawChangeOperations = []
  let hasMore = true
  let since = baseHistoryVersion
  let size = 0
  while (hasMore) {
    let changes
    ;[{ changes, hasMore } /* resyncPending throws */] = await Promise.all([
      HistoryManager.promises.getChangesWithHistoryId(historyId, { since }),
      HistoryManager.promises.ensureNoResyncPending(projectId),
    ])
    since += changes.length
    const newRawChangeOperations = _rawChangeOperationsFromChanges(changes)
    size += Buffer.from(JSON.stringify(newRawChangeOperations)).byteLength
    if (size > 6.5 * 1024 * 1024) {
      // clsi has a payload limit of 7MiB. Do not send too many operations.
      // Fall back to sending the latest snapshot instead.
      try {
        return await _buildRequestFromHistoryFull(
          projectId,
          historyId,
          options,
          project
        )
      } catch (err) {
        throw OError.tag(err, 'upgrade to history-full failed', { size })
      }
    }
    rawChangeOperations.push(...newRawChangeOperations)
  }
  const globalBlobs = _collectGlobalBlobs(rawChangeOperations)
  options = {
    ...options,
    syncType: 'history-incremental',
    historyId,
    baseHistoryVersion,
    rawChangeOperations,
    globalBlobs: Array.from(globalBlobs),
  }
  return _finaliseRequest(projectId, options, project, [], [])
}

function _buildRequestFromDocupdater(
  projectId,
  options,
  project,
  projectStateHash,
  docUpdaterDocs
) {
  const docPath = ProjectEntityHandler.getAllDocPathsFromProject(project)
  const docs = {}
  for (const doc of docUpdaterDocs || []) {
    const path = docPath[doc._id]
    docs[path] = doc
  }
  // send new docs but not files as those are already on the clsi
  options = _.clone(options)
  options.syncType = 'incremental'
  options.syncState = projectStateHash
  // create stub doc entries for any possible root docs, if not
  // present in the docupdater. This allows finaliseRequest to
  // identify the root doc.
  const possibleRootDocIds = [options.rootDoc_id, project.rootDoc_id]
  for (const rootDocId of possibleRootDocIds) {
    if (rootDocId != null && rootDocId in docPath) {
      const path = docPath[rootDocId]
      if (docs[path] == null) {
        docs[path] = { _id: rootDocId, path }
      }
    }
  }
  return _finaliseRequest(projectId, options, project, docs, [])
}

async function _buildRequestFromMongo(
  projectId,
  options,
  project,
  projectStateHash
) {
  const { docs, files } = await _getContentFromMongo(projectId)
  options = {
    ...options,
    syncType: 'full',
    syncState: projectStateHash,
  }
  return _finaliseRequest(projectId, options, project, docs, files)
}

async function _getContentFromMongo(projectId) {
  await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)
  const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)
  const files = await ProjectEntityHandler.promises.getAllFiles(projectId)
  return { docs, files }
}

function _finaliseRequest(projectId, options, project, docs, files) {
  const resources = []
  let flags
  let rootResourcePath = options.rootResourcePath
  let rootResourcePathOverride = null
  let hasMainFile = false
  let numberOfDocsInProject = 0

  for (let path in docs) {
    const doc = docs[path]
    path = path.replace(/^\//, '') // Remove leading /
    numberOfDocsInProject++
    if (doc.lines != null) {
      // add doc to resources unless it is just a stub entry
      resources.push({
        path,
        content: doc.lines.join('\n'),
      })
    }
    if (
      project.rootDoc_id != null &&
      doc._id.toString() === project.rootDoc_id.toString()
    ) {
      rootResourcePath = path
    }
    if (
      options.rootDoc_id != null &&
      doc._id.toString() === options.rootDoc_id.toString()
    ) {
      rootResourcePathOverride = path
    }
    if (path === 'main.tex') {
      hasMainFile = true
    }
  }

  if (rootResourcePathOverride != null) {
    rootResourcePath = rootResourcePathOverride
  }
  if (rootResourcePath == null) {
    if (hasMainFile) {
      rootResourcePath = 'main.tex'
    } else if (numberOfDocsInProject === 1) {
      // only one file, must be the main document
      for (const path in docs) {
        // Remove leading /
        rootResourcePath = path.replace(/^\//, '')
      }
    } else {
      throw new OError('no main file specified', { projectId })
    }
  }

  const historyId = project.overleaf.history.id
  if (!historyId) {
    throw new OError('project does not have a history id', { projectId })
  }
  for (let path in files) {
    const file = files[path]
    path = path.replace(/^\//, '') // Remove leading /
    resources.push({
      path,
      url: HistoryManager.getFilestoreBlobURL(historyId, file.hash),
      modified: file.created?.getTime(),
    })
  }

  if (options.fileLineErrors) {
    flags = ['-file-line-error']
  }

  return {
    compile: {
      options: {
        historyId: options.historyId?.toString(), // send as string, if set
        buildId: options.buildId,
        editorId: options.editorId,
        compiler: project.compiler,
        timeout: options.timeout,
        imageName: project.imageName,
        draft: Boolean(options.draft),
        stopOnFirstError: Boolean(options.stopOnFirstError),
        check: options.check,
        syncType: options.syncType,
        syncState: options.syncState,
        compileGroup: options.compileGroup,
        // Overleaf alpha/staff users get compileGroup=alpha (via getProjectCompileLimits in CompileManager), enroll them into the premium rollout of clsi-cache.
        compileFromClsiCache:
          // enable for premium compiles
          (['alpha', 'priority'].includes(options.compileGroup) ||
            // enable for free for short period when we saw low capacity
            enableCompileFromCacheUntil > Date.now()) &&
          options.compileFromClsiCache,
        populateClsiCache: options.populateClsiCache,
        enablePdfCaching:
          (Settings.enablePdfCaching && options.enablePdfCaching) || false,
        pdfCachingMinChunkSize: options.pdfCachingMinChunkSize,
        flags,
        metricsMethod: options.compileGroup,
        metricsPath: options.metricsPath,
      },
      baseHistoryVersion: options.baseHistoryVersion,
      rawSnapshot: options.rawSnapshot,
      rawChangeOperations: options.rawChangeOperations,
      globalBlobs: options.globalBlobs,
      rootResourcePath,
      resources,
    },
  }
}

async function wordCount(projectId, userId, file, limits, clsiserverid) {
  const { compileBackendClass, compileGroup } = limits
  const req = await _buildRequest(projectId, userId, limits)
  const filename = file || req.compile.rootResourcePath
  const url = _getCompilerUrl(
    compileBackendClass,
    compileGroup,
    projectId,
    userId,
    'wordcount'
  )
  url.searchParams.set('file', filename)
  url.searchParams.set('image', req.compile.options.imageName)

  const opts = {
    method: 'GET',
  }
  const { body } = await _makeRequestWithClsiServerId(
    projectId,
    userId,
    compileGroup,
    compileBackendClass,
    url,
    opts,
    clsiserverid
  )
  return body
}

async function syncTeX(
  projectId,
  userId,
  {
    direction,
    compileFromClsiCache,
    limits,
    imageName,
    validatedOptions,
    clsiServerId,
  }
) {
  const { compileBackendClass, compileGroup } = limits
  const url = _getCompilerUrl(
    compileBackendClass,
    compileGroup,
    projectId,
    userId,
    `sync/${direction}`
  )
  url.searchParams.set(
    'compileFromClsiCache',
    compileFromClsiCache && ['alpha', 'priority'].includes(compileGroup)
  )
  url.searchParams.set('imageName', imageName)
  for (const [key, value] of Object.entries(validatedOptions)) {
    url.searchParams.set(key, value)
  }
  const opts = {
    method: 'GET',
  }
  try {
    const { body } = await _makeRequestWithClsiServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      url,
      opts,
      clsiServerId
    )
    return body
  } catch (err) {
    if (err instanceof RequestFailedError && err.response.status === 404) {
      throw new Errors.NotFoundError()
    }
    throw err
  }
}

function _getClsiServerIdFromResponse(response) {
  const setCookieHeaders = response.headers.raw()['set-cookie'] ?? []
  for (const header of setCookieHeaders) {
    const cookie = Cookie.parse(header)
    if (cookie.key === Settings.clsiCookie.key) {
      return cookie.value
    }
  }
  return null
}

export default {
  collectGlobalBlobsFromRawSnapshot,
  _finaliseRequest,
  sendRequest: callbackifyMultiResult(sendRequest, [
    'status',
    'outputFiles',
    'clsiServerId',
    'validationProblems',
    'stats',
    'timings',
    'outputUrlPrefix',
    'buildId',
    'clsiCacheShard',
  ]),
  sendExternalRequest: callbackifyMultiResult(sendExternalRequest, [
    'status',
    'outputFiles',
    'clsiServerId',
    'validationProblems',
    'stats',
    'timings',
    'outputUrlPrefix',
  ]),
  stopCompile: callbackify(stopCompile),
  deleteAuxFiles: callbackify(deleteAuxFiles),
  getOutputFileStream: callbackify(getOutputFileStream),
  wordCount: callbackify(wordCount),
  syncTeX: callbackify(syncTeX),
  promises: {
    sendRequest,
    sendExternalRequest,
    stopCompile,
    deleteAuxFiles,
    getOutputFileStream,
    wordCount,
    syncTeX,
  },
}
