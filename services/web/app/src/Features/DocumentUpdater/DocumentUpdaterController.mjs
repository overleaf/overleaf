import logger from '@overleaf/logger'
import DocumentUpdaterHandler from './DocumentUpdaterHandler.js'
import ProjectLocator from '../Project/ProjectLocator.js'
import { plainTextResponse } from '../../infrastructure/Response.js'
import { expressify } from '@overleaf/promise-utils'

async function getDoc(req, res) {
  const projectId = req.params.Project_id
  const docId = req.params.Doc_id

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
