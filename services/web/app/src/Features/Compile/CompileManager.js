let CompileManager
const Settings = require('@overleaf/settings')
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('clsi_recently_compiled')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const UserGetter = require('../User/UserGetter')
const ClsiManager = require('./ClsiManager')
const Metrics = require('@overleaf/metrics')
const rateLimiter = require('../../infrastructure/RateLimiter')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const { getAnalyticsIdFromMongoUser } = require('../Analytics/AnalyticsHelper')

module.exports = CompileManager = {
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
            const limits = {
              timeout:
                ownerFeatures.compileTimeout ||
                Settings.defaultFeatures.compileTimeout,
              compileGroup:
                ownerFeatures.compileGroup ||
                Settings.defaultFeatures.compileGroup,
              ownerAnalyticsId: getAnalyticsIdFromMongoUser(owner),
            }
            CompileManager._getCompileBackendClassDetails(
              owner,
              limits.compileGroup,
              (err, { compileBackendClass, showFasterCompilesFeedbackUI }) => {
                if (err) return callback(err)
                limits.compileBackendClass = compileBackendClass
                limits.showFasterCompilesFeedbackUI =
                  showFasterCompilesFeedbackUI
                callback(null, limits)
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
    const opts = {
      endpointName: 'auto_compile',
      timeInterval: 20,
      subjectName: compileGroup,
      throttle: Settings.rateLimit.autoCompile[compileGroup] || 25,
    }
    rateLimiter.addCount(opts, function (err, canCompile) {
      if (err) {
        canCompile = false
      }
      if (!canCompile) {
        Metrics.inc(`auto-compile-${compileGroup}-limited`)
      }
      callback(null, canCompile)
    })
  },

  _getCompileBackendClassDetails(owner, compileGroup, callback) {
    const { defaultBackendClass } = Settings.apis.clsi
    if (compileGroup === 'standard') {
      return callback(null, {
        compileBackendClass: defaultBackendClass,
        showFasterCompilesFeedbackUI: false,
      })
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
