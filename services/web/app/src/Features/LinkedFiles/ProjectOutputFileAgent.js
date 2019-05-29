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
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectOutputFileAgent
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const ProjectGetter = require('../Project/ProjectGetter')
const Settings = require('settings-sharelatex')
const CompileManager = require('../Compile/CompileManager')
const ClsiManager = require('../Compile/ClsiManager')
const ProjectFileAgent = require('./ProjectFileAgent')
const _ = require('underscore')
const {
  BadDataError,
  AccessDeniedError,
  BadEntityTypeError,
  OutputFileFetchFailedError
} = require('./LinkedFilesErrors')
const LinkedFilesHandler = require('./LinkedFilesHandler')
const logger = require('logger-sharelatex')

module.exports = ProjectOutputFileAgent = {
  _prepare(project_id, linkedFileData, user_id, callback) {
    if (callback == null) {
      callback = function(err, linkedFileData) {}
    }
    return this._checkAuth(
      project_id,
      linkedFileData,
      user_id,
      (err, allowed) => {
        if (err != null) {
          return callback(err)
        }
        if (!allowed) {
          return callback(new AccessDeniedError())
        }
        if (!this._validate(linkedFileData)) {
          return callback(new BadDataError())
        }
        return callback(null, linkedFileData)
      }
    )
  },

  createLinkedFile(
    project_id,
    linkedFileData,
    name,
    parent_folder_id,
    user_id,
    callback
  ) {
    if (!this._canCreate(linkedFileData)) {
      return callback(new AccessDeniedError())
    }
    linkedFileData = this._sanitizeData(linkedFileData)
    return this._prepare(
      project_id,
      linkedFileData,
      user_id,
      (err, linkedFileData) => {
        if (err != null) {
          return callback(err)
        }
        return this._getFileStream(
          linkedFileData,
          user_id,
          (err, readStream) => {
            if (err != null) {
              return callback(err)
            }
            readStream.on('error', callback)
            return readStream.on('response', response => {
              if (response.statusCode >= 200 && response.statusCode < 300) {
                readStream.resume()
                return LinkedFilesHandler.importFromStream(
                  project_id,
                  readStream,
                  linkedFileData,
                  name,
                  parent_folder_id,
                  user_id,
                  function(err, file) {
                    if (err != null) {
                      return callback(err)
                    }
                    return callback(null, file._id)
                  }
                ) // Created
              } else {
                err = new OutputFileFetchFailedError(
                  `Output file fetch failed: ${linkedFileData.build_id}, ${
                    linkedFileData.source_output_file_path
                  }`
                )
                err.statusCode = response.statusCode
                return callback(err)
              }
            })
          }
        )
      }
    )
  },

  refreshLinkedFile(
    project_id,
    linkedFileData,
    name,
    parent_folder_id,
    user_id,
    callback
  ) {
    return this._prepare(
      project_id,
      linkedFileData,
      user_id,
      (err, linkedFileData) => {
        if (err != null) {
          return callback(err)
        }
        return this._compileAndGetFileStream(
          linkedFileData,
          user_id,
          (err, readStream, new_build_id) => {
            if (err != null) {
              return callback(err)
            }
            readStream.on('error', callback)
            return readStream.on('response', response => {
              if (response.statusCode >= 200 && response.statusCode < 300) {
                readStream.resume()
                linkedFileData.build_id = new_build_id
                return LinkedFilesHandler.importFromStream(
                  project_id,
                  readStream,
                  linkedFileData,
                  name,
                  parent_folder_id,
                  user_id,
                  function(err, file) {
                    if (err != null) {
                      return callback(err)
                    }
                    return callback(null, file._id)
                  }
                ) // Created
              } else {
                err = new OutputFileFetchFailedError(
                  `Output file fetch failed: ${linkedFileData.build_id}, ${
                    linkedFileData.source_output_file_path
                  }`
                )
                err.statusCode = response.statusCode
                return callback(err)
              }
            })
          }
        )
      }
    )
  },

  _sanitizeData(data) {
    return {
      provider: data.provider,
      source_project_id: data.source_project_id,
      source_output_file_path: data.source_output_file_path,
      build_id: data.build_id
    }
  },

  _canCreate: ProjectFileAgent._canCreate,

  _getSourceProject: LinkedFilesHandler.getSourceProject,

  _validate(data) {
    if (data.v1_source_doc_id != null) {
      return (
        data.v1_source_doc_id != null && data.source_output_file_path != null
      )
    } else {
      return (
        data.source_project_id != null &&
        data.source_output_file_path != null &&
        data.build_id != null
      )
    }
  },

  _checkAuth(project_id, data, current_user_id, callback) {
    if (callback == null) {
      callback = function(err, allowed) {}
    }
    callback = _.once(callback)
    if (!this._validate(data)) {
      return callback(new BadDataError())
    }
    return this._getSourceProject(data, function(err, project) {
      if (err != null) {
        return callback(err)
      }
      return AuthorizationManager.canUserReadProject(
        current_user_id,
        project._id,
        null,
        function(err, canRead) {
          if (err != null) {
            return callback(err)
          }
          return callback(null, canRead)
        }
      )
    })
  },

  _getFileStream(linkedFileData, user_id, callback) {
    if (callback == null) {
      callback = function(err, fileStream) {}
    }
    callback = _.once(callback)
    const { source_output_file_path, build_id } = linkedFileData
    return this._getSourceProject(linkedFileData, function(err, project) {
      if (err != null) {
        return callback(err)
      }
      const source_project_id = project._id
      return ClsiManager.getOutputFileStream(
        source_project_id,
        user_id,
        build_id,
        source_output_file_path,
        function(err, readStream) {
          if (err != null) {
            return callback(err)
          }
          readStream.pause()
          return callback(null, readStream)
        }
      )
    })
  },

  _compileAndGetFileStream(linkedFileData, user_id, callback) {
    if (callback == null) {
      callback = function(err, stream, build_id) {}
    }
    callback = _.once(callback)
    const { source_output_file_path } = linkedFileData
    return this._getSourceProject(linkedFileData, function(err, project) {
      if (err != null) {
        return callback(err)
      }
      const source_project_id = project._id
      return CompileManager.compile(source_project_id, user_id, {}, function(
        err,
        status,
        outputFiles
      ) {
        if (err != null) {
          return callback(err)
        }
        if (status !== 'success') {
          return callback(new OutputFileFetchFailedError())
        }
        const outputFile = _.find(
          outputFiles,
          o => o.path === source_output_file_path
        )
        if (outputFile == null) {
          return callback(new OutputFileFetchFailedError())
        }
        const build_id = outputFile.build
        return ClsiManager.getOutputFileStream(
          source_project_id,
          user_id,
          build_id,
          source_output_file_path,
          function(err, readStream) {
            if (err != null) {
              return callback(err)
            }
            readStream.pause()
            return callback(null, readStream, build_id)
          }
        )
      })
    })
  }
}
