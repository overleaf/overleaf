#!/usr/bin/env node

// To run in dev:
//
// docker compose run --rm project-history scripts/flush_all.js <limit>
//
// In production:
//
// docker run --rm $(docker ps -lq) scripts/flush_all.js <limit>

import _ from 'lodash'
import async from 'async'
import logger from '@overleaf/logger'
import * as RedisManager from '../app/js/RedisManager.js'
import * as UpdatesProcessor from '../app/js/UpdatesProcessor.js'

logger.logger.level('fatal')

const argv = process.argv.slice(2)
const limit = parseInt(argv[0], 10) || null
const parallelism = Math.min(parseInt(argv[1], 10) || 1, 10)

// flush all outstanding changes
RedisManager.getProjectIdsWithHistoryOps(limit, flushProjects)

function flushProjects(error, projectIds) {
  if (error) {
    throw error
  }
  let ts = new Date()
  console.log(
    'found projects',
    JSON.stringify({ project_ids: projectIds.length, limit, ts })
  )
  projectIds = _.shuffle(projectIds) // randomise to avoid hitting same projects each time
  if (limit > 0) {
    projectIds = projectIds.slice(0, limit)
  }

  let succeededProjects = 0
  let failedProjects = 0
  let attempts = 0

  async.eachLimit(
    projectIds,
    parallelism,
    function (projectId, cb) {
      attempts++
      UpdatesProcessor.processUpdatesForProject(
        projectId,
        function (err, queueSize) {
          const progress = attempts + '/' + projectIds.length
          ts = new Date()
          if (err) {
            failedProjects++
            console.log(
              'failed',
              progress,
              JSON.stringify({
                projectId,
                queueSize,
                ts,
                err: err.toString(),
              })
            )
          } else {
            succeededProjects++
            console.log(
              'succeeded',
              progress,
              JSON.stringify({
                projectId,
                queueSize,
                ts,
              })
            )
          }
          return cb()
        }
      )
    },
    function () {
      console.log(
        'total',
        JSON.stringify({
          succeededProjects,
          failedProjects,
        })
      )
      process.exit(0)
    }
  )
}
