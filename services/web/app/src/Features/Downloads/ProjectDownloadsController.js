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
const logger = require('logger-sharelatex')
const Metrics = require('metrics-sharelatex')
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectZipStreamManager = require('./ProjectZipStreamManager')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')

module.exports = ProjectDownloadsController = {
  downloadProject(req, res, next) {
    const project_id = req.params.Project_id
    Metrics.inc('zip-downloads')
    logger.log({ project_id }, 'downloading project')
    return DocumentUpdaterHandler.flushProjectToMongo(project_id, function(
      error
    ) {
      if (error != null) {
        return next(error)
      }
      return ProjectGetter.getProject(project_id, { name: true }, function(
        error,
        project
      ) {
        if (error != null) {
          return next(error)
        }
        return ProjectZipStreamManager.createZipStreamForProject(
          project_id,
          function(error, stream) {
            if (error != null) {
              return next(error)
            }
            res.setContentDisposition('attachment', {
              filename: `${project.name}.zip`
            })
            res.contentType('application/zip')
            return stream.pipe(res)
          }
        )
      })
    })
  },

  downloadMultipleProjects(req, res, next) {
    const project_ids = req.query.project_ids.split(',')
    Metrics.inc('zip-downloads-multiple')
    logger.log({ project_ids }, 'downloading multiple projects')
    return DocumentUpdaterHandler.flushMultipleProjectsToMongo(
      project_ids,
      function(error) {
        if (error != null) {
          return next(error)
        }
        return ProjectZipStreamManager.createZipStreamForMultipleProjects(
          project_ids,
          function(error, stream) {
            if (error != null) {
              return next(error)
            }
            res.setContentDisposition('attachment', {
              filename: `Overleaf Projects (${project_ids.length} items).zip`
            })
            res.contentType('application/zip')
            return stream.pipe(res)
          }
        )
      }
    )
  }
}
