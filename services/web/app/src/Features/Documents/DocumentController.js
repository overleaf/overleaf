const ProjectGetter = require('../Project/ProjectGetter')
const OError = require('@overleaf/o-error')
const ProjectLocator = require('../Project/ProjectLocator')
const ProjectEntityHandler = require('../Project/ProjectEntityHandler')
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const logger = require('@overleaf/logger')
const _ = require('lodash')

function getDocument(req, res, next) {
  const { Project_id: projectId, doc_id: docId } = req.params
  const plain = req.query.plain === 'true'
  const peek = req.query.peek === 'true'
  ProjectGetter.getProject(
    projectId,
    { rootFolder: true, overleaf: true },
    (error, project) => {
      if (error) {
        return next(error)
      }
      if (!project) {
        return res.sendStatus(404)
      }
      ProjectLocator.findElement(
        { project, element_id: docId, type: 'doc' },
        (error, doc, path) => {
          if (error) {
            OError.tag(error, 'error finding element for getDocument', {
              docId,
              projectId,
            })
            return next(error)
          }
          ProjectEntityHandler.getDoc(
            projectId,
            docId,
            { peek },
            (error, lines, rev, version, ranges) => {
              if (error) {
                OError.tag(
                  error,
                  'error finding doc contents for getDocument',
                  {
                    docId,
                    projectId,
                  }
                )
                return next(error)
              }
              if (plain) {
                res.type('text/plain')
                res.send(lines.join('\n'))
              } else {
                const projectHistoryId = _.get(project, 'overleaf.history.id')
                const projectHistoryDisplay = _.get(
                  project,
                  'overleaf.history.display'
                )
                const sendToBothHistorySystems = _.get(
                  project,
                  'overleaf.history.allowDowngrade'
                )
                // if project has been switched but has 'allowDowngrade' set
                // then leave projectHistoryType undefined to (temporarily)
                // continue sending updates to both SL and full project history
                const projectHistoryType =
                  projectHistoryDisplay && !sendToBothHistorySystems
                    ? 'project-history'
                    : undefined // for backwards compatibility, don't send anything if the project is still on track-changes
                res.json({
                  lines,
                  version,
                  ranges,
                  pathname: path.fileSystem,
                  projectHistoryId,
                  projectHistoryType,
                })
              }
            }
          )
        }
      )
    }
  )
}

function setDocument(req, res, next) {
  const { Project_id: projectId, doc_id: docId } = req.params
  const { lines, version, ranges, lastUpdatedAt, lastUpdatedBy } = req.body
  ProjectEntityUpdateHandler.updateDocLines(
    projectId,
    docId,
    lines,
    version,
    ranges,
    lastUpdatedAt,
    lastUpdatedBy,
    error => {
      if (error) {
        OError.tag(error, 'error finding element for getDocument', {
          docId,
          projectId,
        })
        return next(error)
      }
      logger.log(
        { docId, projectId },
        'finished receiving set document request from api (docupdater)'
      )
      res.sendStatus(200)
    }
  )
}

module.exports = { getDocument, setDocument }
