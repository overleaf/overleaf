/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
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
let ClsiManager
const Path = require('path')
let async = require('async')
const Settings = require('settings-sharelatex')
const request = require('request')
const { Project } = require('../../models/Project')
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
async = require('async')
const ClsiFormatChecker = require('./ClsiFormatChecker')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const Metrics = require('metrics-sharelatex')
const Errors = require('../Errors/Errors')

module.exports = ClsiManager = {
  sendRequest(project_id, user_id, options, callback) {
    if (options == null) {
      options = {}
    }
    return ClsiManager.sendRequestOnce(project_id, user_id, options, function(
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
        return ClsiManager.sendRequestOnce(
          project_id,
          user_id,
          options,
          callback
        ) // try again
      } else {
        return callback(error, status, ...Array.from(result))
      }
    })
  },

  sendRequestOnce(project_id, user_id, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function(
        error,
        status,
        outputFiles,
        clsiServerId,
        validationProblems
      ) {}
    }
    return ClsiManager._buildRequest(project_id, options, function(error, req) {
      if (error != null) {
        if (error.message === 'no main file specified') {
          return callback(null, 'validation-problems', null, null, {
            mainFile: error.message
          })
        } else {
          return callback(error)
        }
      }
      logger.log({ project_id }, 'sending compile to CLSI')
      return ClsiManager._sendBuiltRequest(
        project_id,
        user_id,
        req,
        options,
        function(error, status, ...result) {
          if (error != null) {
            return callback(error)
          }
          return callback(error, status, ...Array.from(result))
        }
      )
    })
  },

  // for public API requests where there is no project id
  sendExternalRequest(submission_id, clsi_request, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function(
        error,
        status,
        outputFiles,
        clsiServerId,
        validationProblems
      ) {}
    }
    logger.log(
      { submission_id },
      'sending external compile to CLSI',
      clsi_request
    )
    return ClsiManager._sendBuiltRequest(
      submission_id,
      null,
      clsi_request,
      options,
      function(error, status, ...result) {
        if (error != null) {
          return callback(error)
        }
        return callback(error, status, ...Array.from(result))
      }
    )
  },

  stopCompile(project_id, user_id, options, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const compilerUrl = this._getCompilerUrl(
      options != null ? options.compileGroup : undefined,
      project_id,
      user_id,
      'compile/stop'
    )
    const opts = {
      url: compilerUrl,
      method: 'POST'
    }
    return ClsiManager._makeRequest(project_id, opts, callback)
  },

  deleteAuxFiles(project_id, user_id, options, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const compilerUrl = this._getCompilerUrl(
      options != null ? options.compileGroup : undefined,
      project_id,
      user_id
    )
    const opts = {
      url: compilerUrl,
      method: 'DELETE'
    }
    return ClsiManager._makeRequest(project_id, opts, clsiError =>
      // always clear the project state from the docupdater, even if there
      // was a problem with the request to the clsi
      DocumentUpdaterHandler.clearProjectState(project_id, function(
        docUpdaterError
      ) {
        const error = clsiError || docUpdaterError
        if (error != null) {
          return callback(error)
        }
        return callback()
      })
    )
  },

  _sendBuiltRequest(project_id, user_id, req, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function(
        error,
        status,
        outputFiles,
        clsiServerId,
        validationProblems
      ) {}
    }
    return ClsiFormatChecker.checkRecoursesForProblems(
      req.compile != null ? req.compile.resources : undefined,
      function(err, validationProblems) {
        if (err != null) {
          logger.warn(
            err,
            project_id,
            'could not check resources for potential problems before sending to clsi'
          )
          return callback(err)
        }
        if (validationProblems != null) {
          logger.log(
            { project_id, validationProblems },
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
        return ClsiManager._postToClsi(
          project_id,
          user_id,
          req,
          options.compileGroup,
          function(error, response) {
            if (error != null) {
              logger.warn(
                { err: error, project_id },
                'error sending request to clsi'
              )
              return callback(error)
            }
            logger.log(
              {
                project_id,
                outputFilesLength: __guard__(
                  response != null ? response.outputFiles : undefined,
                  x => x.length
                ),
                status: response != null ? response.status : undefined,
                compile_status: __guard__(
                  response != null ? response.compile : undefined,
                  x1 => x1.status
                )
              },
              'received compile response from CLSI'
            )
            return ClsiCookieManager._getServerId(project_id, function(
              err,
              clsiServerId
            ) {
              if (err != null) {
                logger.warn({ err, project_id }, 'error getting server id')
                return callback(err)
              }
              const outputFiles = ClsiManager._parseOutputFiles(
                project_id,
                __guard__(
                  response != null ? response.compile : undefined,
                  x2 => x2.outputFiles
                )
              )
              return callback(
                null,
                __guard__(
                  response != null ? response.compile : undefined,
                  x3 => x3.status
                ),
                outputFiles,
                clsiServerId
              )
            })
          }
        )
      }
    )
  },

  _makeRequest(project_id, opts, callback) {
    return async.series(
      {
        currentBackend(cb) {
          const startTime = new Date()
          return ClsiCookieManager.getCookieJar(project_id, function(err, jar) {
            if (err != null) {
              logger.warn({ err }, 'error getting cookie jar for clsi request')
              return callback(err)
            }
            opts.jar = jar
            const timer = new Metrics.Timer('compile.currentBackend')
            return request(opts, function(err, response, body) {
              timer.done()
              Metrics.inc(
                `compile.currentBackend.response.${
                  response != null ? response.statusCode : undefined
                }`
              )
              if (err != null) {
                logger.warn(
                  { err, project_id, url: opts != null ? opts.url : undefined },
                  'error making request to clsi'
                )
                return callback(err)
              }
              return ClsiCookieManager.setServerId(
                project_id,
                response,
                function(err) {
                  if (err != null) {
                    logger.warn({ err, project_id }, 'error setting server id')
                  }
                  callback(err, response, body) // return as soon as the standard compile has returned
                  return cb(err, {
                    response,
                    body,
                    finishTime: new Date() - startTime
                  })
                }
              )
            })
          })
        },
        newBackend(cb) {
          const startTime = new Date()
          return ClsiManager._makeNewBackendRequest(project_id, opts, function(
            err,
            response,
            body
          ) {
            Metrics.inc(
              `compile.newBackend.response.${
                response != null ? response.statusCode : undefined
              }`
            )
            return cb(err, {
              response,
              body,
              finishTime: new Date() - startTime
            })
          })
        }
      },
      function(err, results) {
        const timeDifference =
          (results.newBackend != null
            ? results.newBackend.finishTime
            : undefined) -
          (results.currentBackend != null
            ? results.currentBackend.finishTime
            : undefined)
        const statusCodeSame =
          __guard__(
            results.newBackend != null
              ? results.newBackend.response
              : undefined,
            x => x.statusCode
          ) ===
          __guard__(
            results.currentBackend != null
              ? results.currentBackend.response
              : undefined,
            x1 => x1.statusCode
          )
        const currentCompileTime =
          results.currentBackend != null
            ? results.currentBackend.finishTime
            : undefined
        const newBackendCompileTime =
          results.newBackend != null ? results.newBackend.finishTime : undefined
        return logger.log(
          {
            statusCodeSame,
            timeDifference,
            currentCompileTime,
            newBackendCompileTime,
            project_id
          },
          'both clsi requests returned'
        )
      }
    )
  },

  _makeNewBackendRequest(project_id, baseOpts, callback) {
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
    return NewBackendCloudClsiCookieManager.getCookieJar(project_id, function(
      err,
      jar
    ) {
      if (err != null) {
        logger.warn({ err }, 'error getting cookie jar for clsi request')
        return callback(err)
      }
      opts.jar = jar
      const timer = new Metrics.Timer('compile.newBackend')
      return request(opts, function(err, response, body) {
        timer.done()
        if (err != null) {
          logger.warn(
            { err, project_id, url: opts != null ? opts.url : undefined },
            'error making request to new clsi'
          )
          return callback(err)
        }
        return NewBackendCloudClsiCookieManager.setServerId(
          project_id,
          response,
          function(err) {
            if (err != null) {
              logger.warn(
                { err, project_id },
                'error setting server id new backend'
              )
            }
            return callback(err, response, body)
          }
        )
      })
    })
  },

  _getCompilerUrl(compileGroup, project_id, user_id, action) {
    const host = Settings.apis.clsi.url
    let path = `/project/${project_id}`
    if (user_id != null) {
      path += `/user/${user_id}`
    }
    if (action != null) {
      path += `/${action}`
    }
    return `${host}${path}`
  },

  _postToClsi(project_id, user_id, req, compileGroup, callback) {
    if (callback == null) {
      callback = function(error, response) {}
    }
    const compileUrl = this._getCompilerUrl(
      compileGroup,
      project_id,
      user_id,
      'compile'
    )
    const opts = {
      url: compileUrl,
      json: req,
      method: 'POST'
    }
    return ClsiManager._makeRequest(project_id, opts, function(
      error,
      response,
      body
    ) {
      if (error != null) {
        return callback(error)
      }
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return callback(null, body)
      } else if (response.statusCode === 413) {
        return callback(null, { compile: { status: 'project-too-large' } })
      } else if (response.statusCode === 409) {
        return callback(null, { compile: { status: 'conflict' } })
      } else if (response.statusCode === 423) {
        return callback(null, { compile: { status: 'compile-in-progress' } })
      } else {
        error = new Error(
          `CLSI returned non-success code: ${response.statusCode}`
        )
        logger.warn({ err: error, project_id }, 'CLSI returned failure code')
        return callback(error, body)
      }
    })
  },

  _parseOutputFiles(project_id, rawOutputFiles) {
    if (rawOutputFiles == null) {
      rawOutputFiles = []
    }
    const outputFiles = []
    for (let file of Array.from(rawOutputFiles)) {
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

  _buildRequest(project_id, options, callback) {
    if (options == null) {
      options = {}
    }
    if (callback == null) {
      callback = function(error, request) {}
    }
    return ProjectGetter.getProject(
      project_id,
      { compiler: 1, rootDoc_id: 1, imageName: 1, rootFolder: 1 },
      function(error, project) {
        let timer
        if (error != null) {
          return callback(error)
        }
        if (project == null) {
          return callback(
            new Errors.NotFoundError(`project does not exist: ${project_id}`)
          )
        }
        if (
          !Array.from(ClsiManager.VALID_COMPILERS).includes(project.compiler)
        ) {
          project.compiler = 'pdflatex'
        }

        if (options.incrementalCompilesEnabled || options.syncType != null) {
          // new way, either incremental or full
          timer = new Metrics.Timer('editor.compile-getdocs-redis')
          return ClsiManager.getContentFromDocUpdaterIfMatch(
            project_id,
            project,
            options,
            function(error, projectStateHash, docUpdaterDocs) {
              timer.done()
              if (error != null) {
                logger.error(
                  { err: error, project_id },
                  'error checking project state'
                )
                // note: we don't bail out when there's an error getting
                // incremental files from the docupdater, we just fall back
                // to a normal compile below
              } else {
                logger.log(
                  {
                    project_id,
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
                return ClsiManager._buildRequestFromDocupdater(
                  project_id,
                  options,
                  project,
                  projectStateHash,
                  docUpdaterDocs,
                  callback
                )
              } else {
                Metrics.inc('compile-from-mongo')
                return ClsiManager._buildRequestFromMongo(
                  project_id,
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
          return ClsiManager._getContentFromMongo(project_id, function(
            error,
            docs,
            files
          ) {
            timer.done()
            if (error != null) {
              return callback(error)
            }
            return ClsiManager._finaliseRequest(
              project_id,
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

  getContentFromDocUpdaterIfMatch(project_id, project, options, callback) {
    if (callback == null) {
      callback = function(error, projectStateHash, docs) {}
    }
    return ClsiStateManager.computeHash(project, options, function(
      error,
      projectStateHash
    ) {
      if (error != null) {
        return callback(error)
      }
      return DocumentUpdaterHandler.getProjectDocsIfMatch(
        project_id,
        projectStateHash,
        function(error, docs) {
          if (error != null) {
            return callback(error)
          }
          return callback(null, projectStateHash, docs)
        }
      )
    })
  },

  getOutputFileStream(
    project_id,
    user_id,
    build_id,
    output_file_path,
    callback
  ) {
    if (callback == null) {
      callback = function(err, readStream) {}
    }
    const url = `${
      Settings.apis.clsi.url
    }/project/${project_id}/user/${user_id}/build/${build_id}/output/${output_file_path}`
    return ClsiCookieManager.getCookieJar(project_id, function(err, jar) {
      if (err != null) {
        return callback(err)
      }
      const options = { url, method: 'GET', timeout: 60 * 1000, jar }
      const readStream = request(options)
      return callback(null, readStream)
    })
  },

  _buildRequestFromDocupdater(
    project_id,
    options,
    project,
    projectStateHash,
    docUpdaterDocs,
    callback
  ) {
    if (callback == null) {
      callback = function(error, request) {}
    }
    return ProjectEntityHandler.getAllDocPathsFromProject(project, function(
      error,
      docPath
    ) {
      let path
      if (error != null) {
        return callback(error)
      }
      const docs = {}
      for (let doc of Array.from(docUpdaterDocs || [])) {
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
      for (let rootDoc_id of Array.from(possibleRootDocIds)) {
        if (rootDoc_id != null && rootDoc_id in docPath) {
          path = docPath[rootDoc_id]
          if (docs[path] == null) {
            docs[path] = { _id: rootDoc_id, path }
          }
        }
      }
      return ClsiManager._finaliseRequest(
        project_id,
        options,
        project,
        docs,
        [],
        callback
      )
    })
  },

  _buildRequestFromMongo(
    project_id,
    options,
    project,
    projectStateHash,
    callback
  ) {
    if (callback == null) {
      callback = function(error, request) {}
    }
    return ClsiManager._getContentFromMongo(project_id, function(
      error,
      docs,
      files
    ) {
      if (error != null) {
        return callback(error)
      }
      options = _.clone(options)
      options.syncType = 'full'
      options.syncState = projectStateHash
      return ClsiManager._finaliseRequest(
        project_id,
        options,
        project,
        docs,
        files,
        callback
      )
    })
  },

  _getContentFromMongo(project_id, callback) {
    if (callback == null) {
      callback = function(error, docs, files) {}
    }
    return DocumentUpdaterHandler.flushProjectToMongo(project_id, function(
      error
    ) {
      if (error != null) {
        return callback(error)
      }
      return ProjectEntityHandler.getAllDocs(project_id, function(error, docs) {
        if (docs == null) {
          docs = {}
        }
        if (error != null) {
          return callback(error)
        }
        return ProjectEntityHandler.getAllFiles(project_id, function(
          error,
          files
        ) {
          if (files == null) {
            files = {}
          }
          if (error != null) {
            return callback(error)
          }
          return callback(null, docs, files)
        })
      })
    })
  },

  _finaliseRequest(project_id, options, project, docs, files, callback) {
    let doc, path
    if (callback == null) {
      callback = function(error, params) {}
    }
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
          { project_id },
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
          { project_id, rootResourcePath },
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

    return callback(null, {
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

  wordCount(project_id, user_id, file, options, callback) {
    if (callback == null) {
      callback = function(error, response) {}
    }
    return ClsiManager._buildRequest(project_id, options, function(error, req) {
      const filename =
        file ||
        __guard__(
          req != null ? req.compile : undefined,
          x => x.rootResourcePath
        )
      const wordcount_url = ClsiManager._getCompilerUrl(
        options != null ? options.compileGroup : undefined,
        project_id,
        user_id,
        'wordcount'
      )
      const opts = {
        url: wordcount_url,
        qs: {
          file: filename,
          image: req.compile.options.imageName
        },
        method: 'GET'
      }
      return ClsiManager._makeRequest(project_id, opts, function(
        error,
        response,
        body
      ) {
        if (error != null) {
          return callback(error)
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return callback(null, body)
        } else {
          error = new Error(
            `CLSI returned non-success code: ${response.statusCode}`
          )
          logger.warn({ err: error, project_id }, 'CLSI returned failure code')
          return callback(error, body)
        }
      })
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
