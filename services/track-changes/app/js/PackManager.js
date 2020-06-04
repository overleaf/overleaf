/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let PackManager
const async = require('async')
const _ = require('underscore')
const { db, ObjectId, BSON } = require('./mongojs')
const logger = require('logger-sharelatex')
const LockManager = require('./LockManager')
const MongoAWS = require('./MongoAWS')
const Metrics = require('metrics-sharelatex')
const ProjectIterator = require('./ProjectIterator')
const Settings = require('settings-sharelatex')
const keys = Settings.redis.lock.key_schema

// Sharejs operations are stored in a 'pack' object
//
//  e.g.  a single sharejs update looks like
//
//   {
//     "doc_id" : 549dae9e0a2a615c0c7f0c98,
//     "project_id" : 549dae9c0a2a615c0c7f0c8c,
//     "op" : [ {"p" : 6981,	"d" : "?"	} ],
//     "meta" : {	"user_id" : 52933..., "start_ts" : 1422310693931,	"end_ts" : 1422310693931 },
//     "v" : 17082
//   }
//
//  and a pack looks like this
//
//   {
//     "doc_id" : 549dae9e0a2a615c0c7f0c98,
//     "project_id" : 549dae9c0a2a615c0c7f0c8c,
//     "pack" : [ U1, U2, U3, ...., UN],
//     "meta" : {	"user_id" : 52933..., "start_ts" : 1422310693931,	"end_ts" : 1422310693931 },
//     "v" : 17082
//     "v_end" : ...
//   }
//
//  where U1, U2, U3, .... are single updates stripped of their
//  doc_id and project_id fields (which are the same for all the
//  updates in the pack).
//
//  The pack itself has v and meta fields, this makes it possible to
//  treat packs and single updates in a similar way.
//
//  The v field of the pack itself is from the first entry U1, the
//  v_end field from UN.  The meta.end_ts field of the pack itself is
//  from the last entry UN, the meta.start_ts field from U1.

const DAYS = 24 * 3600 * 1000 // one day in milliseconds

