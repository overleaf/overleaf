import Metrics from '@overleaf/metrics'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectZipStreamManager from './ProjectZipStreamManager.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import { prepareZipAttachment } from '../../infrastructure/Response.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import ProjectAuditLogHandler from '../Project/ProjectAuditLogHandler.mjs'

// Keep in sync with the logic for PDF files in CompileController
function getSafeProjectName(project) {
  return project.name.replace(/[^\p{L}\p{Nd}]/gu, '_')
}

export default {
  downloadProject(req, res, next) {
    const userId = SessionManager.getSessionUser(req.session)
    const projectId = req.params.Project_id
    Metrics.inc('zip-downloads')
    DocumentUpdaterHandler.flushProjectToMongo(projectId, function (error) {
      if (error) {
        return next(error)
      }
      ProjectGetter.getProject(
        projectId,
        { name: true },
        function (error, project) {
          if (error) {
            return next(error)
          }
          ProjectAuditLogHandler.addEntryInBackground(
            projectId,
            'project-downloaded',
            userId,
            req.ip
          )
          ProjectZipStreamManager.createZipStreamForProject(
            projectId,
            function (error, stream) {
              if (error) {
                return next(error)
              }
              prepareZipAttachment(res, `${getSafeProjectName(project)}.zip`)
              stream.pipe(res)
            }
          )
        }
      )
    })
  },

  downloadMultipleProjects(req, res, next) {
    const projectIds = req.query.project_ids.split(',')
    Metrics.inc('zip-downloads-multiple')
    DocumentUpdaterHandler.flushMultipleProjectsToMongo(
      projectIds,
      function (error) {
        if (error) {
          return next(error)
        }
        ProjectZipStreamManager.createZipStreamForMultipleProjects(
          projectIds,
          function (error, stream) {
            if (error) {
              return next(error)
            }
            prepareZipAttachment(
              res,
              `Overleaf Projects (${projectIds.length} items).zip`
            )
            stream.pipe(res)
          }
        )
      }
    )
  },
}
