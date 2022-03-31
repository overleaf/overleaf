const _ = require('lodash')
const OError = require('@overleaf/o-error')
const async = require('async')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const Path = require('path')
const fs = require('fs')
const { Doc } = require('../../models/Doc')
const DocstoreManager = require('../Docstore/DocstoreManager')
const DocumentUpdaterHandler = require('../../Features/DocumentUpdater/DocumentUpdaterHandler')
const Errors = require('../Errors/Errors')
const FileStoreHandler = require('../FileStore/FileStoreHandler')
const LockManager = require('../../infrastructure/LockManager')
const { Project } = require('../../models/Project')
const ProjectEntityHandler = require('./ProjectEntityHandler')
const ProjectGetter = require('./ProjectGetter')
const ProjectLocator = require('./ProjectLocator')
const ProjectUpdateHandler = require('./ProjectUpdateHandler')
const ProjectEntityMongoUpdateHandler = require('./ProjectEntityMongoUpdateHandler')
const SafePath = require('./SafePath')
const TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
const FileWriter = require('../../infrastructure/FileWriter')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const { promisifyAll } = require('../../util/promises')

const LOCK_NAMESPACE = 'sequentialProjectStructureUpdateLock'
const VALID_ROOT_DOC_EXTENSIONS = Settings.validRootDocExtensions
const VALID_ROOT_DOC_REGEXP = new RegExp(
  `^\\.(${VALID_ROOT_DOC_EXTENSIONS.join('|')})$`,
  'i'
)

