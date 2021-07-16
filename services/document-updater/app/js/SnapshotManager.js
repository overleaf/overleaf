/* eslint-disable
    camelcase,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SnapshotManager
const { db, ObjectId } = require('./mongodb')

module.exports = SnapshotManager = {
  recordSnapshot(
    project_id,
    doc_id,
    version,
    pathname,
    lines,
    ranges,
    callback
  ) {
    try {
      project_id = ObjectId(project_id)
      doc_id = ObjectId(doc_id)
    } catch (error) {
      return callback(error)
    }
    db.docSnapshots.insertOne(
      {
        project_id,
        doc_id,
        version,
        lines,
        pathname,
        ranges: SnapshotManager.jsonRangesToMongo(ranges),
        ts: new Date(),
      },
      callback
    )
  },
  // Suggested indexes:
  //   db.docSnapshots.createIndex({project_id:1, doc_id:1})
  //   db.docSnapshots.createIndex({ts:1},{expiresAfterSeconds: 30*24*3600)) # expires after 30 days

  jsonRangesToMongo(ranges) {
    if (ranges == null) {
      return null
    }

    const updateMetadata = function (metadata) {
      if ((metadata != null ? metadata.ts : undefined) != null) {
        metadata.ts = new Date(metadata.ts)
      }
      if ((metadata != null ? metadata.user_id : undefined) != null) {
        return (metadata.user_id = SnapshotManager._safeObjectId(
          metadata.user_id
        ))
      }
    }

    for (const change of Array.from(ranges.changes || [])) {
      change.id = SnapshotManager._safeObjectId(change.id)
      updateMetadata(change.metadata)
    }
    for (const comment of Array.from(ranges.comments || [])) {
      comment.id = SnapshotManager._safeObjectId(comment.id)
      if ((comment.op != null ? comment.op.t : undefined) != null) {
        comment.op.t = SnapshotManager._safeObjectId(comment.op.t)
      }
      updateMetadata(comment.metadata)
    }
    return ranges
  },

  _safeObjectId(data) {
    try {
      return ObjectId(data)
    } catch (error) {
      return data
    }
  },
}
