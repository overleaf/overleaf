const { callbackify } = require('util')
const logger = require('logger-sharelatex')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const { Project } = require('../../models/Project')
const TpdsUpdateSender = require('./TpdsUpdateSender')

module.exports = {
  flushProjectToTpds: callbackify(flushProjectToTpds),
  deferProjectFlushToTpds: callbackify(deferProjectFlushToTpds),
  flushProjectToTpdsIfNeeded: callbackify(flushProjectToTpdsIfNeeded),
  promises: {
    flushProjectToTpds,
    deferProjectFlushToTpds,
    flushProjectToTpdsIfNeeded
  }
}

/**
 * Flush a complete project to the TPDS.
 */
async function flushProjectToTpds(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: true,
    deferredTpdsFlushCounter: true
  })
  await _flushProjectToTpds(project)
}

/**
 * Flush a project to TPDS if a flush is pending
 */
async function flushProjectToTpdsIfNeeded(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: true,
    deferredTpdsFlushCounter: true
  })
  if (project.deferredTpdsFlushCounter > 0) {
    await _flushProjectToTpds(project)
  }
}

async function _flushProjectToTpds(project) {
  logger.debug({ projectId: project._id }, 'flushing project to TPDS')
  logger.debug({ projectId: project._id }, 'finished flushing project to TPDS')
  await DocumentUpdaterHandler.promises.flushProjectToMongo(project._id)
  const [docs, files] = await Promise.all([
    ProjectEntityHandler.promises.getAllDocs(project._id),
    ProjectEntityHandler.promises.getAllFiles(project._id)
  ])
  for (const [docPath, doc] of Object.entries(docs)) {
    await TpdsUpdateSender.promises.addDoc({
      project_id: project._id,
      doc_id: doc._id,
      path: docPath,
      project_name: project.name,
      rev: doc.rev || 0
    })
  }
  for (const [filePath, file] of Object.entries(files)) {
    await TpdsUpdateSender.promises.addFile({
      project_id: project._id,
      file_id: file._id,
      path: filePath,
      project_name: project.name,
      rev: file.rev
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
        deferredTpdsFlushCounter: { $lte: project.deferredTpdsFlushCounter }
      },
      { $set: { deferredTpdsFlushCounter: 0 } }
    ).exec()
  }
}

/**
 * Mark a project as pending a flush to TPDS.
 */
async function deferProjectFlushToTpds(projectId) {
  await Project.updateOne(
    { _id: projectId },
    { $inc: { deferredTpdsFlushCounter: 1 } }
  ).exec()
}
