/* eslint-disable
    camelcase,
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
const ExportsHandler = require('./ExportsHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const logger = require('logger-sharelatex')

module.exports = {
  exportProject(req, res, next) {
    const { project_id, brand_variation_id } = req.params
    const user_id = AuthenticationController.getLoggedInUserId(req)
    const export_params = {
      project_id,
      brand_variation_id,
      user_id
    }

    if (req.body) {
      if (req.body.firstName) {
        export_params.first_name = req.body.firstName.trim()
      }
      if (req.body.lastName) {
        export_params.last_name = req.body.lastName.trim()
      }
      // additional parameters for gallery exports
      if (req.body.title) {
        export_params.title = req.body.title.trim()
      }
      if (req.body.description) {
        export_params.description = req.body.description.trim()
      }
      if (req.body.author) {
        export_params.author = req.body.author.trim()
      }
      if (req.body.license) {
        export_params.license = req.body.license.trim()
      }
      if (req.body.showSource != null) {
        export_params.show_source = req.body.showSource
      }
    }

    return ExportsHandler.exportProject(export_params, function(
      err,
      export_data
    ) {
      if (err != null) {
        if (err.forwardResponse != null) {
          logger.log(
            { responseError: err.forwardResponse },
            'forwarding response'
          )
          const statusCode = err.forwardResponse.status || 500
          return res.status(statusCode).json(err.forwardResponse)
        } else {
          return next(err)
        }
      }
      logger.log(
        {
          user_id,
          project_id,
          brand_variation_id,
          export_v1_id: export_data.v1_id
        },
        'exported project'
      )
      return res.json({ export_v1_id: export_data.v1_id })
    })
  },

  exportStatus(req, res) {
    const { export_id } = req.params
    return ExportsHandler.fetchExport(export_id, function(err, export_json) {
      let json
      if (err != null) {
        json = {
          status_summary: 'failed',
          status_detail: err.toString
        }
        res.json({ export_json: json })
        return err
      }
      const parsed_export = JSON.parse(export_json)
      json = {
        status_summary: parsed_export.status_summary,
        status_detail: parsed_export.status_detail,
        partner_submission_id: parsed_export.partner_submission_id,
        v2_user_email: parsed_export.v2_user_email,
        v2_user_first_name: parsed_export.v2_user_first_name,
        v2_user_last_name: parsed_export.v2_user_last_name,
        title: parsed_export.title,
        token: parsed_export.token
      }
      return res.json({ export_json: json })
    })
  },

  exportDownload(req, res, next) {
    const { type, export_id } = req.params

    AuthenticationController.getLoggedInUserId(req)
    return ExportsHandler.fetchDownload(export_id, type, function(
      err,
      export_file_url
    ) {
      if (err != null) {
        return next(err)
      }

      return res.redirect(export_file_url)
    })
  }
}
