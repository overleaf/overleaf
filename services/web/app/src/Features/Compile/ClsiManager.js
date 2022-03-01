const async = require('async')
const Settings = require('@overleaf/settings')
const request = require('request')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const logger = require('@overleaf/logger')
const { URL } = require('url')
const OError = require('@overleaf/o-error')

const ClsiCookieManager = require('./ClsiCookieManager')(
  Settings.apis.clsi != null ? Settings.apis.clsi.backendGroupName : undefined
)
const NewBackendCloudClsiCookieManager = require('./ClsiCookieManager')(
  Settings.apis.clsi_new != null
    ? Settings.apis.clsi_new.backendGroupName
    : undefined
)
const ClsiStateManager = require('./ClsiStateManager')
const _ = require('underscore')
const ClsiFormatChecker = require('./ClsiFormatChecker')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const Metrics = require('@overleaf/metrics')
const Errors = require('../Errors/Errors')

const VALID_COMPILERS = ['pdflatex', 'latex', 'xelatex', 'lualatex']

const ClsiManager = {
  sendRequest(projectId, userId, options, callback) {
    if (options == null) {
      options = {}
    }
    ClsiManager.sendRequestOnce(
      projectId,
      userId,
      options,
      (err, status, ...result) => {
        if (err != null) {
          return callback(err)
        }
        if (status === 'conflict') {
          // Try again, with a full compile
          return ClsiManager.sendRequestOnce(
            projectId,
            userId,
            { ...options, syncType: 'full' },
            callback
          )
        } else if (status === 'unavailable') {
          return ClsiManager.sendRequestOnce(
            projectId,
            userId,
            { ...options, syncType: 'full', forceNewClsiServer: true },
            callback
          )
        }
        callback(null, status, ...result)
      }
    )
  },

  sendRequestOnce(projectId, userId, options, callback) {
    if (options == null) {
      options = {}
    }
    ClsiManager._buildRequest(projectId, options, (err, req) => {
      if (err != null) {
        if (err.message === 'no main file specified') {
          return callback(null, 'validation-problems', null, null, {
            mainFile: err.message,
          })
        } else {
          return callback(
            OError.tag(err, 'Could not build request to CLSI', {
              projectId,
              options,
            })
          )
        }
      }
      ClsiManager._sendBuiltRequest(
        projectId,
        userId,
        req,
        options,
        (err, status, ...result) => {
          if (err != null) {
            return callback(
              OError.tag(err, 'CLSI compile failed', { projectId, userId })
            )
          }
          callback(null, status, ...result)
        }
      )
    })
  },

  // for public API requests where there is no project id
  sendExternalRequest(submissionId, clsiRequest, options, callback) {
    if (options == null) {
      options = {}
    }
    ClsiManager._sendBuiltRequest(
      submissionId,
      null,
      clsiRequest,
      options,
      (err, status, ...result) => {
        if (err != null) {
          return callback(
            OError.tag(err, 'CLSI compile failed', {
              submissionId,
              options,
            })
          )
        }
        callback(null, status, ...result)
      }
    )
  },

  stopCompile(projectId, userId, options, callback) {
    if (options == null) {
      options = {}
    }
    const compilerUrl = this._getCompilerUrl(
      options.compileGroup,
      projectId,
      userId,
      'compile/stop'
    )
    const opts = {
      url: compilerUrl,
      method: 'POST',
    }
    ClsiManager._makeRequest(projectId, userId, opts, callback)
  },

  deleteAuxFiles(projectId, userId, options, clsiserverid, callback) {
    if (options == null) {
      options = {}
    }
    const compilerUrl = this._getCompilerUrl(
      options.compileGroup,
      projectId,
      userId
    )
    const opts = {
      url: compilerUrl,
      method: 'DELETE',
    }
    ClsiManager._makeRequestWithClsiServerId(
      projectId,
      userId,
      opts,
      clsiserverid,
      clsiErr => {
        // always clear the project state from the docupdater, even if there
        // was a problem with the request to the clsi
        DocumentUpdaterHandler.clearProjectState(projectId, docUpdaterErr => {
          ClsiCookieManager.clearServerId(projectId, userId, redisError => {
            if (clsiErr) {
              return callback(
                OError.tag(clsiErr, 'Failed to delete aux files', { projectId })
              )
            }
            if (docUpdaterErr) {
              return callback(
                OError.tag(
                  docUpdaterErr,
                  'Failed to clear project state in doc updater',
                  { projectId }
                )
              )
            }
            if (redisError) {
              // redis errors need wrapping as the instance may be shared
              return callback(
                OError(
                  'Failed to clear clsi persistence',
                  { projectId },
                  redisError
                )
              )
            }
            callback()
          })
        })
      }
    )
  },

  _sendBuiltRequest(projectId, userId, req, options, callback) {
    if (options == null) {
      options = {}
    }
    if (options.forceNewClsiServer) {
      // Clear clsi cookie, then try again
      return ClsiCookieManager.clearServerId(projectId, userId, err => {
        if (err) {
          return callback(err)
        }
        options.forceNewClsiServer = false // backend has now been reset
        return ClsiManager._sendBuiltRequest(
          projectId,
          userId,
          req,
          options,
          callback
        )
      })
    }
    ClsiFormatChecker.checkRecoursesForProblems(
      req.compile != null ? req.compile.resources : undefined,
      (err, validationProblems) => {
        if (err != null) {
          return callback(
            OError.tag(
              err,
              'could not check resources for potential problems before sending to clsi'
            )
          )
        }
        if (validationProblems != null) {
          logger.log(
            { projectId, validationProblems },
            'problems with users latex before compile was attempted'
          )
          return callback(
            null,
            'validation-problems',
            null,
            null,
            validationProblems
          )
        }
        ClsiManager._postToClsi(
          projectId,
          userId,
          req,
          options.compileGroup,
          (err, response, clsiServerId) => {
            if (err != null) {
              return callback(
                OError.tag(err, 'error sending request to clsi', {
                  projectId,
                  userId,
                })
              )
            }
            const outputFiles = ClsiManager._parseOutputFiles(
              projectId,
              response && response.compile && response.compile.outputFiles
            )
            const compile = (response && response.compile) || {}
            const status = compile.status
            const stats = compile.stats
            const timings = compile.timings
            const validationProblems = undefined
            callback(
              null,
              status,
              outputFiles,
              clsiServerId,
              validationProblems,
              stats,
              timings
            )
          }
        )
      }
    )
  },

  _makeRequestWithClsiServerId(
    projectId,
    userId,
    opts,
    clsiserverid,
    callback
  ) {
    if (clsiserverid) {
      // ignore cookies and newBackend, go straight to the clsi node
      opts.qs = Object.assign({ clsiserverid }, opts.qs)
      request(opts, (err, response, body) => {
        if (err) {
          return callback(
            OError.tag(err, 'error making request to CLSI', { projectId })
          )
        }
        callback(null, response, body)
      })
    } else {
      ClsiManager._makeRequest(projectId, userId, opts, callback)
    }
  },

  _makeRequest(projectId, userId, opts, callback) {
    async.series(
      {
        currentBackend(cb) {
          const startTime = new Date()
          ClsiCookieManager.getCookieJar(
            projectId,
            userId,
            (err, jar, clsiServerId) => {
              if (err != null) {
                return callback(
                  OError.tag(err, 'error getting cookie jar for CLSI request', {
                    projectId,
                  })
                )
              }
              opts.jar = jar
              const timer = new Metrics.Timer('compile.currentBackend')
              request(opts, (err, response, body) => {
                if (err != null) {
                  return callback(
                    OError.tag(err, 'error making request to CLSI', {
                      projectId,
                    })
                  )
                }
                timer.done()
                Metrics.inc(
                  `compile.currentBackend.response.${response.statusCode}`
                )
                ClsiCookieManager.setServerId(
                  projectId,
                  userId,
                  response,
                  clsiServerId,
                  (err, newClsiServerId) => {
                    if (err != null) {
                      callback(
                        OError.tag(err, 'error setting server id', {
                          projectId,
                        })
                      )
                    } else {
                      // return as soon as the standard compile has returned
                      callback(
                        null,
                        response,
                        body,
                        newClsiServerId || clsiServerId
                      )
                    }
                    cb(err, {
                      response,
                      body,
                      finishTime: new Date() - startTime,
                    })
                  }
                )
              })
            }
          )
        },
        newBackend(cb) {
          const startTime = new Date()
          ClsiManager._makeNewBackendRequest(
            projectId,
            userId,
            opts,
            (err, response, body) => {
              if (err != null) {
                logger.warn({ err }, 'Error making request to new CLSI backend')
              }
              if (response != null) {
                Metrics.inc(
                  `compile.newBackend.response.${response.statusCode}`
                )
              }
              cb(err, {
                response,
                body,
                finishTime: new Date() - startTime,
              })
            }
          )
        },
      },
      (err, results) => {
        if (err != null) {
          // This was handled higher up
          return
        }
        if (results.newBackend != null && results.newBackend.response != null) {
          const currentStatusCode = results.currentBackend.response.statusCode
          const newStatusCode = results.newBackend.response.statusCode
          const statusCodeSame = newStatusCode === currentStatusCode
          const currentCompileTime = results.currentBackend.finishTime
          const newBackendCompileTime = results.newBackend.finishTime || 0
          const timeDifference = newBackendCompileTime - currentCompileTime
          logger.log(
            {
              statusCodeSame,
              timeDifference,
              currentCompileTime,
              newBackendCompileTime,
              projectId,
            },
            'both clsi requests returned'
          )
        }
      }
    )
  },

  _makeNewBackendRequest(projectId, userId, baseOpts, callback) {
    if (Settings.apis.clsi_new == null || Settings.apis.clsi_new.url == null) {
      return callback()
    }
    const opts = {
      ...baseOpts,
      url: baseOpts.url.replace(
        Settings.apis.clsi.url,
        Settings.apis.clsi_new.url
      ),
    }
    NewBackendCloudClsiCookieManager.getCookieJar(
      projectId,
      userId,
      (err, jar, clsiServerId) => {
        if (err != null) {
          return callback(
            OError.tag(err, 'error getting cookie jar for CLSI request', {
              projectId,
            })
          )
        }
        opts.jar = jar
        const timer = new Metrics.Timer('compile.newBackend')
        request(opts, (err, response, body) => {
          timer.done()
          if (err != null) {
            return callback(
              OError.tag(err, 'error making request to new CLSI', {
                projectId,
                opts,
              })
            )
          }
          NewBackendCloudClsiCookieManager.setServerId(
            projectId,
            userId,
            response,
            clsiServerId,
            err => {
              if (err != null) {
                return callback(
                  OError.tag(err, 'error setting server id on new backend', {
                    projectId,
                  })
                )
              }
              callback(null, response, body)
            }
          )
        })
      }
    )
  },

  _getCompilerUrl(compileGroup, projectId, userId, action) {
    const host = Settings.apis.clsi.url
    let path = `/project/${projectId}`
    if (userId != null) {
      path += `/user/${userId}`
    }
    if (action != null) {
      path += `/${action}`
    }
    return `${host}${path}`
  },

  _postToClsi(projectId, userId, req, compileGroup, callback) {
    const compileUrl = this._getCompilerUrl(
      compileGroup,
      projectId,
      userId,
      'compile'
    )
    const opts = {
      url: compileUrl,
      json: req,
      method: 'POST',
    }
    ClsiManager._makeRequest(
      projectId,
      userId,
      opts,
      (err, response, body, clsiServerId) => {
        if (err != null) {
          return callback(
            new OError('failed to make request to CLSI', {
              projectId,
              userId,
              compileOptions: req.compile.options,
              rootResourcePath: req.compile.rootResourcePath,
            })
          )
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          callback(null, body, clsiServerId)
        } else if (response.statusCode === 413) {
          callback(null, { compile: { status: 'project-too-large' } })
        } else if (response.statusCode === 409) {
          callback(null, { compile: { status: 'conflict' } })
        } else if (response.statusCode === 423) {
          callback(null, { compile: { status: 'compile-in-progress' } })
        } else if (response.statusCode === 503) {
          callback(null, { compile: { status: 'unavailable' } })
        } else {
          callback(
            new OError(
              `CLSI returned non-success code: ${response.statusCode}`,
              {
                projectId,
                userId,
                compileOptions: req.compile.options,
                rootResourcePath: req.compile.rootResourcePath,
                clsiResponse: body,
                statusCode: response.statusCode,
              }
            )
          )
        }
      }
    )
  },

  _parseOutputFiles(projectId, rawOutputFiles = []) {
    const outputFiles = []
    for (const file of rawOutputFiles) {
      outputFiles.push({
        path: file.path, // the clsi is now sending this to web
        url: new URL(file.url).pathname, // the location of the file on the clsi, excluding the host part
        type: file.type,
        build: file.build,
        contentId: file.contentId,
        ranges: file.ranges,
        size: file.size,
      })
    }
    return outputFiles
  },

  _buildRequest(projectId, options, callback) {
    if (options == null) {
      options = {}
    }
    ProjectGetter.getProject(
      projectId,
      { compiler: 1, rootDoc_id: 1, imageName: 1, rootFolder: 1 },
      (err, project) => {
        if (err != null) {
          return callback(
            OError.tag(err, 'failed to get project', { projectId })
          )
        }
        if (project == null) {
          return callback(
            new Errors.NotFoundError(`project does not exist: ${projectId}`)
          )
        }
        if (!VALID_COMPILERS.includes(project.compiler)) {
          project.compiler = 'pdflatex'
        }

        if (options.incrementalCompilesEnabled || options.syncType != null) {
          // new way, either incremental or full
          const timer = new Metrics.Timer('editor.compile-getdocs-redis')
          ClsiManager.getContentFromDocUpdaterIfMatch(
            projectId,
            project,
            options,
            (err, projectStateHash, docUpdaterDocs) => {
              timer.done()
              if (err != null) {
                logger.error({ err, projectId }, 'error checking project state')
                // note: we don't bail out when there's an error getting
                // incremental files from the docupdater, we just fall back
                // to a normal compile below
              }
              // see if we can send an incremental update to the CLSI
              if (
                docUpdaterDocs != null &&
                options.syncType !== 'full' &&
                err == null
              ) {
                Metrics.inc('compile-from-redis')
                ClsiManager._buildRequestFromDocupdater(
                  projectId,
                  options,
                  project,
                  projectStateHash,
                  docUpdaterDocs,
                  callback
                )
              } else {
                Metrics.inc('compile-from-mongo')
                ClsiManager._buildRequestFromMongo(
                  projectId,
                  options,
                  project,
                  projectStateHash,
                  callback
                )
              }
            }
          )
        } else {
          // old way, always from mongo
          const timer = new Metrics.Timer('editor.compile-getdocs-mongo')
          ClsiManager._getContentFromMongo(projectId, (err, docs, files) => {
            timer.done()
            if (err != null) {
              return callback(
                OError.tag(err, 'failed to get contents from Mongo', {
                  projectId,
                })
              )
            }
            ClsiManager._finaliseRequest(
              projectId,
              options,
              project,
              docs,
              files,
              callback
            )
          })
        }
      }
    )
  },

  getContentFromDocUpdaterIfMatch(projectId, project, options, callback) {
    const projectStateHash = ClsiStateManager.computeHash(project, options)
    DocumentUpdaterHandler.getProjectDocsIfMatch(
      projectId,
      projectStateHash,
      (err, docs) => {
        if (err != null) {
          return callback(
            OError.tag(err, 'Failed to get project documents', {
              projectId,
              projectStateHash,
            })
          )
        }
        callback(null, projectStateHash, docs)
      }
    )
  },

  getOutputFileStream(projectId, userId, buildId, outputFilePath, callback) {
    const url = `${Settings.apis.clsi.url}/project/${projectId}/user/${userId}/build/${buildId}/output/${outputFilePath}`
    ClsiCookieManager.getCookieJar(projectId, userId, (err, jar) => {
      if (err != null) {
        return callback(
          OError.tag(err, 'Failed to get cookie jar', {
            projectId,
            userId,
            buildId,
            outputFilePath,
          })
        )
      }
      const options = { url, method: 'GET', timeout: 60 * 1000, jar }
      const readStream = request(options)
      callback(null, readStream)
    })
  },

  _buildRequestFromDocupdater(
    projectId,
    options,
    project,
    projectStateHash,
    docUpdaterDocs,
    callback
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
    ClsiManager._finaliseRequest(
      projectId,
      options,
      project,
      docs,
      [],
      callback
    )
  },

  _buildRequestFromMongo(
    projectId,
    options,
    project,
    projectStateHash,
    callback
  ) {
    ClsiManager._getContentFromMongo(projectId, (err, docs, files) => {
      if (err != null) {
        return callback(
          OError.tag(err, 'failed to get project contents from Mongo', {
            projectId,
          })
        )
      }
      options = {
        ...options,
        syncType: 'full',
        syncState: projectStateHash,
      }
      ClsiManager._finaliseRequest(
        projectId,
        options,
        project,
        docs,
        files,
        callback
      )
    })
  },

  _getContentFromMongo(projectId, callback) {
    DocumentUpdaterHandler.flushProjectToMongo(projectId, err => {
      if (err != null) {
        return callback(
          OError.tag(err, 'failed to flush project to Mongo', { projectId })
        )
      }
      ProjectEntityHandler.getAllDocs(projectId, (err, docs) => {
        if (err != null) {
          return callback(
            OError.tag(err, 'failed to get project docs', { projectId })
          )
        }
        ProjectEntityHandler.getAllFiles(projectId, (err, files) => {
          if (err != null) {
            return callback(
              OError.tag(err, 'failed to get project files', { projectId })
            )
          }
          if (files == null) {
            files = {}
          }
          callback(null, docs || {}, files || {})
        })
      })
    })
  },

  _finaliseRequest(projectId, options, project, docs, files, callback) {
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
        return callback(new OError('no main file specified', { projectId }))
      }
    }

    for (let path in files) {
      const file = files[path]
      path = path.replace(/^\//, '') // Remove leading /
      resources.push({
        path,
        url: `${Settings.apis.filestore.url}/project/${project._id}/file/${file._id}`,
        modified: file.created != null ? file.created.getTime() : undefined,
      })
    }

    if (options.fileLineErrors) {
      flags = ['-file-line-error']
    }

    callback(null, {
      compile: {
        options: {
          compiler: project.compiler,
          timeout: options.timeout,
          imageName: project.imageName,
          draft: !!options.draft,
          check: options.check,
          syncType: options.syncType,
          syncState: options.syncState,
          compileGroup: options.compileGroup,
          enablePdfCaching:
            (Settings.enablePdfCaching && options.enablePdfCaching) || false,
          flags: flags,
          metricsMethod: options.compileGroup,
        },
        rootResourcePath,
        resources,
      },
    })
  },

  wordCount(projectId, userId, file, options, clsiserverid, callback) {
    ClsiManager._buildRequest(projectId, options, (err, req) => {
      if (err != null) {
        return callback(
          OError.tag(err, 'Failed to build CLSI request', {
            projectId,
            options,
          })
        )
      }
      const filename = file || req.compile.rootResourcePath
      const wordCountUrl = ClsiManager._getCompilerUrl(
        options.compileGroup,
        projectId,
        userId,
        'wordcount'
      )
      const opts = {
        url: wordCountUrl,
        qs: {
          file: filename,
          image: req.compile.options.imageName,
        },
        json: true,
        method: 'GET',
      }
      ClsiManager._makeRequestWithClsiServerId(
        projectId,
        userId,
        opts,
        clsiserverid,
        (err, response, body) => {
          if (err != null) {
            return callback(
              OError.tag(err, 'CLSI request failed', { projectId })
            )
          }
          if (response.statusCode >= 200 && response.statusCode < 300) {
            callback(null, body)
          } else {
            callback(
              new OError(
                `CLSI returned non-success code: ${response.statusCode}`,
                {
                  projectId,
                  clsiResponse: body,
                  statusCode: response.statusCode,
                }
              )
            )
          }
        }
      )
    })
  },
}

module.exports = ClsiManager
