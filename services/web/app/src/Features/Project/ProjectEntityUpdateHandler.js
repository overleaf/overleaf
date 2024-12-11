const _ = require('lodash')
const OError = require('@overleaf/o-error')
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
const ProjectOptionsHandler = require('./ProjectOptionsHandler')
const ProjectUpdateHandler = require('./ProjectUpdateHandler')
const ProjectEntityMongoUpdateHandler = require('./ProjectEntityMongoUpdateHandler')
const SafePath = require('./SafePath')
const TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
const FileWriter = require('../../infrastructure/FileWriter')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const {
  callbackifyMultiResult,
  callbackify,
} = require('@overleaf/promise-utils')
const { iterablePaths } = require('./IterablePath')

const LOCK_NAMESPACE = 'sequentialProjectStructureUpdateLock'
const VALID_ROOT_DOC_EXTENSIONS = Settings.validRootDocExtensions
const VALID_ROOT_DOC_REGEXP = new RegExp(
  `^\\.(${VALID_ROOT_DOC_EXTENSIONS.join('|')})$`,
  'i'
)

function wrapWithLock(methodWithoutLock, lockManager = LockManager) {
  // This lock is used to make sure that the project structure updates are made
  // sequentially. In particular the updates must be made in mongo and sent to
  // the doc-updater in the same order.
  if (typeof methodWithoutLock === 'function') {
    const methodWithLock = async (projectId, ...rest) => {
      return lockManager.promises.runWithLock(LOCK_NAMESPACE, projectId, () =>
        methodWithoutLock(projectId, ...rest)
      )
    }
    methodWithLock.withoutLock = methodWithoutLock
    return methodWithLock
  } else {
    // handle case with separate setup and locked stages
    const mainTask = methodWithoutLock.withLock
    const methodWithLock = async (projectId, ...rest) => {
      const arg = await methodWithoutLock.beforeLock(projectId, ...rest)
      return lockManager.promises.runWithLock(LOCK_NAMESPACE, projectId, () =>
        mainTask(arg)
      )
    }
    methodWithLock.withoutLock = async (...args) => {
      return await mainTask(await methodWithoutLock.beforeLock(...args))
    }
    methodWithLock.beforeLock = methodWithoutLock.beforeLock
    methodWithLock.mainTask = methodWithoutLock.withLock
    return methodWithLock
  }
}

async function getDocContext(projectId, docId) {
  let project
  try {
    project = await ProjectGetter.promises.getProject(projectId, {
      name: true,
      rootFolder: true,
    })
  } catch (err) {
    throw OError.tag(err, 'error fetching project', {
      projectId,
    })
  }

  if (!project) {
    throw new Errors.NotFoundError('project not found')
  }
  try {
    const { path, folder } = await ProjectLocator.promises.findElement({
      project,
      element_id: docId,
      type: 'docs',
    })
    return {
      projectName: project.name,
      isDeletedDoc: false,
      path: path.fileSystem,
      folder,
    }
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      // (Soft-)Deleted docs are removed from the file-tree (rootFolder).
      // docstore can tell whether it exists and is (soft)-deleted.
      let isDeletedDoc
      try {
        isDeletedDoc = await DocstoreManager.promises.isDocDeleted(
          projectId,
          docId
        )
        if (!isDeletedDoc) {
          // NOTE: This can happen while we delete a doc:
          //  1. web will update the projects entry
          //  2. web triggers flushes to tpds/doc-updater
          //  3. web triggers (soft)-delete in docstore
          // Specifically when an update comes in after 1
          //  and before 3 completes.
          logger.debug(
            { projectId, docId },
            'updating doc that is in process of getting soft-deleted'
          )
        }
        return {
          projectName: project.name,
          isDeletedDoc: true,
          path: null,
          folder: null,
        }
      } catch (error) {
        if (error instanceof Errors.NotFoundError) {
          logger.warn(
            { projectId, docId },
            'doc not found while updating doc lines'
          )
          throw error
        }
        throw OError.tag(
          error,
          'error checking deletion status with docstore',
          {
            projectId,
            docId,
          }
        )
      }
    } else {
      throw OError.tag(err, 'error finding doc in rootFolder', {
        docId,
        projectId,
      })
    }
  }
}

async function updateDocLines(
  projectId,
  docId,
  lines,
  version,
  ranges,
  lastUpdatedAt,
  lastUpdatedBy
) {
  let ctx
  try {
    ctx = await getDocContext(projectId, docId)
  } catch (error) {
    if (error instanceof Errors.NotFoundError) {
      // Do not allow an update to a doc which has never exist on this project
      logger.warn(
        { docId, projectId },
        'project or doc not found while updating doc lines'
      )
    }

    throw error
  }
  const { projectName, isDeletedDoc, path, folder } = ctx
  logger.debug({ projectId, docId }, 'telling docstore manager to update doc')
  let modified, rev
  try {
    ;({ modified, rev } = await DocstoreManager.promises.updateDoc(
      projectId,
      docId,
      lines,
      version,
      ranges
    ))
  } catch (err) {
    throw OError.tag(err, 'error sending doc to docstore', { docId, projectId })
  }
  // path will only be present if the doc is not deleted
  if (!modified || isDeletedDoc) {
    return { rev }
  }
  // Don't need to block for marking as updated
  ProjectUpdateHandler.promises
    .markAsUpdated(projectId, lastUpdatedAt, lastUpdatedBy)
    .catch(error => {
      logger.error({ error }, 'failed to mark project as updated')
    })
  await TpdsUpdateSender.promises.addDoc({
    projectId,
    path,
    docId,
    projectName,
    rev,
    folderId: folder?._id,
  })
  return { rev, modified }
}

