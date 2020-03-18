/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Metrics = require('metrics-sharelatex')
Metrics.initialize('contacts')

const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const express = require('express')
const bodyParser = require('body-parser')
const Errors = require('./app/js/Errors')
const HttpController = require('./app/js/HttpController')

logger.initialize('contacts')
if (Metrics.event_loop != null) {
  Metrics.event_loop.monitor(logger)
}

const app = express()

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

const { port } = Settings.internal.contacts
const { host } = Settings.internal.contacts

if (!module.parent) {
  // Called directly
  app.listen(port, host, function (error) {
    if (error != null) {
      throw error
    }
    return logger.info(`contacts starting up, listening on ${host}:${port}`)
  })
}

module.exports = app
