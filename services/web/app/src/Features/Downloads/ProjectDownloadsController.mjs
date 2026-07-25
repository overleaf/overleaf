import Metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import ProjectZipStreamManager from './ProjectZipStreamManager.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import { prepareZipAttachment } from '../../infrastructure/Response.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import ProjectAuditLogHandler from '../Project/ProjectAuditLogHandler.mjs'
import DocumentConversionManager from '../Uploads/DocumentConversionManager.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import Validation from '../../infrastructure/Validation.mjs'
import { expressify } from '@overleaf/promise-utils'
import { pipeline } from 'node:stream/promises'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import { DocumentConversionError } from '../Errors/Errors.js'

const { z, zz, parseReq } = Validation

const SUPPORTED_CONVERSION_TYPES = new Map([
  ['docx', 'docx'],
  ['markdown', 'zip'],
  ['html', 'zip'],
])

const exportProjectConversionSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    type: z.enum([...SUPPORTED_CONVERSION_TYPES.keys()]),
  }),
  query: z.object({
    responseFormat: z.enum(['json', 'stream']).optional().default('stream'),
    rootResourcePath: zz.filepath().optional(),
  }),
})

const downloadPreparedProjectExportSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
    buildId: zz.buildId(),
    conversionId: z.uuid(),
    file: zz.filepath(),
    type: z.enum([...SUPPORTED_CONVERSION_TYPES.keys()]),
  }),
  query: z.object({
    clsiserverid: zz.clsiServerId().optional(),
  }),
})

// Keep in sync with the logic for PDF files in CompileController
function getSafeProjectName(project) {
  return project.name.replace(/[^\p{L}\p{Nd}]/gu, '_')
}

async function _streamConvertedDocumentToResponse(
  res,
  { projectId, type, conversionId, buildId, clsiServerId, file }
) {
  const extension = SUPPORTED_CONVERSION_TYPES.get(type)
  const project = await ProjectGetter.promises.getProject(projectId, {
    name: true,
  })
  const safeFileName = getSafeProjectName(project)

  const { stream, contentLength } =
    await DocumentConversionManager.promises.streamConvertedProjectDocument({
      conversionId,
      buildId,
      clsiServerId,
      file,
    })
  res.setHeader('Content-Length', contentLength)
  res.attachment(`${safeFileName}.${extension}`)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Accel-Buffering', 'no')
  await pipeline(stream, res)
}

async function exportProjectConversion(req, res) {
  const { params, query } = parseReq(req, exportProjectConversionSchema)
  const { Project_id: projectId, type } = params
  const { responseFormat, rootResourcePath } = query
  const userId = SessionManager.getLoggedInUserId(req.session)
  Metrics.inc('document-exports', 1, { type })

  const compileFromHistory = await SplitTestHandler.promises.featureFlagEnabled(
    req,
    res,
    'compile-from-history',
    { includeReferer: true }
  )

  let conversionResult
  try {
    conversionResult =
      await DocumentConversionManager.promises.convertProjectToDocument(
        projectId,
        userId,
        type,
        { compileFromHistory, rootResourcePath }
      )
    AnalyticsManager.recordEventForSession(req.session, 'convert-format', {
      sourceFormat: 'latex',
      targetFormat: type,
      status: 'success',
      operation: 'export',
    })
  } catch (error) {
    AnalyticsManager.recordEventForSession(req.session, 'convert-format', {
      sourceFormat: 'latex',
      targetFormat: type,
      status: 'failure',
      operation: 'export',
    })
    if (error instanceof DocumentConversionError) {
      return res.status(422).json({
        error: error.message,
      })
    }
    throw error
  }
  const { conversionId, buildId, clsiServerId, file } = conversionResult
  ProjectAuditLogHandler.addEntryInBackground(
    projectId,
    `project-exported-${type}`,
    userId,
    req.ip
  )

  if (responseFormat === 'json') {
    const downloadUrl = new URL(
      `/project/${projectId}/download/conversion/${conversionId}/${type}/build/${buildId}/output/${file}`,
      Settings.siteUrl
    )
    if (clsiServerId) {
      downloadUrl.searchParams.set('clsiserverid', clsiServerId)
    }
    return res.json({
      downloadUrl: downloadUrl.pathname + downloadUrl.search,
    })
  }

  await _streamConvertedDocumentToResponse(res, {
    projectId,
    type,
    conversionId,
    buildId,
    clsiServerId,
    file,
  })
}

async function downloadPreparedProjectExport(req, res) {
  const { params, query } = parseReq(req, downloadPreparedProjectExportSchema)
  const { Project_id: projectId, conversionId, buildId, file, type } = params
  const { clsiserverid: clsiServerId } = query

  await _streamConvertedDocumentToResponse(res, {
    projectId,
    type,
    conversionId,
    buildId,
    clsiServerId,
    file,
  })
}

export default {
  exportProjectConversion: expressify(exportProjectConversion),
  downloadPreparedProjectExport: expressify(downloadPreparedProjectExport),

  downloadProject(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const projectId = req.params.Project_id
    Metrics.inc('zip-downloads')
    DocumentUpdaterHandler.flushProjectToMongo(projectId, function (error) {
      if (error) {
        return next(error)
      }
      ProjectGetter.getProject(
        projectId,
        { name: true, 'overleaf.history.id': true },
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
          SplitTestHandler.featureFlagEnabled(
            req,
            res,
            'zip-from-history',
            { includeReferer: true },
            function (error, enabled) {
              if (error) {
                return next(error)
              }
              ProjectZipStreamManager.createZipStreamForProject(
                projectId,
                enabled,
                project.overleaf.history.id,
                function (error, stream, historyVersion) {
                  if (error) {
                    return next(error)
                  }
                  prepareZipAttachment(
                    res,
                    `${getSafeProjectName(project)}.zip`
                  )
                  if (historyVersion != null) {
                    res.setHeader('X-History-Version', historyVersion)
                  }
                  stream.pipe(res)
                }
              )
            }
          )
        }
      )
    })
  },

  downloadMultipleProjects(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const projectIds = req.query.project_ids.split(',')
    Metrics.inc('zip-downloads-multiple')
    DocumentUpdaterHandler.flushMultipleProjectsToMongo(
      projectIds,
      function (error) {
        if (error) {
          return next(error)
        }
        // Log audit entry for each project in the batch
        for (const projectId of projectIds) {
          ProjectAuditLogHandler.addEntryInBackground(
            projectId,
            'project-downloaded',
            userId,
            req.ip
          )
        }
        SplitTestHandler.featureFlagEnabled(
          req,
          res,
          'zip-from-history',
          { includeReferer: true },
          function (error, enabled) {
            if (error) {
              return next(error)
            }
            ProjectZipStreamManager.createZipStreamForMultipleProjects(
              projectIds,
              enabled,
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
      }
    )
  },
}
