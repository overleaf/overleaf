const { callbackify } = require('util')
const { callbackifyMultiResult } = require('@overleaf/promise-utils')
const {
  fetchString,
  fetchStringWithResponse,
  fetchStream,
  RequestFailedError,
} = require('@overleaf/fetch-utils')
const Settings = require('@overleaf/settings')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const { Cookie } = require('tough-cookie')
const ClsiCookieManager = require('./ClsiCookieManager')(
  Settings.apis.clsi?.backendGroupName
)
const Features = require('../../infrastructure/Features')
const NewBackendCloudClsiCookieManager = require('./ClsiCookieManager')(
  Settings.apis.clsi_new?.backendGroupName
)
const ClsiStateManager = require('./ClsiStateManager')
const _ = require('lodash')
const ClsiFormatChecker = require('./ClsiFormatChecker')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const Metrics = require('@overleaf/metrics')
const Errors = require('../Errors/Errors')
const { getBlobLocation } = require('../History/HistoryManager')

const VALID_COMPILERS = ['pdflatex', 'latex', 'xelatex', 'lualatex']
const OUTPUT_FILE_TIMEOUT_MS = 60000
const CLSI_COOKIES_ENABLED = (Settings.clsiCookie?.key ?? '') !== ''

// The timeout in services/clsi/app.js is 10 minutes, so we'll be on the safe side with 12 minutes
const COMPILE_REQUEST_TIMEOUT_MS = 12 * 60 * 1000

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
  if (result.status === 'conflict') {
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
    req = await _buildRequest(projectId, options)
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
  const opts = {
    method: 'DELETE',
  }

  try {
    await _makeRequestWithClsiServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      url,
      opts,
      clsiserverid
    )
  } finally {
    // always clear the project state from the docupdater, even if there
    // was a problem with the request to the clsi
    try {
      await DocumentUpdaterHandler.promises.clearProjectState(projectId)
    } finally {
      await ClsiCookieManager.promises.clearServerId(projectId, userId)
    }
  }
}

async function _sendBuiltRequest(projectId, userId, req, options, callback) {
  if (options.forceNewClsiServer) {
    await ClsiCookieManager.promises.clearServerId(projectId, userId)
  }
  const validationProblems =
    await ClsiFormatChecker.promises.checkRecoursesForProblems(
      req.compile?.resources
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
  return {
    status: compile.status,
    outputFiles,
    clsiServerId,
    buildId: compile.buildId,
    stats: compile.stats,
    timings: compile.timings,
    outputUrlPrefix: compile.outputUrlPrefix,
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
    url.searchParams.set('compileGroup', compileGroup)
    url.searchParams.set('compileBackendClass', compileBackendClass)
    url.searchParams.set('clsiserverid', clsiserverid)

    let body
    try {
      body = await fetchString(url, opts)
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
      if (result == null) {
        return
      }
      const { response: newBackendResponse } = result
      Metrics.inc(`compile.newBackend.response.${newBackendResponse.status}`)
      const newBackendCompileTime = new Date() - newBackendStartTime
      const currentStatusCode = response.status
      const newStatusCode = newBackendResponse.status
      const statusCodeSame = newStatusCode === currentStatusCode
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
  compileBackendClass,
  url,
  opts
) {
  if (Settings.apis.clsi_new?.url == null) {
    return null
  }
  url = url
    .toString()
    .replace(Settings.apis.clsi.url, Settings.apis.clsi_new.url)

  const clsiServerId =
    await NewBackendCloudClsiCookieManager.promises.getServerId(
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
  if (CLSI_COOKIES_ENABLED) {
    const newClsiServerId = _getClsiServerIdFromResponse(response)
    await NewBackendCloudClsiCookieManager.promises.setServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      newClsiServerId,
      clsiServerId
    )
  }
  return { response, body: json }
}

function _getCompilerUrl(
  compileBackendClass,
  compileGroup,
  projectId,
  userId,
  action
) {
  const u = new URL(`/project/${projectId}`, Settings.apis.clsi.url)
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
        return { response: { compile: { status: 'conflict' } } }
      } else if (err.response.status === 423) {
        return { response: { compile: { status: 'compile-in-progress' } } }
      } else if (err.response.status === 503) {
        return { response: { compile: { status: 'unavailable' } } }
      } else {
        throw new OError(
          `CLSI returned non-success code: ${err.response.status}`,
          {
            projectId,
            userId,
            compileOptions: req.compile.options,
            rootResourcePath: req.compile.rootResourcePath,
            clsiResponse: err.body,
            statusCode: err.response.status,
          }
        )
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

async function _buildRequest(projectId, options) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    compiler: 1,
    rootDoc_id: 1,
    imageName: 1,
    rootFolder: 1,
    'overleaf.history.id': 1,
  })
  if (project == null) {
    throw new Errors.NotFoundError(`project does not exist: ${projectId}`)
  }
  if (!VALID_COMPILERS.includes(project.compiler)) {
    project.compiler = 'pdflatex'
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
  const url = new URL(
    `${Settings.apis.clsi.url}/project/${projectId}/user/${userId}/build/${buildId}/output/${outputFilePath}`
  )
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
  let rootResourcePath = null
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

    const filestoreURL = `${Settings.apis.filestore.url}/project/${project._id}/file/${file._id}`
    let url = filestoreURL
    let fallbackURL
    if (file.hash && Features.hasFeature('project-history-blobs')) {
      const { bucket, key } = getBlobLocation(historyId, file.hash)
      url = `${Settings.apis.filestore.url}/bucket/${bucket}/key/${key}`
      fallbackURL = filestoreURL
    }
    resources.push({
      path,
      url,
      fallbackURL,
      modified: file.created?.getTime(),
    })
  }

  if (options.fileLineErrors) {
    flags = ['-file-line-error']
  }

  return {
    compile: {
      options: {
        compiler: project.compiler,
        timeout: options.timeout,
        imageName: project.imageName,
        draft: Boolean(options.draft),
        stopOnFirstError: Boolean(options.stopOnFirstError),
        check: options.check,
        syncType: options.syncType,
        syncState: options.syncState,
        compileGroup: options.compileGroup,
        enablePdfCaching:
          (Settings.enablePdfCaching && options.enablePdfCaching) || false,
        pdfCachingMinChunkSize: options.pdfCachingMinChunkSize,
        flags,
        metricsMethod: options.compileGroup,
      },
      rootResourcePath,
      resources,
    },
  }
}

async function wordCount(projectId, userId, file, options, clsiserverid) {
  const { compileBackendClass, compileGroup } = options
  const req = await _buildRequest(projectId, options)
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

module.exports = {
  sendRequest: callbackifyMultiResult(sendRequest, [
    'status',
    'outputFiles',
    'clsiServerId',
    'validationProblems',
    'stats',
    'timings',
    'outputUrlPrefix',
    'buildId',
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
  promises: {
    sendRequest,
    sendExternalRequest,
    stopCompile,
    deleteAuxFiles,
    getOutputFileStream,
    wordCount,
  },
}
