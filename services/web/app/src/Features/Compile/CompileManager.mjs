import Crypto from 'node:crypto'
import Settings from '@overleaf/settings'
import RedisWrapper from '../../infrastructure/RedisWrapper.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectRootDocManager from '../Project/ProjectRootDocManager.mjs'
import UserGetter from '../User/UserGetter.mjs'
import ClsiManager from './ClsiManager.mjs'
import Metrics from '@overleaf/metrics'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import UserAnalyticsIdCache from '../Analytics/UserAnalyticsIdCache.mjs'
import { callbackify, callbackifyMultiResult } from '@overleaf/promise-utils'
let CompileManager
const rclient = RedisWrapper.client('clsi_recently_compiled')

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

function generateBuildId() {
  return `${Date.now().toString(16)}-${Crypto.randomBytes(8).toString('hex')}`
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

  // Generate the buildId ahead of fetching the project content from redis/mongo so that the buildId's timestamp is before any lastUpdated date.
  options.buildId = generateBuildId()

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
    clsiCacheShard,
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
    clsiCacheShard,
  }
}

const instrumentedCompile = instrumentWithTimer(compile, 'editor.compile')

async function getProjectCompileLimits(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
    fromV1TemplateId: 1,
  })
  return _getProjectCompileLimits(project)
}

async function _getProjectCompileLimits(project) {
  if (!project) {
    throw new Error('project not found')
  }
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
    compileBackendClass: compileGroup === 'standard' ? 'c3d' : 'c4d',
    ownerAnalyticsId: analyticsId,
  }
  if (project.fromV1TemplateId === Settings.overrideCompileTimeForTemplate) {
    limits.timeout = Math.max(limits.timeout, 20)
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

async function syncTeX(
  projectId,
  userId,
  { direction, compileFromClsiCache, validatedOptions, clsiServerId }
) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: 1,
    imageName: 1,
    fromV1TemplateId: 1,
  })
  const limits = await _getProjectCompileLimits(project)
  const { imageName } = project
  return await ClsiManager.promises.syncTeX(projectId, userId, {
    direction,
    limits,
    imageName,
    compileFromClsiCache,
    validatedOptions,
    clsiServerId,
  })
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

export default CompileManager = {
  promises: {
    compile: instrumentedCompile,
    deleteAuxFiles,
    getProjectCompileLimits,
    stopCompile,
    wordCount,
    syncTeX,
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
    'clsiCacheShard',
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
  syncTeX: callbackify(syncTeX),
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
