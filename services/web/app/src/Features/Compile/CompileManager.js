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
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const UserAnalyticsIdCache = require('../Analytics/UserAnalyticsIdCache')

const NEW_COMPILE_TIMEOUT_ENFORCED_CUTOFF = new Date('2023-09-18T11:00:00.000Z')
const NEW_COMPILE_TIMEOUT_ENFORCED_CUTOFF_DEFAULT_BASELINE = new Date(
  '2023-10-10T11:00:00.000Z'
)

module.exports = CompileManager = {
  NEW_COMPILE_TIMEOUT_ENFORCED_CUTOFF,
  NEW_COMPILE_TIMEOUT_ENFORCED_CUTOFF_DEFAULT_BASELINE,

  compile(projectId, userId, options = {}, _callback) {
    const timer = new Metrics.Timer('editor.compile')
    const callback = function (...args) {
      timer.done()
      _callback(...args)
    }

    CompileManager._checkIfRecentlyCompiled(
      projectId,
      userId,
      function (error, recentlyCompiled) {
        if (error) {
          return callback(error)
        }
        if (recentlyCompiled) {
          return callback(null, 'too-recently-compiled', [])
        }

        CompileManager._checkIfAutoCompileLimitHasBeenHit(
          options.isAutoCompile,
          'everyone',
          function (err, canCompile) {
            if (err || !canCompile) {
              return callback(null, 'autocompile-backoff', [])
            }

            ProjectRootDocManager.ensureRootDocumentIsSet(
              projectId,
              function (error) {
                if (error) {
                  return callback(error)
                }
                CompileManager.getProjectCompileLimits(
                  projectId,
                  function (error, limits) {
                    if (error) {
                      return callback(error)
                    }
                    for (const key in limits) {
                      const value = limits[key]
                      options[key] = value
                    }
                    if (options.timeout !== 20) {
                      // temporary override to force the new compile timeout
                      if (options.forceNewCompileTimeout === 'active') {
                        options.timeout = 20
                      } else if (
                        options.forceNewCompileTimeout === 'changing'
                      ) {
                        options.timeout = 60
                      }
                    }
                    // Put a lower limit on autocompiles for free users, based on compileGroup
                    CompileManager._checkCompileGroupAutoCompileLimit(
                      options.isAutoCompile,
                      limits.compileGroup,
                      function (err, canCompile) {
                        if (err || !canCompile) {
                          return callback(null, 'autocompile-backoff', [])
                        }
                        // only pass userId down to clsi if this is a per-user compile
                        const compileAsUser = Settings.disablePerUserCompiles
                          ? undefined
                          : userId
                        ClsiManager.sendRequest(
                          projectId,
                          compileAsUser,
                          options,
                          function (
                            error,
                            status,
                            outputFiles,
                            clsiServerId,
                            validationProblems,
                            stats,
                            timings,
                            outputUrlPrefix
                          ) {
                            if (error) {
                              return callback(error)
                            }
                            callback(
                              null,
                              status,
                              outputFiles,
                              clsiServerId,
                              limits,
                              validationProblems,
                              stats,
                              timings,
                              outputUrlPrefix
                            )
                          }
                        )
                      }
                    )
                  }
                )
              }
            )
          }
        )
      }
    )
  },

  stopCompile(projectId, userId, callback) {
    CompileManager.getProjectCompileLimits(projectId, function (error, limits) {
      if (error) {
        return callback(error)
      }
      ClsiManager.stopCompile(projectId, userId, limits, callback)
    })
  },

  deleteAuxFiles(projectId, userId, clsiserverid, callback) {
    CompileManager.getProjectCompileLimits(projectId, function (error, limits) {
      if (error) {
        return callback(error)
      }
      ClsiManager.deleteAuxFiles(
        projectId,
        userId,
        limits,
        clsiserverid,
        callback
      )
    })
  },

  getProjectCompileLimits(projectId, callback) {
    ProjectGetter.getProject(
      projectId,
      { owner_ref: 1 },
      function (error, project) {
        if (error) {
          return callback(error)
        }
        UserGetter.getUser(
          project.owner_ref,
          {
            _id: 1,
            alphaProgram: 1,
            analyticsId: 1,
            betaProgram: 1,
            features: 1,
            splitTests: 1,
            signUpDate: 1, // for compile-timeout-20s
          },
          function (err, owner) {
            if (err) {
              return callback(err)
            }
            const ownerFeatures = (owner && owner.features) || {}
            // put alpha users into their own compile group
            if (owner && owner.alphaProgram) {
              ownerFeatures.compileGroup = 'alpha'
            }
            UserAnalyticsIdCache.callbacks.get(
              owner._id,
              function (err, analyticsId) {
                if (err) {
                  return callback(err)
                }
                const limits = {
                  timeout:
                    ownerFeatures.compileTimeout ||
                    Settings.defaultFeatures.compileTimeout,
                  compileGroup:
                    ownerFeatures.compileGroup ||
                    Settings.defaultFeatures.compileGroup,
                  ownerAnalyticsId: analyticsId,
                }
                CompileManager._getCompileBackendClassDetails(
                  owner,
                  limits.compileGroup,
                  (
                    err,
                    { compileBackendClass, showFasterCompilesFeedbackUI }
                  ) => {
                    if (err) return callback(err)
                    limits.compileBackendClass = compileBackendClass
                    limits.showFasterCompilesFeedbackUI =
                      showFasterCompilesFeedbackUI
                    if (compileBackendClass === 'n2d' && limits.timeout <= 60) {
                      // project owners with faster compiles but with <= 60 compile timeout (default)
                      // will have a 20s compile timeout
                      // The compile-timeout-20s split test exists to enable a gradual rollout
                      SplitTestHandler.getAssignmentForMongoUser(
                        owner,
                        'compile-timeout-20s',
                        (err, assignment) => {
                          if (err) return callback(err)
                          // users who were on the 'default' servers at time of original rollout
                          // will have a later cutoff date for the 20s timeout in the next phase
                          // we check the backend class at version 8 (baseline)
                          const backendClassHistory =
                            owner.splitTests?.['compile-backend-class-n2d'] ||
                            []
                          const backendClassBaselineVariant =
                            backendClassHistory.find(version => {
                              return version.versionNumber === 8
                            })?.variantName
                          const timeoutEnforcedCutoff =
                            backendClassBaselineVariant === 'default'
                              ? NEW_COMPILE_TIMEOUT_ENFORCED_CUTOFF_DEFAULT_BASELINE
                              : NEW_COMPILE_TIMEOUT_ENFORCED_CUTOFF
                          if (assignment?.variant === '20s') {
                            if (owner.signUpDate > timeoutEnforcedCutoff) {
                              limits.timeout = 20
                              callback(null, limits)
                            } else {
                              SplitTestHandler.getAssignmentForMongoUser(
                                owner,
                                'compile-timeout-20s-existing-users',
                                (err, assignmentExistingUsers) => {
                                  if (err) return callback(err)
                                  if (
                                    assignmentExistingUsers?.variant === '20s'
                                  ) {
                                    limits.timeout = 20
                                  }
                                  callback(null, limits)
                                }
                              )
                            }
                          } else {
                            callback(null, limits)
                          }
                        }
                      )
                    } else {
                      callback(null, limits)
                    }
                  }
                )
              }
            )
          }
        )
      }
    )
  },

  COMPILE_DELAY: 1, // seconds
  _checkIfRecentlyCompiled(projectId, userId, callback) {
    const key = `compile:${projectId}:${userId}`
    rclient.set(
      key,
      true,
      'EX',
      this.COMPILE_DELAY,
      'NX',
      function (error, ok) {
        if (error) {
          return callback(error)
        }
        if (ok === 'OK') {
          callback(null, false)
        } else {
          callback(null, true)
        }
      }
    )
  },

  _checkCompileGroupAutoCompileLimit(isAutoCompile, compileGroup, callback) {
    if (!isAutoCompile) {
      return callback(null, true)
    }
    if (compileGroup === 'standard') {
      // apply extra limits to the standard compile group
      CompileManager._checkIfAutoCompileLimitHasBeenHit(
        isAutoCompile,
        compileGroup,
        callback
      )
    } else {
      Metrics.inc(`auto-compile-${compileGroup}`)
      callback(null, true)
    }
  }, // always allow priority group users to compile

  _checkIfAutoCompileLimitHasBeenHit(isAutoCompile, compileGroup, callback) {
    if (!isAutoCompile) {
      return callback(null, true)
    }
    Metrics.inc(`auto-compile-${compileGroup}`)
    const rateLimiter = getAutoCompileRateLimiter(compileGroup)
    rateLimiter
      .consume('global', 1, { method: 'global' })
      .then(() => {
        callback(null, true)
      })
      .catch(() => {
        // Don't differentiate between errors and rate limits. Silently trigger
        // the rate limit if there's an error consuming the points.
        Metrics.inc(`auto-compile-${compileGroup}-limited`)
        callback(null, false)
      })
  },

  _getCompileBackendClassDetails(owner, compileGroup, callback) {
    const { defaultBackendClass } = Settings.apis.clsi
    if (compileGroup === 'standard') {
      return SplitTestHandler.getAssignmentForMongoUser(
        owner,
        'compile-backend-class-n2d',
        (err, assignment) => {
          if (err) return callback(err, {})
          const { variant } = assignment
          callback(null, {
            compileBackendClass:
              variant === 'default' ? defaultBackendClass : variant,
            showFasterCompilesFeedbackUI: false,
          })
        }
      )
    }
    SplitTestHandler.getAssignmentForMongoUser(
      owner,
      'compile-backend-class',
      (err, assignment) => {
        if (err) return callback(err, {})
        const { analytics, variant } = assignment
        const activeForUser = analytics?.segmentation?.splitTest != null
        callback(null, {
          compileBackendClass:
            variant === 'default' ? defaultBackendClass : variant,
          showFasterCompilesFeedbackUI: activeForUser,
        })
      }
    )
  },

  wordCount(projectId, userId, file, clsiserverid, callback) {
    CompileManager.getProjectCompileLimits(projectId, function (error, limits) {
      if (error) {
        return callback(error)
      }
      ClsiManager.wordCount(
        projectId,
        userId,
        file,
        limits,
        clsiserverid,
        callback
      )
    })
  },
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
