let CompileManager
const Settings = require('@overleaf/settings')
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('clsi_recently_compiled')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const UserGetter = require('../User/UserGetter')
const ClsiManager = require('./ClsiManager')
const Metrics = require('@overleaf/metrics')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const UserAnalyticsIdCache = require('../Analytics/UserAnalyticsIdCache')
const {
  callbackify,
  callbackifyMultiResult,
} = require('@overleaf/promise-utils')

function instrumentWithTimer(fn, key) {
  return async (...args) => {
    const timer = new Metrics.Timer(key)
    try {
      return await fn(...args)
    } finally {
      timer.done()
    }
  }
}

async function compile(projectId, userId, options = {}) {
  const recentlyCompiled = await CompileManager._checkIfRecentlyCompiled(
    projectId,
    userId
  )
  if (recentlyCompiled) {
    return { status: 'too-recently-compiled', outputFiles: [] }
  }

  try {
    const canCompile = await CompileManager._checkIfAutoCompileLimitHasBeenHit(
      options.isAutoCompile,
      'everyone'
    )
    if (!canCompile) {
      return { status: 'autocompile-backoff', outputFiles: [] }
    }
  } catch (error) {
    return { status: 'autocompile-backoff', outputFiles: [] }
  }

  await ProjectRootDocManager.promises.ensureRootDocumentIsSet(projectId)

  const limits =
    await CompileManager.promises.getProjectCompileLimits(projectId)
  for (const key in limits) {
    const value = limits[key]
    options[key] = value
  }

  try {
    const canCompile = await CompileManager._checkCompileGroupAutoCompileLimit(
      options.isAutoCompile,
      limits.compileGroup
    )
    if (!canCompile) {
      return { status: 'autocompile-backoff', outputFiles: [] }
    }
  } catch (error) {
    return { message: 'autocompile-backoff', outputFiles: [] }
  }

  // only pass userId down to clsi if this is a per-user compile
  const compileAsUser = Settings.disablePerUserCompiles ? undefined : userId
  const {
    status,
    outputFiles,
    clsiServerId,
    validationProblems,
    stats,
    timings,
    outputUrlPrefix,
    buildId,
  } = await ClsiManager.promises.sendRequest(projectId, compileAsUser, options)

  return {
    status,
    outputFiles,
    clsiServerId,
    limits,
    validationProblems,
    stats,
    timings,
    outputUrlPrefix,
    buildId,
  }
}

const instrumentedCompile = instrumentWithTimer(compile, 'editor.compile')

async function getProjectCompileLimits(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
  })

  const owner = await UserGetter.promises.getUser(project.owner_ref, {
    _id: 1,
    alphaProgram: 1,
    analyticsId: 1,
    betaProgram: 1,
    features: 1,
  })

  const ownerFeatures = (owner && owner.features) || {}
  // put alpha users into their own compile group
  if (owner && owner.alphaProgram) {
    ownerFeatures.compileGroup = 'alpha'
  }
  const analyticsId = await UserAnalyticsIdCache.get(owner._id)

  const compileGroup =
    ownerFeatures.compileGroup || Settings.defaultFeatures.compileGroup
  const limits = {
    timeout:
      ownerFeatures.compileTimeout || Settings.defaultFeatures.compileTimeout,
    compileGroup,
    compileBackendClass: compileGroup === 'standard' ? 'n2d' : 'c2d',
    ownerAnalyticsId: analyticsId,
  }
  return limits
}

async function wordCount(projectId, userId, file, clsiserverid) {
  const limits =
    await CompileManager.promises.getProjectCompileLimits(projectId)
  return await ClsiManager.promises.wordCount(
    projectId,
    userId,
    file,
    limits,
    clsiserverid
  )
}

async function stopCompile(projectId, userId) {
  const limits =
    await CompileManager.promises.getProjectCompileLimits(projectId)

  return await ClsiManager.promises.stopCompile(projectId, userId, limits)
}

async function deleteAuxFiles(projectId, userId, clsiserverid) {
  const limits =
    await CompileManager.promises.getProjectCompileLimits(projectId)

  return await ClsiManager.promises.deleteAuxFiles(
    projectId,
    userId,
    limits,
    clsiserverid
  )
}

module.exports = CompileManager = {
  promises: {
    compile: instrumentedCompile,
    deleteAuxFiles,
    getProjectCompileLimits,
    stopCompile,
    wordCount,
  },
  compile: callbackifyMultiResult(instrumentedCompile, [
    'status',
    'outputFiles',
    'clsiServerId',
    'limits',
    'validationProblems',
    'stats',
    'timings',
    'outputUrlPrefix',
    'buildId',
  ]),

  stopCompile: callbackify(stopCompile),

  deleteAuxFiles: callbackify(deleteAuxFiles),

  getProjectCompileLimits: callbackify(getProjectCompileLimits),

  COMPILE_DELAY: 1, // seconds
  async _checkIfRecentlyCompiled(projectId, userId) {
    const key = `compile:${projectId}:${userId}`
    const ok = await rclient.set(key, true, 'EX', this.COMPILE_DELAY, 'NX')
    return ok !== 'OK'
  },

  async _checkCompileGroupAutoCompileLimit(isAutoCompile, compileGroup) {
    if (!isAutoCompile) {
      return true
    }
    if (compileGroup === 'standard') {
      // apply extra limits to the standard compile group
      return await CompileManager._checkIfAutoCompileLimitHasBeenHit(
        isAutoCompile,
        compileGroup
      )
    } else {
      Metrics.inc(`auto-compile-${compileGroup}`)
      return true
    }
  }, // always allow priority group users to compile

  async _checkIfAutoCompileLimitHasBeenHit(isAutoCompile, compileGroup) {
    if (!isAutoCompile) {
      return true
    }
    Metrics.inc(`auto-compile-${compileGroup}`)
    const rateLimiter = getAutoCompileRateLimiter(compileGroup)
    try {
      await rateLimiter.consume('global', 1, { method: 'global' })
      return true
    } catch (e) {
      // Don't differentiate between errors and rate limits. Silently trigger
      // the rate limit if there's an error consuming the points.
      Metrics.inc(`auto-compile-${compileGroup}-limited`)
      return false
    }
  },

  wordCount: callbackify(wordCount),
}

const autoCompileRateLimiters = new Map()
function getAutoCompileRateLimiter(compileGroup) {
  let rateLimiter = autoCompileRateLimiters.get(compileGroup)
  if (rateLimiter == null) {
    rateLimiter = new RateLimiter(`auto-compile:${compileGroup}`, {
      points: Settings.rateLimit.autoCompile[compileGroup] || 25,
      duration: 20,
    })
    autoCompileRateLimiters.set(compileGroup, rateLimiter)
  }
  return rateLimiter
}
