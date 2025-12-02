import MongoManager from './MongoManager.js'
import Errors from './Errors.js'
import logger from '@overleaf/logger'
import _ from 'lodash'
import DocArchive from './DocArchiveManager.js'
import RangeManager from './RangeManager.js'
import Settings from '@overleaf/settings'
import { setTimeout } from 'node:timers/promises'

/**
 * @import { Document } from 'mongodb'
 * @import { WithId } from 'mongodb'
 */

const DocManager = {
  /**
   * @param {string} projectId
   * @param {string} docId
   * @param {{inS3: boolean}} filter
   * @returns {Promise<WithId<Document>>}
   * @private
   */
  async _getDoc(projectId, docId, filter) {
    if (filter == null) {
      filter = {}
    }
    if (filter.inS3 !== true) {
      throw new Error('must include inS3 when getting doc')
    }

    const doc = await MongoManager.findDoc(projectId, docId, filter)

    if (doc == null) {
      throw new Errors.NotFoundError(
        `No such doc: ${docId} in project ${projectId}`
      )
    }

    if (doc.inS3) {
      await DocArchive.unarchiveDoc(projectId, docId)
      return await DocManager._getDoc(projectId, docId, filter)
    }

    if (filter.ranges) {
      RangeManager.fixCommentIds(doc)
    }

    return doc
  },

  async isDocDeleted(projectId, docId) {
    const doc = await MongoManager.findDoc(projectId, docId, {
      deleted: true,
    })

    if (!doc) {
      throw new Errors.NotFoundError(
        `No such project/doc: ${projectId}/${docId}`
      )
    }

    // `doc.deleted` is `undefined` for non deleted docs
    return Boolean(doc.deleted)
  },

  async getFullDoc(projectId, docId) {
    const doc = await DocManager._getDoc(projectId, docId, {
      lines: true,
      rev: true,
      deleted: true,
      version: true,
      ranges: true,
      inS3: true,
    })
    return doc
  },

  // returns the doc without any version information
  async _peekRawDoc(projectId, docId) {
    const doc = await MongoManager.findDoc(projectId, docId, {
      lines: true,
      rev: true,
      deleted: true,
      version: true,
      ranges: true,
      inS3: true,
    })

    if (doc == null) {
      throw new Errors.NotFoundError(
        `No such doc: ${docId} in project ${projectId}`
      )
    }

    if (doc.inS3) {
      // skip the unarchiving to mongo when getting a doc
      const archivedDoc = await DocArchive.getDoc(projectId, docId)
      Object.assign(doc, archivedDoc)
    }

    return doc
  },

  // get the doc from mongo if possible, or from the persistent store otherwise,
  // without unarchiving it (avoids unnecessary writes to mongo)
  async peekDoc(projectId, docId) {
    const doc = await DocManager._peekRawDoc(projectId, docId)
    await MongoManager.checkRevUnchanged(doc)
    return doc
  },

  async getDocLines(projectId, docId) {
    const doc = await DocManager._getDoc(projectId, docId, {
      lines: true,
      inS3: true,
    })
    if (!doc) throw new Errors.NotFoundError()
    if (!Array.isArray(doc.lines)) throw new Errors.DocWithoutLinesError()
    return doc.lines.join('\n')
  },

  async getAllDeletedDocs(projectId, filter) {
    return await MongoManager.getProjectsDeletedDocs(projectId, filter)
  },

  async getAllNonDeletedDocs(projectId, filter) {
    await DocArchive.unArchiveAllDocs(projectId)
    const docs = await MongoManager.getProjectsDocs(
      projectId,
      { include_deleted: false },
      filter
    )
    if (docs == null) {
      throw new Errors.NotFoundError(`No docs for project ${projectId}`)
    }
    if (filter.ranges) {
      for (const doc of docs) {
        RangeManager.fixCommentIds(doc)
      }
    }
    return docs
  },

  async getCommentThreadIds(projectId) {
    const docs = await DocManager.getAllNonDeletedDocs(projectId, {
      _id: true,
      ranges: true,
    })
    const byDoc = new Map()
    for (const doc of docs) {
      const ids = new Set()
      for (const comment of doc.ranges?.comments || []) {
        ids.add(comment.op.t)
      }
      if (ids.size > 0) byDoc.set(doc._id.toString(), Array.from(ids))
    }
    return Object.fromEntries(byDoc.entries())
  },

  async getTrackedChangesUserIds(projectId) {
    const docs = await DocManager.getAllNonDeletedDocs(projectId, {
      ranges: true,
    })
    const userIds = new Set()
    for (const doc of docs) {
      for (const change of doc.ranges?.changes || []) {
        if (change.metadata.user_id === 'anonymous-user') continue
        userIds.add(change.metadata.user_id)
      }
    }
    return Array.from(userIds)
  },

  async projectHasRanges(projectId) {
    const docs = await MongoManager.getProjectsDocs(projectId, {}, { _id: 1 })
    const docIds = docs.map(doc => doc._id)
    for (const docId of docIds) {
      const doc = await DocManager.peekDoc(projectId, docId)
      if (
        (doc.ranges?.comments != null && doc.ranges.comments.length > 0) ||
        (doc.ranges?.changes != null && doc.ranges.changes.length > 0)
      ) {
        return true
      }
    }
    return false
  },

  async updateDoc(projectId, docId, lines, version, ranges) {
    const MAX_ATTEMPTS = 2
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { modified, rev } = await DocManager._tryUpdateDoc(
          projectId,
          docId,
          lines,
          version,
          ranges
        )
        return { modified, rev }
      } catch (err) {
        if (err instanceof Errors.DocRevValueError && attempt < MAX_ATTEMPTS) {
          // Another updateDoc call was racing with ours.
          // Retry once in a bit.
          logger.warn(
            { projectId, docId, err },
            'detected concurrent updateDoc call'
          )
          await setTimeout(100 + Math.random() * 100)
          continue
        } else {
          throw err
        }
      }
    }
  },

  async _tryUpdateDoc(projectId, docId, lines, version, ranges) {
    if (lines == null || version == null || ranges == null) {
      throw new Error('no lines, version or ranges provided')
    }

    let doc
    try {
      doc = await DocManager._getDoc(projectId, docId, {
        version: true,
        rev: true,
        lines: true,
        ranges: true,
        inS3: true,
      })
    } catch (err) {
      if (err instanceof Errors.NotFoundError) {
        doc = null
      } else {
        throw err
      }
    }

    ranges = RangeManager.jsonRangesToMongo(ranges)

    let updateLines, updateRanges, updateVersion
    if (doc == null) {
      // If the document doesn't exist, we'll make sure to create/update all parts of it.
      updateLines = true
      updateVersion = true
      updateRanges = true
    } else {
      if (doc.version > version) {
        // Reject update when the version was decremented.
        // Potential reasons: racing flush, broken history.
        throw new Errors.DocVersionDecrementedError('rejecting stale update', {
          updateVersion: version,
          flushedVersion: doc.version,
        })
      }
      updateLines = !_.isEqual(doc.lines, lines)
      updateVersion = doc.version !== version
      updateRanges = RangeManager.shouldUpdateRanges(doc.ranges, ranges)
    }

    let modified = false
    let rev = doc?.rev || 0

    if (updateLines || updateRanges || updateVersion) {
      const update = {}
      if (updateLines) {
        update.lines = lines
      }
      if (updateRanges) {
        update.ranges = ranges
      }
      if (updateVersion) {
        update.version = version
      }
      logger.debug(
        { projectId, docId, oldVersion: doc?.version, newVersion: version },
        'updating doc'
      )

      if (updateLines || updateRanges) {
        rev += 1 // rev will be incremented in mongo by MongoManager.upsertIntoDocCollection
      }

      modified = true
      await MongoManager.upsertIntoDocCollection(
        projectId,
        docId,
        doc?.rev,
        update
      )
    } else {
      logger.debug({ projectId, docId }, 'doc has not changed - not updating')
    }

    return { modified, rev }
  },

  async patchDoc(projectId, docId, meta) {
    const projection = { _id: 1, deleted: true }
    const doc = await MongoManager.findDoc(projectId, docId, projection)
    if (!doc) {
      throw new Errors.NotFoundError(
        `No such project/doc to delete: ${projectId}/${docId}`
      )
    }

    if (meta.deleted && Settings.docstore.archiveOnSoftDelete) {
      // The user will not read this doc anytime soon. Flush it out of mongo.
      DocArchive.archiveDoc(projectId, docId).catch(err => {
        logger.warn(
          { projectId, docId, err },
          'archiving a single doc in the background failed'
        )
      })
    }

    await MongoManager.patchDoc(projectId, docId, meta)
  },
}

export default DocManager
