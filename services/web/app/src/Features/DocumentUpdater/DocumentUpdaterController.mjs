import logger from '@overleaf/logger'
import DocumentUpdaterHandler from './DocumentUpdaterHandler.mjs'
import ProjectLocator from '../Project/ProjectLocator.mjs'
import { plainTextResponse } from '../../infrastructure/Response.mjs'
import { expressify } from '@overleaf/promise-utils'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

const getDocSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    Doc_id: zz.objectId(),
  }),
})

async function getDoc(req, res) {
  const { params } = parseReq(req, getDocSchema, { logOnly: true })
  const projectId = params.Project_id
  const docId = params.Doc_id

  try {
    const { element: doc } = await ProjectLocator.promises.findElement({
      project_id: projectId,
      element_id: docId,
      type: 'doc',
    })

    const { lines } = await DocumentUpdaterHandler.promises.getDocument(
      projectId,
      docId,
      -1 // latest version only
    )

    res.setContentDisposition('attachment', { filename: doc.name })
    plainTextResponse(res, lines.join('\n'))
  } catch (err) {
    if (err.name === 'NotFoundError') {
      logger.warn(
        { err, projectId, docId },
        'entity not found when downloading doc'
      )

      return res.sendStatus(404)
    }

    logger.err(
      { err, projectId, docId },
      'error getting document for downloading'
    )

    return res.sendStatus(500)
  }
}

export default {
  getDoc: expressify(getDoc),
}
