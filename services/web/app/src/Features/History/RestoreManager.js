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
const OError = require('@overleaf/o-error')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')

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

  async revertFile(userId, projectId, version, pathname, options = {}) {
    const project = await ProjectGetter.promises.getProject(projectId, {
      overleaf: true,
    })
    if (!project?.overleaf?.history?.rangesSupportEnabled) {
      throw new OError('project does not have ranges support', { projectId })
    }

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

    const updates = await RestoreManager._getUpdatesFromHistory(
      projectId,
      version
    )
    const updateAtVersion = updates.find(update => update.toV === version)

    const origin = options.origin || {
      kind: 'file-restore',
      path: pathname,
      version,
      timestamp: new Date(updateAtVersion.meta.end_ts).toISOString(),
    }

    const importInfo = await FileSystemImportManager.promises.importFile(
      fsPath,
      pathname
    )

    if (file) {
      if (file.type !== 'doc' && file.type !== 'file') {
        throw new OError('unexpected file type', { type: file.type })
      }
      logger.debug(
        { projectId, fileId: file.element._id, type: importInfo.type },
        'deleting entity before reverting it'
      )
      await EditorController.promises.deleteEntity(
        projectId,
        file.element._id,
        file.type,
        origin,
        userId
      )
    }

    const { metadata } = await RestoreManager._getMetadataFromHistory(
      projectId,
      version,
      pathname
    )

    // Look for metadata indicating a linked file.
    const isFileMetadata = metadata && 'provider' in metadata

    logger.debug({ metadata }, 'metadata from history')

    if (importInfo.type === 'file' || isFileMetadata) {
      const newFile = await EditorController.promises.upsertFile(
        projectId,
        parentFolderId,
        basename,
        fsPath,
        metadata,
        origin,
        userId
      )

      return {
        _id: newFile._id,
        type: 'file',
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
        }
        newRanges.comments.push(comment)
      }
    } else {
      newRanges.comments = ranges.comments
    }

    const newCommentThreadData =
      await ChatApiHandler.promises.generateThreadData(
        projectId,
        newRanges.comments.map(({ op: { t } }) => t)
      )

    // Resolve/reopen threads in chat service to match what is in history
    for (const commentRange of newRanges.comments) {
      const threadData = newCommentThreadData[commentRange.op.t]
      if (!threadData) {
        // comment thread was deleted
        continue
      }

      if (commentRange.op.resolved && threadData.resolved == null) {
        // The history snapshot stores the comment's resolved property as a boolean,
        // but it does not include information about who resolved the comment or the timestamp.
        // Until this is fixed, we will resolve the thread with the current user and the current timestamp.
        await ChatApiHandler.promises.resolveThread(
          projectId,
          commentRange.op.t,
          userId
        )
        threadData.resolved = true
        threadData.resolved_by_user_id = userId
        threadData.resolved_at = new Date().toISOString()
      } else if (!commentRange.op.resolved && threadData.resolved != null) {
        await ChatApiHandler.promises.reopenThread(projectId, commentRange.op.t)
        delete threadData.resolved
        delete threadData.resolved_by_user_id
        delete threadData.resolved_at
      }
      // remove the resolved property from the comment range as the chat service is synced at this point
      delete commentRange.op.resolved
    }

    await ChatManager.promises.injectUserInfoIntoThreads(newCommentThreadData)

    // Only keep restored comment ranges that point to a valid thread.
    // The chat service won't have generated thread data for deleted threads.
    newRanges.comments = newRanges.comments.filter(
      comment => newCommentThreadData[comment.op.t] != null
    )

    logger.debug({ newCommentThreadData }, 'emitting new comment threads')
    EditorRealTimeController.emitToRoom(
      projectId,
      'new-comment-threads',
      newCommentThreadData
    )

    const { _id } = await EditorController.promises.addDocWithRanges(
      projectId,
      parentFolderId,
      basename,
      importInfo.lines,
      newRanges,
      origin,
      userId
    )

    return {
      _id,
      type: importInfo.type,
    }
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
      if (error instanceof Errors.DuplicateNameError) {
        // Duplicate name, so try with a prefix
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

  async revertProject(userId, projectId, version) {
    const project = await ProjectGetter.promises.getProject(projectId, {
      overleaf: true,
    })
    if (!project?.overleaf?.history?.rangesSupportEnabled) {
      throw new OError('project does not have ranges support', { projectId })
    }

    // Get project paths at version
    const pathsAtPastVersion = await RestoreManager._getProjectPathsAtVersion(
      projectId,
      version
    )

    const updates = await RestoreManager._getUpdatesFromHistory(
      projectId,
      version
    )
    const updateAtVersion = updates.find(update => update.toV === version)

    const origin = {
      kind: 'project-restore',
      version,
      timestamp: new Date(updateAtVersion.meta.end_ts).toISOString(),
    }

    for (const pathname of pathsAtPastVersion) {
      await RestoreManager.revertFile(userId, projectId, version, pathname, {
        origin,
      })
    }

    const entitiesAtLiveVersion =
      await ProjectEntityHandler.promises.getAllEntities(projectId)

    const trimLeadingSlash = path => path.replace(/^\//, '')

    const pathsAtLiveVersion = entitiesAtLiveVersion.docs
      .map(doc => doc.path)
      .concat(entitiesAtLiveVersion.files.map(file => file.path))
      .map(trimLeadingSlash)

    // Delete files that were not present at the reverted version
    for (const path of pathsAtLiveVersion) {
      if (!pathsAtPastVersion.includes(path)) {
        await EditorController.promises.deleteEntityWithPath(
          projectId,
          path,
          origin,
          userId
        )
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

  async _getMetadataFromHistory(projectId, version, pathname) {
    const url = `${
      Settings.apis.project_history.url
    }/project/${projectId}/metadata/version/${version}/${encodeURIComponent(pathname)}`
    return await fetchJson(url)
  },

  async _getUpdatesFromHistory(projectId, version) {
    const url = `${Settings.apis.project_history.url}/project/${projectId}/updates?before=${version}&min_count=1`
    const res = await fetchJson(url)
    return res.updates
  },

  async _getProjectPathsAtVersion(projectId, version) {
    const url = `${Settings.apis.project_history.url}/project/${projectId}/paths/version/${version}`
    const res = await fetchJson(url)
    return res.paths
  },
}

module.exports = { ...callbackifyAll(RestoreManager), promises: RestoreManager }
