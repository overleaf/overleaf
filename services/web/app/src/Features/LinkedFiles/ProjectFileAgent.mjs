/* eslint-disable
    n/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import _ from 'lodash'
import LinkedFilesHandler from './LinkedFilesHandler.mjs'
import LinkedFilesErrors from './LinkedFilesErrors.mjs'
import { promisify } from '@overleaf/promise-utils'
import HistoryManager from '../History/HistoryManager.mjs'

const {
  BadDataError,
  AccessDeniedError,
  BadEntityTypeError,
  SourceFileNotFoundError,
} = LinkedFilesErrors

let ProjectFileAgent

export default ProjectFileAgent = {
  createLinkedFile(
    projectId,
    linkedFileData,
    name,
    parentFolderId,
    userId,
    callback
  ) {
    if (!ProjectFileAgent._canCreate(linkedFileData)) {
      return callback(new AccessDeniedError())
    }
    return ProjectFileAgent._go(
      projectId,
      linkedFileData,
      name,
      parentFolderId,
      userId,
      callback
    )
  },

  refreshLinkedFile(
    projectId,
    linkedFileData,
    name,
    parentFolderId,
    userId,
    callback
  ) {
    return ProjectFileAgent._go(
      projectId,
      linkedFileData,
      name,
      parentFolderId,
      userId,
      callback
    )
  },

  _prepare(projectId, linkedFileData, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return ProjectFileAgent._checkAuth(
      projectId,
      linkedFileData,
      userId,
      (err, allowed) => {
        if (err != null) {
          return callback(err)
        }
        if (!allowed) {
          return callback(new AccessDeniedError())
        }
        if (!ProjectFileAgent._validate(linkedFileData)) {
          return callback(new BadDataError())
        }
        return callback(null, linkedFileData)
      }
    )
  },

  _go(projectId, linkedFileData, name, parentFolderId, userId, callback) {
    linkedFileData = ProjectFileAgent._sanitizeData(linkedFileData)
    return ProjectFileAgent._prepare(
      projectId,
      linkedFileData,
      userId,
      (err, linkedFileData) => {
        if (err != null) {
          return callback(err)
        }
        if (!ProjectFileAgent._validate(linkedFileData)) {
          return callback(new BadDataError())
        }
        return ProjectFileAgent._getEntity(
          linkedFileData,
          userId,
          (err, sourceProject, entity, type) => {
            if (err != null) {
              return callback(err)
            }
            if (type === 'doc') {
              return DocstoreManager.getDoc(
                sourceProject._id,
                entity._id,
                function (err, lines) {
                  if (err != null) {
                    return callback(err)
                  }
                  return LinkedFilesHandler.importContent(
                    projectId,
                    lines.join('\n'),
                    linkedFileData,
                    name,
                    parentFolderId,
                    userId,
                    function (err, file) {
                      if (err != null) {
                        return callback(err)
                      }
                      return callback(null, file._id)
                    }
                  )
                }
              ) // Created
            } else if (type === 'file') {
              return HistoryManager.requestBlob(
                sourceProject.overleaf.history.id,
                entity.hash,
                'GET',
                function (err, result) {
                  if (err != null) {
                    return callback(err)
                  }
                  return LinkedFilesHandler.importFromStream(
                    projectId,
                    result.stream,
                    linkedFileData,
                    name,
                    parentFolderId,
                    userId,
                    function (err, file) {
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

  _getEntity(linkedFileData, currentUserId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    callback = _.once(callback)
    const { source_entity_path: sourceEntityPath } = linkedFileData
    return ProjectFileAgent._getSourceProject(
      linkedFileData,
      function (err, project) {
        if (err != null) {
          return callback(err)
        }
        const sourceProjectId = project._id
        return DocumentUpdaterHandler.flushProjectToMongo(
          sourceProjectId,
          function (err) {
            if (err != null) {
              return callback(err)
            }
            return ProjectLocator.findElementByPath(
              {
                project_id: sourceProjectId,
                path: sourceEntityPath,
                exactCaseMatch: true,
              },
              function (err, entity, type) {
                if (err != null) {
                  if (/^not found.*/.test(err.message)) {
                    err = new SourceFileNotFoundError()
                  }
                  return callback(err)
                }
                return callback(null, project, entity, type)
              }
            )
          }
        )
      }
    )
  },

  _sanitizeData(data) {
    return _.pick(
      data,
      'provider',
      'source_project_id',
      'v1_source_doc_id',
      'source_entity_path',
      'importedAt'
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

  _checkAuth(projectId, data, currentUserId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    callback = _.once(callback)
    if (!ProjectFileAgent._validate(data)) {
      return callback(new BadDataError())
    }
    return ProjectFileAgent._getSourceProject(data, function (err, project) {
      if (err != null) {
        return callback(err)
      }
      return AuthorizationManager.canUserReadProject(
        currentUserId,
        project._id,
        null,
        function (err, canRead) {
          if (err != null) {
            return callback(err)
          }
          return callback(null, canRead)
        }
      )
    })
  },
}

ProjectFileAgent.promises = {
  createLinkedFile: promisify(ProjectFileAgent.createLinkedFile),
  refreshLinkedFile: promisify(ProjectFileAgent.refreshLinkedFile),
}
