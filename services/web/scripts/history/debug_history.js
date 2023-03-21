// Script to debug the track-changes history of the documents in a project.
// Usage:
//   node debug_history.js --project-id=<project_id>
//   node debug_history.js --all   # to check all unmigrated projects
//
// Example output:
//   $ node scripts/debug_history.js  --project-id=63ff3adc06177192f18a6b38
//   Using default settings from /overleaf/services/track-changes/config/settings.defaults.js
//   Set UV_THREADPOOL_SIZE=16
//   project 63ff3adc06177192f18a6b38 docId 63ff3adc06177192f18a6b3d OK
//   project 63ff3adc06177192f18a6b38 docId 63ff3b08de41e3b0989c1720 FAILED
//   {"action":"rewinding","version":7,"meta":{"start_ts":1677671465447,"end_ts":1677671465447,"user_id":"632ae106f9a6dd002505765b"},
//   "ops":[{"action":"rewindOp","contentLength":24,"op":{"p":32,"d":6},"errors":[{"message":"invalid offset rewinding delete,
//   truncating to content length","op":{"p":32,"d":6},"contentLength":24}]}],"status":"failed"}

/* eslint-disable camelcase */
const TrackChangesMongoDb = require('../../../track-changes/app/js/mongodb')
const { waitForDb } = require('../../app/src/infrastructure/mongodb')
const {
  findProjects,
} = require('../../modules/history-migration/app/src/HistoryUpgradeHelper')
const PackManager = require('../../../track-changes/app/js/PackManager')
const {
  packsAreDuplicated,
} = require('../../../track-changes/app/js/util/PackUtils')
const {
  ConsistencyError,
} = require('../../../track-changes/app/js/DiffGenerator')
const DocumentUpdaterManager = require('../../../track-changes/app/js/DocumentUpdaterManager')
const DocstoreManager = require('../../../track-changes/app/js/DocstoreManager')
const Errors = require('../../../track-changes/app/js/Errors')
const minimist = require('minimist')
const util = require('util')
const logger = require('@overleaf/logger')
logger.initialize('debug-history')
// disable logging to stdout from internal modules
logger.logger.streams = []

const options = {
  boolean: ['all', 'verbose', 'raw', 'help'],
  string: ['project-id'],
  alias: {
    'project-id': 'p',
    verbose: 'v',
    raw: 'r',
    help: 'h',
    all: 'a',
  },
  default: {},
}
const argv = minimist(process.argv.slice(2), options)

function usage() {
  console.log(
    `Usage: ${process.argv[1]} [--project-id=<project_id> | --all] [--verbose] [--raw]`
  )
  process.exit(1)
}

// look in docstore or docupdater for the latest version of the document
async function getLatestContent(projectId, docId, lastUpdateVersion) {
  const [docstoreContent, docstoreVersion] =
    await DocstoreManager.promises.peekDocument(projectId, docId)

  // if docstore is out of date, check for a newer version in docupdater
  // and return that instead
  if (docstoreVersion <= lastUpdateVersion) {
    const [docupdaterContent, docupdaterVersion] =
      await DocumentUpdaterManager.promises.peekDocument(projectId, docId)
    if (docupdaterVersion > docstoreVersion) {
      return [docupdaterContent, docupdaterVersion]
    }
  }

  return [docstoreContent, docstoreVersion]
}

// This class is used to write a record of all the operations that have been applied to a document
class LogAppliedOps {
  constructor() {
    this.result = []
  }

  // used to log the initial state of the document
  start(action, latestContent, version) {
    this.result.push({
      action,
      latestContentLength: latestContent.length,
      latestContent: argv.raw ? latestContent : undefined,
      version,
    })
  }

  // used to log a new document update
  update(action, update) {
    this._finalize()
    this.opResults = []
    this.currentResult = {
      action,
      version: update.v,
      meta: update.meta,
      ops: this.opResults,
    }
    this.result.push(this.currentResult)
  }

  // used to log an operation that has been applied to the document
  op(action, content, op) {
    this.currentOp = {
      action,
      contentLength: content.length,
      content: argv.raw ? content : undefined,
      op: this._filterOp(op),
    }
    this.opResults.push(this.currentOp)
  }

  // used to log an error that occurred while applying an operation
  opError(message, content, op, err) {
    this.currentOp.errors = this.currentOp.errors || []
    this.currentOp.errors.push({
      message,
      op: this._filterOp(op),
      contentLength: content.length,
      content: argv.raw ? content : undefined,
      err,
    })
  }

  // sets the status of the current update to 'success' or 'failed'
  // depending on whether any errors were logged
  _finalize() {
    if (!this.currentResult) {
      return
    }
    const errors = this.opResults.some(op => op.errors)
    this.currentResult.status = errors ? 'failed' : 'success'
  }

  // returns the final result of the log
  end() {
    this._finalize()
    return this.result
  }

