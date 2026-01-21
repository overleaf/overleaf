import OutputFileArchiveManager from './OutputFileArchiveManager.js'
import { expressify } from '@overleaf/promise-utils'
import { pipeline } from 'node:stream/promises'

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
  await pipeline(archive, res)
}

export default { createOutputZip: expressify(createOutputZip) }
