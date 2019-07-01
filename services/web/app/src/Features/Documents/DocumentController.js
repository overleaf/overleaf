/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const ProjectGetter = require('../Project/ProjectGetter')
const ProjectLocator = require('../Project/ProjectLocator')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const logger = require('logger-sharelatex')

module.exports = {
  getDocument(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const project_id = req.params.Project_id
    const { doc_id } = req.params
    const plain =
      __guard__(req != null ? req.query : undefined, x => x.plain) === 'true'
    logger.log(
      { doc_id, project_id },
      'receiving get document request from api (docupdater)'
    )
    return ProjectGetter.getProject(
      project_id,
      { rootFolder: true, overleaf: true },
      function(error, project) {
        if (error != null) {
          return next(error)
        }
        if (project == null) {
          return res.sendStatus(404)
        }
        return ProjectLocator.findElement(
          { project, element_id: doc_id, type: 'doc' },
          function(error, doc, path) {
            if (error != null) {
              logger.warn(
                { err: error, doc_id, project_id },
                'error finding element for getDocument'
              )
              return next(error)
            }
            return ProjectEntityHandler.getDoc(project_id, doc_id, function(
              error,
              lines,
              rev,
              version,
              ranges
            ) {
              if (error != null) {
                logger.warn(
                  { err: error, doc_id, project_id },
                  'error finding doc contents for getDocument'
                )
                return next(error)
              }
              if (plain) {
                res.type('text/plain')
                return res.send(lines.join('\n'))
              } else {
                const projectHistoryId = __guard__(
                  __guard__(
                    project != null ? project.overleaf : undefined,
                    x2 => x2.history
                  ),
                  x1 => x1.id
                )
                return res.json({
                  lines,
                  version,
                  ranges,
                  pathname: path.fileSystem,
                  projectHistoryId
                })
              }
            })
          }
        )
      }
    )
  },

  setDocument(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const project_id = req.params.Project_id
    const { doc_id } = req.params
    const { lines, version, ranges, lastUpdatedAt, lastUpdatedBy } = req.body
    logger.log(
      { doc_id, project_id },
      'receiving set document request from api (docupdater)'
    )
    return ProjectEntityUpdateHandler.updateDocLines(
      project_id,
      doc_id,
      lines,
      version,
      ranges,
      lastUpdatedAt,
      lastUpdatedBy,
      function(error) {
        if (error != null) {
          logger.warn(
            { err: error, doc_id, project_id },
            'error finding element for getDocument'
          )
          return next(error)
        }
        logger.log(
          { doc_id, project_id },
          'finished receiving set document request from api (docupdater)'
        )
        return res.sendStatus(200)
      }
    )
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
