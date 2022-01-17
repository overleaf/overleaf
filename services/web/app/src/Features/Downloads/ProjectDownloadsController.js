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
let ProjectDownloadsController
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectZipStreamManager = require('./ProjectZipStreamManager')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const { prepareZipAttachment } = require('../../infrastructure/Response')

module.exports = ProjectDownloadsController = {
  downloadProject(req, res, next) {
    const project_id = req.params.Project_id
    Metrics.inc('zip-downloads')
    return DocumentUpdaterHandler.flushProjectToMongo(
      project_id,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return ProjectGetter.getProject(
          project_id,
          { name: true },
          function (error, project) {
            if (error != null) {
              return next(error)
            }
            return ProjectZipStreamManager.createZipStreamForProject(
              project_id,
              function (error, stream) {
                if (error != null) {
                  return next(error)
                }
                prepareZipAttachment(res, `${project.name}.zip`)
                return stream.pipe(res)
              }
            )
          }
        )
      }
    )
  },

  downloadMultipleProjects(req, res, next) {
    const project_ids = req.query.project_ids.split(',')
    Metrics.inc('zip-downloads-multiple')
    return DocumentUpdaterHandler.flushMultipleProjectsToMongo(
      project_ids,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return ProjectZipStreamManager.createZipStreamForMultipleProjects(
          project_ids,
          function (error, stream) {
            if (error != null) {
              return next(error)
            }
            prepareZipAttachment(
              res,
              `Overleaf Projects (${project_ids.length} items).zip`
            )
            return stream.pipe(res)
          }
        )
      }
    )
  },
}
