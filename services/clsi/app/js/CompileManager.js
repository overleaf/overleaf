const fsPromises = require('node:fs/promises')
const os = require('node:os')
const Path = require('node:path')
const { callbackify } = require('node:util')

const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')

const ResourceWriter = require('./ResourceWriter')
const LatexRunner = require('./LatexRunner')
const OutputFileFinder = require('./OutputFileFinder')
const OutputCacheManager = require('./OutputCacheManager')
const Metrics = require('./Metrics')
const DraftModeManager = require('./DraftModeManager')
const TikzManager = require('./TikzManager')
const LockManager = require('./LockManager')
const Errors = require('./Errors')
const CommandRunner = require('./CommandRunner')
const { emitPdfStats } = require('./ContentCacheMetrics')
const SynctexOutputParser = require('./SynctexOutputParser')
const {
  downloadLatestCompileCache,
  downloadOutputDotSynctexFromCompileCache,
} = require('./CLSICacheHandler')
const { callbackifyMultiResult } = require('@overleaf/promise-utils')

const COMPILE_TIME_BUCKETS = [
  // NOTE: These buckets are locked in per metric name.
  //       If you want to change them, you will need to rename metrics.
  0, 1, 2, 3, 4, 6, 8, 11, 15, 22, 31, 43, 61, 86, 121, 170, 240,
].map(seconds => seconds * 1000)

function getCompileName(projectId, userId) {
  if (userId != null) {
    return `${projectId}-${userId}`
  } else {
    return projectId
  }
}

function getCompileDir(projectId, userId) {
  return Path.join(Settings.path.compilesDir, getCompileName(projectId, userId))
}

function getOutputDir(projectId, userId) {
  return Path.join(Settings.path.outputDir, getCompileName(projectId, userId))
}

async function doCompileWithLock(request, stats, timings) {
  const compileDir = getCompileDir(request.project_id, request.user_id)
  request.isInitialCompile =
    (await fsPromises.mkdir(compileDir, { recursive: true })) === compileDir
  // prevent simultaneous compiles
  const lock = LockManager.acquire(compileDir)
  try {
    return await doCompile(request, stats, timings)
  } finally {
    lock.release()
  }
}

