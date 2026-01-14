import OError from '@overleaf/o-error'
import * as HttpController from './HttpController.js'

export function initialize(app) {
  // use an extended timeout on all endpoints, to allow for long requests to history-v1
  app.use(longerTimeout)

  app.post('/project', HttpController.initializeProject)

  app.delete('/project/:project_id', HttpController.deleteProject)

  app.get('/project/:project_id/snapshot', HttpController.getLatestSnapshot)

  app.get('/project/:project_id/diff', HttpController.getDiff)

  app.get('/project/:project_id/filetree/diff', HttpController.getFileTreeDiff)

  app.get('/project/:project_id/updates', HttpController.getUpdates)

  app.get(
    '/project/:project_id/changes-in-chunk',
    HttpController.getChangesInChunkSince
  )

  app.get('/project/:project_id/version', HttpController.latestVersion)

  app.post('/project/:project_id/flush', HttpController.flushProject)

  app.post('/project/:project_id/resync', HttpController.resyncProject)

  app.get('/project/:project_id/dump', HttpController.dumpProject)

  app.get('/project/:project_id/labels', HttpController.getLabels)

  app.post('/project/:project_id/labels', HttpController.createLabel)

  app.delete(
    '/project/:project_id/user/:user_id/labels/:label_id',
    HttpController.deleteLabelForUser
  )

  app.delete(
    '/project/:project_id/labels/:label_id',
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

  app.post('/project/:project_id/force', HttpController.forceDebugProject)

  app.get('/project/:history_id/blob/:hash', HttpController.getProjectBlob)

  app.get('/status/failures', HttpController.getFailures)

  app.get('/status/queue', HttpController.getQueueCounts)

  app.post('/retry/failures', HttpController.retryFailures)

  app.post('/flush/old', HttpController.flushOld)

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
