/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import ExportsHandler from './ExportsHandler.mjs'

import SessionManager from '../Authentication/SessionManager.mjs'
import logger from '@overleaf/logger'

export default {
  exportProject(req, res, next) {
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

    return ExportsHandler.exportProject(
      exportParams,
      function (err, exportData) {
        if (err != null) {
          if (err.forwardResponse != null) {
            logger.debug(
              { responseError: err.forwardResponse },
              'forwarding response'
            )
            const statusCode = err.forwardResponse.status || 500
            return res.status(statusCode).json(err.forwardResponse)
          } else {
            return next(err)
          }
        }
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
      }
    )
  },

  exportStatus(req, res) {
    const { export_id: exportId } = req.params
    return ExportsHandler.fetchExport(exportId, function (err, exportJson) {
      let json
      if (err != null) {
        json = {
          status_summary: 'failed',
          status_detail: err.toString,
        }
        res.json({ export_json: json })
        return err
      }
      const parsedExport = JSON.parse(exportJson)
      json = {
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
    })
  },

  exportDownload(req, res, next) {
    const { type, export_id: exportId } = req.params

    SessionManager.getLoggedInUserId(req.session)
    return ExportsHandler.fetchDownload(
      exportId,
      type,
      function (err, exportFileUrl) {
        if (err != null) {
          return next(err)
        }

        return res.redirect(exportFileUrl)
      }
    )
  },
}
