const metrics = require('@overleaf/metrics')
metrics.initialize('chat')
const logger = require('@overleaf/logger')
logger.initialize('chat')
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
