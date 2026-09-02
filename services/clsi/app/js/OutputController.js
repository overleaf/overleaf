import OutputFileArchiveManager from './OutputFileArchiveManager.js'
import { expressify } from '@overleaf/promise-utils'
import { pipeline } from 'node:stream/promises'
import { parseReq, z, zz } from '@overleaf/validation-tools'

// user_id is present only on the /project/:project_id/user/:user_id/build/...
// mount; this same handler is used for both routes.
const createOutputZipSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId().or(zz.submissionId()),
    user_id: zz.objectId().optional(),
    build_id: zz.buildId(),
  }),
})

async function createOutputZip(req, res) {
  const { params } = parseReq(req, createOutputZipSchema, { logOnly: true })
  const { project_id: projectId, user_id: userId, build_id: buildId } = params

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