function wrapWithLock(methodWithoutLock) {
  // This lock is used to make sure that the project structure updates are made
  // sequentially. In particular the updates must be made in mongo and sent to
  // the doc-updater in the same order.
  if (typeof methodWithoutLock === 'function') {
    const methodWithLock = (projectId, ...rest) => {
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
  } else {
    // handle case with separate setup and locked stages
    const wrapWithSetup = methodWithoutLock.beforeLock // a function to set things up before the lock
    const mainTask = methodWithoutLock.withLock // function to execute inside the lock
    const methodWithLock = wrapWithSetup((projectId, ...rest) => {
      const adjustedLength = Math.max(rest.length, 1)
      const args = rest.slice(0, adjustedLength - 1)
      const callback = rest[adjustedLength - 1]
      LockManager.runWithLock(
        LOCK_NAMESPACE,
        projectId,
        cb => mainTask(projectId, ...args, cb),
        callback
      )
    })
    methodWithLock.withoutLock = wrapWithSetup(mainTask)
    methodWithLock.beforeLock = methodWithoutLock.beforeLock
    methodWithLock.mainTask = methodWithoutLock.withLock
    return methodWithLock
  }
}

function getDocContext(projectId, docId, callback) {
  ProjectGetter.getProject(
    projectId,
    { name: true, rootFolder: true },
    (err, project) => {
      if (err) {
        return callback(
          OError.tag(err, 'error fetching project', {
            projectId,
          })
        )
      }
      if (!project) {
        return callback(new Errors.NotFoundError('project not found'))
      }
      ProjectLocator.findElement(
        { project, element_id: docId, type: 'docs' },
        (err, doc, path) => {
          if (err && err instanceof Errors.NotFoundError) {
            // (Soft-)Deleted docs are removed from the file-tree (rootFolder).
            // docstore can tell whether it exists and is (soft)-deleted.
            DocstoreManager.isDocDeleted(
              projectId,
              docId,
              (err, isDeletedDoc) => {
                if (err && err instanceof Errors.NotFoundError) {
                  logger.warn(
                    { projectId, docId },
                    'doc not found while updating doc lines'
                  )
                  callback(err)
                } else if (err) {
                  callback(
                    OError.tag(
                      err,
                      'error checking deletion status with docstore',
                      { projectId, docId }
                    )
                  )
                } else {
                  if (!isDeletedDoc) {
                    // NOTE: This can happen while we delete a doc:
                    //  1. web will update the projects entry
                    //  2. web triggers flushes to tpds/doc-updater
                    //  3. web triggers (soft)-delete in docstore
                    // Specifically when an update comes in after 1
                    //  and before 3 completes.
                    logger.info(
                      { projectId, docId },
                      'updating doc that is in process of getting soft-deleted'
                    )
                  }
                  callback(null, {
                    projectName: project.name,
                    isDeletedDoc: true,
                    path: null,
                  })
                }
              }
            )
          } else if (err) {
            callback(
              OError.tag(err, 'error finding doc in rootFolder', {
                docId,
                projectId,
              })
            )
          } else {
            callback(null, {
              projectName: project.name,
              isDeletedDoc: false,
              path: path.fileSystem,
            })
          }
        }
      )
    }
  )
}

const ProjectEntityUpdateHandler = {
  updateDocLines(
    projectId,
    docId,
    lines,
    version,
    ranges,
    lastUpdatedAt,
    lastUpdatedBy,
    callback
  ) {
    getDocContext(projectId, docId, (err, ctx) => {
      if (err && err instanceof Errors.NotFoundError) {
        // Do not allow an update to a doc which has never exist on this project
        logger.warn(
          { docId, projectId },
          'project or doc not found while updating doc lines'
        )
        return callback(err)
      }
      if (err) {
        return callback(err)
      }
      const { projectName, isDeletedDoc, path } = ctx
      logger.log({ projectId, docId }, 'telling docstore manager to update doc')
      DocstoreManager.updateDoc(
        projectId,
        docId,
        lines,
        version,
        ranges,
        (err, modified, rev) => {
          if (err != null) {
            OError.tag(err, 'error sending doc to docstore', {
              docId,
              projectId,
            })
            return callback(err)
          }
          logger.log(
            { projectId, docId, modified },
            'finished updating doc lines'
          )
          // path will only be present if the doc is not deleted
          if (!modified || isDeletedDoc) {
            return callback()
          }
          // Don't need to block for marking as updated
          ProjectUpdateHandler.markAsUpdated(
            projectId,
            lastUpdatedAt,
            lastUpdatedBy
          )
          TpdsUpdateSender.addDoc(
            {
              project_id: projectId,
              path,
              doc_id: docId,
              project_name: projectName,
              rev,
            },
            callback
          )
        }
      )
    })
  },

  setRootDoc(projectId, newRootDocID, callback) {
    logger.log({ projectId, rootDocId: newRootDocID }, 'setting root doc')
    if (projectId == null || newRootDocID == null) {
      return callback(
        new Errors.InvalidError('missing arguments (project or doc)')
      )
    }
    ProjectEntityHandler.getDocPathByProjectIdAndDocId(
      projectId,
      newRootDocID,
      (err, docPath) => {
        if (err != null) {
          return callback(err)
        }
        if (ProjectEntityUpdateHandler.isPathValidForRootDoc(docPath)) {
          Project.updateOne(
            { _id: projectId },
            { rootDoc_id: newRootDocID },
            {},
            callback
          )
        } else {
          callback(
            new Errors.UnsupportedFileTypeError(
              'invalid file extension for root doc'
            )
          )
        }
      }
    )
  },

  unsetRootDoc(projectId, callback) {
    logger.log({ projectId }, 'removing root doc')
    Project.updateOne(
      { _id: projectId },
      { $unset: { rootDoc_id: true } },
      {},
      callback
    )
  },

  _addDocAndSendToTpds(projectId, folderId, doc, callback) {
    ProjectEntityMongoUpdateHandler.addDoc(
      projectId,
      folderId,
      doc,
      (err, result, project) => {
        if (err != null) {
          OError.tag(err, 'error adding file with project', {
            projectId,
            folderId,
            doc_name: doc != null ? doc.name : undefined,
            doc_id: doc != null ? doc._id : undefined,
          })
          return callback(err)
        }
        TpdsUpdateSender.addDoc(
          {
            project_id: projectId,
            doc_id: doc != null ? doc._id : undefined,
            path: result && result.path && result.path.fileSystem,
            project_name: project.name,
            rev: 0,
          },
          err => {
            if (err != null) {
              return callback(err)
            }
            callback(null, result, project)
          }
        )
      }
    )
  },

  addDoc(projectId, folderId, docName, docLines, userId, callback) {
    ProjectEntityUpdateHandler.addDocWithRanges(
      projectId,
      folderId,
      docName,
      docLines,
      {},
      userId,
      callback
    )
  },

  addDocWithRanges: wrapWithLock({
    beforeLock(next) {
      return function (
        projectId,
        folderId,
        docName,
        docLines,
        ranges,
        userId,
        callback
      ) {
        if (!SafePath.isCleanFilename(docName)) {
          return callback(new Errors.InvalidNameError('invalid element name'))
        }
        // Put doc in docstore first, so that if it errors, we don't have a doc_id in the project
        // which hasn't been created in docstore.
        const doc = new Doc({ name: docName })
        DocstoreManager.updateDoc(
          projectId.toString(),
          doc._id.toString(),
          docLines,
          0,
          ranges,
          (err, modified, rev) => {
            if (err != null) {
              return callback(err)
            }
            next(
              projectId,
              folderId,
              doc,
              docName,
              docLines,
              ranges,
              userId,
              callback
            )
          }
        )
      }
    },
    withLock(
      projectId,
      folderId,
      doc,
      docName,
      docLines,
      ranges,
      userId,
      callback
    ) {
      ProjectEntityUpdateHandler._addDocAndSendToTpds(
        projectId,
        folderId,
        doc,
        (err, result, project) => {
          if (err != null) {
            return callback(err)
          }
          const docPath = result && result.path && result.path.fileSystem
          const projectHistoryId =
            project.overleaf &&
            project.overleaf.history &&
            project.overleaf.history.id
          const newDocs = [
            {
              doc,
              path: docPath,
              docLines: docLines.join('\n'),
            },
          ]
          DocumentUpdaterHandler.updateProjectStructure(
            projectId,
            projectHistoryId,
            userId,
            { newDocs, newProject: project },
            error => {
              if (error != null) {
                return callback(error)
              }
              callback(null, doc, folderId || project.rootFolder[0]._id)
            }
          )
        }
      )
    },
  }),

  _uploadFile(projectId, folderId, fileName, fsPath, linkedFileData, callback) {
    if (!SafePath.isCleanFilename(fileName)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    const fileArgs = {
      name: fileName,
      linkedFileData,
    }
    FileStoreHandler.uploadFileFromDisk(
      projectId,
      fileArgs,
      fsPath,
      (err, fileStoreUrl, fileRef) => {
        if (err != null) {
          OError.tag(err, 'error uploading image to s3', {
            projectId,
            folderId,
            file_name: fileName,
            fileRef,
          })
          return callback(err)
        }
        callback(null, fileStoreUrl, fileRef)
      }
    )
  },

  _addFileAndSendToTpds(projectId, folderId, fileRef, callback) {
    ProjectEntityMongoUpdateHandler.addFile(
      projectId,
      folderId,
      fileRef,
      (err, result, project) => {
        if (err != null) {
          OError.tag(err, 'error adding file with project', {
            projectId,
            folderId,
            file_name: fileRef.name,
            fileRef,
          })
          return callback(err)
        }
        TpdsUpdateSender.addFile(
          {
            project_id: projectId,
            file_id: fileRef._id,
            path: result && result.path && result.path.fileSystem,
            project_name: project.name,
            rev: fileRef.rev,
          },
          err => {
            if (err != null) {
              return callback(err)
            }
            callback(null, result, project)
          }
        )
      }
    )
  },

  addFile: wrapWithLock({
    beforeLock(next) {
      return function (
        projectId,
        folderId,
        fileName,
        fsPath,
        linkedFileData,
        userId,
        callback
      ) {
        if (!SafePath.isCleanFilename(fileName)) {
          return callback(new Errors.InvalidNameError('invalid element name'))
        }
        ProjectEntityUpdateHandler._uploadFile(
          projectId,
          folderId,
          fileName,
          fsPath,
          linkedFileData,
          (error, fileStoreUrl, fileRef) => {
            if (error != null) {
              return callback(error)
            }
            next(
              projectId,
              folderId,
              fileName,
              fsPath,
              linkedFileData,
              userId,
              fileRef,
              fileStoreUrl,
              callback
            )
          }
        )
      }
    },
    withLock(
      projectId,
      folderId,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      fileRef,
      fileStoreUrl,
      callback
    ) {
      ProjectEntityUpdateHandler._addFileAndSendToTpds(
        projectId,
        folderId,
        fileRef,
        (err, result, project) => {
          if (err != null) {
            return callback(err)
          }
          const projectHistoryId =
            project.overleaf &&
            project.overleaf.history &&
            project.overleaf.history.id
          const newFiles = [
            {
              file: fileRef,
              path: result && result.path && result.path.fileSystem,
              url: fileStoreUrl,
            },
          ]
          DocumentUpdaterHandler.updateProjectStructure(
            projectId,
            projectHistoryId,
            userId,
            { newFiles, newProject: project },
            error => {
              if (error != null) {
                return callback(error)
              }
              ProjectUpdateHandler.markAsUpdated(projectId, new Date(), userId)
              callback(null, fileRef, folderId)
            }
          )
        }
      )
    },
  }),

  replaceFile: wrapWithLock({
    beforeLock(next) {
      return function (
        projectId,
        fileId,
        fsPath,
        linkedFileData,
        userId,
        callback
      ) {
        // create a new file
        const fileArgs = {
          name: 'dummy-upload-filename',
          linkedFileData,
        }
        FileStoreHandler.uploadFileFromDisk(
          projectId,
          fileArgs,
          fsPath,
          (err, fileStoreUrl, fileRef) => {
            if (err != null) {
              return callback(err)
            }
            next(
              projectId,
              fileId,
              fsPath,
              linkedFileData,
              userId,
              fileRef,
              fileStoreUrl,
              callback
            )
          }
        )
      }
    },
    withLock(
      projectId,
      fileId,
      fsPath,
      linkedFileData,
      userId,
      newFileRef,
      fileStoreUrl,
      callback
    ) {
      ProjectEntityMongoUpdateHandler.replaceFileWithNew(
        projectId,
        fileId,
        newFileRef,
        (err, oldFileRef, project, path, newProject) => {
          if (err != null) {
            return callback(err)
          }
          const oldFiles = [
            {
              file: oldFileRef,
              path: path.fileSystem,
            },
          ]
          const newFiles = [
            {
              file: newFileRef,
              path: path.fileSystem,
              url: fileStoreUrl,
            },
          ]
          const projectHistoryId =
            project.overleaf &&
            project.overleaf.history &&
            project.overleaf.history.id
          // Increment the rev for an in-place update (with the same path) so the third-party-datastore
          // knows this is a new file.
          // Ideally we would get this from ProjectEntityMongoUpdateHandler.replaceFileWithNew
          // but it returns the original oldFileRef (after incrementing the rev value in mongo),
          // so we add 1 to the rev from that. This isn't atomic and relies on the lock
          // but it is acceptable for now.
          TpdsUpdateSender.addFile(
            {
              project_id: project._id,
              file_id: newFileRef._id,
              path: path.fileSystem,
              rev: oldFileRef.rev + 1,
              project_name: project.name,
            },
            err => {
              if (err != null) {
                return callback(err)
              }
              ProjectUpdateHandler.markAsUpdated(projectId, new Date(), userId)

              DocumentUpdaterHandler.updateProjectStructure(
                projectId,
                projectHistoryId,
                userId,
                { oldFiles, newFiles, newProject },
                callback
              )
            }
          )
        }
      )
    },
  }),

  upsertDoc: wrapWithLock(function (
    projectId,
    folderId,
    docName,
    docLines,
    source,
    userId,
    callback
  ) {
    if (!SafePath.isCleanFilename(docName)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    ProjectLocator.findElement(
      { project_id: projectId, element_id: folderId, type: 'folder' },
      (error, folder, folderPath) => {
        if (error != null) {
          return callback(error)
        }
        if (folder == null) {
          return callback(new Error("Couldn't find folder"))
        }
        const existingDoc = folder.docs.find(({ name }) => name === docName)
        const existingFile = folder.fileRefs.find(
          ({ name }) => name === docName
        )
        if (existingFile) {
          const doc = new Doc({ name: docName })
          const filePath = `${folderPath.fileSystem}/${existingFile.name}`
          DocstoreManager.updateDoc(
            projectId.toString(),
            doc._id.toString(),
            docLines,
            0,
            {},
            (err, modified, rev) => {
              if (err != null) {
                return callback(err)
              }
              ProjectEntityMongoUpdateHandler.replaceFileWithDoc(
                projectId,
                existingFile._id,
                doc,
                (err, project) => {
                  if (err) {
                    return callback(err)
                  }
                  TpdsUpdateSender.addDoc(
                    {
                      project_id: projectId,
                      doc_id: doc._id,
                      path: filePath,
                      project_name: project.name,
                      rev: existingFile.rev + 1,
                    },
                    err => {
                      if (err) {
                        return callback(err)
                      }
                      const projectHistoryId =
                        project.overleaf &&
                        project.overleaf.history &&
                        project.overleaf.history.id
                      const newDocs = [
                        {
                          doc,
                          path: filePath,
                          docLines: docLines.join('\n'),
                        },
                      ]
                      const oldFiles = [
                        {
                          file: existingFile,
                          path: filePath,
                        },
                      ]
                      DocumentUpdaterHandler.updateProjectStructure(
                        projectId,
                        projectHistoryId,
                        userId,
                        { oldFiles, newDocs, newProject: project },
                        error => {
                          if (error != null) {
                            return callback(error)
                          }
                          EditorRealTimeController.emitToRoom(
                            projectId,
                            'removeEntity',
                            existingFile._id,
                            'convertFileToDoc'
                          )
                          callback(null, doc, true)
                        }
                      )
                    }
                  )
                }
              )
            }
          )
        } else if (existingDoc) {
          DocumentUpdaterHandler.setDocument(
            projectId,
            existingDoc._id,
            userId,
            docLines,
            source,
            err => {
              if (err != null) {
                return callback(err)
              }
              logger.log(
                { projectId, docId: existingDoc._id },
                'notifying users that the document has been updated'
              )
              DocumentUpdaterHandler.flushDocToMongo(
                projectId,
                existingDoc._id,
                err => {
                  if (err != null) {
                    return callback(err)
                  }
                  callback(null, existingDoc, existingDoc == null)
                }
              )
            }
          )
        } else {
          ProjectEntityUpdateHandler.addDocWithRanges.withoutLock(
            projectId,
            folderId,
            docName,
            docLines,
            {},
            userId,
            (err, doc) => {
              if (err != null) {
                return callback(err)
              }
              callback(null, doc, existingDoc == null)
            }
          )
        }
      }
    )
  }),

  upsertFile: wrapWithLock({
    beforeLock(next) {
      return function (
        projectId,
        folderId,
        fileName,
        fsPath,
        linkedFileData,
        userId,
        callback
      ) {
        if (!SafePath.isCleanFilename(fileName)) {
          return callback(new Errors.InvalidNameError('invalid element name'))
        }
        // create a new file
        const fileArgs = {
          name: fileName,
          linkedFileData,
        }
        FileStoreHandler.uploadFileFromDisk(
          projectId,
          fileArgs,
          fsPath,
          (err, fileStoreUrl, fileRef) => {
            if (err != null) {
              return callback(err)
            }
            next(
              projectId,
              folderId,
              fileName,
              fsPath,
              linkedFileData,
              userId,
              fileRef,
              fileStoreUrl,
              callback
            )
          }
        )
      }
    },
    withLock(
      projectId,
      folderId,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      newFileRef,
      fileStoreUrl,
      callback
    ) {
      ProjectLocator.findElement(
        { project_id: projectId, element_id: folderId, type: 'folder' },
        (error, folder) => {
          if (error != null) {
            return callback(error)
          }
          if (folder == null) {
            return callback(new Error("Couldn't find folder"))
          }
          const existingFile = folder.fileRefs.find(
            ({ name }) => name === fileName
          )
          const existingDoc = folder.docs.find(({ name }) => name === fileName)

          if (existingDoc) {
            ProjectLocator.findElement(
              {
                project_id: projectId,
                element_id: existingDoc._id,
                type: 'doc',
              },
              (err, doc, path) => {
                if (err) {
                  return callback(new Error('coudnt find existing file'))
                }
                ProjectEntityMongoUpdateHandler.replaceDocWithFile(
                  projectId,
                  existingDoc._id,
                  newFileRef,
                  (err, project) => {
                    if (err) {
                      return callback(err)
                    }
                    const projectHistoryId =
                      project.overleaf &&
                      project.overleaf.history &&
                      project.overleaf.history.id
                    TpdsUpdateSender.addFile(
                      {
                        project_id: project._id,
                        file_id: newFileRef._id,
                        path: path.fileSystem,
                        rev: newFileRef.rev,
                        project_name: project.name,
                      },
                      err => {
                        if (err) {
                          return callback(err)
                        }
                        DocumentUpdaterHandler.updateProjectStructure(
                          projectId,
                          projectHistoryId,
                          userId,
                          {
                            oldDocs: [
                              { doc: existingDoc, path: path.fileSystem },
                            ],

                            newFiles: [
                              {
                                file: newFileRef,
                                path: path.fileSystem,
                                url: fileStoreUrl,
                              },
                            ],
                            newProject: project,
                          },
                          err => {
                            if (err) {
                              return callback(err)
                            }
                            EditorRealTimeController.emitToRoom(
                              projectId,
                              'removeEntity',
                              existingDoc._id,
                              'convertDocToFile'
                            )
                            callback(null, newFileRef, true, existingFile)
                          }
                        )
                      }
                    )
                  }
                )
              }
            )
          } else if (existingFile) {
            // this calls directly into the replaceFile main task (without the beforeLock part)
            return ProjectEntityUpdateHandler.replaceFile.mainTask(
              projectId,
              existingFile._id,
              fsPath,
              linkedFileData,
              userId,
              newFileRef,
              fileStoreUrl,
              err => {
                if (err != null) {
                  return callback(err)
                }
                callback(null, newFileRef, existingFile == null, existingFile)
              }
            )
          } else {
            // this calls directly into the addFile main task (without the beforeLock part)
            ProjectEntityUpdateHandler.addFile.mainTask(
              projectId,
              folderId,
              fileName,
              fsPath,
              linkedFileData,
              userId,
              newFileRef,
              fileStoreUrl,
              err => {
                if (err != null) {
                  return callback(err)
                }
                callback(null, newFileRef, existingFile == null, existingFile)
              }
            )
          }
        }
      )
    },
  }),

  upsertDocWithPath: wrapWithLock(function (
    projectId,
    elementPath,
    docLines,
    source,
    userId,
    callback
  ) {
    if (!SafePath.isCleanPath(elementPath)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    const docName = Path.basename(elementPath)
    const folderPath = Path.dirname(elementPath)
    ProjectEntityUpdateHandler.mkdirp.withoutLock(
      projectId,
      folderPath,
      (err, newFolders, folder) => {
        if (err != null) {
          return callback(err)
        }
        ProjectEntityUpdateHandler.upsertDoc.withoutLock(
          projectId,
          folder._id,
          docName,
          docLines,
          source,
          userId,
          (err, doc, isNewDoc) => {
            if (err != null) {
              return callback(err)
            }
            callback(null, doc, isNewDoc, newFolders, folder)
          }
        )
      }
    )
  }),

  upsertFileWithPath: wrapWithLock({
    beforeLock(next) {
      return function (
        projectId,
        elementPath,
        fsPath,
        linkedFileData,
        userId,
        callback
      ) {
        if (!SafePath.isCleanPath(elementPath)) {
          return callback(new Errors.InvalidNameError('invalid element name'))
        }
        const fileName = Path.basename(elementPath)
        const folderPath = Path.dirname(elementPath)
        // create a new file
        const fileArgs = {
          name: fileName,
          linkedFileData,
        }
        FileStoreHandler.uploadFileFromDisk(
          projectId,
          fileArgs,
          fsPath,
          (err, fileStoreUrl, fileRef) => {
            if (err != null) {
              return callback(err)
            }
            next(
              projectId,
              folderPath,
              fileName,
              fsPath,
              linkedFileData,
              userId,
              fileRef,
              fileStoreUrl,
              callback
            )
          }
        )
      }
    },
    withLock(
      projectId,
      folderPath,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      fileRef,
      fileStoreUrl,
      callback
    ) {
      ProjectEntityUpdateHandler.mkdirp.withoutLock(
        projectId,
        folderPath,
        (err, newFolders, folder) => {
          if (err != null) {
            return callback(err)
          }
          // this calls directly into the upsertFile main task (without the beforeLock part)
          ProjectEntityUpdateHandler.upsertFile.mainTask(
            projectId,
            folder._id,
            fileName,
            fsPath,
            linkedFileData,
            userId,
            fileRef,
            fileStoreUrl,
            (err, newFile, isNewFile, existingFile) => {
              if (err != null) {
                return callback(err)
              }
              callback(
                null,
                newFile,
                isNewFile,
                existingFile,
                newFolders,
                folder
              )
            }
          )
        }
      )
    },
  }),

  deleteEntity: wrapWithLock(function (
    projectId,
    entityId,
    entityType,
    userId,
    callback
  ) {
    logger.log({ entityId, entityType, projectId }, 'deleting project entity')
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', projectId, entityId })
      return callback(new Error('No entityType set'))
    }
    entityType = entityType.toLowerCase()
    ProjectEntityMongoUpdateHandler.deleteEntity(
      projectId,
      entityId,
      entityType,
      (error, entity, path, projectBeforeDeletion, newProject) => {
        if (error != null) {
          return callback(error)
        }
        ProjectEntityUpdateHandler._cleanUpEntity(
          projectBeforeDeletion,
          newProject,
          entity,
          entityType,
          path.fileSystem,
          userId,
          error => {
            if (error != null) {
              return callback(error)
            }
            TpdsUpdateSender.deleteEntity(
              {
                project_id: projectId,
                path: path.fileSystem,
                project_name: projectBeforeDeletion.name,
              },
              error => {
                if (error != null) {
                  return callback(error)
                }
                callback(null, entityId)
              }
            )
          }
        )
      }
    )
  }),

  deleteEntityWithPath: wrapWithLock((projectId, path, userId, callback) =>
    ProjectLocator.findElementByPath(
      { project_id: projectId, path },
      (err, element, type) => {
        if (err != null) {
          return callback(err)
        }
        if (element == null) {
          return callback(new Errors.NotFoundError('project not found'))
        }
        ProjectEntityUpdateHandler.deleteEntity.withoutLock(
          projectId,
          element._id,
          type,
          userId,
          callback
        )
      }
    )
  ),

  mkdirp: wrapWithLock(function (projectId, path, callback) {
    for (const folder of path.split('/')) {
      if (folder.length > 0 && !SafePath.isCleanFilename(folder)) {
        return callback(new Errors.InvalidNameError('invalid element name'))
      }
    }
    ProjectEntityMongoUpdateHandler.mkdirp(
      projectId,
      path,
      { exactCaseMatch: false },
      callback
    )
  }),

  mkdirpWithExactCase: wrapWithLock(function (projectId, path, callback) {
    for (const folder of path.split('/')) {
      if (folder.length > 0 && !SafePath.isCleanFilename(folder)) {
        return callback(new Errors.InvalidNameError('invalid element name'))
      }
    }
    ProjectEntityMongoUpdateHandler.mkdirp(
      projectId,
      path,
      { exactCaseMatch: true },
      callback
    )
  }),

  addFolder: wrapWithLock(function (
    projectId,
    parentFolderId,
    folderName,
    callback
  ) {
    if (!SafePath.isCleanFilename(folderName)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    ProjectEntityMongoUpdateHandler.addFolder(
      projectId,
      parentFolderId,
      folderName,
      callback
    )
  }),

  moveEntity: wrapWithLock(function (
    projectId,
    entityId,
    destFolderId,
    entityType,
    userId,
    callback
  ) {
    logger.log(
      { entityType, entityId, projectId, destFolderId },
      'moving entity'
    )
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', projectId, entityId })
      return callback(new Error('No entityType set'))
    }
    entityType = entityType.toLowerCase()
    ProjectEntityMongoUpdateHandler.moveEntity(
      projectId,
      entityId,
      destFolderId,
      entityType,
      (err, project, startPath, endPath, rev, changes) => {
        if (err != null) {
          return callback(err)
        }
        const projectHistoryId =
          project.overleaf &&
          project.overleaf.history &&
          project.overleaf.history.id
        // do not wait
        TpdsUpdateSender.promises
          .moveEntity({
            project_id: projectId,
            project_name: project.name,
            startPath,
            endPath,
            rev,
          })
          .catch(err => {
            logger.error({ err }, 'error sending tpds update')
          })
        DocumentUpdaterHandler.updateProjectStructure(
          projectId,
          projectHistoryId,
          userId,
          changes,
          callback
        )
      }
    )
  }),

  renameEntity: wrapWithLock(function (
    projectId,
    entityId,
    entityType,
    newName,
    userId,
    callback
  ) {
    if (!SafePath.isCleanFilename(newName)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    logger.log({ entityId, projectId }, `renaming ${entityType}`)
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', projectId, entityId })
      return callback(new Error('No entityType set'))
    }
    entityType = entityType.toLowerCase()

    ProjectEntityMongoUpdateHandler.renameEntity(
      projectId,
      entityId,
      entityType,
      newName,
      (err, project, startPath, endPath, rev, changes) => {
        if (err != null) {
          return callback(err)
        }
        const projectHistoryId =
          project.overleaf &&
          project.overleaf.history &&
          project.overleaf.history.id
        // do not wait
        TpdsUpdateSender.promises
          .moveEntity({
            project_id: projectId,
            project_name: project.name,
            startPath,
            endPath,
            rev,
          })
          .catch(err => {
            logger.error({ err }, 'error sending tpds update')
          })
        DocumentUpdaterHandler.updateProjectStructure(
          projectId,
          projectHistoryId,
          userId,
          changes,
          callback
        )
      }
    )
  }),

  // This doesn't directly update project structure but we need to take the lock
  // to prevent anything else being queued before the resync update
  resyncProjectHistory: wrapWithLock((projectId, callback) =>
    ProjectGetter.getProject(
      projectId,
      { rootFolder: true, overleaf: true },
      (error, project) => {
        if (error != null) {
          return callback(error)
        }

        const projectHistoryId =
          project &&
          project.overleaf &&
          project.overleaf.history &&
          project.overleaf.history.id
        if (projectHistoryId == null) {
          error = new Errors.ProjectHistoryDisabledError(
            `project history not enabled for ${projectId}`
          )
          return callback(error)
        }

        let { docs, files, folders } =
          ProjectEntityHandler.getAllEntitiesFromProject(project)
        // _checkFileTree() must be passed the folders before docs and
        // files
        ProjectEntityUpdateHandler._checkFiletree(
          projectId,
          projectHistoryId,
          [...folders, ...docs, ...files],
          error => {
            if (error) {
              return callback(error)
            }
            docs = _.map(docs, doc => ({
              doc: doc.doc._id,
              path: doc.path,
            }))

            files = _.map(files, file => ({
              file: file.file._id,
              path: file.path,
              url: FileStoreHandler._buildUrl(projectId, file.file._id),
              _hash: file.file.hash,
            }))

            DocumentUpdaterHandler.resyncProjectHistory(
              projectId,
              projectHistoryId,
              docs,
              files,
              callback
            )
          }
        )
      }
    )
  ),

  _checkFiletree(projectId, projectHistoryId, entities, callback) {
    const adjustPathsAfterFolderRename = (oldPath, newPath) => {
      oldPath = oldPath + '/'
      newPath = newPath + '/'
      for (const entity of entities) {
        if (entity.path.startsWith(oldPath)) {
          entity.path = newPath + entity.path.slice(oldPath.length)
        }
      }
    }

    // Data structures for recording pending renames
    const renames = []
    const paths = new Set()
    for (const entity of entities) {
      const originalName = entity.folder
        ? entity.folder.name
        : entity.doc
        ? entity.doc.name
        : entity.file.name

      let newPath = entity.path
      let newName = originalName

      // Clean the filename if necessary
      if (newName === '') {
        newName = 'untitled'
      } else {
        newName = SafePath.clean(newName)
      }
      if (newName !== originalName) {
        newPath = Path.join(
          newPath.slice(0, newPath.length - originalName.length),
          newName
        )
      }

      // Check if we've seen that path already
      if (paths.has(newPath)) {
        newPath = ProjectEntityUpdateHandler.findNextAvailablePath(
          paths,
          newPath
        )
        newName = newPath.split('/').pop()
      }

      // If we've changed the filename, schedule a rename
      if (newName !== originalName) {
        renames.push({ entity, newName, newPath })
        if (entity.folder) {
          // Here, we rely on entities being processed in the right order.
          // Parent folders need to be processed before their children. This is
          // the case only because getAllEntitiesFromProject() returns folders
          // in that order and resyncProjectHistory() calls us with the folders
          // first.
          adjustPathsAfterFolderRename(entity.path, newPath)
        }
      }

      // Remember that we've seen this path
      paths.add(newPath)
    }

    if (renames.length === 0) {
      return callback()
    }
    logger.warn(
      {
        projectId,
        renames: renames.map(rename => ({
          oldPath: rename.entity.path,
          newPath: rename.newPath,
        })),
      },
      'found conflicts or bad filenames in filetree'
    )

    // rename the duplicate files
    const doRename = (rename, cb) => {
      const entity = rename.entity
      const entityId = entity.folder
        ? entity.folder._id
        : entity.doc
        ? entity.doc._id
        : entity.file._id
      const entityType = entity.folder ? 'folder' : entity.doc ? 'doc' : 'file'
      ProjectEntityMongoUpdateHandler.renameEntity(
        projectId,
        entityId,
        entityType,
        rename.newName,
        (err, project, startPath, endPath, rev, changes) => {
          if (err) {
            return cb(err)
          }
          // update the renamed entity for the resync
          entity.path = rename.newPath
          if (entityType === 'folder') {
            entity.folder.name = rename.newName
          } else if (entityType === 'doc') {
            entity.doc.name = rename.newName
          } else {
            entity.file.name = rename.newName
          }
          DocumentUpdaterHandler.updateProjectStructure(
            projectId,
            projectHistoryId,
            null,
            changes,
            cb
          )
        }
      )
    }
    async.eachSeries(renames, doRename, callback)
  },

  findNextAvailablePath(allPaths, candidatePath) {
    const incrementReplacer = (match, p1) => {
      return ' (' + (parseInt(p1, 10) + 1) + ')'
    }
    // if the filename was invalid we should normalise it here too.  Currently
    // this only handles renames in the same folder, so we will be out of luck
    // if it is the folder name which in invalid.  We could handle folder
    // renames by returning the folders list from getAllEntitiesFromProject
    do {
      // does the filename look like "foo (1)" if so, increment the number in parentheses
      if (/ \(\d+\)$/.test(candidatePath)) {
        candidatePath = candidatePath.replace(/ \((\d+)\)$/, incrementReplacer)
      } else {
        // otherwise, add a ' (1)' suffix to the name
        candidatePath = candidatePath + ' (1)'
      }
    } while (allPaths.has(candidatePath)) // keep going until the name is unique
    // add the new name to the set
    allPaths.add(candidatePath)
    return candidatePath
  },

  isPathValidForRootDoc(docPath) {
    const docExtension = Path.extname(docPath)
    return VALID_ROOT_DOC_REGEXP.test(docExtension)
  },

  _cleanUpEntity(
    project,
    newProject,
    entity,
    entityType,
    path,
    userId,
    callback
  ) {
    ProjectEntityUpdateHandler._updateProjectStructureWithDeletedEntity(
      project,
      newProject,
      entity,
      entityType,
      path,
      userId,
      error => {
        if (error != null) {
          return callback(error)
        }
        if (entityType.indexOf('file') !== -1) {
          ProjectEntityUpdateHandler._cleanUpFile(
            project,
            entity,
            path,
            userId,
            callback
          )
        } else if (entityType.indexOf('doc') !== -1) {
          ProjectEntityUpdateHandler._cleanUpDoc(
            project,
            entity,
            path,
            userId,
            callback
          )
        } else if (entityType.indexOf('folder') !== -1) {
          ProjectEntityUpdateHandler._cleanUpFolder(
            project,
            entity,
            path,
            userId,
            callback
          )
        } else {
          callback()
        }
      }
    )
  },

  // Note: the _cleanUpEntity code and _updateProjectStructureWithDeletedEntity
  // methods both need to recursively iterate over the entities in folder.
  // These are currently using separate implementations of the recursion. In
  // future, these could be simplified using a common project entity iterator.
  _updateProjectStructureWithDeletedEntity(
    project,
    newProject,
    entity,
    entityType,
    entityPath,
    userId,
    callback
  ) {
    // compute the changes to the project structure
    let changes
    if (entityType.indexOf('file') !== -1) {
      changes = { oldFiles: [{ file: entity, path: entityPath }] }
    } else if (entityType.indexOf('doc') !== -1) {
      changes = { oldDocs: [{ doc: entity, path: entityPath }] }
    } else if (entityType.indexOf('folder') !== -1) {
      changes = { oldDocs: [], oldFiles: [] }
      const _recurseFolder = (folder, folderPath) => {
        for (const doc of folder.docs) {
          changes.oldDocs.push({ doc, path: Path.join(folderPath, doc.name) })
        }
        for (const file of folder.fileRefs) {
          changes.oldFiles.push({
            file,
            path: Path.join(folderPath, file.name),
          })
        }
        for (const childFolder of folder.folders) {
          _recurseFolder(childFolder, Path.join(folderPath, childFolder.name))
        }
      }
      _recurseFolder(entity, entityPath)
    }
    // now send the project structure changes to the docupdater
    changes.newProject = newProject
    const projectId = project._id.toString()
    const projectHistoryId =
      project.overleaf &&
      project.overleaf.history &&
      project.overleaf.history.id
    DocumentUpdaterHandler.updateProjectStructure(
      projectId,
      projectHistoryId,
      userId,
      changes,
      callback
    )
  },

  _cleanUpDoc(project, doc, path, userId, callback) {
    const projectId = project._id.toString()
    const docId = doc._id.toString()
    const unsetRootDocIfRequired = callback => {
      if (
        project.rootDoc_id != null &&
        project.rootDoc_id.toString() === docId
      ) {
        ProjectEntityUpdateHandler.unsetRootDoc(projectId, callback)
      } else {
        callback()
      }
    }

    unsetRootDocIfRequired(error => {
      if (error != null) {
        return callback(error)
      }
      const { name } = doc
      const deletedAt = new Date()
      DocstoreManager.deleteDoc(projectId, docId, name, deletedAt, error => {
        if (error) {
          return callback(error)
        }
        DocumentUpdaterHandler.deleteDoc(projectId, docId, callback)
      })
    })
  },

  _cleanUpFile(project, file, path, userId, callback) {
    ProjectEntityMongoUpdateHandler._insertDeletedFileReference(
      project._id,
      file,
      callback
    )
  },

  _cleanUpFolder(project, folder, folderPath, userId, callback) {
    const jobs = []
    folder.docs.forEach(doc => {
      const docPath = Path.join(folderPath, doc.name)
      jobs.push(callback =>
        ProjectEntityUpdateHandler._cleanUpDoc(
          project,
          doc,
          docPath,
          userId,
          callback
        )
      )
    })

    folder.fileRefs.forEach(file => {
      const filePath = Path.join(folderPath, file.name)
      jobs.push(callback =>
        ProjectEntityUpdateHandler._cleanUpFile(
          project,
          file,
          filePath,
          userId,
          callback
        )
      )
    })

    folder.folders.forEach(childFolder => {
      folderPath = Path.join(folderPath, childFolder.name)
      jobs.push(callback =>
        ProjectEntityUpdateHandler._cleanUpFolder(
          project,
          childFolder,
          folderPath,
          userId,
          callback
        )
      )
    })

    async.series(jobs, callback)
  },

  convertDocToFile: wrapWithLock({
    beforeLock(next) {
      return function (projectId, docId, userId, callback) {
        DocumentUpdaterHandler.flushDocToMongo(projectId, docId, err => {
          if (err) {
            return callback(err)
          }
          ProjectLocator.findElement(
            { project_id: projectId, element_id: docId, type: 'doc' },
            (err, doc, path) => {
              const docPath = path.fileSystem
              if (err) {
                return callback(err)
              }
              DocstoreManager.getDoc(
                projectId,
                docId,
                (err, docLines, rev, version, ranges) => {
                  if (err) {
                    return callback(err)
                  }
                  if (!_.isEmpty(ranges)) {
                    return callback(new Errors.DocHasRangesError({}))
                  }
                  DocumentUpdaterHandler.deleteDoc(projectId, docId, err => {
                    if (err) {
                      return callback(err)
                    }
                    FileWriter.writeLinesToDisk(
                      projectId,
                      docLines,
                      (err, fsPath) => {
                        if (err) {
                          return callback(err)
                        }
                        FileStoreHandler.uploadFileFromDisk(
                          projectId,
                          { name: doc.name, rev: rev + 1 },
                          fsPath,
                          (err, fileStoreUrl, fileRef) => {
                            if (err) {
                              return callback(err)
                            }
                            fs.unlink(fsPath, err => {
                              if (err) {
                                logger.warn(
                                  { err, path: fsPath },
                                  'failed to clean up temporary file'
                                )
                              }
                              next(
                                projectId,
                                doc,
                                docPath,
                                fileRef,
                                fileStoreUrl,
                                userId,
                                callback
                              )
                            })
                          }
                        )
                      }
                    )
                  })
                }
              )
            }
          )
        })
      }
    },
    withLock(projectId, doc, path, fileRef, fileStoreUrl, userId, callback) {
      ProjectEntityMongoUpdateHandler.replaceDocWithFile(
        projectId,
        doc._id,
        fileRef,
        (err, project) => {
          if (err) {
            return callback(err)
          }
          const projectHistoryId =
            project.overleaf &&
            project.overleaf.history &&
            project.overleaf.history.id
          DocumentUpdaterHandler.updateProjectStructure(
            projectId,
            projectHistoryId,
            userId,
            {
              oldDocs: [{ doc, path }],
              newFiles: [{ file: fileRef, path, url: fileStoreUrl }],
              newProject: project,
            },
            err => {
              if (err) {
                return callback(err)
              }
              ProjectLocator.findElement(
                {
                  project_id: projectId,
                  element_id: fileRef._id,
                  type: 'file',
                },
                (err, element, path, folder) => {
                  if (err) {
                    return callback(err)
                  }
                  EditorRealTimeController.emitToRoom(
                    projectId,
                    'removeEntity',
                    doc._id,
                    'convertDocToFile'
                  )
                  EditorRealTimeController.emitToRoom(
                    projectId,
                    'reciveNewFile',
                    folder._id,
                    fileRef,
                    'convertDocToFile',
                    null,
                    userId
                  )
                  callback(null, fileRef)
                }
              )
            }
          )
        }
      )
    },
  }),
}

module.exports = ProjectEntityUpdateHandler
module.exports.promises = promisifyAll(ProjectEntityUpdateHandler, {
  without: ['isPathValidForRootDoc'],
  multiResult: {
    _addDocAndSendToTpds: ['result', 'project'],
    addDoc: ['doc', 'folderId'],
    addDocWithRanges: ['doc', 'folderId'],
    _uploadFile: ['fileStoreUrl', 'fileRef'],
    _addFileAndSendToTpds: ['result', 'project'],
    addFile: ['fileRef', 'folderId'],
    upsertDoc: ['doc', 'isNew'],
    upsertFile: ['fileRef', 'isNew', 'oldFileRef'],
    upsertDocWithPath: ['doc', 'isNew', 'newFolders', 'folder'],
    upsertFileWithPath: ['fileRef', 'isNew', 'oldFile', 'newFolders', 'folder'],
    mkdirp: ['newFolders', 'folder'],
    mkdirpWithExactCase: ['newFolders', 'folder'],
    addFolder: ['folder', 'parentFolderId'],
  },
})
