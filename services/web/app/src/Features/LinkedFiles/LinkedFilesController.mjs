/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import SessionManager from '../Authentication/SessionManager.mjs'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import _ from 'lodash'
import AnalyticsManager from '../../../../app/src/Features/Analytics/AnalyticsManager.mjs'
import LinkedFilesHandler from './LinkedFilesHandler.mjs'
import LinkedFilesErrors from './LinkedFilesErrors.mjs'
import {
  OutputFileFetchFailedError,
  FileTooLargeError,
  TooManyFilesError,
} from '../Errors/Errors.js'
import Modules from '../../infrastructure/Modules.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import { plainTextResponse } from '../../infrastructure/Response.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import { expressify } from '@overleaf/promise-utils'
import ProjectOutputFileAgent from './ProjectOutputFileAgent.mjs'
import ProjectFileAgent from './ProjectFileAgent.mjs'
import UrlAgent from './UrlAgent.mjs'

const {
  CompileFailedError,
  UrlFetchFailedError,
  InvalidUrlError,
  AccessDeniedError,
  BadEntityTypeError,
  BadDataError,
  ProjectNotFoundError,
  V1ProjectNotFoundError,
  SourceFileNotFoundError,
  NotOriginalImporterError,
  FeatureNotAvailableError,
  RemoteServiceError,
  FileCannotRefreshError,
} = LinkedFilesErrors

let LinkedFilesController

// Per-provider shape of the client-submitted `data` object. This mirrors
// overleaf-editor-core's `rawLinkedFileData` discriminated union (the
// *stored* linkedFileData shape), but is not identical to it: `provider`
// lives as a sibling of `data` here rather than inside it, `importedAt` is
// never client-submitted (set server-side after validation), and a couple
// of fields are intentionally looser than the stored shape because the
// agents apply defaults/coercions between validation and storage --
// `zotero`'s `format` defaults to 'bibtex' when absent (ZoteroAgent
// `_getFormat`), and `project_file`/`project_output_file`'s
// `v1_source_doc_id` may arrive as a number (existing callers do this; the
// agent's `_canCreate` check rejects v1 ids with its own 403, so this must
// not be intercepted by validation first).
const createLinkedFileSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
  body: z.discriminatedUnion('provider', [
    z.strictObject({
      name: z.string(),
      parent_folder_id: zz.objectId(),
      provider: z.literal('url'),
      data: z.strictObject({
        url: z.string(),
      }),
    }),
    z.strictObject({
      name: z.string(),
      parent_folder_id: zz.objectId(),
      provider: z.literal('project_file'),
      data: z.strictObject({
        source_project_id: zz.objectId().optional(),
        v1_source_doc_id: z.union([z.string(), z.number()]).optional(),
        source_entity_path: z.string(),
      }),
    }),
    z.strictObject({
      name: z.string(),
      parent_folder_id: zz.objectId(),
      provider: z.literal('project_output_file'),
      data: z.strictObject({
        source_project_id: zz.objectId().optional(),
        v1_source_doc_id: z.union([z.string(), z.number()]).optional(),
        source_output_file_path: z.string(),
        build_id: zz.buildId().optional(),
        clsiServerId: z.string().optional(),
      }),
    }),
    z.strictObject({
      name: z.string(),
      parent_folder_id: zz.objectId(),
      provider: z.literal('mendeley'),
      data: z.strictObject({
        group_id: zz.routeSegment().optional(),
      }),
    }),
    z.strictObject({
      name: z.string(),
      parent_folder_id: zz.objectId(),
      provider: z.literal('zotero'),
      data: z.strictObject({
        format: z.enum(['bibtex', 'biblatex']).optional(),
        group_id: zz.routeSegment().optional(),
      }),
    }),
    z.strictObject({
      name: z.string(),
      parent_folder_id: zz.objectId(),
      provider: z.literal('papers'),
      data: z.strictObject({
        group_id: zz.routeSegment().optional(),
      }),
    }),
  ]),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const createLinkedFileFallbackSchema = z.object({
  params: z.object({
    project_id: zz.objectId(),
  }),
  body: z.object({
    name: z.string(),
    provider: z.string(),
    data: z.object({}).passthrough(),
    parent_folder_id: zz.objectId(),
  }),
})

const refreshLinkedFileSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    file_id: zz.objectId(),
  }),
  body: z.strictObject({
    clientId: z.string().optional(),
    shouldReindexReferences: z.boolean().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const refreshLinkedFileFallbackSchema = z.object({
  params: z.object({
    project_id: zz.objectId(),
    file_id: zz.objectId(),
  }),
  body: z.object({
    clientId: z.string().optional(),
    shouldReindexReferences: z.boolean().optional(),
  }),
})

// Keys whose values are safe to log as-is. Every other key is kept (so the shape of the data stays visible in the log) but its value is replaced.
const LINKED_FILE_DATA_ALLOW_LIST = [
  'provider',
  'importedAt',
  'source_project_id',
  'v1_source_doc_id',
  'source_entity_path',
  'source_output_file_path',
  'format',
  'group_id',
  'clsiServerId',
]

function redactLinkedFileData(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (LINKED_FILE_DATA_ALLOW_LIST.includes(key)) return [key, value]
      if (key === 'url') {
        try {
          return [key, new URL(value).origin + '/<redacted>']
        } catch {
          return [key, '<bad input>']
        }
      }
      return [key, '<redacted>']
    })
  )
}

async function createLinkedFile(req, res, next) {
  const { params, body } = parseReq(req, createLinkedFileSchema, {
    fallbackSchema: createLinkedFileFallbackSchema,
  })
  const { project_id: projectId } = params
  const { name, provider, data, parent_folder_id: parentFolderId } = body
  const userId = SessionManager.getLoggedInUserId(req.session)

  const Agent = await LinkedFilesController._getAgent(provider)
  if (Agent == null) {
    return res.sendStatus(400)
  }

  data.provider = provider
  data.importedAt = new Date().toISOString()

  const historySource = await SplitTestHandler.promises.featureFlagEnabled(
    req,
    res,
    'linked-file-from-history',
    { includeReferer: true }
  )

  try {
    const newFileId = await Agent.promises.createLinkedFile(
      projectId,
      data,
      name,
      parentFolderId,
      userId,
      historySource
    )
    if (name.endsWith('.bib')) {
      AnalyticsManager.recordEventForSession(req.session, 'linked-bib-file', {
        integration: provider,
      })
    }
    return res.json({ new_file_id: newFileId })
  } catch (err) {
    return LinkedFilesController.handleError(
      err,
      { projectId, userId, parentFolderId },
      data,
      req,
      res,
      next
    )
  }
}

async function refreshLinkedFile(req, res, next) {
  const { params, body } = parseReq(req, refreshLinkedFileSchema, {
    fallbackSchema: refreshLinkedFileFallbackSchema,
  })
  const { project_id: projectId, file_id: fileId } = params
  const { clientId, shouldReindexReferences } = body
  const userId = SessionManager.getLoggedInUserId(req.session)

  const { file, parentFolder } = await LinkedFilesHandler.promises.getFileById(
    projectId,
    fileId
  )

  if (file == null) {
    return res.sendStatus(404)
  }
  const { name } = file
  const { linkedFileData } = file
  if (
    linkedFileData == null ||
    (linkedFileData != null ? linkedFileData.provider : undefined) == null
  ) {
    return res.sendStatus(409)
  }

  const { provider } = linkedFileData
  const parentFolderId = parentFolder._id
  const Agent = await LinkedFilesController._getAgent(provider)
  if (Agent == null) {
    return res.sendStatus(400)
  }

  linkedFileData.importedAt = new Date().toISOString()

  const historySource = await SplitTestHandler.promises.featureFlagEnabled(
    req,
    res,
    'linked-file-from-history',
    { includeReferer: true }
  )

  let newFileId
  try {
    newFileId = await Agent.promises.refreshLinkedFile(
      projectId,
      linkedFileData,
      name,
      parentFolderId,
      userId,
      historySource
    )
  } catch (err) {
    return LinkedFilesController.handleError(
      err,
      { projectId, userId, parentFolderId },
      linkedFileData,
      req,
      res,
      next
    )
  }

  if (shouldReindexReferences) {
    // Signal to clients that they should re-index references
    EditorRealTimeController.emitToRoom(
      projectId,
      'references:keys:updated',
      [],
      true,
      clientId
    )
  }
  res.json({ new_file_id: newFileId })
}

