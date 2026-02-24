import ExportsHandler from './ExportsHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'

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
  let exportJson
  try {
    exportJson = await ExportsHandler.fetchExport(exportId)
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

async function exportDownload(req, res, next) {
  const { type, export_id: exportId } = req.params

  SessionManager.getLoggedInUserId(req.session)
  const exportFileUrl = await ExportsHandler.fetchDownload(exportId, type)
  return res.redirect(exportFileUrl)
}

export default {
  exportDownload: expressify(exportDownload),
  exportProject: expressify(exportProject),
  exportStatus: expressify(exportStatus),
}
