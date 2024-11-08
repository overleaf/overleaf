const { callbackify } = require('node:util')
const MongoManager = require('./MongoManager').promises
const Errors = require('./Errors')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const crypto = require('node:crypto')
const { ReadableString } = require('@overleaf/stream-utils')
const RangeManager = require('./RangeManager')
const PersistorManager = require('./PersistorManager')
const pMap = require('p-map')
const { BSON } = require('mongodb-legacy')

const PARALLEL_JOBS = Settings.parallelArchiveJobs
const UN_ARCHIVE_BATCH_SIZE = Settings.unArchiveBatchSize

module.exports = {
  archiveAllDocs: callbackify(archiveAllDocs),
  archiveDoc: callbackify(archiveDoc),
  unArchiveAllDocs: callbackify(unArchiveAllDocs),
  unarchiveDoc: callbackify(unarchiveDoc),
  destroyProject: callbackify(destroyProject),
  getDoc: callbackify(getDoc),
  promises: {
    archiveAllDocs,
    archiveDoc,
    unArchiveAllDocs,
    unarchiveDoc,
    destroyProject,
    getDoc,
  },
}

async function archiveAllDocs(projectId) {
  if (!_isArchivingEnabled()) {
    return
  }

  const docIds = await MongoManager.getNonArchivedProjectDocIds(projectId)
  await pMap(docIds, docId => archiveDoc(projectId, docId), {
    concurrency: PARALLEL_JOBS,
  })
}

async function archiveDoc(projectId, docId) {
  if (!_isArchivingEnabled()) {
    return
  }

  const doc = await MongoManager.getDocForArchiving(projectId, docId)

  if (!doc) {
    // The doc wasn't found, it was already archived, or the lock couldn't be
    // acquired. Since we don't know which it is, silently return.
    return
  }

  logger.debug({ projectId, docId: doc._id }, 'sending doc to persistor')
  const key = `${projectId}/${doc._id}`

  if (doc.lines == null) {
    throw new Error('doc has no lines')
  }

  // warn about any oversized docs already in mongo
  const linesSize = BSON.calculateObjectSize(doc.lines || {})
  const rangesSize = BSON.calculateObjectSize(doc.ranges || {})
  if (
    linesSize > Settings.max_doc_length ||
    rangesSize > Settings.max_doc_length
  ) {
    logger.warn(
      { projectId, docId: doc._id, linesSize, rangesSize },
      'large doc found when archiving project'
    )
  }

  const json = JSON.stringify({
    lines: doc.lines,
    ranges: doc.ranges,
    rev: doc.rev,
    schema_v: 1,
  })

  // this should never happen, but protects against memory-corruption errors that
  // have happened in the past
  if (json.indexOf('\u0000') > -1) {
    const error = new Error('null bytes detected')
    logger.err({ err: error, doc }, error.message)
    throw error
  }

  const md5 = crypto.createHash('md5').update(json).digest('hex')
  const stream = new ReadableString(json)
  await PersistorManager.sendStream(Settings.docstore.bucket, key, stream, {
    sourceMd5: md5,
  })
  await MongoManager.markDocAsArchived(projectId, docId, doc.rev)
}

async function unArchiveAllDocs(projectId) {
  if (!_isArchivingEnabled()) {
    return
  }

  while (true) {
    let docs
    if (Settings.docstore.keepSoftDeletedDocsArchived) {
      docs = await MongoManager.getNonDeletedArchivedProjectDocs(
        projectId,
        UN_ARCHIVE_BATCH_SIZE
      )
    } else {
      docs = await MongoManager.getArchivedProjectDocs(
        projectId,
        UN_ARCHIVE_BATCH_SIZE
      )
    }
    if (!docs || docs.length === 0) {
      break
    }
    await pMap(docs, doc => unarchiveDoc(projectId, doc._id), {
      concurrency: PARALLEL_JOBS,
    })
  }
}

// get the doc from the PersistorManager without storing it in mongo
async function getDoc(projectId, docId) {
  const key = `${projectId}/${docId}`
  const sourceMd5 = await PersistorManager.getObjectMd5Hash(
    Settings.docstore.bucket,
    key
  )
  const stream = await PersistorManager.getObjectStream(
    Settings.docstore.bucket,
    key
  )
  stream.resume()
  const buffer = await _streamToBuffer(projectId, docId, stream)
  const md5 = crypto.createHash('md5').update(buffer).digest('hex')
  if (sourceMd5 !== md5) {
    throw new Errors.Md5MismatchError('md5 mismatch when downloading doc', {
      key,
      sourceMd5,
      md5,
    })
  }

  return _deserializeArchivedDoc(buffer)
}

// get the doc and unarchive it to mongo
async function unarchiveDoc(projectId, docId) {
  logger.debug({ projectId, docId }, 'getting doc from persistor')
  const mongoDoc = await MongoManager.findDoc(projectId, docId, {
    inS3: 1,
    rev: 1,
  })
  if (!mongoDoc.inS3) {
    // The doc is already unarchived
    return
  }

  if (!_isArchivingEnabled()) {
    throw new Error(
      'found archived doc, but archiving backend is not configured'
    )
  }

  const archivedDoc = await getDoc(projectId, docId)
  if (archivedDoc.rev == null) {
    // Older archived docs didn't have a rev. Assume that the rev of the
    // archived doc is the rev that was stored in Mongo when we retrieved it
    // earlier.
    archivedDoc.rev = mongoDoc.rev
  }
  await MongoManager.restoreArchivedDoc(projectId, docId, archivedDoc)
}

async function destroyProject(projectId) {
  const tasks = [MongoManager.destroyProject(projectId)]
  if (_isArchivingEnabled()) {
    tasks.push(
      PersistorManager.deleteDirectory(Settings.docstore.bucket, projectId)
    )
  }
  await Promise.all(tasks)
}

async function _streamToBuffer(projectId, docId, stream) {
  const chunks = []
  let size = 0
  let logged = false
  const logIfTooLarge = finishedReading => {
    if (size <= Settings.max_doc_length) return
    // Log progress once and then again at the end.
    if (logged && !finishedReading) return
    logger.warn(
      { projectId, docId, size, finishedReading },
      'potentially large doc pulled down from gcs'
    )
    logged = true
  }
  return await new Promise((resolve, reject) => {
    stream.on('data', chunk => {
      size += chunk.byteLength
      logIfTooLarge(false)
      chunks.push(chunk)
    })
    stream.on('error', reject)
    stream.on('end', () => {
      logIfTooLarge(true)
      resolve(Buffer.concat(chunks))
    })
  })
}

function _deserializeArchivedDoc(buffer) {
  const doc = JSON.parse(buffer)

  const result = {}
  if (doc.schema_v === 1 && doc.lines != null) {
    result.lines = doc.lines
    if (doc.ranges != null) {
      result.ranges = RangeManager.jsonRangesToMongo(doc.ranges)
    }
  } else if (Array.isArray(doc)) {
    result.lines = doc
  } else {
    throw new Error("I don't understand the doc format in s3")
  }

  if (doc.rev != null) {
    result.rev = doc.rev
  }

  return result
}

function _isArchivingEnabled() {
  const backend = Settings.docstore.backend

  if (!backend) {
    return false
  }

  // The default backend is S3. If another backend is configured or the S3
  // backend itself is correctly configured, then archiving is enabled.
  if (backend === 's3' && Settings.docstore.s3 == null) {
    return false
  }

  return true
}
