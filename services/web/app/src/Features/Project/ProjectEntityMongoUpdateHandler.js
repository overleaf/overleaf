/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    one-var,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ProjectEntityMongoUpdateHandler, self
const _ = require('underscore')
const async = require('async')
const logger = require('logger-sharelatex')
const path = require('path')
const settings = require('settings-sharelatex')
const CooldownManager = require('../Cooldown/CooldownManager')
const Errors = require('../Errors/Errors')
const { Folder } = require('../../models/Folder')
const LockManager = require('../../infrastructure/LockManager')
const { Project } = require('../../models/Project')
const ProjectEntityHandler = require('./ProjectEntityHandler')
const ProjectGetter = require('./ProjectGetter')
const ProjectLocator = require('./ProjectLocator')
const SafePath = require('./SafePath')

const LOCK_NAMESPACE = 'mongoTransaction'

const wrapWithLock = function(methodWithoutLock) {
  // This lock is used whenever we read or write to an existing project's
  // structure. Some operations to project structure cannot be done atomically
  // in mongo, this lock is used to prevent reading the structure between two
  // parts of a staged update.
  const methodWithLock = function(project_id, ...rest) {
    const adjustedLength = Math.max(rest.length, 1),
      args = rest.slice(0, adjustedLength - 1),
      callback = rest[adjustedLength - 1]
    return LockManager.runWithLock(
      LOCK_NAMESPACE,
      project_id,
      cb => methodWithoutLock(project_id, ...Array.from(args), cb),
      callback
    )
  }
  methodWithLock.withoutLock = methodWithoutLock
  return methodWithLock
}