  // Returns a new object with the same keys as op, but with the i and d
  // fields replaced by their lengths when present. This is used to filter
  // out the contents of the i and d fields of an operation, to redact
  // document content.
  _filterOp(op) {
    const newOp = {}
    for (const key of Object.keys(op)) {
      if (!argv.raw && (key === 'i' || key === 'd')) {
        newOp[key] = op[key].length
      } else {
        newOp[key] = op[key]
      }
    }
    return newOp
  }
}

// This is the rewindOp function from track-changes, modified to log
// the operation and any errors.
function rewindOp(content, op, log) {
  if (op.i != null) {
    // ShareJS will accept an op where p > content.length when applied,
    // and it applies as though p == content.length. However, the op is
    // passed to us with the original p > content.length. Detect if that
    // is the case with this op, and shift p back appropriately to match
    // ShareJS if so.
    let { p } = op
    const maxP = content.length - op.i.length
    if (p > maxP) {
      log.opError(
        'invalid offset rewinding insert, truncating to content length',
        content,
        op
      )
      p = maxP
    }
    const textToBeRemoved = content.slice(p, p + op.i.length)
    if (op.i !== textToBeRemoved) {
      log.opError(
        'inserted content does not match text to be removed',
        content,
        op
      )
      throw new ConsistencyError(
        `Inserted content, '${op.i}', does not match text to be removed, '${textToBeRemoved}'`
      )
    }
    return content.slice(0, p) + content.slice(p + op.i.length)
  } else if (op.d != null) {
    if (op.p > content.length) {
      log.opError(
        'invalid offset rewinding delete, truncating to content length',
        content,
        op
      )
    }
    return content.slice(0, op.p) + op.d + content.slice(op.p)
  } else {
    return content
  }
}

// This is the rewindDoc function from track-changes, modified to log all
// operations that are applied to the document.
async function rewindDoc(projectId, docId) {
  const log = new LogAppliedOps()
  // Prepare to rewind content
  const docIterator = await PackManager.promises.makeDocIterator(docId)
  const getUpdate = util.promisify(docIterator.next).bind(docIterator)

  const lastUpdate = await getUpdate()
  if (!lastUpdate) {
    return null
  }

  const lastUpdateVersion = lastUpdate.v

  let latestContent
  let version
  try {
    ;[latestContent, version] = await getLatestContent(
      projectId,
      docId,
      lastUpdateVersion
    )
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      // Doc not found in docstore. We can't build its history
      return null
    } else {
      throw err
    }
  }
  log.start('load-doc', latestContent, version)

  let content = latestContent
  let update = lastUpdate
  let previousUpdate = null

  while (update) {
    if (packsAreDuplicated(update, previousUpdate)) {
      previousUpdate = update
      update = await getUpdate()
      continue
    }
    log.update('rewinding', update)
    for (let i = update.op.length - 1; i >= 0; i--) {
      const op = update.op[i]
      if (op.broken === true) {
        log.op('skipped', content, op)
        continue
      }
      try {
        log.op('rewindOp', content, op)
        content = rewindOp(content, op, log)
      } catch (e) {
        if (e instanceof ConsistencyError && (i = update.op.length - 1)) {
          // catch known case where the last op in an array has been
          // merged into a later op
          op.broken = true
          log.opError('marking broken', content, op)
        } else {
          log.opError('failed', content, op, e)
        }
      }
    }
    previousUpdate = update
    update = await getUpdate()
  }
  return log.end()
}

async function main() {
  // Get a list of projects to migrate
  let projectIds = []
  if (argv.all) {
    const projectsToMigrate = await findProjects(
      { 'overleaf.history.display': { $ne: true } },
      { _id: 1, overleaf: 1 }
    )
    projectIds = projectsToMigrate.map(p => p._id.toString())
    console.log('Unmigrated projects', projectIds.length)
  } else if (argv['project-id']) {
    projectIds = [argv['project-id']]
  } else {
    usage()
    process.exit(1)
  }
  let errorCount = 0
  for (const projectId of projectIds) {
    const docIds = await PackManager.promises.findAllDocsInProject(projectId)
    if (!docIds.length) {
      console.log('No docs found for project', projectId)
    }
    let projectErrorCount = 0
    for (const docId of docIds) {
      const result = await rewindDoc(projectId, docId)
      const failed = result.filter(r => r.status === 'failed')
      errorCount += failed.length
      if (argv.verbose) {
        console.log(JSON.stringify({ projectId, docId, result }, null, 2))
      } else if (failed.length > 0) {
        console.log('project', projectId, 'docId', docId, 'FAILED')
        for (const f of failed) {
          console.log(JSON.stringify(f))
        }
        projectErrorCount += failed.length
      }
    }
    if (projectErrorCount === 0 && !argv.verbose) {
      console.log('project', projectId, 'docs', docIds.length, 'OK')
    }
  }
  process.exit(errorCount > 0 ? 1 : 0)
}

waitForDb()
  .then(TrackChangesMongoDb.waitForDb)
  .then(main)
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
