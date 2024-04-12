#!/usr/bin/env node

// To run in dev:
//
// docker compose run --rm project-history scripts/clear_deleted.js
//
// In production:
//
// docker run --rm $(docker ps -lq) scripts/clear_deleted.js

import async from 'async'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
import { db, ObjectId } from '../app/js/mongodb.js'

logger.logger.level('fatal')

const rclient = redis.createClient(Settings.redis.project_history)
const Keys = Settings.redis.project_history.key_schema

const argv = process.argv.slice(2)
const limit = parseInt(argv[0], 10) || null
const force = argv[1] === 'force' || false
let projectNotFoundErrors = 0
let projectImportedFromV1Errors = 0
const projectsNotFound = []
const projectsImportedFromV1 = []
let projectWithHistoryIdErrors = 0
const projectsWithHistoryId = []

function checkAndClear(project, callback) {
  const projectId = project.project_id
  console.log('checking project', projectId)

  function checkDeleted(cb) {
    db.projects.findOne(
      { _id: new ObjectId(projectId) },
      { projection: { overleaf: true } },
      (err, result) => {
        console.log(
          '1. looking in mongo projects collection: err',
          err,
          'result',
          JSON.stringify(result)
        )
        if (err) {
          return cb(err)
        }
        if (!result) {
          return cb(new Error('project not found in mongo'))
        }
        if (
          result &&
          result.overleaf &&
          !result.overleaf.id &&
          result.overleaf.history &&
          !result.overleaf.history.id &&
          result.overleaf.history.deleted_id
        ) {
          console.log(
            ' - project is not imported from v1 and has a deleted_id - ok to clear'
          )
          return cb()
        } else if (result && result.overleaf && result.overleaf.id) {
          console.log(' - project is imported from v1')
          return cb(
            new Error('project is imported from v1 - will not clear it')
          )
        } else if (
          result &&
          result.overleaf &&
          result.overleaf.history &&
          result.overleaf.history.id
        ) {
          console.log(' - project has a history id')
          return cb(new Error('project has a history id - will not clear it'))
        } else {
          console.log(' - project state not recognised')
          return cb(new Error('project state not recognised'))
        }
      }
    )
  }

  function clearRedisQueue(cb) {
    const key = Keys.projectHistoryOps({ project_id: projectId })
    if (force) {
      console.log('deleting redis key', key)
      rclient.del(key, err => {
        cb(err)
      })
    } else {
      console.log('dry run, would deleted key', key)
      cb()
    }
  }

  function clearMongoEntry(cb) {
    if (force) {
      console.log('deleting key in mongo projectHistoryFailures', projectId)
      db.projectHistoryFailures.deleteOne(
        { project_id: projectId },
        (err, result) => {
          console.log('got result from remove', err, result)
          cb(err)
        }
      )
    } else {
      console.log('would delete failure record for', projectId, 'from mongo')
      cb()
    }
  }

  // do the checks and deletions
  async.waterfall([checkDeleted, clearRedisQueue, clearMongoEntry], err => {
    if (!err) {
      if (force) {
        return setTimeout(callback, 100)
      } // include a 1 second delay
      return callback()
    } else if (err.message === 'project not found in mongo') {
      projectNotFoundErrors++
      projectsNotFound.push(projectId)
      return callback()
    } else if (err.message === 'project has a history id - will not clear it') {
      projectWithHistoryIdErrors++
      projectsWithHistoryId.push(projectId)
      return callback()
    } else if (
      err.message === 'project is imported from v1 - will not clear it'
    ) {
      projectImportedFromV1Errors++
      projectsImportedFromV1.push(projectId)
      return callback()
    } else {
      console.log('error:', err)
      return callback(err)
    }
  })
}

// find all the broken projects from the failure records
async function main() {
  const results = await db.projectHistoryFailures
    .find({ error: /history store a non-success status code: 422/ })
    .toArray()

  console.log('number of queues without history store 442 =', results.length)
  // now check if the project is truly deleted in mongo
  async.eachSeries(results.slice(0, limit), checkAndClear, err => {
    console.log('Final error status', err)
    console.log(
      'Project not found errors',
      projectNotFoundErrors,
      projectsNotFound
    )
    console.log(
      'Project with history id errors',
      projectWithHistoryIdErrors,
      projectsWithHistoryId
    )
    console.log(
      'Project imported from V1 errors',
      projectImportedFromV1Errors,
      projectsImportedFromV1
    )
    process.exit()
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
