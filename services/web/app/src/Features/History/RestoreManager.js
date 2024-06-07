const Settings = require('@overleaf/settings')
const Path = require('path')
const FileWriter = require('../../infrastructure/FileWriter')
const FileSystemImportManager = require('../Uploads/FileSystemImportManager')
const EditorController = require('../Editor/EditorController')
const Errors = require('../Errors/Errors')
const moment = require('moment')
const { callbackifyAll } = require('@overleaf/promise-utils')
const { fetchJson } = require('@overleaf/fetch-utils')
const ProjectLocator = require('../Project/ProjectLocator')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const ChatApiHandler = require('../Chat/ChatApiHandler')
const DocstoreManager = require('../Docstore/DocstoreManager')
const logger = require('@overleaf/logger')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const ChatManager = require('../Chat/ChatManager')

const RestoreManager = {
  async restoreFileFromV2(userId, projectId, version, pathname) {
    const fsPath = await RestoreManager._writeFileVersionToDisk(
      projectId,
      version,
      pathname
    )
    const basename = Path.basename(pathname)
    let dirname = Path.dirname(pathname)
    if (dirname === '.') {
      // no directory
      dirname = ''
    }
    const parentFolderId = await RestoreManager._findOrCreateFolder(
      projectId,
      dirname
    )
    const addEntityWithName = async name =>
      await FileSystemImportManager.promises.addEntity(
        userId,
        projectId,
        parentFolderId,
        name,
        fsPath,
        false
      )
    return await RestoreManager._addEntityWithUniqueName(
      addEntityWithName,
      basename
    )
  },

  async revertFile(userId, projectId, version, pathname) {
    const source = 'file-revert'
    const fsPath = await RestoreManager._writeFileVersionToDisk(
      projectId,
      version,
      pathname
    )
    const basename = Path.basename(pathname)
    let dirname = Path.dirname(pathname)
    if (dirname === '.') {
      // root directory
      dirname = '/'
    }
    const parentFolderId = await RestoreManager._findOrCreateFolder(
      projectId,
      dirname
    )
    const file = await ProjectLocator.promises
      .findElementByPath({
        project_id: projectId,
        path: pathname,
      })
      .catch(() => null)

    const importInfo = await FileSystemImportManager.promises.importFile(
      fsPath,
      pathname
    )
    if (importInfo.type === 'file') {
      const newFile = await EditorController.promises.upsertFile(
        projectId,
        parentFolderId,
        basename,
        fsPath,
        file?.element?.linkedFileData,
        source,
        userId
      )

      return {
        _id: newFile._id,
        type: importInfo.type,
      }
    }

    if (file) {
      await DocumentUpdaterHandler.promises.setDocument(
        projectId,
        file.element._id,
        userId,
        importInfo.lines,
        source
      )
      return {
        _id: file.element._id,
        type: importInfo.type,
      }
    }

    const ranges = await RestoreManager._getRangesFromHistory(
      projectId,
      version,
      pathname
    )

    const documentCommentIds = new Set(
      ranges.comments?.map(({ op: { t } }) => t)
    )

    await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)

    const docsWithRanges =
      await DocstoreManager.promises.getAllRanges(projectId)

    const nonOrphanedThreadIds = new Set()
    for (const { ranges } of docsWithRanges) {
      for (const comment of ranges.comments ?? []) {
        nonOrphanedThreadIds.add(comment.op.t)
      }
    }

    const commentIdsToDuplicate = Array.from(documentCommentIds).filter(id =>
      nonOrphanedThreadIds.has(id)
    )

    const newRanges = { changes: ranges.changes, comments: [] }

    if (commentIdsToDuplicate.length > 0) {
      const { newThreads: newCommentIds } =
        await ChatApiHandler.promises.duplicateCommentThreads(
          projectId,
          commentIdsToDuplicate
        )

      logger.debug({ mapping: newCommentIds }, 'replacing comment threads')

      for (const comment of ranges.comments ?? []) {
        if (Object.prototype.hasOwnProperty.call(newCommentIds, comment.op.t)) {
          const result = newCommentIds[comment.op.t]
          if (result.error) {
            // We couldn't duplicate the thread, so we need to delete it from
            // the resulting ranges.
            continue
          }
          // We have a new id for this comment thread
          comment.op.t = result.duplicateId
          newRanges.comments.push(comment)
        }
      }
    } else {
      newRanges.comments = ranges.comments
    }

    const newCommentThreadData =
      await ChatApiHandler.promises.generateThreadData(
        projectId,
        newRanges.comments.map(({ op: { t } }) => t)
      )
    await ChatManager.promises.injectUserInfoIntoThreads(newCommentThreadData)
    logger.debug({ newCommentThreadData }, 'emitting new comment threads')
    EditorRealTimeController.emitToRoom(
      projectId,
      'new-comment-threads',
      newCommentThreadData
    )

    return await EditorController.promises.addDocWithRanges(
      projectId,
      parentFolderId,
      basename,
      importInfo.lines,
      newRanges,
      'revert',
      userId
    )
  },

  async _findOrCreateFolder(projectId, dirname) {
    const { lastFolder } = await EditorController.promises.mkdirp(
      projectId,
      dirname
    )
    return lastFolder?._id
  },

  async _addEntityWithUniqueName(addEntityWithName, basename) {
    try {
      return await addEntityWithName(basename)
    } catch (error) {
      if (error instanceof Errors.InvalidNameError) {
        // likely a duplicate name, so try with a prefix
        const date = moment(new Date()).format('Do MMM YY H:mm:ss')
        // Move extension to the end so the file type is preserved
        const extension = Path.extname(basename)
        basename = Path.basename(basename, extension)
        basename = `${basename} (Restored on ${date})`
        if (extension !== '') {
          basename = `${basename}${extension}`
        }
        return await addEntityWithName(basename)
      } else {
        throw error
      }
    }
  },

  async _writeFileVersionToDisk(projectId, version, pathname) {
    const url = `${
      Settings.apis.project_history.url
    }/project/${projectId}/version/${version}/${encodeURIComponent(pathname)}`
    return await FileWriter.promises.writeUrlToDisk(projectId, url)
  },

  async _getRangesFromHistory(projectId, version, pathname) {
    const url = `${
      Settings.apis.project_history.url
    }/project/${projectId}/ranges/version/${version}/${encodeURIComponent(pathname)}`
    return await fetchJson(url)
  },
}

module.exports = { ...callbackifyAll(RestoreManager), promises: RestoreManager }
