import http from 'http'
import metrics from '@overleaf/metrics'
import logger from '@overleaf/logger'
import express from 'express'
import bodyParser from 'body-parser'
import * as Router from './router.js'

metrics.initialize('chat')
logger.initialize('chat')

export const app = express()
export const server = http.createServer(app)

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(metrics.http.monitor(logger))
metrics.injectMetricsRoute(app)

Router.route(app)
