const OutputFileArchiveManager = require('./OutputFileArchiveManager')
const { expressify } = require('@overleaf/promise-utils')

async function createOutputZip(req, res) {
  const {
    project_id: projectId,
    user_id: userId,
    build_id: buildId,
  } = req.params

  const archive = await OutputFileArchiveManager.archiveFilesForBuild(
    projectId,
    userId,
    buildId
  )

  res.attachment('output.zip')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  archive.pipe(res)
}

module.exports = { createOutputZip: expressify(createOutputZip) }
