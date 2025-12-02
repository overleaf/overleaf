import mongodb from './mongodb.js'
import Settings from '@overleaf/settings'
import Errors from './Errors.js'

const { db, ObjectId } = mongodb

const ARCHIVING_LOCK_DURATION_MS = Settings.archivingLockDurationMs

async function findDoc(projectId, docId, projection) {
  const doc = await db.docs.findOne(
    {
      _id: new ObjectId(docId.toString()),
      project_id: new ObjectId(projectId.toString()),
    },
    { projection }
  )
  if (doc && projection.version && !doc.version) {
    doc.version = 0
  }
  return doc
}

async function getProjectsDeletedDocs(projectId, projection) {
  const docs = await db.docs
    .find(
      {
        project_id: new ObjectId(projectId.toString()),
        deleted: true,
      },
      {
        projection,
        sort: { deletedAt: -1 },
        limit: Settings.max_deleted_docs,
      }
    )
    .toArray()
  return docs
}

async function getProjectsDocs(projectId, options, projection) {
  const query = { project_id: new ObjectId(projectId.toString()) }
  if (!options.include_deleted) {
    query.deleted = { $ne: true }
  }
  const queryOptions = {
    projection,
  }
  if (options.limit) {
    queryOptions.limit = options.limit
  }
  const docs = await db.docs.find(query, queryOptions).toArray()
  return docs
}

async function getArchivedProjectDocs(projectId, maxResults) {
  const query = {
    project_id: new ObjectId(projectId.toString()),
    inS3: true,
  }
  const docs = await db.docs
    .find(query, { projection: { _id: 1 }, limit: maxResults })
    .toArray()
  return docs
}

async function getNonArchivedProjectDocIds(projectId) {
  const docs = await db.docs
    .find(
      {
        project_id: new ObjectId(projectId),
        inS3: { $ne: true },
      },
      { projection: { _id: 1 } }
    )
    .map(doc => doc._id)
    .toArray()
  return docs
}

async function getNonDeletedArchivedProjectDocs(projectId, maxResults) {
  const query = {
    project_id: new ObjectId(projectId.toString()),
    deleted: { $ne: true },
    inS3: true,
  }
  const docs = await db.docs
    .find(query, { projection: { _id: 1 }, limit: maxResults })
    .toArray()
  return docs
}

async function upsertIntoDocCollection(projectId, docId, previousRev, updates) {
  if (previousRev) {
    const update = {
      $set: updates,
      $unset: { inS3: true },
    }
    if (updates.lines || updates.ranges) {
      update.$inc = { rev: 1 }
    }
    const result = await db.docs.updateOne(
      {
        _id: new ObjectId(docId),
        project_id: new ObjectId(projectId),
        rev: previousRev,
      },
      update
    )
    if (result.matchedCount !== 1) {
      throw new Errors.DocRevValueError()
    }
  } else {
    try {
      await db.docs.insertOne({
        _id: new ObjectId(docId),
        project_id: new ObjectId(projectId),
        rev: 1,
        ...updates,
      })
    } catch (err) {
      if (err.code === 11000) {
        // duplicate doc _id
        throw new Errors.DocRevValueError()
      } else {
        throw err
      }
    }
  }
}

async function patchDoc(projectId, docId, meta) {
  await db.docs.updateOne(
    {
      _id: new ObjectId(docId),
      project_id: new ObjectId(projectId),
    },
    { $set: meta }
  )
}

/**
 * Fetch a doc and lock it for archiving
 *
 * This will return null if the doc is not found, if it's already archived or
 * if the lock can't be acquired.
 */
async function getDocForArchiving(projectId, docId) {
  const archivingUntil = new Date(Date.now() + ARCHIVING_LOCK_DURATION_MS)
  const result = await db.docs.findOneAndUpdate(
    {
      _id: new ObjectId(docId),
      project_id: new ObjectId(projectId),
      inS3: { $ne: true },
      $or: [{ archivingUntil: null }, { archivingUntil: { $lt: new Date() } }],
    },
    { $set: { archivingUntil } },
    {
      projection: { lines: 1, ranges: 1, rev: 1 },
      includeResultMetadata: true,
    }
  )
  return result.value
}

/**
 * Clear the doc contents from Mongo and release the archiving lock
 */
async function markDocAsArchived(projectId, docId, rev) {
  await db.docs.updateOne(
    { _id: new ObjectId(docId), rev },
    {
      $set: { inS3: true },
      $unset: { lines: 1, ranges: 1, archivingUntil: 1 },
    }
  )
}

/**
 * Restore an archived doc
 *
 * This checks that the archived doc's rev matches.
 */
async function restoreArchivedDoc(projectId, docId, archivedDoc) {
  const query = {
    _id: new ObjectId(docId),
    project_id: new ObjectId(projectId),
    rev: archivedDoc.rev,
  }
  const update = {
    $set: {
      lines: archivedDoc.lines,
      ranges: archivedDoc.ranges || {},
    },
    $unset: {
      inS3: true,
    },
  }
  const result = await db.docs.updateOne(query, update)

  if (result.matchedCount === 0) {
    throw new Errors.DocRevValueError('failed to unarchive doc', {
      docId,
      rev: archivedDoc.rev,
    })
  }
}

async function getDocRev(docId) {
  const doc = await db.docs.findOne(
    { _id: new ObjectId(docId.toString()) },
    { projection: { rev: 1 } }
  )
  return doc && doc.rev
}

/**
 * Helper method  to support optimistic locking.
 *
 * Check that the rev of an existing doc is unchanged. If the rev has
 * changed, return a DocModifiedError.
 */
async function checkRevUnchanged(doc) {
  const currentRev = await getDocRev(doc._id)
  if (isNaN(currentRev) || isNaN(doc.rev)) {
    throw new Errors.DocRevValueError('doc rev is NaN', {
      doc_id: doc._id,
      rev: doc.rev,
      currentRev,
    })
  }
  if (doc.rev !== currentRev) {
    throw new Errors.DocModifiedError('doc rev has changed', {
      doc_id: doc._id,
      rev: doc.rev,
      currentRev,
    })
  }
}

async function destroyProject(projectId) {
  await db.docs.deleteMany({ project_id: new ObjectId(projectId) })
}

export default {
  findDoc,
  getProjectsDeletedDocs,
  getProjectsDocs,
  getArchivedProjectDocs,
  getNonArchivedProjectDocIds,
  getNonDeletedArchivedProjectDocs,
  upsertIntoDocCollection,
  restoreArchivedDoc,
  patchDoc,
  getDocForArchiving,
  markDocAsArchived,
  checkRevUnchanged,
  destroyProject,
}
