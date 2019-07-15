/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let CompileManager
const Settings = require('settings-sharelatex')
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('clsi_recently_compiled')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectRootDocManager = require('../Project/ProjectRootDocManager')
const UserGetter = require('../User/UserGetter')
const ClsiManager = require('./ClsiManager')
const Metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')
const rateLimiter = require('../../infrastructure/RateLimiter')

module.exports = CompileManager = {
  compile(project_id, user_id, options, _callback) {
    if (options == null) {
      options = {}
    }
    if (_callback == null) {
      _callback = function(error) {}
    }
    const timer = new Metrics.Timer('editor.compile')
    const callback = function(...args) {
      timer.done()
      return _callback(...Array.from(args || []))
    }

    logger.log({ project_id, user_id }, 'compiling project')
    return CompileManager._checkIfRecentlyCompiled(
      project_id,
      user_id,
      function(error, recentlyCompiled) {
        if (error != null) {
          return callback(error)
        }
        if (recentlyCompiled) {
          logger.warn(
            { project_id, user_id },
            'project was recently compiled so not continuing'
          )
          return callback(null, 'too-recently-compiled', [])
        }

        return CompileManager._checkIfAutoCompileLimitHasBeenHit(
          options.isAutoCompile,
          'everyone',
          function(err, canCompile) {
            if (!canCompile) {
              return callback(null, 'autocompile-backoff', [])
            }

            return ProjectRootDocManager.ensureRootDocumentIsSet(
              project_id,
              function(error) {
                if (error != null) {
                  return callback(error)
                }
                return CompileManager.getProjectCompileLimits(
                  project_id,
                  function(error, limits) {
                    if (error != null) {
                      return callback(error)
                    }
                    for (let key in limits) {
                      const value = limits[key]
                      options[key] = value
                    }
                    // Put a lower limit on autocompiles for free users, based on compileGroup
                    return CompileManager._checkCompileGroupAutoCompileLimit(
                      options.isAutoCompile,
                      limits.compileGroup,
                      function(err, canCompile) {
                        if (!canCompile) {
                          return callback(null, 'autocompile-backoff', [])
                        }
                        // only pass user_id down to clsi if this is a per-user compile
                        const compileAsUser = Settings.disablePerUserCompiles
                          ? undefined
                          : user_id
                        return ClsiManager.sendRequest(
                          project_id,
                          compileAsUser,
                          options,
                          function(
                            error,
                            status,
                            outputFiles,
                            clsiServerId,
                            validationProblems
                          ) {
                            if (error != null) {
                              return callback(error)
                            }
                            logger.log({ files: outputFiles }, 'output files')
                            return callback(
                              null,
                              status,
                              outputFiles,
                              clsiServerId,
                              limits,
                              validationProblems
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

  stopCompile(project_id, user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return CompileManager.getProjectCompileLimits(project_id, function(
      error,
      limits
    ) {
      if (error != null) {
        return callback(error)
      }
      return ClsiManager.stopCompile(project_id, user_id, limits, callback)
    })
  },

  deleteAuxFiles(project_id, user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return CompileManager.getProjectCompileLimits(project_id, function(
      error,
      limits
    ) {
      if (error != null) {
        return callback(error)
      }
      return ClsiManager.deleteAuxFiles(project_id, user_id, limits, callback)
    })
  },

  getProjectCompileLimits(project_id, callback) {
    if (callback == null) {
      callback = function(error, limits) {}
    }
    return ProjectGetter.getProject(project_id, { owner_ref: 1 }, function(
      error,
      project
    ) {
      if (error != null) {
        return callback(error)
      }
      return UserGetter.getUser(project.owner_ref, { features: 1 }, function(
        err,
        owner
      ) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, {
          timeout:
            __guard__(
              owner != null ? owner.features : undefined,
              x => x.compileTimeout
            ) || Settings.defaultFeatures.compileTimeout,
          compileGroup:
            __guard__(
              owner != null ? owner.features : undefined,
              x1 => x1.compileGroup
            ) || Settings.defaultFeatures.compileGroup
        })
      })
    })
  },

  COMPILE_DELAY: 1, // seconds
  _checkIfRecentlyCompiled(project_id, user_id, callback) {
    if (callback == null) {
      callback = function(error, recentlyCompiled) {}
    }
    const key = `compile:${project_id}:${user_id}`
    return rclient.set(key, true, 'EX', this.COMPILE_DELAY, 'NX', function(
      error,
      ok
    ) {
      if (error != null) {
        return callback(error)
      }
      if (ok === 'OK') {
        return callback(null, false)
      } else {
        return callback(null, true)
      }
    })
  },

  _checkCompileGroupAutoCompileLimit(isAutoCompile, compileGroup, callback) {
    if (callback == null) {
      callback = function(err, canCompile) {}
    }
    if (!isAutoCompile) {
      return callback(null, true)
    }
    if (compileGroup === 'standard') {
      // apply extra limits to the standard compile group
      return CompileManager._checkIfAutoCompileLimitHasBeenHit(
        isAutoCompile,
        compileGroup,
        callback
      )
    } else {
      Metrics.inc(`auto-compile-${compileGroup}`)
      return callback(null, true)
    }
  }, // always allow priority group users to compile

  _checkIfAutoCompileLimitHasBeenHit(isAutoCompile, compileGroup, callback) {
    if (callback == null) {
      callback = function(err, canCompile) {}
    }
    if (!isAutoCompile) {
      return callback(null, true)
    }
    Metrics.inc(`auto-compile-${compileGroup}`)
    const opts = {
      endpointName: 'auto_compile',
      timeInterval: 20,
      subjectName: compileGroup,
      throttle: Settings.rateLimit.autoCompile[compileGroup] || 25
    }
    return rateLimiter.addCount(opts, function(err, canCompile) {
      if (err != null) {
        canCompile = false
      }
      if (!canCompile) {
        Metrics.inc(`auto-compile-${compileGroup}-limited`)
      }
      return callback(err, canCompile)
    })
  },

  wordCount(project_id, user_id, file, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return CompileManager.getProjectCompileLimits(project_id, function(
      error,
      limits
    ) {
      if (error != null) {
        return callback(error)
      }
      return ClsiManager.wordCount(project_id, user_id, file, limits, callback)
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
