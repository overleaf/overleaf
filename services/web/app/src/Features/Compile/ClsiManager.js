const async = require('async')
const Settings = require('settings-sharelatex')
const request = require('request')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const logger = require('logger-sharelatex')
const Url = require('url')
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
const Metrics = require('metrics-sharelatex')
const Errors = require('../Errors/Errors')

const ClsiManager = {
  sendRequest(projectId, userId, options, callback) {
    if (options == null) {
      options = {}
    }
    ClsiManager.sendRequestOnce(projectId, userId, options, function(
      error,
      status,
      ...result
    ) {
      if (error != null) {
        return callback(error)
      }
      if (status === 'conflict') {
        options = _.clone(options)
        options.syncType = 'full' //  force full compile
        ClsiManager.sendRequestOnce(projectId, userId, options, callback) // try again
      } else {
        callback(error, status, ...result)
      }
    })
  },

  sendRequestOnce(projectId, userId, options, callback) {
    if (options == null) {
      options = {}
    }
    ClsiManager._buildRequest(projectId, options, function(error, req) {
      if (error != null) {
        if (error.message === 'no main file specified') {
          return callback(null, 'validation-problems', null, null, {
            mainFile: error.message
          })
        } else {
          return callback(error)
        }
      }
      logger.log({ projectId }, 'sending compile to CLSI')
      ClsiManager._sendBuiltRequest(projectId, userId, req, options, function(
        error,
        status,
        ...result
      ) {
        if (error != null) {
          return callback(error)
        }
        callback(error, status, ...result)
      })
    })
  },

  // for public API requests where there is no project id
  sendExternalRequest(submissionId, clsiRequest, options, callback) {
    if (options == null) {
      options = {}
    }
    logger.log(
      { submissionId },
      'sending external compile to CLSI',
      clsiRequest
    )
    ClsiManager._sendBuiltRequest(
      submissionId,
      null,
      clsiRequest,
      options,
      function(error, status, ...result) {
        if (error != null) {
          return callback(error)
        }
        callback(error, status, ...result)
      }
    )
  },

  stopCompile(projectId, userId, options, callback) {
    const compilerUrl = this._getCompilerUrl(
      options != null ? options.compileGroup : undefined,
      projectId,
      userId,
      'compile/stop'
    )
    const opts = {
      url: compilerUrl,
      method: 'POST'
    }
    ClsiManager._makeRequest(projectId, opts, callback)
  },

  deleteAuxFiles(projectId, userId, options, callback) {
    const compilerUrl = this._getCompilerUrl(
      options != null ? options.compileGroup : undefined,
      projectId,
      userId
    )
    const opts = {
      url: compilerUrl,
      method: 'DELETE'
    }
    ClsiManager._makeRequest(projectId, opts, clsiError =>
      // always clear the project state from the docupdater, even if there
      // was a problem with the request to the clsi
      DocumentUpdaterHandler.clearProjectState(projectId, function(
        docUpdaterError
      ) {
        const error = clsiError || docUpdaterError
        if (error != null) {
          return callback(error)
        }
        callback()
      })
    )
  },

  _sendBuiltRequest(projectId, userId, req, options, callback) {
    if (options == null) {
      options = {}
    }
    ClsiFormatChecker.checkRecoursesForProblems(
      req.compile != null ? req.compile.resources : undefined,
      function(err, validationProblems) {
        if (err != null) {
          logger.warn(
            err,
            projectId,
            'could not check resources for potential problems before sending to clsi'
          )
          return callback(err)
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
          function(error, response) {
            if (error != null) {
              logger.warn(
                { err: error, projectId },
                'error sending request to clsi'
              )
              return callback(error)
            }
            if (response != null) {
              logger.log(
                {
                  projectId,
                  outputFilesLength:
                    response.outputFiles && response.outputFiles.length,
                  status: response.status,
                  compile_status: response.compile && response.compile.status
                },
                'received compile response from CLSI'
              )
            }
            ClsiCookieManager._getServerId(projectId, function(
              err,
              clsiServerId
            ) {
              if (err != null) {
                logger.warn({ err, projectId }, 'error getting server id')
                return callback(err)
              }
              const outputFiles = ClsiManager._parseOutputFiles(
                projectId,
                response && response.compile && response.compile.outputFiles
              )
              callback(
                null,
                response && response.compile && response.compile.status,
                outputFiles,
                clsiServerId
              )
            })
          }
        )
      }
    )
  },

  _makeRequest(projectId, opts, callback) {
    async.series(
      {
        currentBackend(cb) {
          const startTime = new Date()
          ClsiCookieManager.getCookieJar(projectId, function(err, jar) {
            if (err != null) {
              logger.warn({ err }, 'error getting cookie jar for clsi request')
              return callback(err)
            }
            opts.jar = jar
            const timer = new Metrics.Timer('compile.currentBackend')
            request(opts, function(err, response, body) {
              timer.done()
              Metrics.inc(
                `compile.currentBackend.response.${
                  response != null ? response.statusCode : undefined
                }`
              )
              if (err != null) {
                logger.warn(
                  { err, projectId, url: opts != null ? opts.url : undefined },
                  'error making request to clsi'
                )
                return callback(err)
              }
              ClsiCookieManager.setServerId(projectId, response, function(err) {
                if (err != null) {
                  logger.warn({ err, projectId }, 'error setting server id')
                }
                callback(err, response, body) // return as soon as the standard compile has returned
                cb(err, {
                  response,
                  body,
                  finishTime: new Date() - startTime
                })
              })
            })
          })
        },
        newBackend(cb) {
          const startTime = new Date()
          ClsiManager._makeNewBackendRequest(projectId, opts, function(
            err,
            response,
            body
          ) {
            Metrics.inc(
              `compile.newBackend.response.${
                response != null ? response.statusCode : undefined
              }`
            )
            cb(err, {
              response,
              body,
              finishTime: new Date() - startTime
            })
          })
        }
      },
      function(err, results) {
        if (err != null) {
          logger.warn({ err }, 'Error making request to CLSI')
          return
        }
        const timeDifference =
          (results.newBackend != null
            ? results.newBackend.finishTime
            : undefined) -
          (results.currentBackend != null
            ? results.currentBackend.finishTime
            : undefined)
        const newStatusCode =
          results.newBackend &&
          results.newBackend.response &&
          results.newBackend.response.statusCode
        const currentStatusCode =
          results.currentBackend &&
          results.currentBackend.response &&
          results.currentBackend.response.statusCode
        const statusCodeSame = newStatusCode === currentStatusCode
        const currentCompileTime =
          results.currentBackend != null
            ? results.currentBackend.finishTime
            : undefined
        const newBackendCompileTime =
          results.newBackend != null ? results.newBackend.finishTime : undefined
        logger.log(
          {
            statusCodeSame,
            timeDifference,
            currentCompileTime,
            newBackendCompileTime,
            projectId
          },
          'both clsi requests returned'
        )
      }
    )
  },

  _makeNewBackendRequest(projectId, baseOpts, callback) {
    if (
      (Settings.apis.clsi_new != null
        ? Settings.apis.clsi_new.url
        : undefined) == null
    ) {
      return callback()
    }
    const opts = _.clone(baseOpts)
    opts.url = opts.url.replace(
      Settings.apis.clsi.url,
      Settings.apis.clsi_new != null ? Settings.apis.clsi_new.url : undefined
    )
    NewBackendCloudClsiCookieManager.getCookieJar(projectId, function(
      err,
      jar
    ) {
      if (err != null) {
        logger.warn({ err }, 'error getting cookie jar for clsi request')
        return callback(err)
      }
      opts.jar = jar
      const timer = new Metrics.Timer('compile.newBackend')
      request(opts, function(err, response, body) {
        timer.done()
        if (err != null) {
          logger.warn(
            { err, projectId, url: opts != null ? opts.url : undefined },
            'error making request to new clsi'
          )
          return callback(err)
        }
        NewBackendCloudClsiCookieManager.setServerId(
          projectId,
          response,
          function(err) {
            if (err != null) {
              logger.warn(
                { err, projectId },
                'error setting server id new backend'
              )
            }
            callback(err, response, body)
          }
        )
      })
    })
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
      method: 'POST'
    }
    ClsiManager._makeRequest(projectId, opts, function(error, response, body) {
      if (error != null) {
        return callback(error)
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        callback(null, body)
      } else if (response.statusCode === 413) {
        callback(null, { compile: { status: 'project-too-large' } })
      } else if (response.statusCode === 409) {
        callback(null, { compile: { status: 'conflict' } })
      } else if (response.statusCode === 423) {
        callback(null, { compile: { status: 'compile-in-progress' } })
      } else {
        error = new Error(
          `CLSI returned non-success code: ${response.statusCode}`
        )
        logger.warn({ err: error, projectId }, 'CLSI returned failure code')
        callback(error, body)
      }
    })
  },

  _parseOutputFiles(projectId, rawOutputFiles) {
    if (rawOutputFiles == null) {
      rawOutputFiles = []
    }
    const outputFiles = []
    for (const file of rawOutputFiles) {
      outputFiles.push({
        path: file.path, // the clsi is now sending this to web
        url: Url.parse(file.url).path, // the location of the file on the clsi, excluding the host part
        type: file.type,
        build: file.build
      })
    }
    return outputFiles
  },

  VALID_COMPILERS: ['pdflatex', 'latex', 'xelatex', 'lualatex'],

  _buildRequest(projectId, options, callback) {
    if (options == null) {
      options = {}
    }
    ProjectGetter.getProject(
      projectId,
      { compiler: 1, rootDoc_id: 1, imageName: 1, rootFolder: 1 },
      function(error, project) {
        let timer
        if (error != null) {
          return callback(error)
        }
        if (project == null) {
          return callback(
            new Errors.NotFoundError(`project does not exist: ${projectId}`)
          )
        }
        if (!ClsiManager.VALID_COMPILERS.includes(project.compiler)) {
          project.compiler = 'pdflatex'
        }

        if (options.incrementalCompilesEnabled || options.syncType != null) {
          // new way, either incremental or full
          timer = new Metrics.Timer('editor.compile-getdocs-redis')
          ClsiManager.getContentFromDocUpdaterIfMatch(
            projectId,
            project,
            options,
            function(error, projectStateHash, docUpdaterDocs) {
              timer.done()
              if (error != null) {
                logger.error(
                  { err: error, projectId },
                  'error checking project state'
                )
                // note: we don't bail out when there's an error getting
                // incremental files from the docupdater, we just fall back
                // to a normal compile below
              } else {
                logger.log(
                  {
                    projectId,
                    projectStateHash,
                    docs: docUpdaterDocs != null
                  },
                  'checked project state'
                )
              }
              // see if we can send an incremental update to the CLSI
              if (
                docUpdaterDocs != null &&
                options.syncType !== 'full' &&
                error == null
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
          timer = new Metrics.Timer('editor.compile-getdocs-mongo')
          ClsiManager._getContentFromMongo(projectId, function(
            error,
            docs,
            files
          ) {
            timer.done()
            if (error != null) {
              return callback(error)
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
    ClsiStateManager.computeHash(project, options, function(
      error,
      projectStateHash
    ) {
      if (error != null) {
        return callback(error)
      }
      DocumentUpdaterHandler.getProjectDocsIfMatch(
        projectId,
        projectStateHash,
        function(error, docs) {
          if (error != null) {
            return callback(error)
          }
          callback(null, projectStateHash, docs)
        }
      )
    })
  },

  getOutputFileStream(projectId, userId, buildId, outputFilePath, callback) {
    const url = `${
      Settings.apis.clsi.url
    }/project/${projectId}/user/${userId}/build/${buildId}/output/${outputFilePath}`
    ClsiCookieManager.getCookieJar(projectId, function(err, jar) {
      if (err != null) {
        return callback(err)
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
    ProjectEntityHandler.getAllDocPathsFromProject(project, function(
      error,
      docPath
    ) {
      let path
      if (error != null) {
        return callback(error)
      }
      const docs = {}
      for (let doc of docUpdaterDocs || []) {
        path = docPath[doc._id]
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
          path = docPath[rootDocId]
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
    })
  },

  _buildRequestFromMongo(
    projectId,
    options,
    project,
    projectStateHash,
    callback
  ) {
    ClsiManager._getContentFromMongo(projectId, function(error, docs, files) {
      if (error != null) {
        return callback(error)
      }
      options = _.clone(options)
      options.syncType = 'full'
      options.syncState = projectStateHash
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
    DocumentUpdaterHandler.flushProjectToMongo(projectId, function(error) {
      if (error != null) {
        return callback(error)
      }
      ProjectEntityHandler.getAllDocs(projectId, function(error, docs) {
        if (docs == null) {
          docs = {}
        }
        if (error != null) {
          return callback(error)
        }
        ProjectEntityHandler.getAllFiles(projectId, function(error, files) {
          if (files == null) {
            files = {}
          }
          if (error != null) {
            return callback(error)
          }
          callback(null, docs, files)
        })
      })
    })
  },

  _finaliseRequest(projectId, options, project, docs, files, callback) {
    let doc, path
    const resources = []
    let rootResourcePath = null
    let rootResourcePathOverride = null
    let hasMainFile = false
    let numberOfDocsInProject = 0

    for (path in docs) {
      doc = docs[path]
      path = path.replace(/^\//, '') // Remove leading /
      numberOfDocsInProject++
      if (doc.lines != null) {
        // add doc to resources unless it is just a stub entry
        resources.push({
          path,
          content: doc.lines.join('\n')
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
        logger.warn(
          { projectId },
          'no root document found, setting to main.tex'
        )
        rootResourcePath = 'main.tex'
      } else if (numberOfDocsInProject === 1) {
        // only one file, must be the main document
        for (path in docs) {
          doc = docs[path]
          rootResourcePath = path.replace(/^\//, '')
        } // Remove leading /
        logger.warn(
          { projectId, rootResourcePath },
          'no root document found, single document in project'
        )
      } else {
        return callback(new Error('no main file specified'))
      }
    }

    for (path in files) {
      const file = files[path]
      path = path.replace(/^\//, '') // Remove leading /
      resources.push({
        path,
        url: `${Settings.apis.filestore.url}/project/${project._id}/file/${
          file._id
        }`,
        modified: file.created != null ? file.created.getTime() : undefined
      })
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
          syncState: options.syncState
        },
        rootResourcePath,
        resources
      }
    })
  },

  wordCount(projectId, userId, file, options, callback) {
    ClsiManager._buildRequest(projectId, options, function(error, req) {
      if (error != null) {
        return callback(error)
      }
      const filename = file || req.compile.rootResourcePath
      const wordCountUrl = ClsiManager._getCompilerUrl(
        options != null ? options.compileGroup : undefined,
        projectId,
        userId,
        'wordcount'
      )
      const opts = {
        url: wordCountUrl,
        qs: {
          file: filename,
          image: req.compile.options.imageName
        },
        method: 'GET'
      }
      ClsiManager._makeRequest(projectId, opts, function(
        error,
        response,
        body
      ) {
        if (error != null) {
          return callback(error)
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          callback(null, body)
        } else {
          error = new Error(
            `CLSI returned non-success code: ${response.statusCode}`
          )
          logger.warn({ err: error, projectId }, 'CLSI returned failure code')
          callback(error, body)
        }
      })
    })
  }
}

module.exports = ClsiManager