async function doCompile(request, stats, timings) {
  const { project_id: projectId, user_id: userId } = request
  const compileDir = getCompileDir(request.project_id, request.user_id)

  const timerE2E = new Metrics.Timer(
    'compile-e2e-v2',
    1,
    request.metricsOpts,
    COMPILE_TIME_BUCKETS
  )
  if (request.isInitialCompile) {
    stats.isInitialCompile = 1
    request.metricsOpts.compile = 'initial'
    if (request.compileFromClsiCache) {
      try {
        if (await downloadLatestCompileCache(projectId, userId, compileDir)) {
          stats.restoredClsiCache = 1
          request.metricsOpts.compile = 'from-clsi-cache'
        }
      } catch (err) {
        logger.warn(
          { err, projectId, userId },
          'failed to populate compile dir from cache'
        )
      }
    }
  } else {
    request.metricsOpts.compile = 'recompile'
  }
  const writeToDiskTimer = new Metrics.Timer(
    'write-to-disk',
    1,
    request.metricsOpts
  )
  logger.debug(
    { projectId: request.project_id, userId: request.user_id },
    'syncing resources to disk'
  )

  let resourceList
  try {
    // NOTE: resourceList is insecure, it should only be used to exclude files from the output list
    resourceList = await ResourceWriter.promises.syncResourcesToDisk(
      request,
      compileDir
    )
  } catch (error) {
    if (error instanceof Errors.FilesOutOfSyncError) {
      OError.tag(error, 'files out of sync, please retry', {
        projectId: request.project_id,
        userId: request.user_id,
      })
    } else {
      OError.tag(error, 'error writing resources to disk', {
        projectId: request.project_id,
        userId: request.user_id,
      })
    }
    throw error
  }
  logger.debug(
    {
      projectId: request.project_id,
      userId: request.user_id,
      timeTaken: Date.now() - writeToDiskTimer.start,
    },
    'written files to disk'
  )
  timings.sync = writeToDiskTimer.done()

  // set up environment variables for chktex
  const env = {
    OVERLEAF_PROJECT_ID: request.project_id,
  }
  if (Settings.texliveOpenoutAny && Settings.texliveOpenoutAny !== '') {
    // override default texlive openout_any environment variable
    env.openout_any = Settings.texliveOpenoutAny
  }
  if (Settings.texliveMaxPrintLine && Settings.texliveMaxPrintLine !== '') {
    // override default texlive max_print_line environment variable
    env.max_print_line = Settings.texliveMaxPrintLine
  }
  // only run chktex on LaTeX files (not knitr .Rtex files or any others)
  const isLaTeXFile = request.rootResourcePath?.match(/\.tex$/i)
  if (request.check != null && isLaTeXFile) {
    env.CHKTEX_OPTIONS = '-nall -e9 -e10 -w15 -w16'
    env.CHKTEX_ULIMIT_OPTIONS = '-t 5 -v 64000'
    if (request.check === 'error') {
      env.CHKTEX_EXIT_ON_ERROR = 1
    }
    if (request.check === 'validate') {
      env.CHKTEX_VALIDATE = 1
    }
  }

  // apply a series of file modifications/creations for draft mode and tikz
  if (request.draft) {
    await DraftModeManager.promises.injectDraftMode(
      Path.join(compileDir, request.rootResourcePath)
    )
  }

  const needsMainFile = await TikzManager.promises.checkMainFile(
    compileDir,
    request.rootResourcePath,
    resourceList
  )
  if (needsMainFile) {
    await TikzManager.promises.injectOutputFile(
      compileDir,
      request.rootResourcePath
    )
  }

  const compileTimer = new Metrics.Timer('run-compile', 1, request.metricsOpts)
  // find the image tag to log it as a metric, e.g. 2015.1 (convert . to - for graphite)
  let tag = 'default'
  if (request.imageName != null) {
    const match = request.imageName.match(/:(.*)/)
    if (match != null) {
      tag = match[1].replace(/\./g, '-')
    }
  }
  // exclude smoke test
  if (!request.project_id.match(/^[0-9a-f]{24}$/)) {
    tag = 'other'
  }
  Metrics.inc('compiles', 1, request.metricsOpts)
  Metrics.inc(`compiles-with-image.${tag}`, 1, request.metricsOpts)
  const compileName = getCompileName(request.project_id, request.user_id)

  try {
    await LatexRunner.promises.runLatex(compileName, {
      directory: compileDir,
      mainFile: request.rootResourcePath,
      compiler: request.compiler,
      typstVersion: request.typstVersion,
      timeout: request.timeout,
      image: request.imageName,
      flags: request.flags,
      environment: env,
      compileGroup: request.compileGroup,
      stopOnFirstError: request.stopOnFirstError,
      stats,
      timings,
    })

    // We use errors to return the validation state. It would be nice to use a
    // more appropriate mechanism.
    if (request.check === 'validate') {
      const validationError = new Error('validation')
      validationError.validate = 'pass'
      throw validationError
    }
  } catch (originalError) {
    let error = originalError
    // request was for validation only
    if (request.check === 'validate' && !error.validate) {
      error = new Error('validation')
      error.validate = originalError.code ? 'fail' : 'pass'
    }

    // request was for compile, and failed on validation
    if (request.check === 'error' && originalError.message === 'exited') {
      error = new Error('compilation')
      error.validate = 'fail'
    }

    // record timeout errors as a separate counter, success is recorded later
    if (error.timedout) {
      Metrics.inc('compiles-timeout', 1, request.metricsOpts)
    }

    const { outputFiles, allEntries, buildId } = await _saveOutputFiles({
      request,
      compileDir,
      resourceList,
      stats,
      timings,
    })
    error.outputFiles = outputFiles // return output files so user can check logs
    error.buildId = buildId
    // Clear project if this compile was abruptly terminated
    if (error.terminated || error.timedout) {
      await clearProjectWithListing(
        request.project_id,
        request.user_id,
        allEntries
      )
    }

    throw error
  }

  // compile completed normally
  Metrics.inc('compiles-succeeded', 1, request.metricsOpts)
  for (const metricKey in stats) {
    const metricValue = stats[metricKey]
    Metrics.count(metricKey, metricValue, 1, request.metricsOpts)
  }
  for (const metricKey in timings) {
    const metricValue = timings[metricKey]
    Metrics.timing(metricKey, metricValue, 1, request.metricsOpts)
  }
  const loadavg = typeof os.loadavg === 'function' ? os.loadavg() : undefined
  if (loadavg != null) {
    Metrics.gauge('load-avg', loadavg[0])
  }
  const ts = compileTimer.done()
  logger.debug(
    {
      projectId: request.project_id,
      userId: request.user_id,
      timeTaken: ts,
      stats,
      timings,
      loadavg,
    },
    'done compile'
  )
  if (stats['latex-runs'] > 0) {
    Metrics.histogram(
      'avg-compile-per-pass-v2',
      ts / stats['latex-runs'],
      COMPILE_TIME_BUCKETS,
      request.metricsOpts
    )
    Metrics.timing(
      'avg-compile-per-pass-v2',
      ts / stats['latex-runs'],
      1,
      request.metricsOpts
    )
  }
  if (stats['latex-runs'] > 0 && timings['cpu-time'] > 0) {
    Metrics.timing(
      'run-compile-cpu-time-per-pass',
      timings['cpu-time'] / stats['latex-runs'],
      1,
      request.metricsOpts
    )
  }
  // Emit compile time.
  timings.compile = ts

  const { outputFiles, buildId } = await _saveOutputFiles({
    request,
    compileDir,
    resourceList,
    stats,
    timings,
  })

  // Emit e2e compile time.
  timings.compileE2E = timerE2E.done()
  Metrics.timing('compile-e2e-v2', timings.compileE2E, 1, request.metricsOpts)

  if (stats['pdf-size']) {
    emitPdfStats(stats, timings, request)
  }

  return { outputFiles, buildId }
}