module.exports = ProjectEntityMongoUpdateHandler = self = {
  LOCK_NAMESPACE,

  addDoc: wrapWithLock(function(project_id, folder_id, doc, callback) {
    if (callback == null) {
      callback = function(err, result) {}
    }
    return ProjectGetter.getProjectWithoutLock(
      project_id,
      { rootFolder: true, name: true, overleaf: true },
      function(err, project) {
        if (err != null) {
          logger.warn({ project_id, err }, 'error getting project for add doc')
          return callback(err)
        }
        logger.log(
          { project_id, folder_id, doc_name: doc.name },
          'adding doc to project with project'
        )
        return self._confirmFolder(project, folder_id, folder_id => {
          return self._putElement(project, folder_id, doc, 'doc', callback)
        })
      }
    )
  }),

  addFile: wrapWithLock(function(project_id, folder_id, fileRef, callback) {
    if (callback == null) {
      callback = function(error, result, project) {}
    }
    return ProjectGetter.getProjectWithoutLock(
      project_id,
      { rootFolder: true, name: true, overleaf: true },
      function(err, project) {
        if (err != null) {
          logger.warn({ project_id, err }, 'error getting project for add file')
          return callback(err)
        }
        logger.log(
          { project_id: project._id, folder_id, file_name: fileRef.name },
          'adding file'
        )
        return self._confirmFolder(project, folder_id, folder_id =>
          self._putElement(project, folder_id, fileRef, 'file', callback)
        )
      }
    )
  }),

  replaceFileWithNew: wrapWithLock(
    (project_id, file_id, newFileRef, callback) =>
      ProjectGetter.getProjectWithoutLock(
        project_id,
        { rootFolder: true, name: true, overleaf: true },
        function(err, project) {
          if (err != null) {
            return callback(err)
          }
          return ProjectLocator.findElement(
            { project, element_id: file_id, type: 'file' },
            (err, fileRef, path) => {
              if (err != null) {
                return callback(err)
              }
              return ProjectEntityMongoUpdateHandler._insertDeletedFileReference(
                project_id,
                fileRef,
                function(err) {
                  if (err != null) {
                    return callback(err)
                  }
                  const conditions = { _id: project._id }
                  const inc = {}
                  // increment the project structure version as we are adding a new file here
                  inc['version'] = 1
                  const set = {}
                  set[`${path.mongo}._id`] = newFileRef._id
                  set[`${path.mongo}.created`] = new Date()
                  set[`${path.mongo}.linkedFileData`] =
                    newFileRef.linkedFileData
                  inc[`${path.mongo}.rev`] = 1
                  set[`${path.mongo}.hash`] = newFileRef.hash
                  const update = {
                    $inc: inc,
                    $set: set
                  }
                  // Note: Mongoose uses new:true to return the modified document
                  // https://mongoosejs.com/docs/api.html#model_Model.findOneAndUpdate
                  // but Mongo uses returnNewDocument:true instead
                  // https://docs.mongodb.com/manual/reference/method/db.collection.findOneAndUpdate/
                  // We are using Mongoose here, but if we ever switch to a direct mongo call
                  // the next line will need to be updated.
                  return Project.findOneAndUpdate(
                    conditions,
                    update,
                    { new: true },
                    function(err, newProject) {
                      if (err != null) {
                        return callback(err)
                      }
                      return callback(null, fileRef, project, path, newProject)
                    }
                  )
                }
              )
            }
          )
        }
      )
  ),

  mkdirp: wrapWithLock(function(project_id, path, options, callback) {
    // defaults to case insensitive paths, use options {exactCaseMatch:true}
    // to make matching case-sensitive
    let folders = path.split('/')
    folders = _.select(folders, folder => folder.length !== 0)

    return ProjectGetter.getProjectWithOnlyFolders(
      project_id,
      (err, project) => {
        if (path === '/') {
          logger.log(
            { project_id: project._id },
            'mkdir is only trying to make path of / so sending back root folder'
          )
          return callback(null, [], project.rootFolder[0])
        }
        logger.log({ project_id: project._id, path, folders }, 'running mkdirp')

        let builtUpPath = ''
        const procesFolder = (previousFolders, folderName, callback) => {
          let parentFolder_id
          previousFolders = previousFolders || []
          const parentFolder = previousFolders[previousFolders.length - 1]
          if (parentFolder != null) {
            parentFolder_id = parentFolder._id
          }
          builtUpPath = `${builtUpPath}/${folderName}`
          return ProjectLocator.findElementByPath(
            {
              project,
              path: builtUpPath,
              exactCaseMatch:
                options != null ? options.exactCaseMatch : undefined
            },
            (err, foundFolder) => {
              if (foundFolder == null) {
                logger.log(
                  { path, project_id: project._id, folderName },
                  'making folder from mkdirp'
                )
                return self.addFolder.withoutLock(
                  project_id,
                  parentFolder_id,
                  folderName,
                  function(err, newFolder, parentFolder_id) {
                    if (err != null) {
                      return callback(err)
                    }
                    newFolder.parentFolder_id = parentFolder_id
                    previousFolders.push(newFolder)
                    return callback(null, previousFolders)
                  }
                )
              } else {
                foundFolder.filterOut = true
                previousFolders.push(foundFolder)
                return callback(null, previousFolders)
              }
            }
          )
        }

        return async.reduce(folders, [], procesFolder, function(err, folders) {
          if (err != null) {
            return callback(err)
          }
          const lastFolder = folders[folders.length - 1]
          folders = _.select(folders, folder => !folder.filterOut)
          return callback(null, folders, lastFolder)
        })
      }
    )
  }),

  moveEntity: wrapWithLock(function(
    project_id,
    entity_id,
    destFolderId,
    entityType,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ProjectGetter.getProjectWithoutLock(
      project_id,
      { rootFolder: true, name: true, overleaf: true },
      function(err, project) {
        if (err != null) {
          return callback(err)
        }
        return ProjectLocator.findElement(
          { project, element_id: entity_id, type: entityType },
          function(err, entity, entityPath) {
            if (err != null) {
              return callback(err)
            }
            // Prevent top-level docs/files with reserved names (to match v1 behaviour)
            if (self._blockedFilename(entityPath, entityType)) {
              return callback(
                new Errors.InvalidNameError('blocked element name')
              )
            }
            return self._checkValidMove(
              project,
              entityType,
              entity,
              entityPath,
              destFolderId,
              function(error) {
                if (error != null) {
                  return callback(error)
                }
                return ProjectEntityHandler.getAllEntitiesFromProject(
                  project,
                  function(error, oldDocs, oldFiles) {
                    if (error != null) {
                      return callback(error)
                    }
                    // For safety, insert the entity in the destination
                    // location first, and then remove the original.  If
                    // there is an error the entity may appear twice. This
                    // will cause some breakage but is better than being
                    // lost, which is what happens if this is done in the
                    // opposite order.
                    return self._putElement(
                      project,
                      destFolderId,
                      entity,
                      entityType,
                      function(err, result) {
                        if (err != null) {
                          return callback(err)
                        }
                        // Note: putElement always pushes onto the end of an
                        // array so it will never change an existing mongo
                        // path. Therefore it is safe to remove an element
                        // from the project with an existing path after
                        // calling putElement. But we must be sure that we
                        // have not moved a folder subfolder of itself (which
                        // is done by _checkValidMove above) because that
                        // would lead to it being deleted.
                        return self._removeElementFromMongoArray(
                          Project,
                          project_id,
                          entityPath.mongo,
                          entity_id,
                          function(err, newProject) {
                            if (err != null) {
                              return callback(err)
                            }
                            return ProjectEntityHandler.getAllEntitiesFromProject(
                              newProject,
                              function(err, newDocs, newFiles) {
                                if (err != null) {
                                  return callback(err)
                                }
                                const startPath = entityPath.fileSystem
                                const endPath = result.path.fileSystem
                                const changes = {
                                  oldDocs,
                                  newDocs,
                                  oldFiles,
                                  newFiles,
                                  newProject
                                }
                                // check that no files have been lost (or duplicated)
                                if (
                                  oldFiles.length !== newFiles.length ||
                                  oldDocs.length !== newDocs.length
                                ) {
                                  logger.warn(
                                    {
                                      project_id,
                                      oldDocs: oldDocs.length,
                                      newDocs: newDocs.length,
                                      oldFiles: oldFiles.length,
                                      newFiles: newFiles.length,
                                      origProject: project,
                                      newProject
                                    },
                                    "project corrupted moving files - shouldn't happen"
                                  )
                                  return callback(
                                    new Error(
                                      'unexpected change in project structure'
                                    )
                                  )
                                }
                                return callback(
                                  null,
                                  project,
                                  startPath,
                                  endPath,
                                  entity.rev,
                                  changes,
                                  callback
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
      }
    )
  }),

  deleteEntity: wrapWithLock((project_id, entity_id, entityType, callback) =>
    ProjectGetter.getProjectWithoutLock(
      project_id,
      { name: true, rootFolder: true, overleaf: true },
      function(error, project) {
        if (error != null) {
          return callback(error)
        }
        return ProjectLocator.findElement(
          { project, element_id: entity_id, type: entityType },
          function(error, entity, path) {
            if (error != null) {
              return callback(error)
            }
            return self._removeElementFromMongoArray(
              Project,
              project_id,
              path.mongo,
              entity_id,
              function(error, newProject) {
                if (error != null) {
                  return callback(error)
                }
                return callback(null, entity, path, project, newProject)
              }
            )
          }
        )
      }
    )
  ),

  renameEntity: wrapWithLock(
    (project_id, entity_id, entityType, newName, callback) =>
      ProjectGetter.getProjectWithoutLock(
        project_id,
        { rootFolder: true, name: true, overleaf: true },
        (error, project) => {
          if (error != null) {
            return callback(error)
          }
          return ProjectEntityHandler.getAllEntitiesFromProject(
            project,
            (error, oldDocs, oldFiles) => {
              if (error != null) {
                return callback(error)
              }
              return ProjectLocator.findElement(
                { project, element_id: entity_id, type: entityType },
                (error, entity, entPath, parentFolder) => {
                  if (error != null) {
                    return callback(error)
                  }
                  const endPath = path.join(
                    path.dirname(entPath.fileSystem),
                    newName
                  )
                  // Prevent top-level docs/files with reserved names (to match v1 behaviour)
                  if (
                    self._blockedFilename({ fileSystem: endPath }, entityType)
                  ) {
                    return callback(
                      new Errors.InvalidNameError('blocked element name')
                    )
                  }
                  // check if the new name already exists in the current folder
                  return self._checkValidElementName(
                    parentFolder,
                    newName,
                    error => {
                      if (error != null) {
                        return callback(error)
                      }
                      const conditions = { _id: project_id }
                      const update = { $set: {}, $inc: {} }
                      const namePath = entPath.mongo + '.name'
                      update['$set'][namePath] = newName
                      // we need to increment the project version number for any structure change
                      update['$inc']['version'] = 1
                      return Project.findOneAndUpdate(
                        conditions,
                        update,
                        { new: true },
                        function(error, newProject) {
                          if (error != null) {
                            return callback(error)
                          }
                          return ProjectEntityHandler.getAllEntitiesFromProject(
                            newProject,
                            (error, newDocs, newFiles) => {
                              if (error != null) {
                                return callback(error)
                              }
                              const startPath = entPath.fileSystem
                              const changes = {
                                oldDocs,
                                newDocs,
                                oldFiles,
                                newFiles,
                                newProject
                              }
                              return callback(
                                null,
                                project,
                                startPath,
                                endPath,
                                entity.rev,
                                changes,
                                callback
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
  ),

  addFolder: wrapWithLock((project_id, parentFolder_id, folderName, callback) =>
    ProjectGetter.getProjectWithoutLock(
      project_id,
      { rootFolder: true, name: true, overleaf: true },
      function(err, project) {
        if (err != null) {
          logger.warn(
            { project_id, err },
            'error getting project for add folder'
          )
          return callback(err)
        }
        return self._confirmFolder(
          project,
          parentFolder_id,
          parentFolder_id => {
            const folder = new Folder({ name: folderName })
            logger.log(
              { project: project._id, parentFolder_id, folderName },
              'adding new folder'
            )
            return self._putElement(
              project,
              parentFolder_id,
              folder,
              'folder',
              err => {
                if (err != null) {
                  logger.warn(
                    { err, project_id: project._id },
                    'error adding folder to project'
                  )
                  return callback(err)
                }
                return callback(null, folder, parentFolder_id)
              }
            )
          }
        )
      }
    )
  ),

  _removeElementFromMongoArray(model, model_id, path, element_id, callback) {
    if (callback == null) {
      callback = function(err, project) {}
    }
    const conditions = { _id: model_id }
    const pullUpdate = { $pull: {}, $inc: {} }
    const nonArrayPath = path.slice(0, path.lastIndexOf('.'))
    // remove specific element from array by id
    pullUpdate['$pull'][nonArrayPath] = { _id: element_id }
    // we need to increment the project version number for any structure change
    pullUpdate['$inc']['version'] = 1
    return model.findOneAndUpdate(
      conditions,
      pullUpdate,
      { new: true },
      callback
    )
  },

  _countElements(project) {
    var countFolder = function(folder) {
      let total = 0

      for (let subfolder of Array.from(
        (folder != null ? folder.folders : undefined) || []
      )) {
        total += countFolder(subfolder)
      }

      if (
        __guard__(folder != null ? folder.folders : undefined, x => x.length) !=
        null
      ) {
        total += folder.folders.length
      }

      if (
        __guard__(folder != null ? folder.docs : undefined, x1 => x1.length) !=
        null
      ) {
        total += folder.docs.length
      }

      if (
        __guard__(
          folder != null ? folder.fileRefs : undefined,
          x2 => x2.length
        ) != null
      ) {
        total += folder.fileRefs.length
      }

      return total
    }

    return countFolder(project.rootFolder[0])
  },

  _putElement(project, folder_id, element, type, callback) {
    let e
    if (callback == null) {
      callback = function(err, path, project) {}
    }
    const sanitizeTypeOfElement = function(elementType) {
      const lastChar = elementType.slice(-1)
      if (lastChar !== 's') {
        elementType += 's'
      }
      if (elementType === 'files') {
        elementType = 'fileRefs'
      }
      return elementType
    }

    if (element == null || element._id == null) {
      e = new Error('no element passed to be inserted')
      logger.warn(
        { project_id: project._id, folder_id, element, type },
        'failed trying to insert element as it was null'
      )
      return callback(e)
    }
    type = sanitizeTypeOfElement(type)

    // original check path.resolve("/", element.name) isnt "/#{element.name}" or element.name.match("/")
    // check if name is allowed
    if (!SafePath.isCleanFilename(element.name)) {
      e = new Errors.InvalidNameError('invalid element name')
      logger.warn(
        { project_id: project._id, folder_id, element, type },
        'failed trying to insert element as name was invalid'
      )
      return callback(e)
    }

    if (folder_id == null) {
      folder_id = project.rootFolder[0]._id
    }

    if (self._countElements(project) > settings.maxEntitiesPerProject) {
      logger.warn(
        { project_id: project._id },
        'project too big, stopping insertions'
      )
      CooldownManager.putProjectOnCooldown(project._id)
      return callback(new Error('project_has_to_many_files'))
    }

    return ProjectLocator.findElement(
      { project, element_id: folder_id, type: 'folders' },
      (err, folder, path) => {
        if (err != null) {
          logger.warn(
            { err, project_id: project._id, folder_id, type, element },
            'error finding folder for _putElement'
          )
          return callback(err)
        }
        const newPath = {
          fileSystem: `${path.fileSystem}/${element.name}`,
          mongo: path.mongo
        }
        // check if the path would be too long
        if (!SafePath.isAllowedLength(newPath.fileSystem)) {
          return callback(new Errors.InvalidNameError('path too long'))
        }
        // Prevent top-level docs/files with reserved names (to match v1 behaviour)
        if (self._blockedFilename(newPath, type)) {
          return callback(new Errors.InvalidNameError('blocked element name'))
        }
        return self._checkValidElementName(folder, element.name, err => {
          if (err != null) {
            return callback(err)
          }
          const id = element._id + ''
          element._id = require('mongoose').Types.ObjectId(id)
          const conditions = { _id: project._id }
          const mongopath = `${path.mongo}.${type}`
          const update = { $push: {}, $inc: {} }
          update['$push'][mongopath] = element
          // we need to increment the project version number for any structure change
          update['$inc']['version'] = 1 // increment project version number
          logger.log(
            {
              project_id: project._id,
              element_id: element._id,
              fileType: type,
              folder_id,
              mongopath
            },
            'adding element to project'
          )
          // We are using Mongoose here, but if we ever switch to a direct mongo call
          // the next line will need to be updated to {returnNewDocument:true}
          return Project.findOneAndUpdate(
            conditions,
            update,
            { new: true },
            function(err, newProject) {
              if (err != null) {
                logger.warn(
                  { err, project_id: project._id },
                  'error saving in putElement project'
                )
                return callback(err)
              }
              return callback(err, { path: newPath }, newProject)
            }
          )
        })
      }
    )
  },

  _blockedFilename(entityPath, entityType) {
    // check if name would be blocked in v1
    // javascript reserved names are forbidden for docs and files
    // at the top-level (but folders with reserved names are allowed).
    const isFolder = ['folder', 'folders'].includes(entityType)
    const [dir, file] = Array.from([
      path.dirname(entityPath.fileSystem),
      path.basename(entityPath.fileSystem)
    ])
    const isTopLevel = dir === '/'
    if (isTopLevel && !isFolder && SafePath.isBlockedFilename(file)) {
      return true
    } else {
      return false
    }
  },

  _checkValidElementName(folder, name, callback) {
    // check if the name is already taken by a doc, file or
    // folder. If so, return an error "file already exists".
    if (callback == null) {
      callback = function(err) {}
    }
    const err = new Errors.InvalidNameError('file already exists')
    for (let doc of Array.from(
      (folder != null ? folder.docs : undefined) || []
    )) {
      if (doc.name === name) {
        return callback(err)
      }
    }
    for (let file of Array.from(
      (folder != null ? folder.fileRefs : undefined) || []
    )) {
      if (file.name === name) {
        return callback(err)
      }
    }
    for (folder of Array.from(
      (folder != null ? folder.folders : undefined) || []
    )) {
      if (folder.name === name) {
        return callback(err)
      }
    }
    return callback()
  },

  _confirmFolder(project, folder_id, callback) {
    logger.log(
      { folder_id, project_id: project._id },
      'confirming folder in project'
    )
    if (folder_id + '' === 'undefined') {
      return callback(project.rootFolder[0]._id)
    } else if (folder_id !== null) {
      return callback(folder_id)
    } else {
      return callback(project.rootFolder[0]._id)
    }
  },

  _checkValidMove(
    project,
    entityType,
    entity,
    entityPath,
    destFolderId,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ProjectLocator.findElement(
      { project, element_id: destFolderId, type: 'folder' },
      function(err, destEntity, destFolderPath) {
        if (err != null) {
          return callback(err)
        }
        // check if there is already a doc/file/folder with the same name
        // in the destination folder
        return self._checkValidElementName(destEntity, entity.name, function(
          err
        ) {
          if (err != null) {
            return callback(err)
          }
          if (/folder/.test(entityType)) {
            logger.log(
              {
                destFolderPath: destFolderPath.fileSystem,
                folderPath: entityPath.fileSystem
              },
              'checking folder is not moving into child folder'
            )
            const isNestedFolder =
              destFolderPath.fileSystem.slice(
                0,
                entityPath.fileSystem.length
              ) === entityPath.fileSystem
            if (isNestedFolder) {
              return callback(
                new Errors.InvalidNameError(
                  'destination folder is a child folder of me'
                )
              )
            }
          }
          return callback()
        })
      }
    )
  },

  _insertDeletedDocReference(project_id, doc, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return Project.update(
      {
        _id: project_id
      },
      {
        $push: {
          deletedDocs: {
            _id: doc._id,
            name: doc.name,
            deletedAt: new Date()
          }
        }
      },
      {},
      callback
    )
  },

  _insertDeletedFileReference(project_id, fileRef, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return Project.update(
      {
        _id: project_id
      },
      {
        $push: {
          deletedFiles: {
            _id: fileRef._id,
            name: fileRef.name,
            linkedFileData: fileRef.linkedFileData,
            hash: fileRef.hash,
            deletedAt: new Date()
          }
        }
      },
      {},
      callback
    )
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
