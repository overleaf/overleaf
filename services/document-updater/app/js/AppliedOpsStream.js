// Server-Sent Events stream that forwards applied-ops pub/sub messages for a
// single project to an HTTP client. Used by external sync agents (e.g. the
// Claude Code sync daemon) that don't speak Socket.IO.

const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const logger = require('@overleaf/logger')

const HEARTBEAT_MS = 15000

const AppliedOpsStream = {
  attach(projectId, req, res) {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    res.write(`retry: 5000\n\n`)

    const subClient = redis.createClient(Settings.redis.pubsub)

    function publish(data) {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch (err) {
        cleanup()
      }
    }

    function onMessage(channel, message) {
      let parsed
      try {
        parsed = JSON.parse(message)
      } catch (err) {
        return
      }
      if (parsed && parsed.project_id === projectId) {
        publish(parsed)
      }
    }

    function onPMessage(_pattern, channel, message) {
      onMessage(channel, message)
    }

    subClient.subscribe('applied-ops', err => {
      if (err) {
        logger.error({ err, projectId }, 'failed to subscribe applied-ops')
      }
    })
    if (Settings.publishOnIndividualChannels) {
      subClient.psubscribe('applied-ops:*', err => {
        if (err) {
          logger.error(
            { err, projectId },
            'failed to psubscribe applied-ops:*'
          )
        }
      })
    }
    subClient.on('message', onMessage)
    subClient.on('pmessage', onPMessage)

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`)
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
        subClient.removeListener('message', onMessage)
        subClient.removeListener('pmessage', onPMessage)
        subClient.unsubscribe('applied-ops')
        if (Settings.publishOnIndividualChannels) {
          subClient.punsubscribe('applied-ops:*')
        }
        subClient.quit()
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

    // Immediate hello so clients can confirm subscription succeeded.
    publish({ type: 'ready', project_id: projectId, ts: Date.now() })
  },
}

module.exports = AppliedOpsStream
