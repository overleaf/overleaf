// Server-Sent Events stream of editor-events (reciveNewDoc, reciveNewFolder,
// reciveNewFile, reciveEntityRename, reciveEntityMove, removeEntity, …)
// scoped to one project. Subscribed to by the sync daemon so it can mirror
// structural changes from the Web UI into the per-user code-server workspace.
//
// We re-publish exactly what EditorRealTimeController.emitToRoom puts on
// Redis: { room_id, message, payload, _id }. The daemon ignores messages
// from other rooms.

import Settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
import logger from '@overleaf/logger'

const HEARTBEAT_MS = 15000

export default {
  attach(req, res) {
    const projectId = req.params.Project_id

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    res.write('retry: 5000\n\n')

    const rclient = redis.createClient(Settings.redis.pubsub)

    function send(data) {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch (err) {
        cleanup()
      }
    }

    function onMessage(_channel, message) {
      let parsed
      try {
        parsed = JSON.parse(message)
      } catch (err) {
        return
      }
      if (parsed && parsed.room_id === projectId) {
        send(parsed)
      }
    }

    rclient.subscribe('editor-events', err => {
      if (err) logger.error({ err, projectId }, 'editor-events subscribe failed')
    })
    if (Settings.publishOnIndividualChannels) {
      rclient.psubscribe('editor-events:*', err => {
        if (err)
          logger.error({ err, projectId }, 'editor-events psubscribe failed')
      })
      rclient.on('pmessage', (_pat, channel, message) =>
        onMessage(channel, message)
      )
    }
    rclient.on('message', onMessage)

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch (err) {
        cleanup()
      }
    }, HEARTBEAT_MS)

    let closed = false
    function cleanup() {
      if (closed) return
      closed = true
      clearInterval(heartbeat)
      try {
        rclient.removeAllListeners('message')
        rclient.removeAllListeners('pmessage')
        rclient.unsubscribe('editor-events')
        if (Settings.publishOnIndividualChannels) {
          rclient.punsubscribe('editor-events:*')
        }
        rclient.quit()
      } catch (_) {
        /* ignore */
      }
      try {
        res.end()
      } catch (_) {
        /* ignore */
      }
    }

    req.on('close', cleanup)
    req.on('aborted', cleanup)
    res.on('close', cleanup)

    send({ type: 'ready', project_id: projectId, ts: Date.now() })
  },
}