async function _saveOutputFiles({
  request,
  compileDir,
  resourceList,
  stats,
  timings,
}) {
  const timer = new Metrics.Timer(
    'process-output-files',
    1,
    request.metricsOpts
  )
  const outputDir = getOutputDir(request.project_id, request.user_id)

  const { outputFiles: rawOutputFiles, allEntries } =
    await OutputFileFinder.promises.findOutputFiles(resourceList, compileDir)

  const { buildId, outputFiles } =
    await OutputCacheManager.promises.saveOutputFiles(
      { request, stats, timings },
      rawOutputFiles,
      compileDir,
      outputDir
    )

  timings.output = timer.done()
  return { outputFiles, allEntries, buildId }
}

async function stopCompile(projectId, userId) {
  const compileName = getCompileName(projectId, userId)
  await LatexRunner.promises.killLatex(compileName)
}

async function clearProject(projectId, userId) {
  const compileDir = getCompileDir(projectId, userId)
  await fsPromises.rm(compileDir, { force: true, recursive: true })
}

async function clearProjectWithListing(projectId, userId, allEntries) {
  const compileDir = getCompileDir(projectId, userId)

  const exists = await _checkDirectory(compileDir)
  if (!exists) {
    // skip removal if no directory present
    return
  }

  for (const pathInProject of allEntries) {
    const path = Path.join(compileDir, pathInProject)
    if (path.endsWith('/')) {
      await fsPromises.rmdir(path)
    } else {
      await fsPromises.unlink(path)
    }
  }
  await fsPromises.rmdir(compileDir)
}

async function _findAllDirs() {
  const root = Settings.path.compilesDir
  const files = await fsPromises.readdir(root)
  const allDirs = files.map(file => Path.join(root, file))
  return allDirs
}

async function clearExpiredProjects(maxCacheAgeMs) {
  const now = Date.now()
  const dirs = await _findAllDirs()
  for (const dir of dirs) {
    let stats
    try {
      stats = await fsPromises.stat(dir)
    } catch (err) {
      // ignore errors checking directory
      continue
    }

    const age = now - stats.mtime
    const hasExpired = age > maxCacheAgeMs
    if (hasExpired) {
      await fsPromises.rm(dir, { force: true, recursive: true })
    }
  }
}

async function _checkDirectory(compileDir) {
  let stats
  try {
    stats = await fsPromises.lstat(compileDir)
  } catch (err) {
    if (err.code === 'ENOENT') {
      //  directory does not exist
      return false
    }
    OError.tag(err, 'error on stat of project directory for removal', {
      dir: compileDir,
    })
    throw err
  }
  if (!stats.isDirectory()) {
    throw new OError('project directory is not directory', {
      dir: compileDir,
      stats,
    })
  }
  return true
}

