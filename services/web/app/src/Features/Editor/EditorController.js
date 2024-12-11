const logger = require('@overleaf/logger')
const OError = require('@overleaf/o-error')
const Metrics = require('@overleaf/metrics')
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const ProjectOptionsHandler = require('../Project/ProjectOptionsHandler')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectDeleter = require('../Project/ProjectDeleter')
const EditorRealTimeController = require('./EditorRealTimeController')
const async = require('async')
const PublicAccessLevels = require('../Authorization/PublicAccessLevels')
const { promisifyAll } = require('@overleaf/promise-utils')

const EditorController = {
  addDoc(projectId, folderId, docName, docLines, source, userId, callback) {
    EditorController.addDocWithRanges(
      projectId,
      folderId,
      docName,
      docLines,
      {},
      source,
      userId,
      callback
    )
  },

  addDocWithRanges(
    projectId,
    folderId,
    docName,
    docLines,
    docRanges,
    source,
    userId,
    callback
  ) {
    docName = docName.trim()
    Metrics.inc('editor.add-doc')
    ProjectEntityUpdateHandler.addDocWithRanges(
      projectId,
      folderId,
      docName,
      docLines,
      docRanges,
      userId,
      source,
      (err, doc, folderId) => {
        if (err) {
          OError.tag(err, 'error adding doc without lock', {
            projectId,
            docName,
          })
          return callback(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'reciveNewDoc',
          folderId,
          doc,
          source,
          userId
        )
        callback(err, doc)
      }
    )
  },

  addFile(
    projectId,
    folderId,
    fileName,
    fsPath,
    linkedFileData,
    source,
    userId,
    callback
  ) {
    fileName = fileName.trim()
    Metrics.inc('editor.add-file')
    ProjectEntityUpdateHandler.addFile(
      projectId,
      folderId,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      source,
      (err, fileRef, folderId) => {
        if (err) {
          OError.tag(err, 'error adding file without lock', {
            projectId,
            folderId,
            fileName,
          })
          return callback(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'reciveNewFile',
          folderId,
          fileRef,
          source,
          linkedFileData,
          userId
        )
        callback(err, fileRef)
      }
    )
  },

  appendToDoc(projectId, docId, docLines, source, userId, callback) {
    ProjectEntityUpdateHandler.appendToDoc(
      projectId,
      docId,
      docLines,
      source,
      userId,
      function (err, doc) {
        if (err) {
          OError.tag(err, 'error appending to doc', {
            projectId,
            docId,
          })
          return callback(err)
        }
        callback(err, doc)
      }
    )
  },

  upsertDoc(projectId, folderId, docName, docLines, source, userId, callback) {
    ProjectEntityUpdateHandler.upsertDoc(
      projectId,
      folderId,
      docName,
      docLines,
      source,
      userId,
      function (err, doc, didAddNewDoc) {
        if (didAddNewDoc) {
          EditorRealTimeController.emitToRoom(
            projectId,
            'reciveNewDoc',
            folderId,
            doc,
            source,
            userId
          )
        }
        callback(err, doc)
      }
    )
  },

  upsertFile(
    projectId,
    folderId,
    fileName,
    fsPath,
    linkedFileData,
    source,
    userId,
    callback
  ) {
    ProjectEntityUpdateHandler.upsertFile(
      projectId,
      folderId,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      source,
      function (err, newFile, didAddFile, existingFile) {
        if (err) {
          return callback(err)
        }
        if (!didAddFile) {
          // replacement, so remove the existing file from the client
          EditorRealTimeController.emitToRoom(
            projectId,
            'removeEntity',
            existingFile._id,
            source
          )
        }
        // now add the new file on the client
        EditorRealTimeController.emitToRoom(
          projectId,
          'reciveNewFile',
          folderId,
          newFile,
          source,
          linkedFileData,
          userId
        )
        callback(null, newFile)
      }
    )
  },

  upsertDocWithPath(
    projectId,
    elementPath,
    docLines,
    source,
    userId,
    callback
  ) {
    ProjectEntityUpdateHandler.upsertDocWithPath(
      projectId,
      elementPath,
      docLines,
      source,
      userId,
      function (err, doc, didAddNewDoc, newFolders, lastFolder) {
        if (err) {
          return callback(err)
        }
        EditorController._notifyProjectUsersOfNewFolders(
          projectId,
          newFolders,
          function (err) {
            if (err) {
              return callback(err)
            }
            if (didAddNewDoc) {
              EditorRealTimeController.emitToRoom(
                projectId,
                'reciveNewDoc',
                lastFolder._id,
                doc,
                source,
                userId
              )
            }
            callback(null, { doc, folder: lastFolder })
          }
        )
      }
    )
  },

  upsertFileWithPath(
    projectId,
    elementPath,
    fsPath,
    linkedFileData,
    source,
    userId,
    callback
  ) {
    ProjectEntityUpdateHandler.upsertFileWithPath(
      projectId,
      elementPath,
      fsPath,
      linkedFileData,
      userId,
      source,
      function (
        err,
        newFile,
        didAddFile,
        existingFile,
        newFolders,
        lastFolder
      ) {
        if (err) {
          return callback(err)
        }
        EditorController._notifyProjectUsersOfNewFolders(
          projectId,
          newFolders,
          function (err) {
            if (err) {
              return callback(err)
            }
            if (!didAddFile) {
              // replacement, so remove the existing file from the client
              EditorRealTimeController.emitToRoom(
                projectId,
                'removeEntity',
                existingFile._id,
                source
              )
            }
            // now add the new file on the client
            EditorRealTimeController.emitToRoom(
              projectId,
              'reciveNewFile',
              lastFolder._id,
              newFile,
              source,
              linkedFileData,
              userId
            )
            callback(null, { file: newFile, folder: lastFolder })
          }
        )
      }
    )
  },

  addFolder(projectId, folderId, folderName, source, userId, callback) {
    folderName = folderName.trim()
    Metrics.inc('editor.add-folder')
    ProjectEntityUpdateHandler.addFolder(
      projectId,
      folderId,
      folderName,
      (err, folder, folderId) => {
        if (err) {
          OError.tag(err, 'could not add folder', {
            projectId,
            folderId,
            folderName,
            source,
          })
          return callback(err)
        }
        EditorController._notifyProjectUsersOfNewFolder(
          projectId,
          folderId,
          folder,
          userId,
          function (err) {
            if (err) {
              return callback(err)
            }
            callback(null, folder)
          }
        )
      }
    )
  },

  mkdirp(projectId, path, callback) {
    logger.debug({ projectId, path }, "making directories if they don't exist")
    ProjectEntityUpdateHandler.mkdirp(
      projectId,
      path,
      (err, newFolders, lastFolder) => {
        if (err) {
          OError.tag(err, 'could not mkdirp', {
            projectId,
            path,
          })
          return callback(err)
        }

        EditorController._notifyProjectUsersOfNewFolders(
          projectId,
          newFolders,
          function (err) {
            if (err) {
              return callback(err)
            }
            callback(null, newFolders, lastFolder)
          }
        )
      }
    )
  },

  deleteEntity(projectId, entityId, entityType, source, userId, callback) {
    Metrics.inc('editor.delete-entity')
    ProjectEntityUpdateHandler.deleteEntity(
      projectId,
      entityId,
      entityType,
      userId,
      source,
      function (err) {
        if (err) {
          OError.tag(err, 'could not delete entity', {
            projectId,
            entityId,
            entityType,
          })
          return callback(err)
        }
        logger.debug(
          { projectId, entityId, entityType },
          'telling users entity has been deleted'
        )
        EditorRealTimeController.emitToRoom(
          projectId,
          'removeEntity',
          entityId,
          source
        )
        callback()
      }
    )
  },

  deleteEntityWithPath(projectId, path, source, userId, callback) {
    ProjectEntityUpdateHandler.deleteEntityWithPath(
      projectId,
      path,
      userId,
      source,
      function (err, entityId) {
        if (err) {
          return callback(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'removeEntity',
          entityId,
          source
        )
        callback(null, entityId)
      }
    )
  },

  updateProjectDescription(projectId, description, callback) {
    logger.debug({ projectId, description }, 'updating project description')
    ProjectDetailsHandler.setProjectDescription(
      projectId,
      description,
      function (err) {
        if (err) {
          OError.tag(
            err,
            'something went wrong setting the project description',
            {
              projectId,
              description,
            }
          )
          return callback(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'projectDescriptionUpdated',
          description
        )
        callback()
      }
    )
  },

  deleteProject(projectId, callback) {
    Metrics.inc('editor.delete-project')
    ProjectDeleter.deleteProject(projectId, callback)
  },

  renameEntity(
    projectId,
    entityId,
    entityType,
    newName,
    userId,
    source,
    callback
  ) {
    Metrics.inc('editor.rename-entity')
    ProjectEntityUpdateHandler.renameEntity(
      projectId,
      entityId,
      entityType,
      newName,
      userId,
      source,
      function (err) {
        if (err) {
          OError.tag(err, 'error renaming entity', {
            projectId,
            entityId,
            entityType,
            newName,
          })
          return callback(err)
        }
        if (newName.length > 0) {
          EditorRealTimeController.emitToRoom(
            projectId,
            'reciveEntityRename',
            entityId,
            newName
          )
        }
        callback()
      }
    )
  },

  moveEntity(
    projectId,
    entityId,
    folderId,
    entityType,
    userId,
    source,
    callback
  ) {
    Metrics.inc('editor.move-entity')
    ProjectEntityUpdateHandler.moveEntity(
      projectId,
      entityId,
      folderId,
      entityType,
      userId,
      source,
      function (err) {
        if (err) {
          OError.tag(err, 'error moving entity', {
            projectId,
            entityId,
            folderId,
          })
          return callback(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'reciveEntityMove',
          entityId,
          folderId
        )
        callback()
      }
    )
  },

  renameProject(projectId, newName, callback) {
    ProjectDetailsHandler.renameProject(projectId, newName, function (err) {
      if (err) {
        OError.tag(err, 'error renaming project', {
          projectId,
          newName,
        })
        return callback(err)
      }
      EditorRealTimeController.emitToRoom(
        projectId,
        'projectNameUpdated',
        newName
      )
      callback()
    })
  },

  setCompiler(projectId, compiler, callback) {
    ProjectOptionsHandler.setCompiler(projectId, compiler, function (err) {
      if (err) {
        return callback(err)
      }
      EditorRealTimeController.emitToRoom(
        projectId,
        'compilerUpdated',
        compiler
      )
      callback()
    })
  },

  setImageName(projectId, imageName, callback) {
    ProjectOptionsHandler.setImageName(projectId, imageName, function (err) {
      if (err) {
        return callback(err)
      }
      EditorRealTimeController.emitToRoom(
        projectId,
        'imageNameUpdated',
        imageName
      )
      callback()
    })
  },

  setSpellCheckLanguage(projectId, languageCode, callback) {
    ProjectOptionsHandler.setSpellCheckLanguage(
      projectId,
      languageCode,
      function (err) {
        if (err) {
          return callback(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'spellCheckLanguageUpdated',
          languageCode
        )
        callback()
      }
    )
  },

  setPublicAccessLevel(projectId, newAccessLevel, callback) {
    async.series(
      [
        cb => {
          if (newAccessLevel === PublicAccessLevels.TOKEN_BASED) {
            ProjectDetailsHandler.ensureTokensArePresent(projectId, cb)
          } else {
            cb()
          }
        },
        cb =>
          ProjectDetailsHandler.setPublicAccessLevel(
            projectId,
            newAccessLevel,
            cb
          ),
        cb => {
          EditorRealTimeController.emitToRoom(
            projectId,
            'project:publicAccessLevel:changed',
            { newAccessLevel }
          )
          cb()
        },
      ],
      callback
    )
  },

  setRootDoc(projectId, newRootDocID, callback) {
    ProjectEntityUpdateHandler.setRootDoc(
      projectId,
      newRootDocID,
      function (err) {
        if (err) {
          return callback(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'rootDocUpdated',
          newRootDocID
        )
        callback()
      }
    )
  },

  setMainBibliographyDoc(projectId, newBibliographyDocId, callback) {
    ProjectEntityUpdateHandler.setMainBibliographyDoc(
      projectId,
      newBibliographyDocId,
      function (err) {
        if (err) {
          return callback(err)
        }
        EditorRealTimeController.emitToRoom(
          projectId,
          'mainBibliographyDocUpdated',
          newBibliographyDocId
        )
        callback()
      }
    )
  },

  _notifyProjectUsersOfNewFolders(projectId, folders, callback) {
    async.eachSeries(
      folders,
      (folder, cb) =>
        EditorController._notifyProjectUsersOfNewFolder(
          projectId,
          folder.parentFolder_id,
          folder,
          null,
          cb
        ),
      callback
    )
  },

  _notifyProjectUsersOfNewFolder(
    projectId,
    folderId,
    folder,
    userId,
    callback
  ) {
    EditorRealTimeController.emitToRoom(
      projectId,
      'reciveNewFolder',
      folderId,
      folder,
      userId
    )
    callback()
  },
}

EditorController.promises = promisifyAll(EditorController, {
  multiResult: {
    mkdirp: ['newFolders', 'lastFolder'],
  },
})
module.exports = EditorController
