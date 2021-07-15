const { callbackify } = require('util')
const MongoManager = require('./MongoManager').promises
const Errors = require('./Errors')
const logger = require('logger-sharelatex')
const settings = require('@overleaf/settings')
const crypto = require('crypto')
const Streamifier = require('streamifier')
const RangeManager = require('./RangeManager')
const PersistorManager = require('./PersistorManager')
const pMap = require('p-map')

const PARALLEL_JOBS = settings.parallelArchiveJobs
const ARCHIVE_BATCH_SIZE = settings.archiveBatchSize
const UN_ARCHIVE_BATCH_SIZE = settings.unArchiveBatchSize
const DESTROY_BATCH_SIZE = settings.destroyBatchSize
const DESTROY_RETRY_COUNT = settings.destroyRetryCount

module.exports = {
  archiveAllDocs: callbackify(archiveAllDocs),
  archiveDocById: callbackify(archiveDocById),
  archiveDoc: callbackify(archiveDoc),
  unArchiveAllDocs: callbackify(unArchiveAllDocs),
  unarchiveDoc: callbackify(unarchiveDoc),
  destroyAllDocs: callbackify(destroyAllDocs),
  destroyDoc: callbackify(destroyDoc),
  promises: {
    archiveAllDocs,
    archiveDocById,
    archiveDoc,
    unArchiveAllDocs,
    unarchiveDoc,
    destroyAllDocs,
    destroyDoc,
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

  // TODO(das7pad): consider refactoring MongoManager.findDoc to take a query
  if (doc.inS3) return
  return archiveDoc(projectId, doc)
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
  await PersistorManager.sendStream(settings.docstore.bucket, key, stream, {
    sourceMd5: md5,
  })
  await MongoManager.markDocAsArchived(doc._id, doc.rev)
}

async function unArchiveAllDocs(projectId) {
  while (true) {
    let docs
    if (settings.docstore.keepSoftDeletedDocsArchived) {
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

async function unarchiveDoc(projectId, docId) {
  logger.log(
    { project_id: projectId, doc_id: docId },
    'getting doc from persistor'
  )
  const originalDoc = await MongoManager.findDoc(projectId, docId, { inS3: 1 })
  if (!originalDoc.inS3) {
    // return if it's not actually in S3 as there's nothing to do
    return
  }
  const key = `${projectId}/${docId}`
  let stream, sourceMd5
  try {
    sourceMd5 = await PersistorManager.getObjectMd5Hash(
      settings.docstore.bucket,
      key
    )
    stream = await PersistorManager.getObjectStream(
      settings.docstore.bucket,
      key
    )
  } catch (err) {
    // if we get a 404, we could be in a race and something else has unarchived the doc already
    if (err instanceof Errors.NotFoundError) {
      const doc = await MongoManager.findDoc(projectId, docId, { inS3: 1 })
      if (!doc.inS3) {
        // the doc has been archived while we were looking for it, so no error
        return
      }
    }
    throw err
  }
  stream.resume()
  const json = await _streamToString(stream)
  const md5 = crypto.createHash('md5').update(json).digest('hex')
  if (sourceMd5 !== md5) {
    throw new Errors.Md5MismatchError('md5 mismatch when downloading doc', {
      key,
      sourceMd5,
      md5,
    })
  }

  const doc = JSON.parse(json)

  const mongoDoc = {}
  if (doc.schema_v === 1 && doc.lines != null) {
    mongoDoc.lines = doc.lines
    if (doc.ranges != null) {
      mongoDoc.ranges = RangeManager.jsonRangesToMongo(doc.ranges)
    }
  } else if (Array.isArray(doc)) {
    mongoDoc.lines = doc
  } else {
    throw new Error("I don't understand the doc format in s3")
  }
  await MongoManager.upsertIntoDocCollection(projectId, docId, mongoDoc)
  await PersistorManager.deleteObject(settings.docstore.bucket, key)
}

async function destroyAllDocs(projectId) {
  while (true) {
    const docs = await MongoManager.getProjectsDocs(
      projectId,
      { include_deleted: true, limit: DESTROY_BATCH_SIZE },
      { _id: 1 }
    )
    if (!docs || docs.length === 0) {
      break
    }
    await pMap(docs, doc => destroyDoc(projectId, doc._id), {
      concurrency: PARALLEL_JOBS,
    })
  }
}

async function destroyDoc(projectId, docId) {
  logger.log(
    { project_id: projectId, doc_id: docId },
    'removing doc from mongo and persistor'
  )
  const doc = await MongoManager.findDoc(projectId, docId, {
    inS3: 1,
  })
  if (!doc) {
    throw new Errors.NotFoundError('Doc not found in Mongo')
  }

  if (doc.inS3) {
    await destroyArchiveWithRetry(projectId, docId)
  }
  await MongoManager.destroyDoc(docId)
}

async function destroyArchiveWithRetry(projectId, docId) {
  let attempt = 0
  let lastError
  while (attempt++ <= DESTROY_RETRY_COUNT) {
    try {
      await PersistorManager.deleteObject(
        settings.docstore.bucket,
        `${projectId}/${docId}`
      )
      return
    } catch (err) {
      lastError = err
      logger.warn(
        { projectId, docId, err, attempt },
        'destroying archive failed'
      )
    }
  }
  throw lastError
}

async function _streamToString(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}