async function syncFromCode(projectId, userId, filename, line, column, opts) {
  // If LaTeX was run in a virtual environment, the file path that synctex expects
  // might not match the file path on the host. The .synctex.gz file however, will be accessed
  // wherever it is on the host.
  const compileName = getCompileName(projectId, userId)
  const baseDir = Settings.path.synctexBaseDir(compileName)
  const inputFilePath = Path.join(baseDir, filename)
  const outputFilePath = Path.join(baseDir, 'output.pdf')
  const command = [
    'synctex',
    'view',
    '-i',
    `${line}:${column}:${inputFilePath}`,
    '-o',
    outputFilePath,
  ]
  const { stdout, downloadedFromCache } = await _runSynctex(
    projectId,
    userId,
    command,
    opts
  )
  logger.debug(
    { projectId, userId, filename, line, column, command, stdout },
    'synctex code output'
  )
  return {
    codePositions: SynctexOutputParser.parseViewOutput(stdout),
    downloadedFromCache,
  }
}

async function syncFromPdf(projectId, userId, page, h, v, opts) {
  const compileName = getCompileName(projectId, userId)
  const baseDir = Settings.path.synctexBaseDir(compileName)
  const outputFilePath = `${baseDir}/output.pdf`
  const command = [
    'synctex',
    'edit',
    '-o',
    `${page}:${h}:${v}:${outputFilePath}`,
  ]
  const { stdout, downloadedFromCache } = await _runSynctex(
    projectId,
    userId,
    command,
    opts
  )
  logger.debug({ projectId, userId, page, h, v, stdout }, 'synctex pdf output')
  return {
    pdfPositions: SynctexOutputParser.parseEditOutput(stdout, baseDir),
    downloadedFromCache,
  }
}

async function _checkFileExists(dir, filename) {
  try {
    await fsPromises.stat(dir)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Errors.NotFoundError('no output directory')
    }
    throw error
  }

  const file = Path.join(dir, filename)
  let stats
  try {
    stats = await fsPromises.stat(file)
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Errors.NotFoundError('no output file')
    }
  }
  if (!stats.isFile()) {
    throw new Error('not a file')
  }
}

async function _runSynctex(projectId, userId, command, opts) {
  const { imageName, editorId, buildId, compileFromClsiCache } = opts

  if (imageName && !_isImageNameAllowed(imageName)) {
    throw new Errors.InvalidParameter('invalid image')
  }
  if (editorId && !/^[a-f0-9-]+$/.test(editorId)) {
    throw new Errors.InvalidParameter('invalid editorId')
  }
  if (buildId && !OutputCacheManager.BUILD_REGEX.test(buildId)) {
    throw new Errors.InvalidParameter('invalid buildId')
  }

  const outputDir = getOutputDir(projectId, userId)
  const runInOutputDir = buildId && CommandRunner.canRunSyncTeXInOutputDir()

  const directory = runInOutputDir
    ? Path.join(outputDir, OutputCacheManager.CACHE_SUBDIR, buildId)
    : getCompileDir(projectId, userId)
  const timeout = 60 * 1000 // increased to allow for large projects
  const compileName = getCompileName(projectId, userId)
  const compileGroup = runInOutputDir ? 'synctex-output' : 'synctex'
  const defaultImageName =
    Settings.clsi && Settings.clsi.docker && Settings.clsi.docker.image
  // eslint-disable-next-line @typescript-eslint/return-await
  return await OutputCacheManager.promises.queueDirOperation(
    outputDir,
    /**
     * @return {Promise<{stdout: string, downloadedFromCache: boolean}>}
     */
    async () => {
      let downloadedFromCache = false
      try {
        await _checkFileExists(directory, 'output.synctex.gz')
      } catch (err) {
        if (
          err instanceof Errors.NotFoundError &&
          compileFromClsiCache &&
          editorId &&
          buildId
        ) {
          try {
            downloadedFromCache =
              await downloadOutputDotSynctexFromCompileCache(
                projectId,
                userId,
                editorId,
                buildId,
                directory
              )
          } catch (err) {
            logger.warn(
              { err, projectId, userId, editorId, buildId },
              'failed to download output.synctex.gz from clsi-cache'
            )
          }
          await _checkFileExists(directory, 'output.synctex.gz')
        } else {
          throw err
        }
      }
      try {
        const { stdout } = await CommandRunner.promises.run(
          compileName,
          command,
          directory,
          imageName || defaultImageName,
          timeout,
          {},
          compileGroup
        )
        return {
          stdout,
          downloadedFromCache,
        }
      } catch (error) {
        throw OError.tag(error, 'error running synctex', {
          command,
          projectId,
          userId,
        })
      }
    }
  )
}

