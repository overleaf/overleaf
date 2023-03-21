/* eslint-disable
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
    const projectId = req.params.Project_id
    Metrics.inc('zip-downloads')
    return DocumentUpdaterHandler.flushProjectToMongo(
      projectId,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return ProjectGetter.getProject(
          projectId,
          { name: true },
          function (error, project) {
            if (error != null) {
              return next(error)
            }
            return ProjectZipStreamManager.createZipStreamForProject(
              projectId,
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
    const projectIds = req.query.project_ids.split(',')
    Metrics.inc('zip-downloads-multiple')
    return DocumentUpdaterHandler.flushMultipleProjectsToMongo(
      projectIds,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return ProjectZipStreamManager.createZipStreamForMultipleProjects(
          projectIds,
          function (error, stream) {
            if (error != null) {
              return next(error)
            }
            prepareZipAttachment(
              res,
              `Overleaf Projects (${projectIds.length} items).zip`
            )
            return stream.pipe(res)
          }
        )
      }
    )
  },
}
