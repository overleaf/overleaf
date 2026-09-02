import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import _ from 'lodash'
import LinkedFilesHandler from './LinkedFilesHandler.mjs'
import LinkedFilesErrors from './LinkedFilesErrors.mjs'
import { callbackify } from '@overleaf/promise-utils'
import HistoryManager from '../History/HistoryManager.mjs'
import HistoryBlobStore from '../History/HistoryBlobStore.mjs'
import * as HistoryOTContentManager from '../History/HistoryOTContentManager.mjs'
import Errors from '../Errors/Errors.js'

const {
  BadDataError,
  AccessDeniedError,
  BadEntityTypeError,
  SourceFileNotFoundError,
} = LinkedFilesErrors

async function createLinkedFile(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId,
  historySource
) {
  if (!_canCreate(linkedFileData)) {
    throw new AccessDeniedError()
  }
  return await _go(
    projectId,
    linkedFileData,
    name,
    parentFolderId,
    userId,
    historySource
  )
}

async function refreshLinkedFile(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId,
  historySource
) {
  return await _go(
    projectId,
    linkedFileData,
    name,
    parentFolderId,
    userId,
    historySource
  )
}

async function _go(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId,
  historySource
) {
  linkedFileData = _sanitizeData(linkedFileData)
  await _prepare(projectId, linkedFileData, userId)
  const sourceProject =
    await LinkedFilesHandler.promises.getSourceProject(linkedFileData)
  const file = historySource
    ? await _importFromHistory(
        projectId,
        sourceProject,
        linkedFileData,
        name,
        parentFolderId,
        userId
      )
    : await _importFromProject(
        projectId,
        sourceProject,
        linkedFileData,
        name,
        parentFolderId,
        userId
      )
  return file._id
}

async function _prepare(projectId, linkedFileData, userId) {
  const allowed = await _checkAuth(projectId, linkedFileData, userId)
  if (!allowed) {
    throw new AccessDeniedError()
  }
  if (!_validate(linkedFileData)) {
    throw new BadDataError()
  }
}

/**
 * Read the source content from the source project's docs and files in mongo.
 */
async function _importFromProject(
  projectId,
  sourceProject,
  linkedFileData,
  name,
  parentFolderId,
  userId
) {
  const sourceProjectId = sourceProject._id
  await DocumentUpdaterHandler.promises.flushProjectToMongo(sourceProjectId)

  let entity, type
  try {
    ;({ element: entity, type } =
      await ProjectLocator.promises.findElementByPath({
        project_id: sourceProjectId,
        path: linkedFileData.source_entity_path,
        exactCaseMatch: true,
      }))
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      throw new SourceFileNotFoundError()
    }
    throw err
  }

  if (type === 'doc') {
    const { lines } = await DocstoreManager.promises.getDoc(
      sourceProjectId,
      entity._id
    )
    return await LinkedFilesHandler.promises.importContent(
      projectId,
      lines.join('\n'),
      linkedFileData,
      name,
      parentFolderId,
      userId
    )
  } else if (type === 'file') {
    const { stream } = await HistoryManager.promises.requestBlob(
      sourceProject.overleaf.history.id,
      entity.hash
    )
    return await LinkedFilesHandler.promises.importFromStream(
      projectId,
      stream,
      linkedFileData,
      name,
      parentFolderId,
      userId
    )
  } else {
    throw new BadEntityTypeError()
  }
}

/**
 * Read the source content from the latest snapshot in the source project's
 * history, where docs and files are both plain files.
 */
async function _importFromHistory(
  projectId,
  sourceProject,
  linkedFileData,
  name,
  parentFolderId,
  userId
) {
  const sourceProjectId = sourceProject._id
  const sourceHistoryId = sourceProject.overleaf.history.id

  // The snapshot only contains what has reached history, so push any pending
  // updates through document-updater and project-history first.
  await DocumentUpdaterHandler.promises.flushProjectToMongo(sourceProjectId)
  await HistoryManager.promises.flushProject(sourceProjectId)

  const { snapshot } =
    await HistoryOTContentManager.getLatestSnapshot(sourceHistoryId)

  // Paths in the project tree are absolute (/main.tex), history pathnames are
  // relative (main.tex).
  const pathname = linkedFileData.source_entity_path.replace(/^\//, '')
  const file = snapshot.getFile(pathname)
  if (!file) {
    if (
      snapshot
        .getFilePathnames()
        .some(other => other.startsWith(`${pathname}/`))
    ) {
      // History has no folder entities, a folder is only visible as the prefix
      // of the pathnames below it.
      throw new BadEntityTypeError()
    }
    throw new SourceFileNotFoundError()
  }

  // An eager load applies any edit operations that are not part of a blob yet.
  // It only reads a blob for an editable file, the other kinds resolve to
  // themselves.
  await file.load('eager', new HistoryBlobStore(sourceHistoryId))

  const hash = file.getHash()
  if (hash) {
    // A file that is not editable is content-addressed by a single blob, so
    // stream it rather than holding it in memory.
    const { stream } = await HistoryManager.promises.requestBlob(
      sourceHistoryId,
      hash
    )
    return await LinkedFilesHandler.promises.importFromStream(
      projectId,
      stream,
      linkedFileData,
      name,
      parentFolderId,
      userId
    )
  }

  return await LinkedFilesHandler.promises.importContent(
    projectId,
    file.getContent({ filterTrackedDeletes: true }),
    linkedFileData,
    name,
    parentFolderId,
    userId
  )
}

function _sanitizeData(data) {
  return _.pick(
    data,
    'provider',
    'source_project_id',
    'v1_source_doc_id',
    'source_entity_path',
    'importedAt'
  )
}

function _validate(data) {
  return (
    (data.source_project_id != null || data.v1_source_doc_id != null) &&
    data.source_entity_path != null
  )
}

function _canCreate(data) {
  // Don't allow creation of linked-files with v1 doc ids
  return data.v1_source_doc_id == null
}

async function _checkAuth(projectId, data, currentUserId) {
  if (!_validate(data)) {
    throw new BadDataError()
  }
  const project = await LinkedFilesHandler.promises.getSourceProject(data)
  return await AuthorizationManager.promises.canUserReadProject(
    currentUserId,
    project._id,
    null
  )
}

export default {
  createLinkedFile: callbackify(createLinkedFile),
  refreshLinkedFile: callbackify(refreshLinkedFile),
  promises: { createLinkedFile, refreshLinkedFile },
  _sanitizeData,
  _validate,
  _canCreate,
  _getSourceProject: LinkedFilesHandler.getSourceProject,
  _checkAuth: callbackify(_checkAuth),
}
