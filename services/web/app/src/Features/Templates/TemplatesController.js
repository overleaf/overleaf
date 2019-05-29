/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let TemplatesController
const path = require('path')
const AuthenticationController = require('../Authentication/AuthenticationController')
const TemplatesManager = require('./TemplatesManager')
const ProjectHelper = require('../Project/ProjectHelper')
const logger = require('logger-sharelatex')

module.exports = TemplatesController = {
  getV1Template(req, res) {
    const templateVersionId = req.params.Template_version_id
    const templateId = req.query.id
    if (!/^[0-9]+$/.test(templateVersionId) || !/^[0-9]+$/.test(templateId)) {
      logger.err(
        { templateVersionId, templateId },
        'invalid template id or version'
      )
      return res.sendStatus(400)
    }
    const data = {}
    data.templateVersionId = templateVersionId
    data.templateId = templateId
    data.name = req.query.templateName
    data.compiler = ProjectHelper.compilerFromV1Engine(req.query.latexEngine)
    data.imageName = req.query.texImage
    data.mainFile = req.query.mainFile
    data.brandVariationId = req.query.brandVariationId
    return res.render(
      path.resolve(
        __dirname,
        '../../../views/project/editor/new_from_template'
      ),
      data
    )
  },

  createProjectFromV1Template(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return TemplatesManager.createProjectFromV1Template(
      req.body.brandVariationId,
      req.body.compiler,
      req.body.mainFile,
      req.body.templateId,
      req.body.templateName,
      req.body.templateVersionId,
      user_id,
      req.body.imageName,
      function(err, project) {
        if (err != null) {
          return next(err)
        }
        delete req.session.templateData
        return res.redirect(`/project/${project._id}`)
      }
    )
  }
}
