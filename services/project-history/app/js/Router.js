import OError from '@overleaf/o-error'
import * as HttpController from './HttpController.js'
import { Joi, validate } from './Validation.js'

export function initialize(app) {
  app.use(
    validate({
      params: Joi.object({
        project_id: Joi.string().regex(/^[0-9a-f]{24}$/),
        user_id: Joi.string().regex(/^[0-9a-f]{24}$/),
        label_id: Joi.string().regex(/^[0-9a-f]{24}$/),
        version: Joi.number().integer(),
      }),
    })
  )

  // use an extended timeout on all endpoints, to allow for long requests to history-v1
  app.use(longerTimeout)

  app.post('/project', HttpController.initializeProject)

  app.delete('/project/:project_id', HttpController.deleteProject)

  app.get('/project/:project_id/snapshot', HttpController.getLatestSnapshot)

  app.get(
    '/project/:project_id/diff',
    validate({
      query: {
        pathname: Joi.string().required(),
        from: Joi.number().integer().required(),
        to: Joi.number().integer().required(),
      },
    }),
    HttpController.getDiff
  )

  app.get(
    '/project/:project_id/filetree/diff',
    validate({
      query: {
        from: Joi.number().integer().required(),
        to: Joi.number().integer().required(),
      },
    }),
    HttpController.getFileTreeDiff
  )

  app.get(
    '/project/:project_id/updates',
    validate({
      query: {
        before: Joi.number().integer(),
        min_count: Joi.number().integer(),
      },
    }),
    HttpController.getUpdates
  )

  app.get(
    '/project/:project_id/changes-in-chunk',
    validate({
      query: {
        since: Joi.number().integer().min(0),
      },
    }),
    HttpController.getChangesInChunkSince
  )

  app.get('/project/:project_id/version', HttpController.latestVersion)

  app.post(
    '/project/:project_id/flush',
    validate({
      query: {
        debug: Joi.boolean().default(false),
        bisect: Joi.boolean().default(false),
      },
    }),
    HttpController.flushProject
  )

  app.post(
    '/project/:project_id/resync',
    validate({
      query: {
        force: Joi.boolean().default(false),
      },
      body: {
        force: Joi.boolean().default(false),
        origin: Joi.object({
          kind: Joi.string().required(),
        }),
        historyRangesMigration: Joi.string()
          .optional()
          .valid('forwards', 'backwards'),
      },
    }),
    HttpController.resyncProject
  )

  app.get(
    '/project/:project_id/dump',
    validate({
      query: {
        count: Joi.number().integer(),
      },
    }),
    HttpController.dumpProject
  )

  app.get('/project/:project_id/labels', HttpController.getLabels)

  app.post(
    '/project/:project_id/labels',
    validate({
      body: {
        version: Joi.number().integer().required(),
        comment: Joi.string().required(),
        created_at: Joi.string(),
        validate_exists: Joi.boolean().default(true),
        user_id: Joi.string().allow(null),
      },
    }),

    HttpController.createLabel
  )

  app.delete(
    '/project/:project_id/user/:user_id/labels/:label_id',
    validate({
      params: Joi.object({
        project_id: Joi.string().regex(/^[0-9a-f]{24}$/),
        user_id: Joi.string().regex(/^[0-9a-f]{24}$/),
        label_id: Joi.string().regex(/^[0-9a-f]{24}$/),
      }),
    }),
    HttpController.deleteLabelForUser
  )

  app.delete(
    '/project/:project_id/labels/:label_id',
    validate({
      params: Joi.object({
        project_id: Joi.string().regex(/^[0-9a-f]{24}$/),
        label_id: Joi.string().regex(/^[0-9a-f]{24}$/),
      }),
    }),
    HttpController.deleteLabel
  )

  app.post(
    '/user/:from_user/labels/transfer/:to_user',
    HttpController.transferLabels
  )

  app.get(
    '/project/:project_id/version/:version/:pathname',
    HttpController.getFileSnapshot
  )

  app.get(
    '/project/:project_id/ranges/version/:version/:pathname',
    HttpController.getRangesSnapshot
  )

  app.get(
    '/project/:project_id/metadata/version/:version/:pathname',
    HttpController.getFileMetadataSnapshot
  )

  app.get(
    '/project/:project_id/version/:version',
    HttpController.getProjectSnapshot
  )

  app.get(
    '/project/:project_id/paths/version/:version',
    HttpController.getPathsAtVersion
  )

  app.post(
    '/project/:project_id/force',
    validate({
      query: {
        clear: Joi.boolean().default(false),
      },
    }),
    HttpController.forceDebugProject
  )

  app.get('/project/:history_id/blob/:hash', HttpController.getProjectBlob)

  app.get('/status/failures', HttpController.getFailures)

  app.get('/status/queue', HttpController.getQueueCounts)

  app.post(
    '/retry/failures',
    validate({
      query: {
        failureType: Joi.string().valid('soft', 'hard'),
        // bail out after this time limit
        timeout: Joi.number().integer().default(300),
        // maximum number of projects to check
        limit: Joi.number().integer().default(100),
        callbackUrl: Joi.string(),
      },
    }),
    HttpController.retryFailures
  )

  app.post(
    '/flush/old',
    validate({
      query: {
        // flush projects with queued ops older than this
        maxAge: Joi.number()
          .integer()
          .default(6 * 3600),
        // pause this amount of time between checking queues
        queueDelay: Joi.number().integer().default(100),
        // maximum number of queues to check
        limit: Joi.number().integer().default(1000),
        //  maximum amount of time allowed
        timeout: Joi.number()
          .integer()
          .default(60 * 1000),
        // whether to run in the background
        background: Joi.boolean().falsy('0').truthy('1').default(false),
      },
    }),
    HttpController.flushOld
  )

  app.get('/status', (req, res, next) => res.send('project-history is up'))

  app.get('/oops', function (req, res, next) {
    throw new OError('dummy test error')
  })

  app.get('/check_lock', HttpController.checkLock)

  app.get('/health_check', HttpController.healthCheck)
}

function longerTimeout(req, res, next) {
  res.setTimeout(6 * 60 * 1000)
  next()
}
