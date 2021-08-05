/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const metrics = require('@overleaf/metrics')
metrics.initialize('chat')
const logger = require('logger-sharelatex')
logger.initialize('chat')
const Path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const errorHandler = require('errorhandler')
const app = express()
const server = require('http').createServer(app)
const Router = require('./router')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(metrics.http.monitor(logger))
metrics.injectMetricsRoute(app)

if (app.get('env') === 'development') {
  app.use(errorHandler({ dumpExceptions: true, showStack: true }))
}

if (app.get('env') === 'production') {
  app.use(errorHandler())
}

Router.route(app)

module.exports = {
  server,
  app,
}
