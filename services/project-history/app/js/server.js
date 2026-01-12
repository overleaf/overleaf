import Metrics from '@overleaf/metrics'
import logger from '@overleaf/logger'
import express from 'express'
import bodyParser from 'body-parser'
import * as Errors from './Errors.js'
import * as Router from './Router.js'
import * as Validation from './Validation.js'

const HistoryLogger = logger.initialize('project-history').logger

Metrics.event_loop.monitor(logger)
Metrics.memory.monitor(logger)
Metrics.leaked_sockets.monitor(logger)
Metrics.open_sockets.monitor()

// log updates as truncated strings
function truncateFn(updates) {
  return JSON.parse(
    JSON.stringify(updates, function (key, value) {
      let len
      if (typeof value === 'string' && (len = value.length) > 80) {
        return (
          value.substr(0, 32) +
          `...(message of length ${len} truncated)...` +
          value.substr(-32)
        )
      } else {
        return value
      }
    })
  )
}

HistoryLogger.addSerializers({
  rawUpdate: truncateFn,
  rawUpdates: truncateFn,
  newUpdates: truncateFn,
  lastUpdate: truncateFn,
})

export const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(Metrics.http.monitor(logger))
Router.initialize(app)
Metrics.injectMetricsRoute(app)
app.use(Validation.errorMiddleware)
app.use(function (error, req, res, next) {
  if (error instanceof Errors.NotFoundError) {
    res.sendStatus(404)
  } else if (error instanceof Errors.BadRequestError) {
    res.sendStatus(400)
  } else if (error instanceof Errors.InconsistentChunkError) {
    res.sendStatus(422)
  } else if (error instanceof Errors.TooManyRequestsError) {
    res.status(429).set('Retry-After', 300).end()
  } else {
    logger.error({ err: error, req }, error.message)
    res.status(500).json({ message: 'an internal error occurred' })
  }
})