module.exports = PackManager = {
  MAX_SIZE: 1024 * 1024, // make these configurable parameters
  MAX_COUNT: 1024,

  insertCompressedUpdates(
    project_id,
    doc_id,
    lastUpdate,
    newUpdates,
    temporary,
    callback
  ) {
    if (callback == null) {
      callback = function (error) {}
    }
    if (newUpdates.length === 0) {
      return callback()
    }

    // never append permanent ops to a pack that will expire
    if (
      (lastUpdate != null ? lastUpdate.expiresAt : undefined) != null &&
      !temporary
    ) {
      lastUpdate = null
    }

    const updatesToFlush = []
    const updatesRemaining = newUpdates.slice()

    let n = (lastUpdate != null ? lastUpdate.n : undefined) || 0
    let sz = (lastUpdate != null ? lastUpdate.sz : undefined) || 0

    while (
      updatesRemaining.length &&
      n < PackManager.MAX_COUNT &&
      sz < PackManager.MAX_SIZE
    ) {
      const nextUpdate = updatesRemaining[0]
      const nextUpdateSize = BSON.calculateObjectSize(nextUpdate)
      if (nextUpdateSize + sz > PackManager.MAX_SIZE && n > 0) {
        break
      }
      n++
      sz += nextUpdateSize
      updatesToFlush.push(updatesRemaining.shift())
    }

    return PackManager.flushCompressedUpdates(
      project_id,
      doc_id,
      lastUpdate,
      updatesToFlush,
      temporary,
      function (error) {
        if (error != null) {
          return callback(error)
        }
        return PackManager.insertCompressedUpdates(
          project_id,
          doc_id,
          null,
          updatesRemaining,
          temporary,
          callback
        )
      }
    )
  },

  flushCompressedUpdates(
    project_id,
    doc_id,
    lastUpdate,
    newUpdates,
    temporary,
    callback
  ) {
    if (callback == null) {
      callback = function (error) {}
    }
    if (newUpdates.length === 0) {
      return callback()
    }

    let canAppend = false
    // check if it is safe to append to an existing pack
    if (lastUpdate != null) {
      if (!temporary && lastUpdate.expiresAt == null) {
        // permanent pack appends to permanent pack
        canAppend = true
      }
      const age =
        Date.now() -
        (lastUpdate.meta != null ? lastUpdate.meta.start_ts : undefined)
      if (temporary && lastUpdate.expiresAt != null && age < 1 * DAYS) {
        // temporary pack appends to temporary pack if same day
        canAppend = true
      }
    }

    if (canAppend) {
      return PackManager.appendUpdatesToExistingPack(
        project_id,
        doc_id,
        lastUpdate,
        newUpdates,
        temporary,
        callback
      )
    } else {
      return PackManager.insertUpdatesIntoNewPack(
        project_id,
        doc_id,
        newUpdates,
        temporary,
        callback
      )
    }
  },

  insertUpdatesIntoNewPack(
    project_id,
    doc_id,
    newUpdates,
    temporary,
    callback
  ) {
    if (callback == null) {
      callback = function (error) {}
    }
    const first = newUpdates[0]
    const last = newUpdates[newUpdates.length - 1]
    const n = newUpdates.length
    const sz = BSON.calculateObjectSize(newUpdates)
    const newPack = {
      project_id: ObjectId(project_id.toString()),
      doc_id: ObjectId(doc_id.toString()),
      pack: newUpdates,
      n,
      sz,
      meta: {
        start_ts: first.meta.start_ts,
        end_ts: last.meta.end_ts
      },
      v: first.v,
      v_end: last.v,
      temporary
    }
    if (temporary) {
      newPack.expiresAt = new Date(Date.now() + 7 * DAYS)
      newPack.last_checked = new Date(Date.now() + 30 * DAYS) // never check temporary packs
    }
    logger.log(
      { project_id, doc_id, newUpdates },
      'inserting updates into new pack'
    )
    return db.docHistory.save(newPack, function (err, result) {
      if (err != null) {
        return callback(err)
      }
      Metrics.inc(`insert-pack-${temporary ? 'temporary' : 'permanent'}`)
      if (temporary) {
        return callback()
      } else {
        return PackManager.updateIndex(project_id, doc_id, callback)
      }
    })
  },

  appendUpdatesToExistingPack(
    project_id,
    doc_id,
    lastUpdate,
    newUpdates,
    temporary,
    callback
  ) {
    if (callback == null) {
      callback = function (error) {}
    }
    const first = newUpdates[0]
    const last = newUpdates[newUpdates.length - 1]
    const n = newUpdates.length
    const sz = BSON.calculateObjectSize(newUpdates)
    const query = {
      _id: lastUpdate._id,
      project_id: ObjectId(project_id.toString()),
      doc_id: ObjectId(doc_id.toString()),
      pack: { $exists: true }
    }
    const update = {
      $push: {
        pack: { $each: newUpdates }
      },
      $inc: {
        n: n,
        sz: sz
      },
      $set: {
        'meta.end_ts': last.meta.end_ts,
        v_end: last.v
      }
    }
    if (lastUpdate.expiresAt && temporary) {
      update.$set.expiresAt = new Date(Date.now() + 7 * DAYS)
    }
    logger.log(
      { project_id, doc_id, lastUpdate, newUpdates },
      'appending updates to existing pack'
    )
    Metrics.inc(`append-pack-${temporary ? 'temporary' : 'permanent'}`)
    return db.docHistory.findAndModify(
      { query, update, new: true, fields: { meta: 1, v_end: 1 } },
      callback
    )
  },

  // Retrieve all changes for a document

  getOpsByVersionRange(project_id, doc_id, fromVersion, toVersion, callback) {
    if (callback == null) {
      callback = function (error, updates) {}
    }
    return PackManager.loadPacksByVersionRange(
      project_id,
      doc_id,
      fromVersion,
      toVersion,
      function (error) {
        const query = { doc_id: ObjectId(doc_id.toString()) }
        if (toVersion != null) {
          query.v = { $lte: toVersion }
        }
        if (fromVersion != null) {
          query.v_end = { $gte: fromVersion }
        }
        // console.log "query:", query
        return db.docHistory
          .find(query)
          .sort({ v: -1 }, function (err, result) {
            if (err != null) {
              return callback(err)
            }
            // console.log "getOpsByVersionRange:", err, result
            const updates = []
            const opInRange = function (op, from, to) {
              if (fromVersion != null && op.v < fromVersion) {
                return false
              }
              if (toVersion != null && op.v > toVersion) {
                return false
              }
              return true
            }
            for (const docHistory of Array.from(result)) {
              // console.log 'adding', docHistory.pack
              for (const op of Array.from(docHistory.pack.reverse())) {
                if (opInRange(op, fromVersion, toVersion)) {
                  op.project_id = docHistory.project_id
                  op.doc_id = docHistory.doc_id
                  // console.log "added op", op.v, fromVersion, toVersion
                  updates.push(op)
                }
              }
            }
            return callback(null, updates)
          })
      }
    )
  },

  loadPacksByVersionRange(
    project_id,
    doc_id,
    fromVersion,
    toVersion,
    callback
  ) {
    return PackManager.getIndex(doc_id, function (err, indexResult) {
      let pack
      if (err != null) {
        return callback(err)
      }
      const indexPacks =
        (indexResult != null ? indexResult.packs : undefined) || []
      const packInRange = function (pack, from, to) {
        if (fromVersion != null && pack.v_end < fromVersion) {
          return false
        }
        if (toVersion != null && pack.v > toVersion) {
          return false
        }
        return true
      }
      const neededIds = (() => {
        const result = []
        for (pack of Array.from(indexPacks)) {
          if (packInRange(pack, fromVersion, toVersion)) {
            result.push(pack._id)
          }
        }
        return result
      })()
      if (neededIds.length) {
        return PackManager.fetchPacksIfNeeded(
          project_id,
          doc_id,
          neededIds,
          callback
        )
      } else {
        return callback()
      }
    })
  },

  fetchPacksIfNeeded(project_id, doc_id, pack_ids, callback) {
    let id
    return db.docHistory.find(
      {
        _id: {
          $in: (() => {
            const result = []
            for (id of Array.from(pack_ids)) {
              result.push(ObjectId(id))
            }
            return result
          })()
        }
      },
      { _id: 1 },
      function (err, loadedPacks) {
        if (err != null) {
          return callback(err)
        }
        const allPackIds = (() => {
          const result1 = []
          for (id of Array.from(pack_ids)) {
            result1.push(id.toString())
          }
          return result1
        })()
        const loadedPackIds = Array.from(loadedPacks).map((pack) =>
          pack._id.toString()
        )
        const packIdsToFetch = _.difference(allPackIds, loadedPackIds)
        logger.log(
          { project_id, doc_id, loadedPackIds, allPackIds, packIdsToFetch },
          'analysed packs'
        )
        if (packIdsToFetch.length === 0) {
          return callback()
        }
        return async.eachLimit(
          packIdsToFetch,
          4,
          (pack_id, cb) =>
            MongoAWS.unArchivePack(project_id, doc_id, pack_id, cb),
          function (err) {
            if (err != null) {
              return callback(err)
            }
            logger.log({ project_id, doc_id }, 'done unarchiving')
            return callback()
          }
        )
      }
    )
  },

  // Retrieve all changes across a project

  makeProjectIterator(project_id, before, callback) {
    // get all the docHistory Entries
    return db.docHistory
      .find({ project_id: ObjectId(project_id) }, { pack: false })
      .sort({ 'meta.end_ts': -1 }, function (err, packs) {
        let pack
        if (err != null) {
          return callback(err)
        }
        const allPacks = []
        const seenIds = {}
        for (pack of Array.from(packs)) {
          allPacks.push(pack)
          seenIds[pack._id] = true
        }
        return db.docHistoryIndex.find(
          { project_id: ObjectId(project_id) },
          function (err, indexes) {
            if (err != null) {
              return callback(err)
            }
            for (const index of Array.from(indexes)) {
              for (pack of Array.from(index.packs)) {
                if (!seenIds[pack._id]) {
                  pack.project_id = index.project_id
                  pack.doc_id = index._id
                  pack.fromIndex = true
                  allPacks.push(pack)
                  seenIds[pack._id] = true
                }
              }
            }
            return callback(
              null,
              new ProjectIterator(allPacks, before, PackManager.getPackById)
            )
          }
        )
      })
  },

  getPackById(project_id, doc_id, pack_id, callback) {
    return db.docHistory.findOne({ _id: pack_id }, function (err, pack) {
      if (err != null) {
        return callback(err)
      }
      if (pack == null) {
        return MongoAWS.unArchivePack(project_id, doc_id, pack_id, callback)
      } else if (pack.expiresAt != null && pack.temporary === false) {
        // we only need to touch the TTL when listing the changes in the project
        // because diffs on individual documents are always done after that
        return PackManager.increaseTTL(pack, callback)
        // only do this for cached packs, not temporary ones to avoid older packs
        // being kept longer than newer ones (which messes up the last update version)
      } else {
        return callback(null, pack)
      }
    })
  },

  increaseTTL(pack, callback) {
    if (pack.expiresAt < new Date(Date.now() + 6 * DAYS)) {
      // update cache expiry since we are using this pack
      return db.docHistory.findAndModify(
        {
          query: { _id: pack._id },
          update: { $set: { expiresAt: new Date(Date.now() + 7 * DAYS) } }
        },
        (err) => callback(err, pack)
      )
    } else {
      return callback(null, pack)
    }
  },

  // Manage docHistoryIndex collection

  getIndex(doc_id, callback) {
    return db.docHistoryIndex.findOne(
      { _id: ObjectId(doc_id.toString()) },
      callback
    )
  },

  getPackFromIndex(doc_id, pack_id, callback) {
    return db.docHistoryIndex.findOne(
      { _id: ObjectId(doc_id.toString()), 'packs._id': pack_id },
      { 'packs.$': 1 },
      callback
    )
  },

  getLastPackFromIndex(doc_id, callback) {
    return db.docHistoryIndex.findOne(
      { _id: ObjectId(doc_id.toString()) },
      { packs: { $slice: -1 } },
      function (err, indexPack) {
        if (err != null) {
          return callback(err)
        }
        if (indexPack == null) {
          return callback()
        }
        return callback(null, indexPack[0])
      }
    )
  },

  getIndexWithKeys(doc_id, callback) {
    return PackManager.getIndex(doc_id, function (err, index) {
      if (err != null) {
        return callback(err)
      }
      if (index == null) {
        return callback()
      }
      for (const pack of Array.from(
        (index != null ? index.packs : undefined) || []
      )) {
        index[pack._id] = pack
      }
      return callback(null, index)
    })
  },

  initialiseIndex(project_id, doc_id, callback) {
    return PackManager.findCompletedPacks(project_id, doc_id, function (
      err,
      packs
    ) {
      // console.log 'err', err, 'packs', packs, packs?.length
      if (err != null) {
        return callback(err)
      }
      if (packs == null) {
        return callback()
      }
      return PackManager.insertPacksIntoIndexWithLock(
        project_id,
        doc_id,
        packs,
        callback
      )
    })
  },

  updateIndex(project_id, doc_id, callback) {
    // find all packs prior to current pack
    return PackManager.findUnindexedPacks(project_id, doc_id, function (
      err,
      newPacks
    ) {
      if (err != null) {
        return callback(err)
      }
      if (newPacks == null || newPacks.length === 0) {
        return callback()
      }
      return PackManager.insertPacksIntoIndexWithLock(
        project_id,
        doc_id,
        newPacks,
        function (err) {
          if (err != null) {
            return callback(err)
          }
          logger.log(
            { project_id, doc_id, newPacks },
            'added new packs to index'
          )
          return callback()
        }
      )
    })
  },

  findCompletedPacks(project_id, doc_id, callback) {
    const query = {
      doc_id: ObjectId(doc_id.toString()),
      expiresAt: { $exists: false }
    }
    return db.docHistory
      .find(query, { pack: false })
      .sort({ v: 1 }, function (err, packs) {
        if (err != null) {
          return callback(err)
        }
        if (packs == null) {
          return callback()
        }
        if (!(packs != null ? packs.length : undefined)) {
          return callback()
        }
        const last = packs.pop() // discard the last pack, if it's still in progress
        if (last.finalised) {
          packs.push(last)
        } // it's finalised so we push it back to archive it
        return callback(null, packs)
      })
  },

  findPacks(project_id, doc_id, callback) {
    const query = {
      doc_id: ObjectId(doc_id.toString()),
      expiresAt: { $exists: false }
    }
    return db.docHistory
      .find(query, { pack: false })
      .sort({ v: 1 }, function (err, packs) {
        if (err != null) {
          return callback(err)
        }
        if (packs == null) {
          return callback()
        }
        if (!(packs != null ? packs.length : undefined)) {
          return callback()
        }
        return callback(null, packs)
      })
  },

  findUnindexedPacks(project_id, doc_id, callback) {
    return PackManager.getIndexWithKeys(doc_id, function (err, indexResult) {
      if (err != null) {
        return callback(err)
      }
      return PackManager.findCompletedPacks(project_id, doc_id, function (
        err,
        historyPacks
      ) {
        let pack
        if (err != null) {
          return callback(err)
        }
        if (historyPacks == null) {
          return callback()
        }
        // select only the new packs not already in the index
        let newPacks = (() => {
          const result = []
          for (pack of Array.from(historyPacks)) {
            if (
              (indexResult != null ? indexResult[pack._id] : undefined) == null
            ) {
              result.push(pack)
            }
          }
          return result
        })()
        newPacks = (() => {
          const result1 = []
          for (pack of Array.from(newPacks)) {
            result1.push(
              _.omit(
                pack,
                'doc_id',
                'project_id',
                'n',
                'sz',
                'last_checked',
                'finalised'
              )
            )
          }
          return result1
        })()
        if (newPacks.length) {
          logger.log(
            { project_id, doc_id, n: newPacks.length },
            'found new packs'
          )
        }
        return callback(null, newPacks)
      })
    })
  },

  insertPacksIntoIndexWithLock(project_id, doc_id, newPacks, callback) {
    return LockManager.runWithLock(
      keys.historyIndexLock({ doc_id }),
      (releaseLock) =>
        PackManager._insertPacksIntoIndex(
          project_id,
          doc_id,
          newPacks,
          releaseLock
        ),
      callback
    )
  },

  _insertPacksIntoIndex(project_id, doc_id, newPacks, callback) {
    return db.docHistoryIndex.findAndModify(
      {
        query: { _id: ObjectId(doc_id.toString()) },
        update: {
          $setOnInsert: { project_id: ObjectId(project_id.toString()) },
          $push: {
            packs: { $each: newPacks, $sort: { v: 1 } }
          }
        },
        upsert: true
      },
      callback
    )
  },

  // Archiving packs to S3

  archivePack(project_id, doc_id, pack_id, callback) {
    const clearFlagOnError = function (err, cb) {
      if (err != null) {
        // clear the inS3 flag on error
        return PackManager.clearPackAsArchiveInProgress(
          project_id,
          doc_id,
          pack_id,
          function (err2) {
            if (err2 != null) {
              return cb(err2)
            }
            return cb(err)
          }
        )
      } else {
        return cb()
      }
    }
    return async.series(
      [
        (cb) =>
          PackManager.checkArchiveNotInProgress(
            project_id,
            doc_id,
            pack_id,
            cb
          ),
        (cb) =>
          PackManager.markPackAsArchiveInProgress(
            project_id,
            doc_id,
            pack_id,
            cb
          ),
        (cb) =>
          MongoAWS.archivePack(project_id, doc_id, pack_id, (err) =>
            clearFlagOnError(err, cb)
          ),
        (cb) =>
          PackManager.checkArchivedPack(project_id, doc_id, pack_id, (err) =>
            clearFlagOnError(err, cb)
          ),
        (cb) => PackManager.markPackAsArchived(project_id, doc_id, pack_id, cb),
        (cb) =>
          PackManager.setTTLOnArchivedPack(
            project_id,
            doc_id,
            pack_id,
            callback
          )
      ],
      callback
    )
  },

  checkArchivedPack(project_id, doc_id, pack_id, callback) {
    return db.docHistory.findOne({ _id: pack_id }, function (err, pack) {
      if (err != null) {
        return callback(err)
      }
      if (pack == null) {
        return callback(new Error('pack not found'))
      }
      return MongoAWS.readArchivedPack(project_id, doc_id, pack_id, function (
        err,
        result
      ) {
        delete result.last_checked
        delete pack.last_checked
        // need to compare ids as ObjectIds with .equals()
        for (const key of ['_id', 'project_id', 'doc_id']) {
          if (result[key].equals(pack[key])) {
            result[key] = pack[key]
          }
        }
        for (let i = 0; i < result.pack.length; i++) {
          const op = result.pack[i]
          if (op._id != null && op._id.equals(pack.pack[i]._id)) {
            op._id = pack.pack[i]._id
          }
        }
        if (_.isEqual(pack, result)) {
          return callback()
        } else {
          logger.err(
            {
              pack,
              result,
              jsondiff: JSON.stringify(pack) === JSON.stringify(result)
            },
            'difference when comparing packs'
          )
          return callback(
            new Error('pack retrieved from s3 does not match pack in mongo')
          )
        }
      })
    })
  },
  // Extra methods to test archive/unarchive for a doc_id

  pushOldPacks(project_id, doc_id, callback) {
    return PackManager.findPacks(project_id, doc_id, function (err, packs) {
      if (err != null) {
        return callback(err)
      }
      if (!(packs != null ? packs.length : undefined)) {
        return callback()
      }
      return PackManager.processOldPack(
        project_id,
        doc_id,
        packs[0]._id,
        callback
      )
    })
  },

  pullOldPacks(project_id, doc_id, callback) {
    return PackManager.loadPacksByVersionRange(
      project_id,
      doc_id,
      null,
      null,
      callback
    )
  },

  // Processing old packs via worker

  processOldPack(project_id, doc_id, pack_id, callback) {
    const markAsChecked = (err) =>
      PackManager.markPackAsChecked(project_id, doc_id, pack_id, function (
        err2
      ) {
        if (err2 != null) {
          return callback(err2)
        }
        return callback(err)
      })
    logger.log({ project_id, doc_id }, 'processing old packs')
    return db.docHistory.findOne({ _id: pack_id }, function (err, pack) {
      if (err != null) {
        return markAsChecked(err)
      }
      if (pack == null) {
        return markAsChecked()
      }
      if (pack.expiresAt != null) {
        return callback()
      } // return directly
      return PackManager.finaliseIfNeeded(
        project_id,
        doc_id,
        pack._id,
        pack,
        function (err) {
          if (err != null) {
            return markAsChecked(err)
          }
          return PackManager.updateIndexIfNeeded(project_id, doc_id, function (
            err
          ) {
            if (err != null) {
              return markAsChecked(err)
            }
            return PackManager.findUnarchivedPacks(
              project_id,
              doc_id,
              function (err, unarchivedPacks) {
                if (err != null) {
                  return markAsChecked(err)
                }
                if (
                  !(unarchivedPacks != null
                    ? unarchivedPacks.length
                    : undefined)
                ) {
                  logger.log({ project_id, doc_id }, 'no packs need archiving')
                  return markAsChecked()
                }
                return async.eachSeries(
                  unarchivedPacks,
                  (pack, cb) =>
                    PackManager.archivePack(project_id, doc_id, pack._id, cb),
                  function (err) {
                    if (err != null) {
                      return markAsChecked(err)
                    }
                    logger.log({ project_id, doc_id }, 'done processing')
                    return markAsChecked()
                  }
                )
              }
            )
          })
        }
      )
    })
  },

  finaliseIfNeeded(project_id, doc_id, pack_id, pack, callback) {
    const sz = pack.sz / (1024 * 1024) // in fractions of a megabyte
    const n = pack.n / 1024 // in fraction of 1024 ops
    const age = (Date.now() - pack.meta.end_ts) / DAYS
    if (age < 30) {
      // always keep if less than 1 month old
      logger.log({ project_id, doc_id, pack_id, age }, 'less than 30 days old')
      return callback()
    }
    // compute an archiving threshold which decreases for each month of age
    const archive_threshold = 30 / age
    if (sz > archive_threshold || n > archive_threshold || age > 90) {
      logger.log(
        { project_id, doc_id, pack_id, age, archive_threshold, sz, n },
        'meets archive threshold'
      )
      return PackManager.markPackAsFinalisedWithLock(
        project_id,
        doc_id,
        pack_id,
        callback
      )
    } else {
      logger.log(
        { project_id, doc_id, pack_id, age, archive_threshold, sz, n },
        'does not meet archive threshold'
      )
      return callback()
    }
  },

  markPackAsFinalisedWithLock(project_id, doc_id, pack_id, callback) {
    return LockManager.runWithLock(
      keys.historyLock({ doc_id }),
      (releaseLock) =>
        PackManager._markPackAsFinalised(
          project_id,
          doc_id,
          pack_id,
          releaseLock
        ),
      callback
    )
  },

  _markPackAsFinalised(project_id, doc_id, pack_id, callback) {
    logger.log({ project_id, doc_id, pack_id }, 'marking pack as finalised')
    return db.docHistory.findAndModify(
      {
        query: { _id: pack_id },
        update: { $set: { finalised: true } }
      },
      callback
    )
  },

  updateIndexIfNeeded(project_id, doc_id, callback) {
    logger.log({ project_id, doc_id }, 'archiving old packs')
    return PackManager.getIndexWithKeys(doc_id, function (err, index) {
      if (err != null) {
        return callback(err)
      }
      if (index == null) {
        return PackManager.initialiseIndex(project_id, doc_id, callback)
      } else {
        return PackManager.updateIndex(project_id, doc_id, callback)
      }
    })
  },

  markPackAsChecked(project_id, doc_id, pack_id, callback) {
    logger.log({ project_id, doc_id, pack_id }, 'marking pack as checked')
    return db.docHistory.findAndModify(
      {
        query: { _id: pack_id },
        update: { $currentDate: { last_checked: true } }
      },
      callback
    )
  },

  findUnarchivedPacks(project_id, doc_id, callback) {
    return PackManager.getIndex(doc_id, function (err, indexResult) {
      if (err != null) {
        return callback(err)
      }
      const indexPacks =
        (indexResult != null ? indexResult.packs : undefined) || []
      const unArchivedPacks = (() => {
        const result = []
        for (const pack of Array.from(indexPacks)) {
          if (pack.inS3 == null) {
            result.push(pack)
          }
        }
        return result
      })()
      if (unArchivedPacks.length) {
        logger.log(
          { project_id, doc_id, n: unArchivedPacks.length },
          'find unarchived packs'
        )
      }
      return callback(null, unArchivedPacks)
    })
  },

  // Archive locking flags

  checkArchiveNotInProgress(project_id, doc_id, pack_id, callback) {
    logger.log(
      { project_id, doc_id, pack_id },
      'checking if archive in progress'
    )
    return PackManager.getPackFromIndex(doc_id, pack_id, function (
      err,
      result
    ) {
      if (err != null) {
        return callback(err)
      }
      if (result == null) {
        return callback(new Error('pack not found in index'))
      }
      if (result.inS3) {
        return callback(new Error('pack archiving already done'))
      } else if (result.inS3 != null) {
        return callback(new Error('pack archiving already in progress'))
      } else {
        return callback()
      }
    })
  },

  markPackAsArchiveInProgress(project_id, doc_id, pack_id, callback) {
    logger.log(
      { project_id, doc_id },
      'marking pack as archive in progress status'
    )
    return db.docHistoryIndex.findAndModify(
      {
        query: {
          _id: ObjectId(doc_id.toString()),
          packs: { $elemMatch: { _id: pack_id, inS3: { $exists: false } } }
        },
        fields: { 'packs.$': 1 },
        update: { $set: { 'packs.$.inS3': false } }
      },
      function (err, result) {
        if (err != null) {
          return callback(err)
        }
        if (result == null) {
          return callback(new Error('archive is already in progress'))
        }
        logger.log(
          { project_id, doc_id, pack_id },
          'marked as archive in progress'
        )
        return callback()
      }
    )
  },

  clearPackAsArchiveInProgress(project_id, doc_id, pack_id, callback) {
    logger.log(
      { project_id, doc_id, pack_id },
      'clearing as archive in progress'
    )
    return db.docHistoryIndex.findAndModify(
      {
        query: {
          _id: ObjectId(doc_id.toString()),
          packs: { $elemMatch: { _id: pack_id, inS3: false } }
        },
        fields: { 'packs.$': 1 },
        update: { $unset: { 'packs.$.inS3': true } }
      },
      callback
    )
  },

  markPackAsArchived(project_id, doc_id, pack_id, callback) {
    logger.log({ project_id, doc_id, pack_id }, 'marking pack as archived')
    return db.docHistoryIndex.findAndModify(
      {
        query: {
          _id: ObjectId(doc_id.toString()),
          packs: { $elemMatch: { _id: pack_id, inS3: false } }
        },
        fields: { 'packs.$': 1 },
        update: { $set: { 'packs.$.inS3': true } }
      },
      function (err, result) {
        if (err != null) {
          return callback(err)
        }
        if (result == null) {
          return callback(new Error('archive is not marked as progress'))
        }
        logger.log({ project_id, doc_id, pack_id }, 'marked as archived')
        return callback()
      }
    )
  },

  setTTLOnArchivedPack(project_id, doc_id, pack_id, callback) {
    return db.docHistory.findAndModify(
      {
        query: { _id: pack_id },
        update: { $set: { expiresAt: new Date(Date.now() + 1 * DAYS) } }
      },
      function (err) {
        logger.log({ project_id, doc_id, pack_id }, 'set expiry on pack')
        return callback()
      }
    )
  }
}

//	_getOneDayInFutureWithRandomDelay: ->
//		thirtyMins = 1000 * 60 * 30
//		randomThirtyMinMax = Math.ceil(Math.random() * thirtyMins)
//		return new Date(Date.now() + randomThirtyMinMax + 1*DAYS)
