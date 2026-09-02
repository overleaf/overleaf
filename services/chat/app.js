// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'

import metrics from '@overleaf/metrics'
import logger from '@overleaf/logger'
import settings from '@overleaf/settings'
import express from 'express'
import { handleValidationError } from '@overleaf/validation-tools'
import { mongoClient } from './app/js/mongodb.js'
import * as MessageHttpController from './app/js/Features/Messages/MessageHttpController.js'
import { expressify } from './app/js/util/promises.js'

logger.initialize('chat')
metrics.open_sockets.monitor()
metrics.leaked_sockets.monitor(logger)

const app = express()

app.use(metrics.http.monitor(logger))
metrics.injectMetricsRoute(app)

app.use(express.json())

app.get(
  '/project/:projectId/messages',
  expressify(MessageHttpController.getGlobalMessages)
)
app.post(
  '/project/:projectId/messages',
  expressify(MessageHttpController.sendGlobalMessage)
)
app.get(
  '/project/:projectId/messages/:messageId',
  expressify(MessageHttpController.getGlobalMessage)
)
app.delete(
  '/project/:projectId/messages/:messageId',
  expressify(MessageHttpController.deleteGlobalMessage)
)
app.post(
  '/project/:projectId/messages/:messageId/edit',
  expressify(MessageHttpController.editGlobalMessage)
)
app.post(
  '/project/:projectId/thread/:threadId/messages',
  expressify(MessageHttpController.sendMessage)
)
app.get(
  '/project/:projectId/thread/:threadId/messages/:messageId',
  expressify(MessageHttpController.getThreadMessage)
)
app.delete(
  '/project/:projectId/thread/:threadId/messages/:messageId',
  expressify(MessageHttpController.deleteMessage)
)
app.post(
  '/project/:projectId/thread/:threadId/messages/:messageId/edit',
  expressify(MessageHttpController.editMessage)
)
app.delete(
  '/project/:projectId/thread/:threadId/user/:userId/messages/:messageId',
  expressify(MessageHttpController.deleteUserMessage)
)
app.post(
  '/project/:projectId/thread/:threadId/resolve',
  expressify(MessageHttpController.resolveThread)
)
app.post(
  '/project/:projectId/thread/:threadId/reopen',
  expressify(MessageHttpController.reopenThread)
)
app.get(
  '/project/:projectId/thread/:threadId',
  expressify(MessageHttpController.getThread)
)
app.delete(
  '/project/:projectId/thread/:threadId',
  expressify(MessageHttpController.deleteThread)
)
app.get(
  '/project/:projectId/threads',
  expressify(MessageHttpController.getThreads)
)
app.get(
  '/project/:projectId/resolved-thread-ids',
  expressify(MessageHttpController.getResolvedThreadIds)
)
app.delete(
  '/project/:projectId',
  expressify(MessageHttpController.destroyProject)
)
app.post(
  '/project/:projectId/duplicate-comment-threads',
  expressify(MessageHttpController.duplicateCommentThreads)
)
app.post(
  '/project/:projectId/generate-thread-data',
  expressify(MessageHttpController.generateThreadData)
)
app.post(
  '/project/:projectId/clone-comment-threads',
  expressify(MessageHttpController.cloneCommentThreads)
)
// express also serves HEAD /status via this GET route
app.get('/status', expressify(MessageHttpController.getStatus))

// Return a 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ message: `Not found` })
})

app.use(handleValidationError)

// Handle any unexpected errors
app.use((err, req, res, next) => {
  logger.error({ err, req }, 'request errored')
  res.status(500).json({ message: `Internal error: ${err.message}` })
})

const port = settings.internal.chat.port
const host = settings.internal.chat.host

if (import.meta.main) {
  // Called directly
  mongoClient
    .connect()
    .then(() => {
      app.listen(port, host, function (err) {
        if (err) {
          logger.fatal({ err }, `Cannot bind to ${host}:${port}. Exiting.`)
          process.exit(1)
        }
        logger.debug(`Chat starting up, listening on ${host}:${port}`)
      })
    })
    .catch(err => {
      logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
      process.exit(1)
    })
}

export default app
