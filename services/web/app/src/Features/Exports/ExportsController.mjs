import ExportsHandler from './ExportsHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'
import settings from '@overleaf/settings'
import { fetchStreamWithResponse } from '@overleaf/fetch-utils'
import { isTrustedConversionJobUrl } from '../V1/V1ConversionHelper.mjs'
import { pipeline } from 'node:stream/promises'
import { parseReq, z, zz } from '../../infrastructure/Validation.mjs'

async function exportProject(req, res, next) {
  const { project_id: projectId, brand_variation_id: brandVariationId } =
    req.params
  const userId = SessionManager.getLoggedInUserId(req.session)
  const exportParams = {
    project_id: projectId,
    brand_variation_id: brandVariationId,
    user_id: userId,
  }

  if (req.body) {
    if (req.body.firstName) {
      exportParams.first_name = req.body.firstName.trim()
    }
    if (req.body.lastName) {
      exportParams.last_name = req.body.lastName.trim()
    }
    // additional parameters for gallery exports
    if (req.body.title) {
      exportParams.title = req.body.title.trim()
    }
    if (req.body.description) {
      exportParams.description = req.body.description.trim()
    }
    if (req.body.author) {
      exportParams.author = req.body.author.trim()
    }
    if (req.body.license) {
      exportParams.license = req.body.license.trim()
    }
    if (req.body.showSource != null) {
      exportParams.show_source = req.body.showSource
    }
  }

  try {
    const exportData = await ExportsHandler.exportProject(exportParams)
    logger.debug(
      {
        userId,
        projectId,
        brandVariationId,
        exportV1Id: exportData.v1_id,
      },
      'exported project'
    )
    return res.json({
      export_v1_id: exportData.v1_id,
      token: exportData.token,
      message: exportData.message,
    })
  } catch (err) {
    const info = OError.getFullInfo(err)
    if (info?.forwardResponse) {
      logger.debug(
        { responseError: info.forwardResponse },
        'forwarding response'
      )
      const statusCode = info.forwardResponse.status || 500
      return res.status(statusCode).json(info.forwardResponse)
    }
    throw err
  }
}

async function exportStatus(req, res) {
  const { export_id: exportId } = req.params
  const { token } = req.query
  if (!token && settings.exports?.requireToken) {
    return res.status(403).json({
      export_json: {
        status_summary: 'failed',
        status_detail: 'token is required',
      },
    })
  }
  let exportJson
  try {
    exportJson = await ExportsHandler.fetchExport(exportId, token)
  } catch (err) {
    const json = {
      status_summary: 'failed',
      status_detail: String(err),
    }
    return res.json({ export_json: json })
  }
  const parsedExport = JSON.parse(exportJson)
  const json = {
    status_summary: parsedExport.status_summary,
    status_detail: parsedExport.status_detail,
    partner_submission_id: parsedExport.partner_submission_id,
    v2_user_email: parsedExport.v2_user_email,
    v2_user_first_name: parsedExport.v2_user_first_name,
    v2_user_last_name: parsedExport.v2_user_last_name,
    title: parsedExport.title,
    token: parsedExport.token,
  }
  return res.json({ export_json: json })
}

const exportDownloadSchema = z.object({
  params: z.object({
    export_id: zz.submissionId(),
    type: z.enum(['pdf', 'zip']),
  }),
  query: z.object({
    token: z.string().optional(),
  }),
})

async function exportDownload(req, res, next) {
  const {
    params: { type, export_id: exportId },
    query: { token },
  } = parseReq(req, exportDownloadSchema)
  if (!token && settings.exports?.requireToken) {
    return res.sendStatus(403)
  }

  try {
    SessionManager.getLoggedInUserId(req.session)
    const exportFileUrl = await ExportsHandler.fetchDownload(
      exportId,
      type,
      token
    )
    if (
      settings.exports?.proxyDownload &&
      // V1 always returns a valid URL here; throw if that assumption is violated.
      isTrustedConversionJobUrl(new URL(exportFileUrl))
    ) {
      const { stream, response } = await fetchStreamWithResponse(exportFileUrl)

      res.attachment(`${token}.${type}`)
      res.setHeader('X-Content-Type-Options', 'nosniff')

      if (response.headers.has('Content-Length')) {
        res.setHeader('Content-Length', response.headers.get('Content-Length'))
      }

      // Disable buffering in nginx
      res.setHeader('X-Accel-Buffering', 'no')
      await pipeline(stream, res)
      return
    }
    return res.redirect(exportFileUrl)
  } catch (err) {
    const info = OError.getFullInfo(err)
    // A bad/spoofed token is rejected by v1 as 404; expose as 400 to clients.
    if (info?.statusCode === 404) {
      return res.sendStatus(400)
    }
    throw err
  }
}

export default {
  exportDownload: expressify(exportDownload),
  exportProject: expressify(exportProject),
  exportStatus: expressify(exportStatus),
}
