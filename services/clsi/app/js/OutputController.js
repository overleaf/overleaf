const logger = require('@overleaf/logger')
const OutputFileArchiveManager = require('./OutputFileArchiveManager')
const { expressify } = require('@overleaf/promise-utils')

async function createOutputZip(req, res) {
  const {
    project_id: projectId,
    user_id: userId,
    build_id: buildId,
  } = req.params
  const files = Array.isArray(req.query.files) ? req.query.files : []
  logger.debug({ projectId, userId, buildId, files }, 'Will create zip file')

  const archive = await OutputFileArchiveManager.archiveFilesForBuild(
    projectId,
    userId,
    buildId,
    files
  )

  archive.on('error', err => {
    logger.warn({ err }, 'error emitted when creating output files archive')
  })

  res.attachment('output.zip')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  archive.pipe(res)
}

module.exports = { createOutputZip: expressify(createOutputZip) }
