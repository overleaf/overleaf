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

function wrapWithLock(methodWithoutLock) {
  // This lock is used whenever we read or write to an existing project's
  // structure. Some operations to project structure cannot be done atomically
  // in mongo, this lock is used to prevent reading the structure between two
  // parts of a staged update.
  function methodWithLock(projectId, ...rest) {
    const adjustedLength = Math.max(rest.length, 1)
    const args = rest.slice(0, adjustedLength - 1)
    const callback = rest[adjustedLength - 1]
    LockManager.runWithLock(
      LOCK_NAMESPACE,
      projectId,
      cb => methodWithoutLock(projectId, ...args, cb),
      callback
    )
  }
  methodWithLock.withoutLock = methodWithoutLock
  return methodWithLock
}

const ProjectEntityMongoUpdateHandler = {
  LOCK_NAMESPACE,

  addDoc: wrapWithLock(function(projectId, folderId, doc, callback) {
    ProjectGetter.getProjectWithoutLock(
      projectId,
      { rootFolder: true, name: true, overleaf: true },
      (err, project) => {
        if (err != null) {
          logger.warn({ projectId, err }, 'error getting project for add doc')
          return callback(err)
        }
        logger.log(
          { projectId, folderId, doc_name: doc.name },
          'adding doc to project with project'
        )
        ProjectEntityMongoUpdateHandler._confirmFolder(
          project,
          folderId,
          folderId => {
            ProjectEntityMongoUpdateHandler._putElement(
              project,
              folderId,
              doc,
              'doc',
              callback
            )
          }
        )
      }
    )
  }),

  addFile: wrapWithLock(function(projectId, folderId, fileRef, callback) {
    ProjectGetter.getProjectWithoutLock(
      projectId,
      { rootFolder: true, name: true, overleaf: true },
      (err, project) => {
        if (err != null) {
          logger.warn({ projectId, err }, 'error getting project for add file')
          return callback(err)
        }
        logger.log(
          { projectId: project._id, folderId, file_name: fileRef.name },
          'adding file'
        )
        ProjectEntityMongoUpdateHandler._confirmFolder(
          project,
          folderId,
          folderId =>
            ProjectEntityMongoUpdateHandler._putElement(
              project,
              folderId,
              fileRef,
              'file',
              callback
            )
        )
      }
    )
  }),

  replaceFileWithNew: wrapWithLock((projectId, fileId, newFileRef, callback) =>
    ProjectGetter.getProjectWithoutLock(
      projectId,
      { rootFolder: true, name: true, overleaf: true },
      (err, project) => {
        if (err != null) {
          return callback(err)
        }
        ProjectLocator.findElement(
          { project, element_id: fileId, type: 'file' },
          (err, fileRef, path) => {
            if (err != null) {
              return callback(err)
            }
            ProjectEntityMongoUpdateHandler._insertDeletedFileReference(
              projectId,
              fileRef,
              err => {
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
                set[`${path.mongo}.linkedFileData`] = newFileRef.linkedFileData
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
                Project.findOneAndUpdate(
                  conditions,
                  update,
                  { new: true },
                  (err, newProject) => {
                    if (err != null) {
                      return callback(err)
                    }
                    callback(null, fileRef, project, path, newProject)
                  }
                )
              }
            )
          }
        )
      }
    )
  ),

  mkdirp: wrapWithLock(function(projectId, path, options, callback) {
    // defaults to case insensitive paths, use options {exactCaseMatch:true}
    // to make matching case-sensitive
    let folders = path.split('/')
    folders = _.select(folders, folder => folder.length !== 0)

    ProjectGetter.getProjectWithOnlyFolders(projectId, (err, project) => {
      if (err != null) {
        return callback(err)
      }
      if (path === '/') {
        logger.log(
          { projectId: project._id },
          'mkdir is only trying to make path of / so sending back root folder'
        )
        return callback(null, [], project.rootFolder[0])
      }
      logger.log({ projectId: project._id, path, folders }, 'running mkdirp')

      let builtUpPath = ''
      const procesFolder = (previousFolders, folderName, callback) => {
        let parentFolderId
        previousFolders = previousFolders || []
        const parentFolder = previousFolders[previousFolders.length - 1]
        if (parentFolder != null) {
          parentFolderId = parentFolder._id
        }
        builtUpPath = `${builtUpPath}/${folderName}`
        ProjectLocator.findElementByPath(
          {
            project,
            path: builtUpPath,
            exactCaseMatch: options != null ? options.exactCaseMatch : undefined
          },
          (err, foundFolder) => {
            if (err != null) {
              logger.log(
                { path, projectId: project._id, folderName },
                'making folder from mkdirp'
              )
              ProjectEntityMongoUpdateHandler.addFolder.withoutLock(
                projectId,
                parentFolderId,
                folderName,
                (err, newFolder, parentFolderId) => {
                  if (err != null) {
                    return callback(err)
                  }
                  newFolder.parentFolder_id = parentFolderId
                  previousFolders.push(newFolder)
                  callback(null, previousFolders)
                }
              )
            } else {
              foundFolder.filterOut = true
              previousFolders.push(foundFolder)
              callback(null, previousFolders)
            }
          }
        )
      }

      async.reduce(folders, [], procesFolder, (err, folders) => {
        if (err != null) {
          return callback(err)
        }
        const lastFolder = folders[folders.length - 1]
        folders = _.select(folders, folder => !folder.filterOut)
        callback(null, folders, lastFolder)
      })
    })
  }),

  moveEntity: wrapWithLock(function(
    projectId,
    entityId,
    destFolderId,
    entityType,
    callback
  ) {
    ProjectGetter.getProjectWithoutLock(
      projectId,
      { rootFolder: true, name: true, overleaf: true },
      (err, project) => {
        if (err != null) {
          return callback(err)
        }
        ProjectLocator.findElement(
          { project, element_id: entityId, type: entityType },
          (err, entity, entityPath) => {
            if (err != null) {
              return callback(err)
            }
            // Prevent top-level docs/files with reserved names (to match v1 behaviour)
            if (
              ProjectEntityMongoUpdateHandler._blockedFilename(
                entityPath,
                entityType
              )
            ) {
              return callback(
                new Errors.InvalidNameError('blocked element name')
              )
            }
            ProjectEntityMongoUpdateHandler._checkValidMove(
              project,
              entityType,
              entity,
              entityPath,
              destFolderId,
              error => {
                if (error != null) {
                  return callback(error)
                }
                ProjectEntityHandler.getAllEntitiesFromProject(
                  project,
                  (error, oldDocs, oldFiles) => {
                    if (error != null) {
                      return callback(error)
                    }
                    // For safety, insert the entity in the destination
                    // location first, and then remove the original.  If
                    // there is an error the entity may appear twice. This
                    // will cause some breakage but is better than being
                    // lost, which is what happens if this is done in the
                    // opposite order.
                    ProjectEntityMongoUpdateHandler._putElement(
                      project,
                      destFolderId,
                      entity,
                      entityType,
                      (err, result) => {
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
                        ProjectEntityMongoUpdateHandler._removeElementFromMongoArray(
                          Project,
                          projectId,
                          entityPath.mongo,
                          entityId,
                          (err, newProject) => {
                            if (err != null) {
                              return callback(err)
                            }
                            ProjectEntityHandler.getAllEntitiesFromProject(
                              newProject,
                              (err, newDocs, newFiles) => {
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
                                      projectId,
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
                                callback(
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

  deleteEntity: wrapWithLock((projectId, entityId, entityType, callback) =>
    ProjectGetter.getProjectWithoutLock(
      projectId,
      { name: true, rootFolder: true, overleaf: true },
      (error, project) => {
        if (error != null) {
          return callback(error)
        }
        ProjectLocator.findElement(
          { project, element_id: entityId, type: entityType },
          (error, entity, path) => {
            if (error != null) {
              return callback(error)
            }
            ProjectEntityMongoUpdateHandler._removeElementFromMongoArray(
              Project,
              projectId,
              path.mongo,
              entityId,
              (error, newProject) => {
                if (error != null) {
                  return callback(error)
                }
                callback(null, entity, path, project, newProject)
              }
            )
          }
        )
      }
    )
  ),

  renameEntity: wrapWithLock(
    (projectId, entityId, entityType, newName, callback) =>
      ProjectGetter.getProjectWithoutLock(
        projectId,
        { rootFolder: true, name: true, overleaf: true },
        (error, project) => {
          if (error != null) {
            return callback(error)
          }
          ProjectEntityHandler.getAllEntitiesFromProject(
            project,
            (error, oldDocs, oldFiles) => {
              if (error != null) {
                return callback(error)
              }
              ProjectLocator.findElement(
                { project, element_id: entityId, type: entityType },
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
                    ProjectEntityMongoUpdateHandler._blockedFilename(
                      { fileSystem: endPath },
                      entityType
                    )
                  ) {
                    return callback(
                      new Errors.InvalidNameError('blocked element name')
                    )
                  }
                  // check if the new name already exists in the current folder
                  ProjectEntityMongoUpdateHandler._checkValidElementName(
                    parentFolder,
                    newName,
                    error => {
                      if (error != null) {
                        return callback(error)
                      }
                      const conditions = { _id: projectId }
                      const update = { $set: {}, $inc: {} }
                      const namePath = entPath.mongo + '.name'
                      update['$set'][namePath] = newName
                      // we need to increment the project version number for any structure change
                      update['$inc']['version'] = 1
                      Project.findOneAndUpdate(
                        conditions,
                        update,
                        { new: true },
                        (error, newProject) => {
                          if (error != null) {
                            return callback(error)
                          }
                          ProjectEntityHandler.getAllEntitiesFromProject(
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
                              callback(
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

  addFolder: wrapWithLock((projectId, parentFolderId, folderName, callback) =>
    ProjectGetter.getProjectWithoutLock(
      projectId,
      { rootFolder: true, name: true, overleaf: true },
      (err, project) => {
        if (err != null) {
          logger.warn(
            { projectId, err },
            'error getting project for add folder'
          )
          return callback(err)
        }
        ProjectEntityMongoUpdateHandler._confirmFolder(
          project,
          parentFolderId,
          parentFolderId => {
            const folder = new Folder({ name: folderName })
            logger.log(
              { project: project._id, parentFolderId, folderName },
              'adding new folder'
            )
            ProjectEntityMongoUpdateHandler._putElement(
              project,
              parentFolderId,
              folder,
              'folder',
              err => {
                if (err != null) {
                  logger.warn(
                    { err, projectId: project._id },
                    'error adding folder to project'
                  )
                  return callback(err)
                }
                callback(null, folder, parentFolderId)
              }
            )
          }
        )
      }
    )
  ),

  _removeElementFromMongoArray(model, modelId, path, elementId, callback) {
    const conditions = { _id: modelId }
    const pullUpdate = { $pull: {}, $inc: {} }
    const nonArrayPath = path.slice(0, path.lastIndexOf('.'))
    // remove specific element from array by id
    pullUpdate['$pull'][nonArrayPath] = { _id: elementId }
    // we need to increment the project version number for any structure change
    pullUpdate['$inc']['version'] = 1
    model.findOneAndUpdate(conditions, pullUpdate, { new: true }, callback)
  },

  _countElements(project) {
    function countFolder(folder) {
      let total = 0

      for (let subfolder of (folder != null ? folder.folders : undefined) ||
        []) {
        total += countFolder(subfolder)
      }

      if (
        folder != null &&
        folder.folders != null &&
        folder.folders.length > 0
      ) {
        total += folder.folders.length
      }

      if (folder != null && folder.docs != null && folder.docs.length > 0) {
        total += folder.docs.length
      }

      if (
        folder != null &&
        folder.fileRefs != null &&
        folder.fileRefs.length > 0
      ) {
        total += folder.fileRefs.length
      }

      return total
    }

    return countFolder(project.rootFolder[0])
  },

  _putElement(project, folderId, element, type, callback) {
    function sanitizeTypeOfElement(elementType) {
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
      logger.warn(
        { projectId: project._id, folderId, element, type },
        'failed trying to insert element as it was null'
      )
      return callback(new Error('no element passed to be inserted'))
    }
    type = sanitizeTypeOfElement(type)

    // original check path.resolve("/", element.name) isnt "/#{element.name}" or element.name.match("/")
    // check if name is allowed
    if (!SafePath.isCleanFilename(element.name)) {
      logger.warn(
        { projectId: project._id, folderId, element, type },
        'failed trying to insert element as name was invalid'
      )
      return callback(new Errors.InvalidNameError('invalid element name'))
    }

    if (folderId == null) {
      folderId = project.rootFolder[0]._id
    }

    if (
      ProjectEntityMongoUpdateHandler._countElements(project) >
      settings.maxEntitiesPerProject
    ) {
      logger.warn(
        { projectId: project._id },
        'project too big, stopping insertions'
      )
      CooldownManager.putProjectOnCooldown(project._id)
      return callback(new Error('project_has_to_many_files'))
    }

    ProjectLocator.findElement(
      { project, element_id: folderId, type: 'folders' },
      (err, folder, path) => {
        if (err != null) {
          logger.warn(
            { err, projectId: project._id, folderId, type, element },
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
        if (ProjectEntityMongoUpdateHandler._blockedFilename(newPath, type)) {
          return callback(new Errors.InvalidNameError('blocked element name'))
        }
        ProjectEntityMongoUpdateHandler._checkValidElementName(
          folder,
          element.name,
          err => {
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
                projectId: project._id,
                element_id: element._id,
                fileType: type,
                folderId,
                mongopath
              },
              'adding element to project'
            )
            // We are using Mongoose here, but if we ever switch to a direct mongo call
            // the next line will need to be updated to {returnNewDocument:true}
            Project.findOneAndUpdate(
              conditions,
              update,
              { new: true },
              (err, newProject) => {
                if (err != null) {
                  logger.warn(
                    { err, projectId: project._id },
                    'error saving in putElement project'
                  )
                  return callback(err)
                }
                callback(err, { path: newPath }, newProject)
              }
            )
          }
        )
      }
    )
  },

  _blockedFilename(entityPath, entityType) {
    // check if name would be blocked in v1
    // javascript reserved names are forbidden for docs and files
    // at the top-level (but folders with reserved names are allowed).
    const isFolder = ['folder', 'folders'].includes(entityType)
    const [dir, file] = [
      path.dirname(entityPath.fileSystem),
      path.basename(entityPath.fileSystem)
    ]
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
    const err = new Errors.InvalidNameError('file already exists')
    for (let doc of (folder != null ? folder.docs : undefined) || []) {
      if (doc.name === name) {
        return callback(err)
      }
    }
    for (let file of (folder != null ? folder.fileRefs : undefined) || []) {
      if (file.name === name) {
        return callback(err)
      }
    }
    for (folder of (folder != null ? folder.folders : undefined) || []) {
      if (folder.name === name) {
        return callback(err)
      }
    }
    callback()
  },

  _confirmFolder(project, folderId, callback) {
    logger.log(
      { folderId, projectId: project._id },
      'confirming folder in project'
    )
    if (folderId + '' === 'undefined') {
      callback(project.rootFolder[0]._id)
    } else if (folderId !== null) {
      callback(folderId)
    } else {
      callback(project.rootFolder[0]._id)
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
    ProjectLocator.findElement(
      { project, element_id: destFolderId, type: 'folder' },
      (err, destEntity, destFolderPath) => {
        if (err != null) {
          return callback(err)
        }
        // check if there is already a doc/file/folder with the same name
        // in the destination folder
        ProjectEntityMongoUpdateHandler._checkValidElementName(
          destEntity,
          entity.name,
          err => {
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
            callback()
          }
        )
      }
    )
  },

  _insertDeletedDocReference(projectId, doc, callback) {
    Project.update(
      {
        _id: projectId
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

  _insertDeletedFileReference(projectId, fileRef, callback) {
    Project.update(
      {
        _id: projectId
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

module.exports = ProjectEntityMongoUpdateHandler
