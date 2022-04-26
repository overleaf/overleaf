const { callbackify } = require('util')
const MongoManager = require('./MongoManager').promises
const Errors = require('./Errors')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const crypto = require('crypto')
const Streamifier = require('streamifier')
const RangeManager = require('./RangeManager')
const PersistorManager = require('./PersistorManager')
const pMap = require('p-map')

const PARALLEL_JOBS = Settings.parallelArchiveJobs
const ARCHIVE_BATCH_SIZE = Settings.archiveBatchSize
const UN_ARCHIVE_BATCH_SIZE = Settings.unArchiveBatchSize

module.exports = {
  archiveAllDocs: callbackify(archiveAllDocs),
  archiveDocById: callbackify(archiveDocById),
  archiveDoc: callbackify(archiveDoc),
  unArchiveAllDocs: callbackify(unArchiveAllDocs),
  unarchiveDoc: callbackify(unarchiveDoc),
  destroyProject: callbackify(destroyProject),
  getDoc: callbackify(getDoc),
  promises: {
    archiveAllDocs,
    archiveDocById,
    archiveDoc,
    unArchiveAllDocs,
    unarchiveDoc,
    destroyProject,
    getDoc,
  },
}

async function archiveAllDocs(projectId) {
  while (true) {
    const docs = await MongoManager.getNonArchivedProjectDocs(
      projectId,
      ARCHIVE_BATCH_SIZE
    )
    if (!docs || docs.length === 0) {
      break
    }

    await pMap(docs, doc => archiveDoc(projectId, doc), {
      concurrency: PARALLEL_JOBS,
    })
  }
}

async function archiveDocById(projectId, docId) {
  const doc = await MongoManager.findDoc(projectId, docId, {
    lines: true,
    ranges: true,
    rev: true,
    inS3: true,
  })

  if (!doc) {
    throw new Errors.NotFoundError(
      `Cannot find doc ${docId} in project ${projectId}`
    )
  }

  if (doc.inS3) {
    // No need to throw an error if the doc is already archived
    return
  }
  await archiveDoc(projectId, doc)
}

async function archiveDoc(projectId, doc) {
  logger.log(
    { project_id: projectId, doc_id: doc._id },
    'sending doc to persistor'
  )
  const key = `${projectId}/${doc._id}`

  if (doc.lines == null) {
    throw new Error('doc has no lines')
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
  const stream = Streamifier.createReadStream(json)
  await PersistorManager.sendStream(Settings.docstore.bucket, key, stream, {
    sourceMd5: md5,
  })
  await MongoManager.markDocAsArchived(doc._id, doc.rev)
}

async function unArchiveAllDocs(projectId) {
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
  const buffer = await _streamToBuffer(stream)
  const md5 = crypto.createHash('md5').update(buffer).digest('hex')
  if (sourceMd5 !== md5) {
    throw new Errors.Md5MismatchError('md5 mismatch when downloading doc', {
      key,
      sourceMd5,
      md5,
    })
  }

  const json = buffer.toString()
  return _deserializeArchivedDoc(json)
}

// get the doc and unarchive it to mongo
async function unarchiveDoc(projectId, docId) {
  logger.log({ projectId, docId }, 'getting doc from persistor')
  const mongoDoc = await MongoManager.findDoc(projectId, docId, {
    inS3: 1,
    rev: 1,
  })
  if (!mongoDoc.inS3) {
    // The doc is already unarchived
    return
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

async function _streamToBuffer(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function _deserializeArchivedDoc(json) {
  const doc = JSON.parse(json)

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
