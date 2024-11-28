/* eslint-disable
    no-return-assign,
    no-unused-vars,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ResourceWriter
const { promisify } = require('node:util')
const UrlCache = require('./UrlCache')
const Path = require('node:path')
const fs = require('node:fs')
const async = require('async')
const OutputFileFinder = require('./OutputFileFinder')
const ResourceStateManager = require('./ResourceStateManager')
const Metrics = require('./Metrics')
const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')

const parallelFileDownloads = settings.parallelFileDownloads || 1

module.exports = ResourceWriter = {
  syncResourcesToDisk(request, basePath, callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (request.syncType === 'incremental') {
      logger.debug(
        { projectId: request.project_id, userId: request.user_id },
        'incremental sync'
      )
      return ResourceStateManager.checkProjectStateMatches(
        request.syncState,
        basePath,
        function (error, resourceList) {
          if (error != null) {
            return callback(error)
          }
          return ResourceWriter._removeExtraneousFiles(
            request,
            resourceList,
            basePath,
            function (error, outputFiles, allFiles) {
              if (error != null) {
                return callback(error)
              }
              return ResourceStateManager.checkResourceFiles(
                resourceList,
                allFiles,
                basePath,
                function (error) {
                  if (error != null) {
                    return callback(error)
                  }
                  return ResourceWriter.saveIncrementalResourcesToDisk(
                    request.project_id,
                    request.resources,
                    basePath,
                    function (error) {
                      if (error != null) {
                        return callback(error)
                      }
                      return callback(null, resourceList)
                    }
                  )
                }
              )
            }
          )
        }
      )
    }
    logger.debug(
      { projectId: request.project_id, userId: request.user_id },
      'full sync'
    )
    UrlCache.createProjectDir(request.project_id, error => {
      if (error != null) {
        return callback(error)
      }
      ResourceWriter.saveAllResourcesToDisk(
        request,
        basePath,
        function (error) {
          if (error != null) {
            return callback(error)
          }
          return ResourceStateManager.saveProjectState(
            request.syncState,
            request.resources,
            basePath,
            function (error) {
              if (error != null) {
                return callback(error)
              }
              return callback(null, request.resources)
            }
          )
        }
      )
    })
  },

  saveIncrementalResourcesToDisk(projectId, resources, basePath, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ResourceWriter._createDirectory(basePath, error => {
      if (error != null) {
        return callback(error)
      }
      const jobs = Array.from(resources).map(resource =>
        (resource => {
          return callback =>
            ResourceWriter._writeResourceToDisk(
              projectId,
              resource,
              basePath,
              callback
            )
        })(resource)
      )
      return async.parallelLimit(jobs, parallelFileDownloads, callback)
    })
  },

  saveAllResourcesToDisk(request, basePath, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ResourceWriter._createDirectory(basePath, error => {
      if (error != null) {
        return callback(error)
      }
      const { project_id: projectId, resources } = request
      ResourceWriter._removeExtraneousFiles(
        request,
        resources,
        basePath,
        error => {
          if (error != null) {
            return callback(error)
          }
          const jobs = Array.from(resources).map(resource =>
            (resource => {
              return callback =>
                ResourceWriter._writeResourceToDisk(
                  projectId,
                  resource,
                  basePath,
                  callback
                )
            })(resource)
          )
          return async.parallelLimit(jobs, parallelFileDownloads, callback)
        }
      )
    })
  },

  _createDirectory(basePath, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return fs.mkdir(basePath, function (err) {
      if (err != null) {
        if (err.code === 'EEXIST') {
          return callback()
        } else {
          logger.debug({ err, dir: basePath }, 'error creating directory')
          return callback(err)
        }
      } else {
        return callback()
      }
    })
  },

  _removeExtraneousFiles(request, resources, basePath, _callback) {
    if (_callback == null) {
      _callback = function () {}
    }
    const timer = new Metrics.Timer(
      'unlink-output-files',
      1,
      request.metricsOpts
    )
    const callback = function (error, ...result) {
      timer.done()
      return _callback(error, ...Array.from(result))
    }

    return OutputFileFinder.findOutputFiles(
      resources,
      basePath,
      function (error, outputFiles, allFiles) {
        if (error != null) {
          return callback(error)
        }

        const jobs = []
        for (const file of Array.from(outputFiles || [])) {
          ;(function (file) {
            const { path } = file
            let shouldDelete = true
            if (
              path.match(/^output\./) ||
              path.match(/\.aux$/) ||
              path.match(/^cache\//)
            ) {
              // knitr cache
              shouldDelete = false
            }
            if (path.match(/^output-.*/)) {
              // Tikz cached figures (default case)
              shouldDelete = false
            }
            if (path.match(/\.(pdf|dpth|md5)$/)) {
              // Tikz cached figures (by extension)
              shouldDelete = false
            }
            if (
              path.match(/\.(pygtex|pygstyle)$/) ||
              path.match(/(^|\/)_minted-[^\/]+\//)
            ) {
              // minted files/directory
              shouldDelete = false
            }
            if (
              path.match(/\.md\.tex$/) ||
              path.match(/(^|\/)_markdown_[^\/]+\//)
            ) {
              // markdown files/directory
              shouldDelete = false
            }
            if (path.match(/-eps-converted-to\.pdf$/)) {
              // Epstopdf generated files
              shouldDelete = false
            }
            if (
              path === 'output.pdf' ||
              path === 'output.dvi' ||
              path === 'output.log' ||
              path === 'output.xdv' ||
              path === 'output.stdout' ||
              path === 'output.stderr'
            ) {
              shouldDelete = true
            }
            if (path === 'output.tex') {
              // created by TikzManager if present in output files
              shouldDelete = true
            }
            if (shouldDelete) {
              return jobs.push(callback =>
                ResourceWriter._deleteFileIfNotDirectory(
                  Path.join(basePath, path),
                  callback
                )
              )
            }
          })(file)
        }

        return async.series(jobs, function (error) {
          if (error != null) {
            return callback(error)
          }
          return callback(null, outputFiles, allFiles)
        })
      }
    )
  },

  _deleteFileIfNotDirectory(path, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return fs.stat(path, function (error, stat) {
      if (error != null && error.code === 'ENOENT') {
        return callback()
      } else if (error != null) {
        logger.err(
          { err: error, path },
          'error stating file in deleteFileIfNotDirectory'
        )
        return callback(error)
      } else if (stat.isFile()) {
        return fs.unlink(path, function (error) {
          if (error != null) {
            logger.err(
              { err: error, path },
              'error removing file in deleteFileIfNotDirectory'
            )
            return callback(error)
          } else {
            return callback()
          }
        })
      } else {
        return callback()
      }
    })
  },

  _writeResourceToDisk(projectId, resource, basePath, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ResourceWriter.checkPath(
      basePath,
      resource.path,
      function (error, path) {
        if (error != null) {
          return callback(error)
        }
        return fs.mkdir(
          Path.dirname(path),
          { recursive: true },
          function (error) {
            if (error != null) {
              return callback(error)
            }
            // TODO: Don't overwrite file if it hasn't been modified
            if (resource.url != null) {
              return UrlCache.downloadUrlToFile(
                projectId,
                resource.url,
                resource.fallbackURL,
                path,
                resource.modified,
                function (err) {
                  if (err != null) {
                    logger.err(
                      {
                        err,
                        projectId,
                        path,
                        resourceUrl: resource.url,
                        modified: resource.modified,
                      },
                      'error downloading file for resources'
                    )
                    Metrics.inc('download-failed')
                  }
                  return callback()
                }
              ) // try and continue compiling even if http resource can not be downloaded at this time
            } else {
              fs.writeFile(path, resource.content, callback)
            }
          }
        )
      }
    )
  },

  checkPath(basePath, resourcePath, callback) {
    const path = Path.normalize(Path.join(basePath, resourcePath))
    if (path.slice(0, basePath.length + 1) !== basePath + '/') {
      return callback(new Error('resource path is outside root directory'))
    } else {
      return callback(null, path)
    }
  },
}

module.exports.promises = {
  syncResourcesToDisk: promisify(ResourceWriter.syncResourcesToDisk),
  saveIncrementalResourcesToDisk: promisify(
    ResourceWriter.saveIncrementalResourcesToDisk
  ),
  saveAllResourcesToDisk: promisify(ResourceWriter.saveAllResourcesToDisk),
  checkPath: promisify(ResourceWriter.checkPath),
}
