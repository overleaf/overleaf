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
let ProjectFileAgent
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const ProjectLocator = require('../Project/ProjectLocator')
const ProjectGetter = require('../Project/ProjectGetter')
const DocstoreManager = require('../Docstore/DocstoreManager')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const FileStoreHandler = require('../FileStore/FileStoreHandler')
const _ = require('underscore')
const Settings = require('settings-sharelatex')
const LinkedFilesHandler = require('./LinkedFilesHandler')
const {
  BadDataError,
  AccessDeniedError,
  BadEntityTypeError,
  SourceFileNotFoundError,
  ProjectNotFoundError,
  V1ProjectNotFoundError
} = require('./LinkedFilesErrors')

module.exports = ProjectFileAgent = {
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
    return this._go(
      project_id,
      linkedFileData,
      name,
      parent_folder_id,
      user_id,
      callback
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
    return this._go(
      project_id,
      linkedFileData,
      name,
      parent_folder_id,
      user_id,
      callback
    )
  },

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

  _go(project_id, linkedFileData, name, parent_folder_id, user_id, callback) {
    linkedFileData = this._sanitizeData(linkedFileData)
    return this._prepare(
      project_id,
      linkedFileData,
      user_id,
      (err, linkedFileData) => {
        if (err != null) {
          return callback(err)
        }
        if (!this._validate(linkedFileData)) {
          return callback(new BadDataError())
        }
        return this._getEntity(
          linkedFileData,
          user_id,
          (err, source_project, entity, type) => {
            if (err != null) {
              return callback(err)
            }
            if (type === 'doc') {
              return DocstoreManager.getDoc(
                source_project._id,
                entity._id,
                function(err, lines) {
                  if (err != null) {
                    return callback(err)
                  }
                  return LinkedFilesHandler.importContent(
                    project_id,
                    lines.join('\n'),
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
                  )
                }
              ) // Created
            } else if (type === 'file') {
              return FileStoreHandler.getFileStream(
                source_project._id,
                entity._id,
                null,
                function(err, fileStream) {
                  if (err != null) {
                    return callback(err)
                  }
                  return LinkedFilesHandler.importFromStream(
                    project_id,
                    fileStream,
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
                  )
                }
              ) // Created
            } else {
              return callback(new BadEntityTypeError())
            }
          }
        )
      }
    )
  },

  _getEntity(linkedFileData, current_user_id, callback) {
    if (callback == null) {
      callback = function(err, entity, type) {}
    }
    callback = _.once(callback)
    const { source_entity_path } = linkedFileData
    return this._getSourceProject(linkedFileData, function(err, project) {
      if (err != null) {
        return callback(err)
      }
      const source_project_id = project._id
      return DocumentUpdaterHandler.flushProjectToMongo(
        source_project_id,
        function(err) {
          if (err != null) {
            return callback(err)
          }
          return ProjectLocator.findElementByPath(
            {
              project_id: source_project_id,
              path: source_entity_path,
              exactCaseMatch: true
            },
            function(err, entity, type) {
              if (err != null) {
                if (/^not found.*/.test(err.toString())) {
                  err = new SourceFileNotFoundError()
                }
                return callback(err)
              }
              return callback(null, project, entity, type)
            }
          )
        }
      )
    })
  },

  _sanitizeData(data) {
    return _.pick(
      data,
      'provider',
      'source_project_id',
      'v1_source_doc_id',
      'source_entity_path'
    )
  },

  _validate(data) {
    return (
      (data.source_project_id != null || data.v1_source_doc_id != null) &&
      data.source_entity_path != null
    )
  },

  _canCreate(data) {
    // Don't allow creation of linked-files with v1 doc ids
    return data.v1_source_doc_id == null
  },

  _getSourceProject: LinkedFilesHandler.getSourceProject,

  _checkAuth(project_id, data, current_user_id, callback) {
    if (callback == null) {
      callback = function(error, allowed) {}
    }
    callback = _.once(callback)
    if (!ProjectFileAgent._validate(data)) {
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
  }
}
