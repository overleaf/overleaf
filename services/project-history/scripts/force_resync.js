#!/usr/bin/env node

// To run in dev:
//
// docker compose run --rm project-history scripts/clear_deleted.js
//
// In production:
//
// docker run --rm $(docker ps -lq) scripts/clear_deleted.js

import async from 'async'
import Settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'
import { db, ObjectId } from '../app/js/mongodb.js'
import * as SyncManager from '../app/js/SyncManager.js'
import * as UpdatesProcessor from '../app/js/UpdatesProcessor.js'

const rclient = redis.createClient(Settings.redis.project_history)
const Keys = Settings.redis.project_history.key_schema

const argv = process.argv.slice(2)
const limit = parseInt(argv[0], 10) || null
const force = argv[1] === 'force' || false
let projectNotFoundErrors = 0
let projectImportedFromV1Errors = 0
const projectsNotFound = []
const projectsImportedFromV1 = []
let projectNoHistoryIdErrors = 0
let projectsFailedErrors = 0
const projectsFailed = []
let projectsBrokenSyncErrors = 0
const projectsBrokenSync = []

function checkAndClear(project, callback) {
  const projectId = project.project_id
  console.log('checking project', projectId)

  // These can probably also be reset and their overleaf.history.id unset
  // (unless they are v1 projects).

  function checkNotV1Project(cb) {
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
        if (result && result.overleaf && !result.overleaf.id) {
          if (result.overleaf.history.id) {
            console.log(
              ' - project is not imported from v1 and has a history id - ok to resync'
            )
            return cb()
          } else {
            console.log(
              ' - project is not imported from v1 but does not have a history id'
            )
            return cb(new Error('no history id'))
          }
        } else {
          cb(new Error('project is imported from v1 - will not resync it'))
        }
      }
    )
  }

  function startResync(cb) {
    if (force) {
      console.log('2. starting resync for', projectId)
      SyncManager.startHardResync(projectId, err => {
        if (err) {
          console.log('ERR', JSON.stringify(err.message))
          return cb(err)
        }
        setTimeout(cb, 3000) // include a delay to allow the request to be processed
      })
    } else {
      console.log('2. dry run, would start resync for', projectId)
      cb()
    }
  }

  function forceFlush(cb) {
    if (force) {
      console.log('3. forcing a flush for', projectId)
      UpdatesProcessor.processUpdatesForProject(projectId, err => {
        console.log('err', err)
        return cb(err)
      })
    } else {
      console.log('3. dry run, would force a flush for', projectId)
      cb()
    }
  }

  function watchRedisQueue(cb) {
    const key = Keys.projectHistoryOps({ project_id: projectId })
    function checkQueueEmpty(_callback) {
      rclient.llen(key, (err, result) => {
        console.log('LLEN', projectId, err, result)
        if (err) {
          _callback(err)
        }
        if (result === 0) {
          _callback()
        } else {
          _callback(new Error('queue not empty'))
        }
      })
    }
    if (force) {
      console.log('4. checking redis queue key', key)
      async.retry({ times: 30, interval: 1000 }, checkQueueEmpty, err => {
        cb(err)
      })
    } else {
      console.log('4. dry run, would check redis key', key)
      cb()
    }
  }

  function checkMongoFailureEntry(cb) {
    if (force) {
      console.log('5. checking key in mongo projectHistoryFailures', projectId)
      db.projectHistoryFailures.findOne(
        { project_id: projectId },
        { projection: { _id: 1 } },
        (err, result) => {
          console.log('got result', err, result)
          if (err) {
            return cb(err)
          }
          if (result) {
            return cb(new Error('failure record still exists'))
          }
          return cb()
        }
      )
    } else {
      console.log('5. would check failure record for', projectId, 'in mongo')
      cb()
    }
  }

  // do the checks and deletions
  async.waterfall(
    [
      checkNotV1Project,
      startResync,
      forceFlush,
      watchRedisQueue,
      checkMongoFailureEntry,
    ],
    err => {
      if (!err) {
        return setTimeout(callback, 1000) // include a 1 second delay
      } else if (err.message === 'project not found in mongo') {
        projectNotFoundErrors++
        projectsNotFound.push(projectId)
        return callback()
      } else if (err.message === 'no history id') {
        projectNoHistoryIdErrors++
        return callback()
      } else if (
        err.message === 'project is imported from v1 - will not resync it'
      ) {
        projectImportedFromV1Errors++
        projectsImportedFromV1.push(projectId)
        return callback()
      } else if (
        err.message === 'history store a non-success status code: 422'
      ) {
        projectsFailedErrors++
        projectsFailed.push(projectId)
        return callback()
      } else if (err.message === 'sync ongoing') {
        projectsBrokenSyncErrors++
        projectsBrokenSync.push(projectId)
        return callback()
      } else {
        console.log('error:', err)
        return callback()
      }
    }
  )
}

async function main() {
  const results = await db.projectHistoryFailures.find().toArray()

  console.log('number of queues without history store 442 =', results.length)
  // now check if the project is truly deleted in mongo
  async.eachSeries(results.slice(0, limit), checkAndClear, err => {
    console.log('Final error status', err)
    console.log(
      'Project flush failed again errors',
      projectsFailedErrors,
      projectsFailed
    )
    console.log(
      'Project flush ongoing errors',
      projectsBrokenSyncErrors,
      projectsBrokenSync
    )
    console.log(
      'Project not found errors',
      projectNotFoundErrors,
      projectsNotFound
    )
    console.log('Project without history_id errors', projectNoHistoryIdErrors)
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