export default LinkedFilesController = {
  Agents: null,

  async _cacheAgents() {
    if (!LinkedFilesController.Agents) {
      LinkedFilesController.Agents = _.extend(
        {
          url: UrlAgent,
          project_file: ProjectFileAgent,
          project_output_file: ProjectOutputFileAgent,
        },
        await Modules.linkedFileAgentsIncludes()
      )
    }
  },

  async _getAgent(provider) {
    await LinkedFilesController._cacheAgents()
    if (
      !Object.prototype.hasOwnProperty.call(
        LinkedFilesController.Agents,
        provider
      )
    ) {
      return null
    }
    if (!Array.from(Settings.enabledLinkedFileTypes).includes(provider)) {
      return null
    }
    return LinkedFilesController.Agents[provider]
  },

  createLinkedFile: expressify(createLinkedFile),

  refreshLinkedFile: expressify(refreshLinkedFile),

  handleError(error, info, linkedFileData, req, res, next) {
    logger.warn(
      {
        error,
        req,
        ...info,
        linkedFileData: redactLinkedFileData(linkedFileData),
      },
      'failed to create/refresh linked file'
    )
    if (error instanceof AccessDeniedError) {
      res.status(403)
      plainTextResponse(
        res,
        res.locals.translate(
          'the_project_that_contains_this_file_is_not_shared_with_you'
        )
      )
    } else if (error instanceof BadDataError) {
      res.status(400)
      plainTextResponse(res, 'The submitted data is not valid')
    } else if (error instanceof BadEntityTypeError) {
      res.status(400)
      plainTextResponse(res, 'The file is the wrong type')
    } else if (error instanceof SourceFileNotFoundError) {
      res.status(404)
      plainTextResponse(res, 'Source file not found')
    } else if (error instanceof ProjectNotFoundError) {
      res.status(404)
      plainTextResponse(res, 'Project not found')
    } else if (error instanceof V1ProjectNotFoundError) {
      res.status(409)
      plainTextResponse(
        res,
        'Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file'
      )
    } else if (error instanceof CompileFailedError) {
      res.status(422)
      plainTextResponse(
        res,
        res.locals.translate('generic_linked_file_compile_error')
      )
    } else if (error instanceof OutputFileFetchFailedError) {
      res.status(404)
      plainTextResponse(res, 'Could not get output file')
    } else if (error instanceof UrlFetchFailedError) {
      res.status(422)
      if (error.cause instanceof FileTooLargeError) {
        plainTextResponse(res, 'File too large')
      } else {
        plainTextResponse(
          res,
          `Your URL could not be reached (${
            error.info?.status || error.cause?.info?.status
          } status code). Please check it and try again.`
        )
      }
    } else if (error instanceof InvalidUrlError) {
      res.status(422)
      plainTextResponse(
        res,
        'Your URL is not valid. Please check it and try again.'
      )
    } else if (error instanceof NotOriginalImporterError) {
      res.status(400)
      plainTextResponse(
        res,
        'You are not the user who originally imported this file'
      )
    } else if (error instanceof FeatureNotAvailableError) {
      res.status(400)
      plainTextResponse(res, 'This feature is not enabled on your account')
    } else if (error instanceof RemoteServiceError) {
      if (error.info?.statusCode === 403) {
        res.status(400).json({ relink: true })
      } else if (error.info?.statusCode === 429) {
        res.status(429).json({ message: 'rate_limited' })
      } else {
        res.status(502)
        plainTextResponse(res, 'The remote service produced an error')
      }
    } else if (error instanceof FileCannotRefreshError) {
      res.status(400)
      plainTextResponse(res, 'This file cannot be refreshed')
    } else if (error instanceof TooManyFilesError) {
      res.status(400)
      plainTextResponse(res, 'too many files')
    } else if (/\bECONNREFUSED\b/.test(error.message)) {
      res.status(500)
      plainTextResponse(res, 'Importing references is not currently available')
    } else if (error instanceof FileTooLargeError) {
      res.status(422)
      plainTextResponse(res, 'File too large')
    } else {
      next(error)
    }
  },
}
