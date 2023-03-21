/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LIMIT, pending
let projectId, docId
const { callbackify } = require('util')
const Settings = require('@overleaf/settings')
const async = require('async')
const _ = require('underscore')
const { db, ObjectId, waitForDb, closeDb } = require('./mongodb')
const fs = require('fs')
const Metrics = require('@overleaf/metrics')
Metrics.initialize('track-changes')
const logger = require('@overleaf/logger')
logger.initialize('track-changes-packworker')
if ((Settings.sentry != null ? Settings.sentry.dsn : undefined) != null) {
  logger.initializeErrorReporting(Settings.sentry.dsn)
}

const DAYS = 24 * 3600 * 1000

const LockManager = require('./LockManager')
const PackManager = require('./PackManager')

// this worker script is forked by the main process to look for
// document histories which can be archived

const source = process.argv[2]
const DOCUMENT_PACK_DELAY = Number(process.argv[3]) || 1000
const TIMEOUT = Number(process.argv[4]) || 30 * 60 * 1000
let COUNT = 0 // number processed
let TOTAL = 0 // total number to process

if (!source.match(/^[0-9]+$/)) {
  const file = fs.readFileSync(source)
  const result = (() => {
    const result1 = []
    for (const line of Array.from(file.toString().split('\n'))) {
      ;[projectId, docId] = Array.from(line.split(' '))
      result1.push({ doc_id: docId, project_id: projectId })
    }
    return result1
  })()
  pending = _.filter(result, row =>
    __guard__(row != null ? row.doc_id : undefined, x =>
      x.match(/^[a-f0-9]{24}$/)
    )
  )
} else {
  LIMIT = Number(process.argv[2]) || 1000
}

let shutDownRequested = false
const shutDownTimer = setTimeout(function () {
  logger.debug('pack timed out, requesting shutdown')
  // start the shutdown on the next pack
  shutDownRequested = true
  // do a hard shutdown after a further 5 minutes
  const hardTimeout = setTimeout(function () {
    logger.error('HARD TIMEOUT in pack archive worker')
    return process.exit()
  }, 5 * 60 * 1000)
  return hardTimeout.unref()
}, TIMEOUT)

logger.debug(
  `checking for updates, limit=${LIMIT}, delay=${DOCUMENT_PACK_DELAY}, timeout=${TIMEOUT}`
)

const finish = function () {
  if (shutDownTimer != null) {
    logger.debug('cancelling timeout')
    clearTimeout(shutDownTimer)
  }
  logger.debug('closing db')
  callbackify(closeDb)(function () {
    logger.debug('closing LockManager Redis Connection')
    return LockManager.close(function () {
      logger.debug(
        { processedCount: COUNT, allCount: TOTAL },
        'ready to exit from pack archive worker'
      )
      const hardTimeout = setTimeout(function () {
        logger.error('hard exit from pack archive worker')
        return process.exit(1)
      }, 5 * 1000)
      return hardTimeout.unref()
    })
  })
}

process.on('exit', code => logger.debug({ code }, 'pack archive worker exited'))

const processUpdates = pending =>
  async.eachSeries(
    pending,
    function (result, callback) {
      let _id
      ;({ _id, project_id: projectId, doc_id: docId } = result)
      COUNT++
      logger.debug({ projectId, docId }, `processing ${COUNT}/${TOTAL}`)
      if (projectId == null || docId == null) {
        logger.debug(
          { projectId, docId },
          'skipping pack, missing project/doc id'
        )
        return callback()
      }
      const handler = function (err, result) {
        if (err != null && err.code === 'InternalError' && err.retryable) {
          logger.warn(
            { err, result },
            'ignoring S3 error in pack archive worker'
          )
          // Ignore any s3 errors due to random problems
          err = null
        }
        if (err != null) {
          logger.error({ err, result }, 'error in pack archive worker')
          return callback(err)
        }
        if (shutDownRequested) {
          logger.warn('shutting down pack archive worker')
          return callback(new Error('shutdown'))
        }
        return setTimeout(() => callback(err, result), DOCUMENT_PACK_DELAY)
      }
      if (_id == null) {
        return PackManager.pushOldPacks(projectId, docId, handler)
      } else {
        return PackManager.processOldPack(projectId, docId, _id, handler)
      }
    },
    function (err, results) {
      if (err != null && err.message !== 'shutdown') {
        logger.error({ err }, 'error in pack archive worker processUpdates')
      }
      return finish()
    }
  )
// find the packs which can be archived

const ObjectIdFromDate = function (date) {
  const id = Math.floor(date.getTime() / 1000).toString(16) + '0000000000000000'
  return ObjectId(id)
}

// new approach, two passes
// find packs to be marked as finalised:true, those which have a newer pack present
// then only consider finalised:true packs for archiving

waitForDb()
  .then(() => {
    if (pending != null) {
      logger.debug(`got ${pending.length} entries from ${source}`)
      processUpdates(pending)
    } else {
      processFromOneWeekAgo()
    }
  })
  .catch(err => {
    logger.fatal({ err }, 'cannot connect to mongo, exiting')
    process.exit(1)
  })

function processFromOneWeekAgo() {
  const oneWeekAgo = new Date(Date.now() - 7 * DAYS)
  db.docHistory
    .find(
      {
        expiresAt: { $exists: false },
        project_id: { $exists: true },
        v_end: { $exists: true },
        _id: { $lt: ObjectIdFromDate(oneWeekAgo) },
        last_checked: { $lt: oneWeekAgo },
      },
      { projection: { _id: 1, doc_id: 1, project_id: 1 } }
    )
    .sort({
      last_checked: 1,
    })
    .limit(LIMIT)
    .toArray(function (err, results) {
      if (err != null) {
        logger.debug({ err }, 'error checking for updates')
        finish()
        return
      }
      pending = _.uniq(results, false, result => result.doc_id.toString())
      TOTAL = pending.length
      logger.debug(`found ${TOTAL} documents to archive`)
      return processUpdates(pending)
    })
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