async function wordcount(projectId, userId, filename, image) {
  logger.debug({ projectId, userId, filename, image }, 'running wordcount')
  const filePath = `$COMPILE_DIR/${filename}`
  const command = ['texcount', '-nocol', '-inc', filePath]
  const compileDir = getCompileDir(projectId, userId)
  const timeout = 60 * 1000
  const compileName = getCompileName(projectId, userId)
  const compileGroup = 'wordcount'

  if (image && !_isImageNameAllowed(image)) {
    throw new Errors.InvalidParameter('invalid image')
  }

  try {
    await fsPromises.mkdir(compileDir, { recursive: true })
  } catch (err) {
    throw OError.tag(err, 'error ensuring dir for wordcount', {
      projectId,
      userId,
      filename,
    })
  }

  try {
    const { stdout } = await CommandRunner.promises.run(
      compileName,
      command,
      compileDir,
      image,
      timeout,
      {},
      compileGroup
    )
    const results = _parseWordcountFromOutput(stdout)
    logger.debug(
      { projectId, userId, wordcount: results },
      'word count results'
    )
    return results
  } catch (err) {
    throw OError.tag(err, 'error reading word count output', {
      command,
      compileDir,
      projectId,
      userId,
    })
  }
}

function _parseWordcountFromOutput(output) {
  const results = {
    encode: '',
    textWords: 0,
    headWords: 0,
    outside: 0,
    headers: 0,
    elements: 0,
    mathInline: 0,
    mathDisplay: 0,
    errors: 0,
    messages: '',
  }
  for (const line of output.split('\n')) {
    const [data, info] = line.split(':')
    if (data.indexOf('Encoding') > -1) {
      results.encode = info.trim()
    }
    if (data.indexOf('in text') > -1) {
      results.textWords = parseInt(info, 10)
    }
    if (data.indexOf('in head') > -1) {
      results.headWords = parseInt(info, 10)
    }
    if (data.indexOf('outside') > -1) {
      results.outside = parseInt(info, 10)
    }
    if (data.indexOf('of head') > -1) {
      results.headers = parseInt(info, 10)
    }
    if (data.indexOf('Number of floats/tables/figures') > -1) {
      results.elements = parseInt(info, 10)
    }
    if (data.indexOf('Number of math inlines') > -1) {
      results.mathInline = parseInt(info, 10)
    }
    if (data.indexOf('Number of math displayed') > -1) {
      results.mathDisplay = parseInt(info, 10)
    }
    if (data === '(errors') {
      // errors reported as (errors:123)
      results.errors = parseInt(info, 10)
    }
    if (line.indexOf('!!! ') > -1) {
      // errors logged as !!! message !!!
      results.messages += line + '\n'
    }
  }
  return results
}

function _isImageNameAllowed(imageName) {
  const ALLOWED_IMAGES =
    Settings.clsi && Settings.clsi.docker && Settings.clsi.docker.allowedImages
  return !ALLOWED_IMAGES || ALLOWED_IMAGES.includes(imageName)
}

module.exports = {
  doCompileWithLock: callbackify(doCompileWithLock),
  stopCompile: callbackify(stopCompile),
  clearProject: callbackify(clearProject),
  clearExpiredProjects: callbackify(clearExpiredProjects),
  syncFromCode: callbackifyMultiResult(syncFromCode, [
    'codePositions',
    'downloadedFromCache',
  ]),
  syncFromPdf: callbackifyMultiResult(syncFromPdf, [
    'pdfPositions',
    'downloadedFromCache',
  ]),
  wordcount: callbackify(wordcount),
  promises: {
    doCompileWithLock,
    stopCompile,
    clearProject,
    clearExpiredProjects,
    syncFromCode,
    syncFromPdf,
    wordcount,
  },
}