async function setRootDoc(projectId, newRootDocID) {
  logger.debug({ projectId, rootDocId: newRootDocID }, 'setting root doc')
  if (projectId == null || newRootDocID == null) {
    throw new Errors.InvalidError('missing arguments (project or doc)')
  }
  const docPath =
    await ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
      projectId,
      newRootDocID
    )
  if (ProjectEntityUpdateHandler.isPathValidForRootDoc(docPath)) {
    await Project.updateOne(
      { _id: projectId },
      { rootDoc_id: newRootDocID }
    ).exec()
  } else {
    throw new Errors.UnsupportedFileTypeError(
      'invalid file extension for root doc'
    )
  }
}

async function unsetRootDoc(projectId) {
  logger.debug({ projectId }, 'removing root doc')
  await Project.updateOne(
    { _id: projectId },
    { $unset: { rootDoc_id: true } }
  ).exec()
}

async function addDoc(projectId, folderId, docName, docLines, userId, source) {
  return await ProjectEntityUpdateHandler.promises.addDocWithRanges(
    projectId,
    folderId,
    docName,
    docLines,
    {},
    userId,
    source
  )
}

const addDocWithRanges = wrapWithLock({
  async beforeLock(
    projectId,
    folderId,
    docName,
    docLines,
    ranges,
    userId,
    source
  ) {
    if (!SafePath.isCleanFilename(docName)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    // Put doc in docstore first, so that if it errors, we don't have a doc_id in the project
    // which hasn't been created in docstore.
    const doc = new Doc({ name: docName })
    const { rev } = await DocstoreManager.promises.updateDoc(
      projectId.toString(),
      doc._id.toString(),
      docLines,
      0,
      ranges
    )

    doc.rev = rev
    return {
      projectId,
      folderId,
      doc,
      docName,
      docLines,
      ranges,
      userId,
      source,
    }
  },
  async withLock({
    projectId,
    folderId,
    doc,
    docName,
    docLines,
    ranges,
    userId,
    source,
  }) {
    const { result, project } =
      await ProjectEntityUpdateHandler._addDocAndSendToTpds(
        projectId,
        folderId,
        doc
      )
    const docPath = result?.path?.fileSystem
    const projectHistoryId = project?.overleaf?.history?.id
    const newDocs = [
      {
        doc,
        path: docPath,
        docLines: docLines.join('\n'),
        ranges,
      },
    ]
    await DocumentUpdaterHandler.promises.updateProjectStructure(
      projectId,
      projectHistoryId,
      userId,
      { newDocs, newProject: project },
      source
    )
    return { doc, folderId: folderId || project.rootFolder[0]._id }
  },
})

const addFile = wrapWithLock({
  async beforeLock(
    projectId,
    folderId,
    fileName,
    fsPath,
    linkedFileData,
    userId,
    source
  ) {
    if (!SafePath.isCleanFilename(fileName)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    const { url, fileRef, createdBlob } =
      await ProjectEntityUpdateHandler._uploadFile(
        projectId,
        folderId,
        fileName,
        fsPath,
        linkedFileData
      )

    return {
      projectId,
      folderId,
      userId,
      fileRef,
      fileStoreUrl: url,
      createdBlob,
      source,
    }
  },
  async withLock({
    projectId,
    folderId,
    userId,
    fileRef,
    fileStoreUrl,
    createdBlob,
    source,
  }) {
    const { result, project } =
      await ProjectEntityUpdateHandler._addFileAndSendToTpds(
        projectId,
        folderId,
        fileRef
      )
    const projectHistoryId = project.overleaf?.history?.id
    const newFiles = [
      {
        createdBlob,
        file: fileRef,
        path: result && result.path && result.path.fileSystem,
        url: fileStoreUrl,
      },
    ]
    await DocumentUpdaterHandler.promises.updateProjectStructure(
      projectId,
      projectHistoryId,
      userId,
      { newFiles, newProject: project },
      source
    )

    ProjectUpdateHandler.promises
      .markAsUpdated(projectId, new Date(), userId)
      .catch(error => {
        logger.error({ error }, 'failed to mark project as updated')
      })
    return { fileRef, folderId, createdBlob }
  },
})

const upsertDoc = wrapWithLock(
  async function (projectId, folderId, docName, docLines, source, userId) {
    if (!SafePath.isCleanFilename(docName)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    let element, folderPath
    try {
      ;({ element, path: folderPath } =
        await ProjectLocator.promises.findElement({
          project_id: projectId,
          element_id: folderId,
          type: 'folder',
        }))
    } catch (error) {
      if (error instanceof Errors.NotFoundError) {
        throw new Error('folder_not_found')
      }
      throw error
    }

    if (element == null) {
      throw new Error("Couldn't find folder")
    }

    const existingDoc = element.docs.find(({ name }) => name === docName)
    const existingFile = element.fileRefs.find(({ name }) => name === docName)
    if (existingFile) {
      const doc = new Doc({ name: docName })
      const filePath = `${folderPath.fileSystem}/${existingFile.name}`
      const { rev } = await DocstoreManager.promises.updateDoc(
        projectId.toString(),
        doc._id.toString(),
        docLines,
        0,
        {}
      )

      doc.rev = rev
      const project =
        await ProjectEntityMongoUpdateHandler.promises.replaceFileWithDoc(
          projectId,
          existingFile._id,
          doc
        )

      await TpdsUpdateSender.promises.addDoc({
        projectId,
        docId: doc._id,
        path: filePath,
        projectName: project.name,
        rev: existingFile.rev + 1,
        folderId,
      })

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
      await DocumentUpdaterHandler.promises.updateProjectStructure(
        projectId,
        projectHistoryId,
        userId,
        { oldFiles, newDocs, newProject: project },
        source
      )

      EditorRealTimeController.emitToRoom(
        projectId,
        'removeEntity',
        existingFile._id,
        'convertFileToDoc'
      )
      return { doc, isNew: true }
    } else if (existingDoc) {
      const result = await DocumentUpdaterHandler.promises.setDocument(
        projectId,
        existingDoc._id,
        userId,
        docLines,
        source
      )
      logger.debug(
        { projectId, docId: existingDoc._id },
        'notifying users that the document has been updated'
      )
      // there is no need to flush the doc to mongo at this point as docupdater
      // flushes it as part of setDoc.
      //
      // combine rev from response with existing doc metadata
      return {
        doc: { ...existingDoc, ...result },
        isNew: existingDoc == null,
      }
    } else {
      const { doc } =
        await ProjectEntityUpdateHandler.promises.addDocWithRanges.withoutLock(
          projectId,
          folderId,
          docName,
          docLines,
          {},
          userId,
          source
        )

      return { doc, isNew: existingDoc == null }
    }
  }
)

const appendToDoc = wrapWithLock(
  async (projectId, docId, lines, source, userId) => {
    const { element } = await ProjectLocator.promises.findElement({
      project_id: projectId,
      element_id: docId,
      type: 'doc',
    })

    return await DocumentUpdaterHandler.promises.appendToDocument(
      projectId,
      element._id,
      userId,
      lines,
      source
    )
  }
)

const upsertFile = wrapWithLock({
  async beforeLock(
    projectId,
    folderId,
    fileName,
    fsPath,
    linkedFileData,
    userId,
    source
  ) {
    if (!SafePath.isCleanFilename(fileName)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    // create a new file
    const fileArgs = {
      name: fileName,
      linkedFileData,
    }
    const { url, fileRef, createdBlob } =
      await FileStoreHandler.promises.uploadFileFromDisk(
        projectId,
        fileArgs,
        fsPath
      )

    return {
      projectId,
      folderId,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      fileRef,
      fileStoreUrl: url,
      createdBlob,
      source,
    }
  },
  async withLock({
    projectId,
    folderId,
    fileName,
    userId,
    fileRef,
    fileStoreUrl,
    createdBlob,
    source,
  }) {
    let element
    try {
      ;({ element } = await ProjectLocator.promises.findElement({
        project_id: projectId,
        element_id: folderId,
        type: 'folder',
      }))
    } catch (error) {
      if (error instanceof Errors.NotFoundError) {
        throw new Error('folder_not_found')
      }
      throw error
    }

    if (element == null) {
      throw new Error("Couldn't find folder")
    }
    const existingFile = element.fileRefs.find(({ name }) => name === fileName)
    const existingDoc = element.docs.find(({ name }) => name === fileName)

    if (existingDoc) {
      let path
      try {
        ;({ path } = await ProjectLocator.promises.findElement({
          project_id: projectId,
          element_id: existingDoc._id,
          type: 'doc',
        }))
      } catch (err) {
        throw new Error("couldn't find existing file")
      }
      const project =
        await ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile(
          projectId,
          existingDoc._id,
          fileRef
        )
      const projectHistoryId = project.overleaf?.history?.id
      await TpdsUpdateSender.promises.addFile({
        projectId: project._id,
        historyId: projectHistoryId,
        fileId: fileRef._id,
        hash: fileRef.hash,
        path: path.fileSystem,
        rev: fileRef.rev,
        projectName: project.name,
        folderId,
      })
      await DocumentUpdaterHandler.promises.updateProjectStructure(
        projectId,
        projectHistoryId,
        userId,
        {
          oldDocs: [{ doc: existingDoc, path: path.fileSystem }],

          newFiles: [
            {
              createdBlob,
              file: fileRef,
              path: path.fileSystem,
              url: fileStoreUrl,
            },
          ],
          newProject: project,
        },
        source
      )
      EditorRealTimeController.emitToRoom(
        projectId,
        'removeEntity',
        existingDoc._id,
        'convertDocToFile'
      )
      return { fileRef, isNew: true, oldFileRef: existingFile }
    } else if (existingFile) {
      await ProjectEntityUpdateHandler._replaceFile(
        projectId,
        existingFile._id,
        userId,
        fileRef,
        fileStoreUrl,
        folderId,
        source,
        createdBlob
      )

      return { fileRef, isNew: false, oldFileRef: existingFile }
    } else {
      // this calls directly into the addFile main task (without the beforeLock part)
      await ProjectEntityUpdateHandler.promises.addFile.mainTask({
        projectId,
        folderId,
        userId,
        fileRef,
        fileStoreUrl,
        createdBlob,
        source,
      })

      return {
        fileRef,
        isNew: existingFile == null,
        oldFileRef: existingFile,
      }
    }
  },
})

const upsertDocWithPath = wrapWithLock(
  async function (projectId, elementPath, docLines, source, userId) {
    if (!SafePath.isCleanPath(elementPath)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    const docName = Path.basename(elementPath)
    const folderPath = Path.dirname(elementPath)
    const { newFolders, folder } =
      await ProjectEntityUpdateHandler.promises.mkdirp.withoutLock(
        projectId,
        folderPath
      )
    const { isNew, doc } =
      await ProjectEntityUpdateHandler.promises.upsertDoc.withoutLock(
        projectId,
        folder._id,
        docName,
        docLines,
        source,
        userId
      )

    return { doc, isNew, newFolders, folder }
  }
)

const upsertFileWithPath = wrapWithLock({
  async beforeLock(
    projectId,
    elementPath,
    fsPath,
    linkedFileData,
    userId,
    source
  ) {
    if (!SafePath.isCleanPath(elementPath)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    const fileName = Path.basename(elementPath)
    const folderPath = Path.dirname(elementPath)
    // create a new file
    const fileArgs = {
      name: fileName,
      linkedFileData,
    }
    const {
      url: fileStoreUrl,
      fileRef,
      createdBlob,
    } = await FileStoreHandler.promises.uploadFileFromDisk(
      projectId,
      fileArgs,
      fsPath
    )

    return {
      projectId,
      folderPath,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      fileRef,
      fileStoreUrl,
      createdBlob,
      source,
    }
  },
  async withLock({
    projectId,
    folderPath,
    fileName,
    fsPath,
    linkedFileData,
    userId,
    fileRef,
    fileStoreUrl,
    createdBlob,
    source,
  }) {
    const { newFolders, folder } =
      await ProjectEntityUpdateHandler.promises.mkdirp.withoutLock(
        projectId,
        folderPath
      )
    // this calls directly into the upsertFile main task (without the beforeLock part)
    const {
      fileRef: newFileRef,
      isNew,
      oldFileRef,
    } = await ProjectEntityUpdateHandler.promises.upsertFile.mainTask({
      projectId,
      folderId: folder._id,
      fileName,
      fsPath,
      linkedFileData,
      userId,
      fileRef,
      fileStoreUrl,
      createdBlob,
      source,
    })

    return {
      fileRef: newFileRef,
      isNew,
      oldFileRef,
      newFolders,
      folder,
    }
  },
})

const deleteEntity = wrapWithLock(
  async function (projectId, entityId, entityType, userId, source, callback) {
    logger.debug({ entityId, entityType, projectId }, 'deleting project entity')
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', projectId, entityId })
      throw new Error('No entityType set')
    }
    entityType = entityType.toLowerCase()

    // Flush the entire project to avoid leaving partially deleted docs in redis.
    await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)

    const { entity, path, projectBeforeDeletion, newProject } =
      await ProjectEntityMongoUpdateHandler.promises.deleteEntity(
        projectId,
        entityId,
        entityType
      )
    const subtreeListing = await ProjectEntityUpdateHandler._cleanUpEntity(
      projectBeforeDeletion,
      newProject,
      entity,
      entityType,
      path.fileSystem,
      userId,
      source
    )

    const subtreeEntityIds = subtreeListing.map(entry =>
      entry.entity._id.toString()
    )
    await TpdsUpdateSender.promises.deleteEntity({
      projectId,
      path: path.fileSystem,
      projectName: projectBeforeDeletion.name,
      entityId,
      entityType,
      subtreeEntityIds,
    })

    return entityId
  }
)

const deleteEntityWithPath = wrapWithLock(
  async (projectId, path, userId, source) => {
    const { element, type } = await ProjectLocator.promises.findElementByPath({
      project_id: projectId,
      path,
      exactCaseMatch: true,
    })
    if (element == null) {
      throw new Errors.NotFoundError('project not found')
    }
    return await ProjectEntityUpdateHandler.promises.deleteEntity.withoutLock(
      projectId,
      element._id,
      type,
      userId,
      source
    )
  }
)

const mkdirp = wrapWithLock(async function (projectId, path) {
  for (const folder of path.split('/')) {
    if (folder.length > 0 && !SafePath.isCleanFilename(folder)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
  }
  return await ProjectEntityMongoUpdateHandler.promises.mkdirp(
    projectId,
    path,
    { exactCaseMatch: false }
  )
})

const mkdirpWithExactCase = wrapWithLock(async function (projectId, path) {
  for (const folder of path.split('/')) {
    if (folder.length > 0 && !SafePath.isCleanFilename(folder)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
  }
  return await ProjectEntityMongoUpdateHandler.promises.mkdirp(
    projectId,
    path,
    { exactCaseMatch: true }
  )
})

const addFolder = wrapWithLock(
  async function (projectId, parentFolderId, folderName) {
    if (!SafePath.isCleanFilename(folderName)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    return await ProjectEntityMongoUpdateHandler.promises.addFolder(
      projectId,
      parentFolderId,
      folderName
    )
  }
)

const moveEntity = wrapWithLock(
  async function (
    projectId,
    entityId,
    destFolderId,
    entityType,
    userId,
    source
  ) {
    logger.debug(
      { entityType, entityId, projectId, destFolderId },
      'moving entity'
    )
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', projectId, entityId })
      throw new Error('No entityType set')
    }
    entityType = entityType.toLowerCase()
    await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)
    const { project, startPath, endPath, rev, changes } =
      await ProjectEntityMongoUpdateHandler.promises.moveEntity(
        projectId,
        entityId,
        destFolderId,
        entityType
      )

    const projectHistoryId = project.overleaf?.history?.id
    try {
      await TpdsUpdateSender.promises.moveEntity({
        projectId,
        projectName: project.name,
        startPath,
        endPath,
        rev,
        entityId,
        entityType,
        folderId: destFolderId,
      })
    } catch (err) {
      logger.error({ err }, 'error sending tpds update')
    }

    return await DocumentUpdaterHandler.promises.updateProjectStructure(
      projectId,
      projectHistoryId,
      userId,
      changes,
      source
    )
  }
)

const renameEntity = wrapWithLock(
  async function (projectId, entityId, entityType, newName, userId, source) {
    if (!newName || typeof newName !== 'string') {
      const err = new OError('invalid newName value', {
        value: newName,
        type: typeof newName,
        projectId,
        entityId,
        entityType,
        userId,
        source,
      })
      logger.error({ err }, 'Invalid newName passed to renameEntity')
      throw err
    }
    if (!SafePath.isCleanFilename(newName)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    logger.debug({ entityId, projectId }, `renaming ${entityType}`)
    if (entityType == null) {
      logger.warn({ err: 'No entityType set', projectId, entityId })
      throw new Error('No entityType set')
    }
    entityType = entityType.toLowerCase()
    await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)
    const { project, startPath, endPath, rev, changes } =
      await ProjectEntityMongoUpdateHandler.promises.renameEntity(
        projectId,
        entityId,
        entityType,
        newName
      )

    const projectHistoryId = project.overleaf?.history?.id
    try {
      await TpdsUpdateSender.promises.moveEntity({
        projectId,
        projectName: project.name,
        startPath,
        endPath,
        rev,
        entityId,
        entityType,
        folderId: null, // this means the folder has not changed
      })
    } catch (err) {
      logger.error({ err }, 'error sending tpds update')
    }
    return await DocumentUpdaterHandler.promises.updateProjectStructure(
      projectId,
      projectHistoryId,
      userId,
      changes,
      source
    )
  }
)

// This doesn't directly update project structure, but we need to take the lock
// to prevent anything else being queued before the resync update
const resyncProjectHistory = wrapWithLock(
  async (projectId, opts) => {
    const project = await ProjectGetter.promises.getProject(projectId, {
      rootFolder: true,
      overleaf: true,
    })
    const projectHistoryId = project.overleaf?.history?.id
    if (projectHistoryId == null) {
      throw new Errors.ProjectHistoryDisabledError(
        `project history not enabled for ${projectId}`
      )
    }

    const { docs, files, folders } =
      ProjectEntityHandler.getAllEntitiesFromProject(project)
    // _checkFileTree() must be passed the folders before docs and
    // files
    await ProjectEntityUpdateHandler._checkFiletree(
      projectId,
      projectHistoryId,
      [...folders, ...docs, ...files]
    )

    await DocumentUpdaterHandler.promises.resyncProjectHistory(
      projectId,
      projectHistoryId,
      docs,
      files,
      opts
    )
    if (opts.historyRangesMigration) {
      return await ProjectOptionsHandler.promises.setHistoryRangesSupport(
        projectId,
        opts.historyRangesMigration === 'forwards'
      )
    }
  },
  LockManager.withTimeout(6 * 60) // use an extended lock for the resync operations
)

const convertDocToFile = wrapWithLock({
  async beforeLock(projectId, docId, userId, source) {
    await DocumentUpdaterHandler.promises.flushDocToMongo(projectId, docId)
    const { element: doc, path } = await ProjectLocator.promises.findElement({
      project_id: projectId,
      element_id: docId,
      type: 'doc',
    })
    const docPath = path.fileSystem
    const { lines, rev, ranges } = await DocstoreManager.promises.getDoc(
      projectId,
      docId
    )
    if (!_.isEmpty(ranges)) {
      throw new Errors.DocHasRangesError({})
    }
    await DocumentUpdaterHandler.promises.deleteDoc(projectId, docId, false)
    const fsPath = await FileWriter.promises.writeLinesToDisk(projectId, lines)
    const {
      url: fileStoreUrl,
      fileRef,
      createdBlob,
    } = await FileStoreHandler.promises.uploadFileFromDisk(
      projectId,
      { name: doc.name, rev: rev + 1 },
      fsPath
    )
    try {
      await fs.promises.unlink(fsPath)
    } catch (err) {
      logger.warn({ err, path: fsPath }, 'failed to clean up temporary file')
    }
    return {
      projectId,
      doc,
      path: docPath,
      fileRef,
      fileStoreUrl,
      userId,
      source,
      createdBlob,
    }
  },
  async withLock({
    projectId,
    doc,
    path,
    fileRef,
    fileStoreUrl,
    userId,
    source,
    createdBlob,
  }) {
    const project =
      await ProjectEntityMongoUpdateHandler.promises.replaceDocWithFile(
        projectId,
        doc._id,
        fileRef
      )
    const projectHistoryId = project.overleaf?.history?.id
    await DocumentUpdaterHandler.promises.updateProjectStructure(
      projectId,
      projectHistoryId,
      userId,
      {
        oldDocs: [{ doc, path }],
        newFiles: [{ file: fileRef, path, url: fileStoreUrl, createdBlob }],
        newProject: project,
      },
      source
    )
    const { folder } = await ProjectLocator.promises.findElement({
      project_id: projectId,
      element_id: fileRef._id,
      type: 'file',
    })
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
    return fileRef
  },
})

async function setMainBibliographyDoc(projectId, newBibliographyDocId) {
  logger.debug(
    { projectId, mainBibliographyDocId: newBibliographyDocId },
    'setting main bibliography doc'
  )
  if (projectId == null || newBibliographyDocId == null) {
    throw new Errors.InvalidError('missing arguments (project or doc)')
  }
  const docPath =
    await ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
      projectId,
      newBibliographyDocId
    )
  if (ProjectEntityUpdateHandler.isPathValidForMainBibliographyDoc(docPath)) {
    await Project.updateOne(
      { _id: projectId },
      { mainBibliographyDoc_id: newBibliographyDocId }
    ).exec()
  } else {
    throw new Errors.UnsupportedFileTypeError(
      'invalid file extension for main bibliography doc'
    )
  }
}

const ProjectEntityUpdateHandler = {
  LOCK_NAMESPACE,

  addDoc: callbackifyMultiResult(addDoc, ['doc', 'folderId']),

  addDocWithRanges: callbackifyMultiResult(addDocWithRanges, [
    'doc',
    'folderId',
  ]),

  addFile: callbackifyMultiResult(addFile, [
    'fileRef',
    'folderId',
    'createdBlob',
  ]),

  addFolder: callbackifyMultiResult(addFolder, ['folder', 'parentFolderId']),

  convertDocToFile: callbackify(convertDocToFile),

  deleteEntity: callbackify(deleteEntity),

  deleteEntityWithPath: callbackify(deleteEntityWithPath),

  mkdirp: callbackifyMultiResult(mkdirp, [
    'newFolders',
    'folder',
    'parentFolder',
  ]),

  mkdirpWithExactCase: callbackifyMultiResult(mkdirpWithExactCase, [
    'newFolders',
    'folder',
    'parentFolder',
  ]),

  moveEntity: callbackify(moveEntity),

  renameEntity: callbackify(renameEntity),

  resyncProjectHistory: callbackify(resyncProjectHistory),

  setRootDoc: callbackify(setRootDoc),

  unsetRootDoc: callbackify(unsetRootDoc),

  setMainBibliographyDoc: callbackify(setMainBibliographyDoc),

  updateDocLines: callbackify(updateDocLines),

  upsertDoc: callbackifyMultiResult(upsertDoc, ['doc', 'isNew']),

  appendToDoc: callbackify(appendToDoc),

  upsertDocWithPath: callbackifyMultiResult(upsertDocWithPath, [
    'doc',
    'isNew',
    'newFolders',
    'folder',
  ]),

  upsertFile: callbackifyMultiResult(upsertFile, [
    'fileRef',
    'isNew',
    'oldFileRef',
  ]),

  upsertFileWithPath: callbackifyMultiResult(upsertFileWithPath, [
    'fileRef',
    'isNew',
    'oldFileRef',
    'newFolders',
    'folder',
  ]),

  promises: {
    addDoc,
    addDocWithRanges,
    addFile,
    addFolder,
    convertDocToFile,
    deleteEntity,
    deleteEntityWithPath,
    mkdirp,
    mkdirpWithExactCase,
    moveEntity,
    renameEntity,
    resyncProjectHistory,
    setRootDoc,
    unsetRootDoc,
    updateDocLines,
    upsertDoc,
    upsertDocWithPath,
    upsertFile,
    upsertFileWithPath,
    appendToDocWithPath: appendToDoc,
  },

  async _addDocAndSendToTpds(projectId, folderId, doc) {
    let result, project
    try {
      ;({ result, project } =
        await ProjectEntityMongoUpdateHandler.promises.addDoc(
          projectId,
          folderId,
          doc
        ))
    } catch (err) {
      throw OError.tag(err, 'error adding file with project', {
        projectId,
        folderId,
        doc_name: doc != null ? doc.name : undefined,
        doc_id: doc != null ? doc._id : undefined,
      })
    }

    await TpdsUpdateSender.promises.addDoc({
      projectId,
      docId: doc != null ? doc._id : undefined,
      path: result?.path?.fileSystem,
      projectName: project.name,
      rev: 0,
      folderId,
    })
    return { result, project }
  },

  async _uploadFile(projectId, folderId, fileName, fsPath, linkedFileData) {
    if (!SafePath.isCleanFilename(fileName)) {
      throw new Errors.InvalidNameError('invalid element name')
    }
    const fileArgs = {
      name: fileName,
      linkedFileData,
    }
    try {
      return await FileStoreHandler.promises.uploadFileFromDisk(
        projectId,
        fileArgs,
        fsPath
      )
    } catch (err) {
      throw OError.tag(err, 'error uploading image to s3', {
        projectId,
        folderId,
        file_name: fileName,
      })
    }
  },

  async _addFileAndSendToTpds(projectId, folderId, fileRef) {
    let result, project
    try {
      ;({ result, project } =
        await ProjectEntityMongoUpdateHandler.promises.addFile(
          projectId,
          folderId,
          fileRef
        ))
    } catch (err) {
      throw OError.tag(err, 'error adding file with project', {
        projectId,
        folderId,
        file_name: fileRef.name,
        fileRef,
      })
    }

    const historyId = project?.overleaf?.history?.id
    if (!historyId) {
      throw new OError('project does not have a history id', { projectId })
    }
    await TpdsUpdateSender.promises.addFile({
      projectId,
      historyId,
      fileId: fileRef._id,
      hash: fileRef.hash,
      path: result?.path?.fileSystem,
      projectName: project.name,
      rev: fileRef.rev,
      folderId,
    })
    return { result, project }
  },

  async _replaceFile(
    projectId,
    fileId,
    userId,
    newFileRef,
    fileStoreUrl,
    folderId,
    source,
    createdBlob
  ) {
    const {
      oldFileRef,
      project,
      path,
      newProject,
      newFileRef: updatedFileRef,
    } = await ProjectEntityMongoUpdateHandler.promises.replaceFileWithNew(
      projectId,
      fileId,
      newFileRef
    )

    const oldFiles = [
      {
        file: oldFileRef,
        path: path.fileSystem,
      },
    ]
    const newFiles = [
      {
        file: updatedFileRef,
        createdBlob,
        path: path.fileSystem,
        url: fileStoreUrl,
      },
    ]
    const projectHistoryId = project.overleaf?.history?.id
    await TpdsUpdateSender.promises.addFile({
      projectId: project._id,
      historyId: projectHistoryId,
      fileId: updatedFileRef._id,
      hash: updatedFileRef.hash,
      path: path.fileSystem,
      rev: updatedFileRef.rev,
      projectName: project.name,
      folderId,
    })
    ProjectUpdateHandler.promises
      .markAsUpdated(projectId, new Date(), userId)
      .catch(error => {
        logger.error({ error }, 'failed to mark project as updated')
      })

    await DocumentUpdaterHandler.promises.updateProjectStructure(
      projectId,
      projectHistoryId,
      userId,
      { oldFiles, newFiles, newProject },
      source
    )

    return updatedFileRef
  },

  async _checkFiletree(projectId, projectHistoryId, entities) {
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
      return
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

    // Avoid conflicts by processing renames in the reverse order. If we have
    // the following starting situation:
    //
    // somefile.tex
    // somefile.tex
    // somefile.tex (1)
    //
    // somefile.tex would be processed first, and then somefile.tex (1),
    // yielding the following renames:
    //
    // somefile.tex -> somefile.tex (1)
    // somefile.tex (1) -> somefile.tex (2)
    //
    // When the first rename was decided, we didn't know that somefile.tex (1)
    // existed, so that created a conflict. By processing renames in the
    // reverse order, we start with the files that had the most extensive
    // information about existing files.
    renames.reverse()

    for (const rename of renames) {
      // rename the duplicate files
      const entity = rename.entity
      const entityId = entity.folder
        ? entity.folder._id
        : entity.doc
          ? entity.doc._id
          : entity.file._id
      const entityType = entity.folder ? 'folder' : entity.doc ? 'doc' : 'file'
      const { changes } =
        await ProjectEntityMongoUpdateHandler.promises.renameEntity(
          projectId,
          entityId,
          entityType,
          rename.newName
        )

      // update the renamed entity for the resync
      entity.path = rename.newPath
      if (entityType === 'folder') {
        entity.folder.name = rename.newName
      } else if (entityType === 'doc') {
        entity.doc.name = rename.newName
      } else {
        entity.file.name = rename.newName
      }
      await DocumentUpdaterHandler.promises.updateProjectStructure(
        projectId,
        projectHistoryId,
        null,
        changes,
        'automatic-fix'
      )
    }
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

  isPathValidForMainBibliographyDoc(docPath) {
    const docExtension = Path.extname(docPath).toLowerCase()
    return docExtension === '.bib'
  },

  async _cleanUpEntity(
    project,
    newProject,
    entity,
    entityType,
    path,
    userId,
    source
  ) {
    const subtreeListing = _listSubtree(entity, entityType, path)
    await ProjectEntityUpdateHandler._updateProjectStructureWithDeletedEntity(
      project,
      newProject,
      subtreeListing,
      userId,
      source
    )

    for (const entry of subtreeListing) {
      if (entry.type === 'doc') {
        await ProjectEntityUpdateHandler._cleanUpDoc(
          project,
          entry.entity,
          entry.path,
          userId
        )
      } else if (entry.type === 'file') {
        await ProjectEntityUpdateHandler._cleanUpFile(project, entry.entity)
      }
    }
    return subtreeListing
  },

  async _updateProjectStructureWithDeletedEntity(
    project,
    newProject,
    subtreeListing,
    userId,
    source
  ) {
    const changes = { oldDocs: [], oldFiles: [] }
    for (const entry of subtreeListing) {
      if (entry.type === 'doc') {
        changes.oldDocs.push({ doc: entry.entity, path: entry.path })
      } else if (entry.type === 'file') {
        changes.oldFiles.push({ file: entry.entity, path: entry.path })
      }
    }

    // now send the project structure changes to the docupdater
    changes.newProject = newProject
    const projectId = project._id.toString()
    const projectHistoryId =
      project.overleaf &&
      project.overleaf.history &&
      project.overleaf.history.id
    return await DocumentUpdaterHandler.promises.updateProjectStructure(
      projectId,
      projectHistoryId,
      userId,
      changes,
      source
    )
  },

  async _cleanUpDoc(project, doc) {
    const projectId = project._id.toString()
    const docId = doc._id.toString()
    if (project.rootDoc_id != null && project.rootDoc_id.toString() === docId) {
      await ProjectEntityUpdateHandler.promises.unsetRootDoc(projectId)
    }

    const { name } = doc
    const deletedAt = new Date()
    await DocstoreManager.promises.deleteDoc(projectId, docId, name, deletedAt)

    return await DocumentUpdaterHandler.promises.deleteDoc(projectId, docId)
  },

  async _cleanUpFile(project, file) {
    return await ProjectEntityMongoUpdateHandler.promises._insertDeletedFileReference(
      project._id,
      file
    )
  },
}

/**
 * List all descendants of an entity along with their type and path. Include
 * the top-level entity as well.
 */
function _listSubtree(entity, entityType, entityPath) {
  if (entityType.indexOf('file') !== -1) {
    return [{ type: 'file', entity, path: entityPath }]
  } else if (entityType.indexOf('doc') !== -1) {
    return [{ type: 'doc', entity, path: entityPath }]
  } else if (entityType.indexOf('folder') !== -1) {
    const listing = []
    const _recurseFolder = (folder, folderPath) => {
      listing.push({ type: 'folder', entity: folder, path: folderPath })
      for (const doc of iterablePaths(folder, 'docs')) {
        listing.push({
          type: 'doc',
          entity: doc,
          path: Path.join(folderPath, doc.name),
        })
      }
      for (const file of iterablePaths(folder, 'fileRefs')) {
        listing.push({
          type: 'file',
          entity: file,
          path: Path.join(folderPath, file.name),
        })
      }
      for (const childFolder of iterablePaths(folder, 'folders')) {
        _recurseFolder(childFolder, Path.join(folderPath, childFolder.name))
      }
    }
    _recurseFolder(entity, entityPath)
    return listing
  } else {
    // This shouldn't happen, but if it does, fail silently.
    return []
  }
}

module.exports = ProjectEntityUpdateHandler
