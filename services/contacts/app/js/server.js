import * as Metrics from '@overleaf/metrics'
import logger from '@overleaf/logger'
import express from 'express'
import bodyParser from 'body-parser'
import * as HttpController from './HttpController.js'
import * as Errors from './Errors.js'

Metrics.initialize('contacts')
logger.initialize('contacts')
Metrics.event_loop?.monitor(logger)
Metrics.open_sockets.monitor()

export const app = express()
app.use(Metrics.http.monitor(logger))
Metrics.injectMetricsRoute(app)

app.get('/user/:user_id/contacts', HttpController.getContacts)
app.post(
  '/user/:user_id/contacts',
  bodyParser.json({ limit: '2mb' }),
  HttpController.addContact
)

app.get('/status', (req, res) => res.send('contacts is alive'))

app.use(function (error, req, res, next) {
  logger.error({ err: error }, 'request errored')
  if (error instanceof Errors.NotFoundError) {
    return res.sendStatus(404)
  } else {
    return res.status(500).send('Oops, something went wrong')
  }
})
