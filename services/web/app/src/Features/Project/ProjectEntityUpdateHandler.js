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
let ProjectEntityUpdateHandler, self
const _ = require('lodash')
const async = require('async')
const logger = require('logger-sharelatex')
const path = require('path')
const { Doc } = require('../../models/Doc')
const DocstoreManager = require('../Docstore/DocstoreManager')
const DocumentUpdaterHandler = require('../../Features/DocumentUpdater/DocumentUpdaterHandler')
const Errors = require('../Errors/Errors')
const { File } = require('../../models/File')
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

const LOCK_NAMESPACE = 'sequentialProjectStructureUpdateLock'

const wrapWithLock = function(methodWithoutLock) {
  // This lock is used to make sure that the project structure updates are made
  // sequentially. In particular the updates must be made in mongo and sent to
  // the doc-updater in the same order.
  let methodWithLock
  if (typeof methodWithoutLock === 'function') {
    methodWithLock = function(project_id, ...rest) {
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
  } else {
    // handle case with separate setup and locked stages
    const wrapWithSetup = methodWithoutLock.beforeLock // a function to set things up before the lock
    const mainTask = methodWithoutLock.withLock // function to execute inside the lock
    methodWithLock = wrapWithSetup(function(project_id, ...rest) {
      const adjustedLength = Math.max(rest.length, 1),
        args = rest.slice(0, adjustedLength - 1),
        callback = rest[adjustedLength - 1]
      return LockManager.runWithLock(
        LOCK_NAMESPACE,
        project_id,
        cb => mainTask(project_id, ...Array.from(args), cb),
        callback
      )
    })
    methodWithLock.withoutLock = wrapWithSetup(mainTask)
    methodWithLock.beforeLock = methodWithoutLock.beforeLock
    methodWithLock.mainTask = methodWithoutLock.withLock
    return methodWithLock
  }
}

module.exports = ProjectEntityUpdateHandler = self = {
  copyFileFromExistingProjectWithProject: wrapWithLock({
    beforeLock(next) {
      return function(
        project_id,
        project,
        folder_id,
        originalProject_id,
        origonalFileRef,
        userId,
        callback
      ) {
        if (callback == null) {
          callback = function(error, fileRef, folder_id) {}
        }
        logger.log(
          { project_id, folder_id, originalProject_id, origonalFileRef },
          'copying file in s3 with project'
        )
        return ProjectEntityMongoUpdateHandler._confirmFolder(
          project,
          folder_id,
          function(folder_id) {
            if (origonalFileRef == null) {
              logger.err(
                { project_id, folder_id, originalProject_id, origonalFileRef },
                'file trying to copy is null'
              )
              return callback()
            }
            // convert any invalid characters in original file to '_'
            const fileProperties = {
              name: SafePath.clean(origonalFileRef.name)
            }
            if (origonalFileRef.linkedFileData != null) {
              fileProperties.linkedFileData = origonalFileRef.linkedFileData
            }
            if (origonalFileRef.hash != null) {
              fileProperties.hash = origonalFileRef.hash
            }
            const fileRef = new File(fileProperties)
            return FileStoreHandler.copyFile(
              originalProject_id,
              origonalFileRef._id,
              project._id,
              fileRef._id,
              function(err, fileStoreUrl) {
                if (err != null) {
                  logger.warn(
                    {
                      err,
                      project_id,
                      folder_id,
                      originalProject_id,
                      origonalFileRef
                    },
                    'error coping file in s3'
                  )
                  return callback(err)
                }
                return next(
                  project_id,
                  project,
                  folder_id,
                  originalProject_id,
                  origonalFileRef,
                  userId,
                  fileRef,
                  fileStoreUrl,
                  callback
                )
              }
            )
          }
        )
      }
    },
    withLock(
      project_id,
      project,
      folder_id,
      originalProject_id,
      origonalFileRef,
      userId,
      fileRef,
      fileStoreUrl,
      callback
    ) {
      if (callback == null) {
        callback = function(error, fileRef, folder_id) {}
      }
      const projectHistoryId = __guard__(
        project.overleaf != null ? project.overleaf.history : undefined,
        x => x.id
      )
      return ProjectEntityMongoUpdateHandler._putElement(
        project,
        folder_id,
        fileRef,
        'file',
        function(err, result, newProject) {
          if (err != null) {
            logger.warn(
              { err, project_id, folder_id },
              'error putting element as part of copy'
            )
            return callback(err)
          }
          return TpdsUpdateSender.addFile(
            {
              project_id,
              file_id: fileRef._id,
              path: __guard__(
                result != null ? result.path : undefined,
                x1 => x1.fileSystem
              ),
              rev: fileRef.rev,
              project_name: project.name
            },
            function(err) {
              if (err != null) {
                logger.err(
                  {
                    err,
                    project_id,
                    folder_id,
                    originalProject_id,
                    origonalFileRef
                  },
                  'error sending file to tpds worker'
                )
              }
              const newFiles = [
                {
                  file: fileRef,
                  path: __guard__(
                    result != null ? result.path : undefined,
                    x2 => x2.fileSystem
                  ),
                  url: fileStoreUrl
                }
              ]
              return DocumentUpdaterHandler.updateProjectStructure(
                project_id,
                projectHistoryId,
                userId,
                { newFiles, newProject },
                function(error) {
                  if (error != null) {
                    return callback(error)
                  }
                  return callback(null, fileRef, folder_id)
                }
              )
            }
          )
        }
      )
    }
  }),

  updateDocLines(
    project_id,
    doc_id,
    lines,
    version,
    ranges,
    lastUpdatedAt,
    lastUpdatedBy,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ProjectGetter.getProjectWithoutDocLines(project_id, function(
      err,
      project
    ) {
      if (err != null) {
        return callback(err)
      }
      if (project == null) {
        return callback(new Errors.NotFoundError('project not found'))
      }
      logger.log({ project_id, doc_id }, 'updating doc lines')
      return ProjectLocator.findElement(
        { project, element_id: doc_id, type: 'docs' },
        function(err, doc, path) {
          let isDeletedDoc = false
          if (err != null) {
            if (err instanceof Errors.NotFoundError) {
              // We need to be able to update the doclines of deleted docs. This is
              // so the doc-updater can flush a doc's content to the doc-store after
              // the doc is deleted.
              isDeletedDoc = true
              doc = _.find(
                project.deletedDocs,
                doc => doc._id.toString() === doc_id.toString()
              )
            } else {
              return callback(err)
            }
          }

          if (doc == null) {
            // Do not allow an update to a doc which has never exist on this project
            logger.warn(
              { doc_id, project_id, lines },
              'doc not found while updating doc lines'
            )
            return callback(new Errors.NotFoundError('doc not found'))
          }

          logger.log(
            { project_id, doc_id },
            'telling docstore manager to update doc'
          )
          return DocstoreManager.updateDoc(
            project_id,
            doc_id,
            lines,
            version,
            ranges,
            function(err, modified, rev) {
              if (err != null) {
                logger.warn(
                  { err, doc_id, project_id, lines },
                  'error sending doc to docstore'
                )
                return callback(err)
              }
              logger.log(
                { project_id, doc_id, modified },
                'finished updating doc lines'
              )
              // path will only be present if the doc is not deleted
              if (modified && !isDeletedDoc) {
                // Don't need to block for marking as updated
                ProjectUpdateHandler.markAsUpdated(
                  project_id,
                  lastUpdatedAt,
                  lastUpdatedBy
                )
                return TpdsUpdateSender.addDoc(
                  {
                    project_id,
                    path: path.fileSystem,
                    doc_id,
                    project_name: project.name,
                    rev
                  },
                  callback
                )
              } else {
                return callback()
              }
            }
          )
        }
      )
    })
  },

  setRootDoc(project_id, newRootDocID, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id, rootDocId: newRootDocID }, 'setting root doc')
    return Project.update(
      { _id: project_id },
      { rootDoc_id: newRootDocID },
      {},
      callback
    )
  },

  unsetRootDoc(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ project_id }, 'removing root doc')
    return Project.update(
      { _id: project_id },
      { $unset: { rootDoc_id: true } },
      {},
      callback
    )
  },

  _addDocAndSendToTpds(project_id, folder_id, doc, callback) {
    if (callback == null) {
      callback = function(error, result, project) {}
    }
    return ProjectEntityMongoUpdateHandler.addDoc(
      project_id,
      folder_id,
      doc,
      function(err, result, project) {
        if (err != null) {
          logger.warn(
            {
              err,
              project_id,
              folder_id,
              doc_name: doc != null ? doc.name : undefined,
              doc_id: doc != null ? doc._id : undefined
            },
            'error adding file with project'
          )
          return callback(err)
        }
        return TpdsUpdateSender.addDoc(
          {
            project_id,
            doc_id: doc != null ? doc._id : undefined,
            path: __guard__(
              result != null ? result.path : undefined,
              x => x.fileSystem
            ),
            project_name: project.name,
            rev: 0
          },
          function(err) {
            if (err != null) {
              return callback(err)
            }
            return callback(null, result, project)
          }
        )
      }
    )
  },

  addDoc(project_id, folder_id, docName, docLines, userId, callback) {
    return self.addDocWithRanges(
      project_id,
      folder_id,
      docName,
      docLines,
      {},
      userId,
      callback
    )
  },

  addDocWithRanges: wrapWithLock({
    beforeLock(next) {
      return function(
        project_id,
        folder_id,
        docName,
        docLines,
        ranges,
        userId,
        callback
      ) {
        if (callback == null) {
          callback = function(error, doc, folder_id) {}
        }
        if (!SafePath.isCleanFilename(docName)) {
          return callback(new Errors.InvalidNameError('invalid element name'))
        }
        // Put doc in docstore first, so that if it errors, we don't have a doc_id in the project
        // which hasn't been created in docstore.
        const doc = new Doc({ name: docName })
        return DocstoreManager.updateDoc(
          project_id.toString(),
          doc._id.toString(),
          docLines,
          0,
          ranges,
          function(err, modified, rev) {
            if (err != null) {
              return callback(err)
            }
            return next(
              project_id,
              folder_id,
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
      project_id,
      folder_id,
      doc,
      docName,
      docLines,
      ranges,
      userId,
      callback
    ) {
      if (callback == null) {
        callback = function(error, doc, folder_id) {}
      }
      return ProjectEntityUpdateHandler._addDocAndSendToTpds(
        project_id,
        folder_id,
        doc,
        function(err, result, project) {
          if (err != null) {
            return callback(err)
          }
          const docPath = __guard__(
            result != null ? result.path : undefined,
            x => x.fileSystem
          )
          const projectHistoryId = __guard__(
            project.overleaf != null ? project.overleaf.history : undefined,
            x1 => x1.id
          )
          const newDocs = [
            {
              doc,
              path: docPath,
              docLines: docLines.join('\n')
            }
          ]
          return DocumentUpdaterHandler.updateProjectStructure(
            project_id,
            projectHistoryId,
            userId,
            { newDocs, newProject: project },
            function(error) {
              if (error != null) {
                return callback(error)
              }
              return callback(null, doc, folder_id)
            }
          )
        }
      )
    }
  }),

  _uploadFile(
    project_id,
    folder_id,
    fileName,
    fsPath,
    linkedFileData,
    callback
  ) {
    if (callback == null) {
      callback = function(error, fileStoreUrl, fileRef) {}
    }
    if (!SafePath.isCleanFilename(fileName)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    const fileArgs = {
      name: fileName,
      linkedFileData
    }
    return FileStoreHandler.uploadFileFromDisk(
      project_id,
      fileArgs,
      fsPath,
      function(err, fileStoreUrl, fileRef) {
        if (err != null) {
          logger.warn(
            { err, project_id, folder_id, file_name: fileName, fileRef },
            'error uploading image to s3'
          )
          return callback(err)
        }
        return callback(null, fileStoreUrl, fileRef)
      }
    )
  },

  _addFileAndSendToTpds(project_id, folder_id, fileRef, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ProjectEntityMongoUpdateHandler.addFile(
      project_id,
      folder_id,
      fileRef,
      function(err, result, project) {
        if (err != null) {
          logger.warn(
            { err, project_id, folder_id, file_name: fileRef.name, fileRef },
            'error adding file with project'
          )
          return callback(err)
        }
        return TpdsUpdateSender.addFile(
          {
            project_id,
            file_id: fileRef._id,
            path: __guard__(
              result != null ? result.path : undefined,
              x => x.fileSystem
            ),
            project_name: project.name,
            rev: fileRef.rev
          },
          function(err) {
            if (err != null) {
              return callback(err)
            }
            return callback(null, result, project)
          }
        )
      }
    )
  },

  addFile: wrapWithLock({
    beforeLock(next) {
      return function(
        project_id,
        folder_id,
        fileName,
        fsPath,
        linkedFileData,
        userId,
        callback
      ) {
        if (!SafePath.isCleanFilename(fileName)) {
          return callback(new Errors.InvalidNameError('invalid element name'))
        }
        return ProjectEntityUpdateHandler._uploadFile(
          project_id,
          folder_id,
          fileName,
          fsPath,
          linkedFileData,
          function(error, fileStoreUrl, fileRef) {
            if (error != null) {
              return callback(error)
            }
            return next(
              project_id,
              folder_id,
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
      project_id,
      folder_id,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      fileRef,
      fileStoreUrl,
      callback
    ) {
      if (callback == null) {
        callback = function(error, fileRef, folder_id) {}
      }
      return ProjectEntityUpdateHandler._addFileAndSendToTpds(
        project_id,
        folder_id,
        fileRef,
        function(err, result, project) {
          if (err != null) {
            return callback(err)
          }
          const projectHistoryId = __guard__(
            project.overleaf != null ? project.overleaf.history : undefined,
            x => x.id
          )
          const newFiles = [
            {
              file: fileRef,
              path: __guard__(
                result != null ? result.path : undefined,
                x1 => x1.fileSystem
              ),
              url: fileStoreUrl
            }
          ]
          return DocumentUpdaterHandler.updateProjectStructure(
            project_id,
            projectHistoryId,
            userId,
            { newFiles, newProject: project },
            function(error) {
              if (error != null) {
                return callback(error)
              }
              return callback(null, fileRef, folder_id)
            }
          )
        }
      )
    }
  }),

  replaceFile: wrapWithLock({
    beforeLock(next) {
      return function(
        project_id,
        file_id,
        fsPath,
        linkedFileData,
        userId,
        callback
      ) {
        // create a new file
        const fileArgs = {
          name: 'dummy-upload-filename',
          linkedFileData
        }
        return FileStoreHandler.uploadFileFromDisk(
          project_id,
          fileArgs,
          fsPath,
          function(err, fileStoreUrl, fileRef) {
            if (err != null) {
              return callback(err)
            }
            return next(
              project_id,
              file_id,
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
      project_id,
      file_id,
      fsPath,
      linkedFileData,
      userId,
      newFileRef,
      fileStoreUrl,
      callback
    ) {
      return ProjectEntityMongoUpdateHandler.replaceFileWithNew(
        project_id,
        file_id,
        newFileRef,
        function(err, oldFileRef, project, path, newProject) {
          if (err != null) {
            return callback(err)
          }
          const oldFiles = [
            {
              file: oldFileRef,
              path: path.fileSystem
            }
          ]
          const newFiles = [
            {
              file: newFileRef,
              path: path.fileSystem,
              url: fileStoreUrl
            }
          ]
          const projectHistoryId = __guard__(
            project.overleaf != null ? project.overleaf.history : undefined,
            x => x.id
          )
          // Increment the rev for an in-place update (with the same path) so the third-party-datastore
          // knows this is a new file.
          // Ideally we would get this from ProjectEntityMongoUpdateHandler.replaceFileWithNew
          // but it returns the original oldFileRef (after incrementing the rev value in mongo),
          // so we add 1 to the rev from that. This isn't atomic and relies on the lock
          // but it is acceptable for now.
          return TpdsUpdateSender.addFile(
            {
              project_id: project._id,
              file_id: newFileRef._id,
              path: path.fileSystem,
              rev: oldFileRef.rev + 1,
              project_name: project.name
            },
            function(err) {
              if (err != null) {
                return callback(err)
              }
              return DocumentUpdaterHandler.updateProjectStructure(
                project_id,
                projectHistoryId,
                userId,
                { oldFiles, newFiles, newProject },
                callback
              )
            }
          )
        }
      )
    }
  }),

  upsertDoc: wrapWithLock(function(
    project_id,
    folder_id,
    docName,
    docLines,
    source,
    userId,
    callback
  ) {
    if (callback == null) {
      callback = function(err, doc, folder_id, isNewDoc) {}
    }
    if (!SafePath.isCleanFilename(docName)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    return ProjectLocator.findElement(
      { project_id, element_id: folder_id, type: 'folder' },
      function(error, folder) {
        if (error != null) {
          return callback(error)
        }
        if (folder == null) {
          return callback(new Error("Couldn't find folder"))
        }
        let existingDoc = null
        for (let doc of Array.from(folder.docs)) {
          if (doc.name === docName) {
            existingDoc = doc
            break
          }
        }
        if (existingDoc != null) {
          return DocumentUpdaterHandler.setDocument(
            project_id,
            existingDoc._id,
            userId,
            docLines,
            source,
            err => {
              logger.log(
                { project_id, doc_id: existingDoc._id },
                'notifying users that the document has been updated'
              )
              return DocumentUpdaterHandler.flushDocToMongo(
                project_id,
                existingDoc._id,
                function(err) {
                  if (err != null) {
                    return callback(err)
                  }
                  return callback(null, existingDoc, existingDoc == null)
                }
              )
            }
          )
        } else {
          return self.addDocWithRanges.withoutLock(
            project_id,
            folder_id,
            docName,
            docLines,
            {},
            userId,
            function(err, doc) {
              if (err != null) {
                return callback(err)
              }
              return callback(null, doc, existingDoc == null)
            }
          )
        }
      }
    )
  }),

  upsertFile: wrapWithLock({
    beforeLock(next) {
      return function(
        project_id,
        folder_id,
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
          linkedFileData
        }
        return FileStoreHandler.uploadFileFromDisk(
          project_id,
          fileArgs,
          fsPath,
          function(err, fileStoreUrl, fileRef) {
            if (err != null) {
              return callback(err)
            }
            return next(
              project_id,
              folder_id,
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
      project_id,
      folder_id,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      newFileRef,
      fileStoreUrl,
      callback
    ) {
      if (callback == null) {
        callback = function(err, file, isNewFile, existingFile) {}
      }
      return ProjectLocator.findElement(
        { project_id, element_id: folder_id, type: 'folder' },
        function(error, folder) {
          if (error != null) {
            return callback(error)
          }
          if (folder == null) {
            return callback(new Error("Couldn't find folder"))
          }
          let existingFile = null
          for (let fileRef of Array.from(folder.fileRefs)) {
            if (fileRef.name === fileName) {
              existingFile = fileRef
              break
            }
          }
          if (existingFile != null) {
            // this calls directly into the replaceFile main task (without the beforeLock part)
            return self.replaceFile.mainTask(
              project_id,
              existingFile._id,
              fsPath,
              linkedFileData,
              userId,
              newFileRef,
              fileStoreUrl,
              function(err) {
                if (err != null) {
                  return callback(err)
                }
                return callback(
                  null,
                  newFileRef,
                  existingFile == null,
                  existingFile
                )
              }
            )
          } else {
            // this calls directly into the addFile main task (without the beforeLock part)
            return self.addFile.mainTask(
              project_id,
              folder_id,
              fileName,
              fsPath,
              linkedFileData,
              userId,
              newFileRef,
              fileStoreUrl,
              function(err) {
                if (err != null) {
                  return callback(err)
                }
                return callback(
                  null,
                  newFileRef,
                  existingFile == null,
                  existingFile
                )
              }
            )
          }
        }
      )
    }
  }),

  upsertDocWithPath: wrapWithLock(function(
    project_id,
    elementPath,
    docLines,
    source,
    userId,
    callback
  ) {
    if (!SafePath.isCleanPath(elementPath)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    const docName = path.basename(elementPath)
    const folderPath = path.dirname(elementPath)
    return self.mkdirp.withoutLock(project_id, folderPath, function(
      err,
      newFolders,
      folder
    ) {
      if (err != null) {
        return callback(err)
      }
      return self.upsertDoc.withoutLock(
        project_id,
        folder._id,
        docName,
        docLines,
        source,
        userId,
        function(err, doc, isNewDoc) {
          if (err != null) {
            return callback(err)
          }
          return callback(null, doc, isNewDoc, newFolders, folder)
        }
      )
    })
  }),

  upsertFileWithPath: wrapWithLock({
    beforeLock(next) {
      return function(
        project_id,
        elementPath,
        fsPath,
        linkedFileData,
        userId,
        callback
      ) {
        if (!SafePath.isCleanPath(elementPath)) {
          return callback(new Errors.InvalidNameError('invalid element name'))
        }
        const fileName = path.basename(elementPath)
        const folderPath = path.dirname(elementPath)
        // create a new file
        const fileArgs = {
          name: fileName,
          linkedFileData
        }
        return FileStoreHandler.uploadFileFromDisk(
          project_id,
          fileArgs,
          fsPath,
          function(err, fileStoreUrl, fileRef) {
            if (err != null) {
              return callback(err)
            }
            return next(
              project_id,
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
      project_id,
      folderPath,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      fileRef,
      fileStoreUrl,
      callback
    ) {
      return self.mkdirp.withoutLock(project_id, folderPath, function(
        err,
        newFolders,
        folder
      ) {
        if (err != null) {
          return callback(err)
        }
        // this calls directly into the upsertFile main task (without the beforeLock part)
        return self.upsertFile.mainTask(
          project_id,
          folder._id,
          fileName,
          fsPath,
          linkedFileData,
          userId,
          fileRef,
          fileStoreUrl,
          function(err, newFile, isNewFile, existingFile) {
            if (err != null) {
              return callback(err)
            }
            return callback(
              null,
              newFile,
              isNewFile,
              existingFile,
              newFolders,
              folder
            )
          }
        )
      })
    }
  }),

  deleteEntity: wrapWithLock(function(
    project_id,
    entity_id,
    entityType,
    userId,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log({ entity_id, entityType, project_id }, 'deleting project entity')
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', project_id, entity_id })
      return callback(new Error('No entityType set'))
    }
    entityType = entityType.toLowerCase()
    return ProjectEntityMongoUpdateHandler.deleteEntity(
      project_id,
      entity_id,
      entityType,
      function(error, entity, path, projectBeforeDeletion, newProject) {
        if (error != null) {
          return callback(error)
        }
        return self._cleanUpEntity(
          projectBeforeDeletion,
          newProject,
          entity,
          entityType,
          path.fileSystem,
          userId,
          function(error) {
            if (error != null) {
              return callback(error)
            }
            return TpdsUpdateSender.deleteEntity(
              {
                project_id,
                path: path.fileSystem,
                project_name: projectBeforeDeletion.name
              },
              function(error) {
                if (error != null) {
                  return callback(error)
                }
                return callback(null, entity_id)
              }
            )
          }
        )
      }
    )
  }),

  deleteEntityWithPath: wrapWithLock((project_id, path, userId, callback) =>
    ProjectLocator.findElementByPath({ project_id, path }, function(
      err,
      element,
      type
    ) {
      if (err != null) {
        return callback(err)
      }
      if (element == null) {
        return callback(new Errors.NotFoundError('project not found'))
      }
      return self.deleteEntity.withoutLock(
        project_id,
        element._id,
        type,
        userId,
        callback
      )
    })
  ),

  mkdirp: wrapWithLock(function(project_id, path, callback) {
    if (callback == null) {
      callback = function(err, newlyCreatedFolders, lastFolderInPath) {}
    }
    for (let folder of Array.from(path.split('/'))) {
      if (folder.length > 0 && !SafePath.isCleanFilename(folder)) {
        return callback(new Errors.InvalidNameError('invalid element name'))
      }
    }
    return ProjectEntityMongoUpdateHandler.mkdirp(
      project_id,
      path,
      { exactCaseMatch: false },
      callback
    )
  }),

  mkdirpWithExactCase: wrapWithLock(function(project_id, path, callback) {
    if (callback == null) {
      callback = function(err, newlyCreatedFolders, lastFolderInPath) {}
    }
    for (let folder of Array.from(path.split('/'))) {
      if (folder.length > 0 && !SafePath.isCleanFilename(folder)) {
        return callback(new Errors.InvalidNameError('invalid element name'))
      }
    }
    return ProjectEntityMongoUpdateHandler.mkdirp(
      project_id,
      path,
      { exactCaseMatch: true },
      callback
    )
  }),

  addFolder: wrapWithLock(function(
    project_id,
    parentFolder_id,
    folderName,
    callback
  ) {
    if (!SafePath.isCleanFilename(folderName)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    return ProjectEntityMongoUpdateHandler.addFolder(
      project_id,
      parentFolder_id,
      folderName,
      callback
    )
  }),

  moveEntity: wrapWithLock(function(
    project_id,
    entity_id,
    destFolderId,
    entityType,
    userId,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log(
      { entityType, entity_id, project_id, destFolderId },
      'moving entity'
    )
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', project_id, entity_id })
      return callback(new Error('No entityType set'))
    }
    entityType = entityType.toLowerCase()
    return ProjectEntityMongoUpdateHandler.moveEntity(
      project_id,
      entity_id,
      destFolderId,
      entityType,
      function(err, project, startPath, endPath, rev, changes) {
        if (err != null) {
          return callback(err)
        }
        const projectHistoryId = __guard__(
          project.overleaf != null ? project.overleaf.history : undefined,
          x => x.id
        )
        TpdsUpdateSender.moveEntity({
          project_id,
          project_name: project.name,
          startPath,
          endPath,
          rev
        })
        return DocumentUpdaterHandler.updateProjectStructure(
          project_id,
          projectHistoryId,
          userId,
          changes,
          callback
        )
      }
    )
  }),

  renameEntity: wrapWithLock(function(
    project_id,
    entity_id,
    entityType,
    newName,
    userId,
    callback
  ) {
    if (!SafePath.isCleanFilename(newName)) {
      return callback(new Errors.InvalidNameError('invalid element name'))
    }
    logger.log({ entity_id, project_id }, `renaming ${entityType}`)
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', project_id, entity_id })
      return callback(new Error('No entityType set'))
    }
    entityType = entityType.toLowerCase()

    return ProjectEntityMongoUpdateHandler.renameEntity(
      project_id,
      entity_id,
      entityType,
      newName,
      function(err, project, startPath, endPath, rev, changes) {
        if (err != null) {
          return callback(err)
        }
        const projectHistoryId = __guard__(
          project.overleaf != null ? project.overleaf.history : undefined,
          x => x.id
        )
        TpdsUpdateSender.moveEntity({
          project_id,
          project_name: project.name,
          startPath,
          endPath,
          rev
        })
        return DocumentUpdaterHandler.updateProjectStructure(
          project_id,
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
  resyncProjectHistory: wrapWithLock((project_id, callback) =>
    ProjectGetter.getProject(
      project_id,
      { rootFolder: true, overleaf: true },
      function(error, project) {
        if (error != null) {
          return callback(error)
        }

        const projectHistoryId = __guard__(
          __guard__(
            project != null ? project.overleaf : undefined,
            x1 => x1.history
          ),
          x => x.id
        )
        if (projectHistoryId == null) {
          error = new Errors.ProjectHistoryDisabledError(
            `project history not enabled for ${project_id}`
          )
          return callback(error)
        }

        return ProjectEntityHandler.getAllEntitiesFromProject(project, function(
          error,
          docs,
          files
        ) {
          if (error != null) {
            return callback(error)
          }

          docs = _.map(docs, doc => ({
            doc: doc.doc._id,
            path: doc.path
          }))

          files = _.map(files, file => ({
            file: file.file._id,
            path: file.path,
            url: FileStoreHandler._buildUrl(project_id, file.file._id)
          }))

          return DocumentUpdaterHandler.resyncProjectHistory(
            project_id,
            projectHistoryId,
            docs,
            files,
            callback
          )
        })
      }
    )
  ),

  _cleanUpEntity(
    project,
    newProject,
    entity,
    entityType,
    path,
    userId,
    callback
  ) {
    if (callback == null) {
      callback = function(error) {}
    }
    return self._updateProjectStructureWithDeletedEntity(
      project,
      newProject,
      entity,
      entityType,
      path,
      userId,
      function(error) {
        if (error != null) {
          return callback(error)
        }
        if (entityType.indexOf('file') !== -1) {
          return self._cleanUpFile(project, entity, path, userId, callback)
        } else if (entityType.indexOf('doc') !== -1) {
          return self._cleanUpDoc(project, entity, path, userId, callback)
        } else if (entityType.indexOf('folder') !== -1) {
          return self._cleanUpFolder(project, entity, path, userId, callback)
        } else {
          return callback()
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
    if (callback == null) {
      callback = function(error) {}
    }
    if (entityType.indexOf('file') !== -1) {
      changes = { oldFiles: [{ file: entity, path: entityPath }] }
    } else if (entityType.indexOf('doc') !== -1) {
      changes = { oldDocs: [{ doc: entity, path: entityPath }] }
    } else if (entityType.indexOf('folder') !== -1) {
      changes = { oldDocs: [], oldFiles: [] }
      var _recurseFolder = function(folder, folderPath) {
        for (let doc of Array.from(folder.docs)) {
          changes.oldDocs.push({ doc, path: path.join(folderPath, doc.name) })
        }
        for (let file of Array.from(folder.fileRefs)) {
          changes.oldFiles.push({
            file,
            path: path.join(folderPath, file.name)
          })
        }
        return Array.from(folder.folders).map(childFolder =>
          _recurseFolder(childFolder, path.join(folderPath, childFolder.name))
        )
      }
      _recurseFolder(entity, entityPath)
    }
    // now send the project structure changes to the docupdater
    changes.newProject = newProject
    const project_id = project._id.toString()
    const projectHistoryId = __guard__(
      project.overleaf != null ? project.overleaf.history : undefined,
      x => x.id
    )
    return DocumentUpdaterHandler.updateProjectStructure(
      project_id,
      projectHistoryId,
      userId,
      changes,
      callback
    )
  },

  _cleanUpDoc(project, doc, path, userId, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const project_id = project._id.toString()
    const doc_id = doc._id.toString()
    const unsetRootDocIfRequired = callback => {
      if (
        project.rootDoc_id != null &&
        project.rootDoc_id.toString() === doc_id
      ) {
        return this.unsetRootDoc(project_id, callback)
      } else {
        return callback()
      }
    }

    return unsetRootDocIfRequired(function(error) {
      if (error != null) {
        return callback(error)
      }
      return ProjectEntityMongoUpdateHandler._insertDeletedDocReference(
        project._id,
        doc,
        function(error) {
          if (error != null) {
            return callback(error)
          }
          return DocumentUpdaterHandler.deleteDoc(project_id, doc_id, function(
            error
          ) {
            if (error != null) {
              return callback(error)
            }
            return DocstoreManager.deleteDoc(project_id, doc_id, callback)
          })
        }
      )
    })
  },

  _cleanUpFile(project, file, path, userId, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return ProjectEntityMongoUpdateHandler._insertDeletedFileReference(
      project._id,
      file,
      callback
    )
  },

  _cleanUpFolder(project, folder, folderPath, userId, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const jobs = []
    for (let doc of Array.from(folder.docs)) {
      ;(function(doc) {
        const docPath = path.join(folderPath, doc.name)
        return jobs.push(callback =>
          self._cleanUpDoc(project, doc, docPath, userId, callback)
        )
      })(doc)
    }

    for (let file of Array.from(folder.fileRefs)) {
      ;(function(file) {
        const filePath = path.join(folderPath, file.name)
        return jobs.push(callback =>
          self._cleanUpFile(project, file, filePath, userId, callback)
        )
      })(file)
    }

    for (let childFolder of Array.from(folder.folders)) {
      ;(function(childFolder) {
        folderPath = path.join(folderPath, childFolder.name)
        return jobs.push(callback =>
          self._cleanUpFolder(
            project,
            childFolder,
            folderPath,
            userId,
            callback
          )
        )
      })(childFolder)
    }

    return async.series(jobs, callback)
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
