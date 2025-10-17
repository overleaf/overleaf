const { callbackify } = require('util')
const logger = require('@overleaf/logger')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const { Project } = require('../../models/Project')
const TpdsUpdateSender = require('./TpdsUpdateSender')
const OError = require('@overleaf/o-error')

module.exports = {
  flushProjectToTpds: callbackify(flushProjectToTpds),
  deferProjectFlushToTpds: callbackify(deferProjectFlushToTpds),
  flushProjectToTpdsIfNeeded: callbackify(flushProjectToTpdsIfNeeded),
  promises: {
    flushProjectToTpds,
    deferProjectFlushToTpds,
    flushProjectToTpdsIfNeeded,
  },
}

/**
 * Flush a complete project to the TPDS.
 */
async function flushProjectToTpds(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: true,
    deferredTpdsFlushCounter: true,
    'overleaf.history.id': 1,
  })
  await _flushProjectToTpds(project)
}

/**
 * Flush a project to TPDS if a flush is pending.  This is called when
 * projects are loaded in the editor and triggers a sync to dropbox for
 * projects that were imported from Overleaf v1.
 */
async function flushProjectToTpdsIfNeeded(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: true,
    deferredTpdsFlushCounter: true,
    'overleaf.history.id': 1,
  })
  if (project.deferredTpdsFlushCounter > 0) {
    await _flushProjectToTpds(project)
  }
}

async function _flushProjectToTpds(project) {
  const historyId = project?.overleaf?.history?.id
  if (!historyId) {
    const projectId = project._id
    throw new OError('project does not have a history id', { projectId })
  }
  logger.debug({ projectId: project._id }, 'flushing project to TPDS')
  logger.debug({ projectId: project._id }, 'finished flushing project to TPDS')
  await DocumentUpdaterHandler.promises.flushProjectToMongo(project._id)
  const [docs, files] = await Promise.all([
    ProjectEntityHandler.promises.getAllDocs(project._id),
    ProjectEntityHandler.promises.getAllFiles(project._id),
  ])
  for (const [docPath, doc] of Object.entries(docs)) {
    await TpdsUpdateSender.promises.addDoc({
      projectId: project._id,
      docId: doc._id,
      path: docPath,
      projectName: project.name,
      rev: doc.rev || 0,
      folderId: doc.folder._id,
    })
  }
  for (const [filePath, file] of Object.entries(files)) {
    await TpdsUpdateSender.promises.addFile({
      projectId: project._id,
      historyId,
      fileId: file._id,
      hash: file.hash,
      path: filePath,
      projectName: project.name,
      rev: file.rev,
      folderId: file.folder._id,
    })
  }
  await _resetDeferredTpdsFlushCounter(project)
}

/**
 * Reset the TPDS pending flush counter.
 *
 * To avoid concurrency problems, the flush counter is not reset if it has been
 * incremented since we fetched it from the database.
 */
async function _resetDeferredTpdsFlushCounter(project) {
  if (project.deferredTpdsFlushCounter > 0) {
    await Project.updateOne(
      {
        _id: project._id,
        deferredTpdsFlushCounter: { $lte: project.deferredTpdsFlushCounter },
      },
      { $set: { deferredTpdsFlushCounter: 0 } }
    ).exec()
  }
}

/**
 * Mark a project as pending a flush to TPDS.
 * This was called as part of the import process for Overleaf v1 projects.
 * We no longer use this method, but imported v1 projects have the
 * deferredTpdsFlushCounter set and will trigger a flush when loaded in
 * the editor.
 */
async function deferProjectFlushToTpds(projectId) {
  await Project.updateOne(
    { _id: projectId },
    { $inc: { deferredTpdsFlushCounter: 1 } }
  ).exec()
}
