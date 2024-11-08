const MongoManager = require('./MongoManager')
const Errors = require('./Errors')
const logger = require('@overleaf/logger')
const _ = require('lodash')
const DocArchive = require('./DocArchiveManager')
const RangeManager = require('./RangeManager')
const Settings = require('@overleaf/settings')
const { callbackifyAll } = require('@overleaf/promise-utils')
const { setTimeout } = require('node:timers/promises')

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

    const doc = await MongoManager.promises.findDoc(projectId, docId, filter)

    if (doc == null) {
      throw new Errors.NotFoundError(
        `No such doc: ${docId} in project ${projectId}`
      )
    }

    if (doc.inS3) {
      await DocArchive.promises.unarchiveDoc(projectId, docId)
      return await DocManager._getDoc(projectId, docId, filter)
    }

    return doc
  },

  async isDocDeleted(projectId, docId) {
    const doc = await MongoManager.promises.findDoc(projectId, docId, {
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
    const doc = await MongoManager.promises.findDoc(projectId, docId, {
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
      const archivedDoc = await DocArchive.promises.getDoc(projectId, docId)
      Object.assign(doc, archivedDoc)
    }

    return doc
  },

  // get the doc from mongo if possible, or from the persistent store otherwise,
  // without unarchiving it (avoids unnecessary writes to mongo)
  async peekDoc(projectId, docId) {
    const doc = await DocManager._peekRawDoc(projectId, docId)
    await MongoManager.promises.checkRevUnchanged(doc)
    return doc
  },

  async getDocLines(projectId, docId) {
    const doc = await DocManager._getDoc(projectId, docId, {
      lines: true,
      inS3: true,
    })
    return doc
  },

  async getAllDeletedDocs(projectId, filter) {
    return await MongoManager.promises.getProjectsDeletedDocs(projectId, filter)
  },

  async getAllNonDeletedDocs(projectId, filter) {
    await DocArchive.promises.unArchiveAllDocs(projectId)
    const docs = await MongoManager.promises.getProjectsDocs(
      projectId,
      { include_deleted: false },
      filter
    )
    if (docs == null) {
      throw new Errors.NotFoundError(`No docs for project ${projectId}`)
    }
    return docs
  },

  async projectHasRanges(projectId) {
    const docs = await MongoManager.promises.getProjectsDocs(
      projectId,
      {},
      { _id: 1 }
    )
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
      await MongoManager.promises.upsertIntoDocCollection(
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
    const doc = await MongoManager.promises.findDoc(
      projectId,
      docId,
      projection
    )
    if (!doc) {
      throw new Errors.NotFoundError(
        `No such project/doc to delete: ${projectId}/${docId}`
      )
    }

    if (meta.deleted && Settings.docstore.archiveOnSoftDelete) {
      // The user will not read this doc anytime soon. Flush it out of mongo.
      DocArchive.promises.archiveDoc(projectId, docId).catch(err => {
        logger.warn(
          { projectId, docId, err },
          'archiving a single doc in the background failed'
        )
      })
    }

    await MongoManager.promises.patchDoc(projectId, docId, meta)
  },
}

module.exports = {
  ...callbackifyAll(DocManager, {
    multiResult: {
      updateDoc: ['modified', 'rev'],
    },
  }),
  promises: DocManager,
}
