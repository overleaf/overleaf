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
const logger = require('@overleaf/logger')
logger.initialize('chat')
const Path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const server = require('http').createServer(app)
const Router = require('./router')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(metrics.http.monitor(logger))
metrics.injectMetricsRoute(app)

Router.route(app)

module.exports = {
  server,
  app,
}
