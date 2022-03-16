const MessageHttpController = require('./Features/Messages/MessageHttpController')
const { ObjectId } = require('./mongodb')

module.exports = {
  route(app) {
    app.param('projectId', function (req, res, next, projectId) {
      if (ObjectId.isValid(projectId)) {
        next()
      } else {
        res.status(400).send('Invalid projectId')
      }
    })

    app.param('threadId', function (req, res, next, threadId) {
      if (ObjectId.isValid(threadId)) {
        next()
      } else {
        res.status(400).send('Invalid threadId')
      }
    })

    // These are for backwards compatibility
    app.get(
      '/room/:projectId/messages',
      MessageHttpController.getGlobalMessages
    )
    app.post(
      '/room/:projectId/messages',
      MessageHttpController.sendGlobalMessage
    )

    app.get(
      '/project/:projectId/messages',
      MessageHttpController.getGlobalMessages
    )
    app.post(
      '/project/:projectId/messages',
      MessageHttpController.sendGlobalMessage
    )

    app.post(
      '/project/:projectId/thread/:threadId/messages',
      MessageHttpController.sendThreadMessage
    )
    app.get('/project/:projectId/threads', MessageHttpController.getAllThreads)

    app.post(
      '/project/:projectId/thread/:threadId/messages/:messageId/edit',
      MessageHttpController.editMessage
    )
    app.delete(
      '/project/:projectId/thread/:threadId/messages/:messageId',
      MessageHttpController.deleteMessage
    )

    app.post(
      '/project/:projectId/thread/:threadId/resolve',
      MessageHttpController.resolveThread
    )
    app.post(
      '/project/:projectId/thread/:threadId/reopen',
      MessageHttpController.reopenThread
    )
    app.delete(
      '/project/:projectId/thread/:threadId',
      MessageHttpController.deleteThread
    )

    app.delete('/project/:projectId', MessageHttpController.destroyProject)

    app.get('/status', (req, res, next) => res.send('chat is alive'))
  },
}
