/* eslint-disable
    no-console,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// The model of all the ops. Responsible for applying & transforming remote deltas
// and managing the storage layer.
//
// Actual storage is handled by the database wrappers in db/*, wrapped by DocCache

let Model
const { EventEmitter } = require('events')

const queue = require('./syncqueue')
const types = require('../types')

const isArray = o => Object.prototype.toString.call(o) === '[object Array]'

// This constructor creates a new Model object. There will be one model object
// per server context.
//
// The model object is responsible for a lot of things:
//
// - It manages the interactions with the database
// - It maintains (in memory) a set of all active documents
// - It calls out to the OT functions when necessary
//
// The model is an event emitter. It emits the following events:
//
// create(docName, data): A document has been created with the specified name & data
module.exports = Model = function (db, options) {
  // db can be null if the user doesn't want persistance.

  let getOps
  if (!(this instanceof Model)) {
    return new Model(db, options)
  }

  const model = this

  if (options == null) {
    options = {}
  }

  // This is a cache of 'live' documents.
  //
  // The cache is a map from docName -> {
  //   ops:[{op, meta}]
  //   snapshot
  //   type
  //   v
  //   meta
  //   eventEmitter
  //   reapTimer
  //   committedVersion: v
  //   snapshotWriteLock: bool to make sure writeSnapshot isn't re-entrant
  //   dbMeta: database specific data
  //   opQueue: syncQueue for processing ops
  // }
  //
  // The ops list contains the document's last options.numCachedOps ops. (Or all
  // of them if we're using a memory store).
  //
  // Documents are stored in this set so long as the document has been accessed in
  // the last few seconds (options.reapTime) OR at least one client has the document
  // open. I don't know if I should keep open (but not being edited) documents live -
  // maybe if a client has a document open but the document isn't being edited, I should
  // flush it from the cache.
  //
  // In any case, the API to model is designed such that if we want to change that later
  // it should be pretty easy to do so without any external-to-the-model code changes.
  const docs = {}

  // This is a map from docName -> [callback]. It is used when a document hasn't been
  // cached and multiple getSnapshot() / getVersion() requests come in. All requests
  // are added to the callback list and called when db.getSnapshot() returns.
  //
  // callback(error, snapshot data)
  const awaitingGetSnapshot = {}

  // The time that documents which no clients have open will stay in the cache.
  // Should be > 0.
  if (options.reapTime == null) {
    options.reapTime = 3000
  }

  // The number of operations the cache holds before reusing the space
  if (options.numCachedOps == null) {
    options.numCachedOps = 10
  }

  // This option forces documents to be reaped, even when there's no database backend.
  // This is useful when you don't care about persistance and don't want to gradually
  // fill memory.
  //
  // You might want to set reapTime to a day or something.
  if (options.forceReaping == null) {
    options.forceReaping = false
  }

  // Until I come up with a better strategy, we'll save a copy of the document snapshot
  // to the database every ~20 submitted ops.
  if (options.opsBeforeCommit == null) {
    options.opsBeforeCommit = 20
  }

  // It takes some processing time to transform client ops. The server will punt ops back to the
  // client to transform if they're too old.
  if (options.maximumAge == null) {
    options.maximumAge = 40
  }

  // **** Cache API methods

  // Its important that all ops are applied in order. This helper method creates the op submission queue
  // for a single document. This contains the logic for transforming & applying ops.
  const makeOpQueue = (docName, doc) =>
    queue(function (opData, callback) {
      if (!(opData.v >= 0)) {
        return callback('Version missing')
      }
      if (opData.v > doc.v) {
        return callback('Op at future version')
      }

      // Punt the transforming work back to the client if the op is too old.
      if (opData.v + options.maximumAge < doc.v) {
        return callback('Op too old')
      }

      if (!opData.meta) {
        opData.meta = {}
      }
      opData.meta.ts = Date.now()

      // We'll need to transform the op to the current version of the document. This
      // calls the callback immediately if opVersion == doc.v.
      return getOps(docName, opData.v, doc.v, function (error, ops) {
        let snapshot
        if (error) {
          return callback(error)
        }

        if (doc.v - opData.v !== ops.length) {
          // This should never happen. It indicates that we didn't get all the ops we
          // asked for. Its important that the submitted op is correctly transformed.
          console.error(
            `Could not get old ops in model for document ${docName}`
          )
          console.error(
            `Expected ops ${opData.v} to ${doc.v} and got ${ops.length} ops`
          )
          return callback('Internal error')
        }

        if (ops.length > 0) {
          try {
            // If there's enough ops, it might be worth spinning this out into a webworker thread.
            for (const oldOp of Array.from(ops)) {
              // Dup detection works by sending the id(s) the op has been submitted with previously.
              // If the id matches, we reject it. The client can also detect the op has been submitted
              // already if it sees its own previous id in the ops it sees when it does catchup.
              if (
                oldOp.meta.source &&
                opData.dupIfSource &&
                Array.from(opData.dupIfSource).includes(oldOp.meta.source)
              ) {
                return callback('Op already submitted')
              }

              opData.op = doc.type.transform(opData.op, oldOp.op, 'left')
              opData.v++
            }
          } catch (error1) {
            error = error1
            console.error(error.stack)
            return callback(error.message)
          }
        }

        try {
          snapshot = doc.type.apply(doc.snapshot, opData.op)
        } catch (error2) {
          error = error2
          console.error(error.stack)
          return callback(error.message)
        }

        if (
          options.maxDocLength != null &&
          doc.snapshot.length > options.maxDocLength
        ) {
          return callback('Update takes doc over max doc size')
        }

        // The op data should be at the current version, and the new document data should be at
        // the next version.
        //
        // This should never happen in practice, but its a nice little check to make sure everything
        // is hunky-dory.
        if (opData.v !== doc.v) {
          // This should never happen.
          console.error(
            'Version mismatch detected in model. File a ticket - this is a bug.'
          )
          console.error(`Expecting ${opData.v} == ${doc.v}`)
          return callback('Internal error')
        }

        // newDocData = {snapshot, type:type.name, v:opVersion + 1, meta:docData.meta}
        const writeOp =
          (db != null ? db.writeOp : undefined) ||
          ((docName, newOpData, callback) => callback())

        return writeOp(docName, opData, function (error) {
          if (error) {
            // The user should probably know about this.
            console.warn(`Error writing ops to database: ${error}`)
            return callback(error)
          }

          __guardMethod__(options.stats, 'writeOp', o => o.writeOp())

          // This is needed when we emit the 'change' event, below.
          const oldSnapshot = doc.snapshot

          // All the heavy lifting is now done. Finally, we'll update the cache with the new data
          // and (maybe!) save a new document snapshot to the database.

          doc.v = opData.v + 1
          doc.snapshot = snapshot

          doc.ops.push(opData)
          if (db && doc.ops.length > options.numCachedOps) {
            doc.ops.shift()
          }

          model.emit('applyOp', docName, opData, snapshot, oldSnapshot)
          doc.eventEmitter.emit('op', opData, snapshot, oldSnapshot)

          // The callback is called with the version of the document at which the op was applied.
          // This is the op.v after transformation, and its doc.v - 1.
          callback(null, opData.v)

          // I need a decent strategy here for deciding whether or not to save the snapshot.
          //
          // The 'right' strategy looks something like "Store the snapshot whenever the snapshot
          // is smaller than the accumulated op data". For now, I'll just store it every 20
          // ops or something. (Configurable with doc.committedVersion)
          if (
            !doc.snapshotWriteLock &&
            doc.committedVersion + options.opsBeforeCommit <= doc.v
          ) {
            return tryWriteSnapshot(docName, function (error) {
              if (error) {
                return console.warn(
                  `Error writing snapshot ${error}. This is nonfatal`
                )
              }
            })
          }
        })
      })
    })

  // Add the data for the given docName to the cache. The named document shouldn't already
  // exist in the doc set.
  //
  // Returns the new doc.
  const add = function (docName, error, data, committedVersion, ops, dbMeta) {
    let callback, doc
    const callbacks = awaitingGetSnapshot[docName]
    delete awaitingGetSnapshot[docName]

    if (error) {
      if (callbacks) {
        for (callback of Array.from(callbacks)) {
          callback(error)
        }
      }
    } else {
      doc = docs[docName] = {
        snapshot: data.snapshot,
        v: data.v,
        type: data.type,
        meta: data.meta,

        // Cache of ops
        ops: ops || [],

        eventEmitter: new EventEmitter(),

        // Timer before the document will be invalidated from the cache (if the document has no
        // listeners)
        reapTimer: null,

        // Version of the snapshot thats in the database
        committedVersion: committedVersion != null ? committedVersion : data.v,
        snapshotWriteLock: false,
        dbMeta,
      }

      doc.opQueue = makeOpQueue(docName, doc)

      refreshReapingTimeout(docName)
      model.emit('add', docName, data)
      if (callbacks) {
        for (callback of Array.from(callbacks)) {
          callback(null, doc)
        }
      }
    }

    return doc
  }

  // This is a little helper wrapper around db.getOps. It does two things:
  //
  // - If there's no database set, it returns an error to the callback
  // - It adds version numbers to each op returned from the database
  // (These can be inferred from context so the DB doesn't store them, but its useful to have them).
  const getOpsInternal = function (docName, start, end, callback) {
    if (!db) {
      return typeof callback === 'function'
        ? callback('Document does not exist')
        : undefined
    }

    return db.getOps(docName, start, end, function (error, ops) {
      if (error) {
        return typeof callback === 'function' ? callback(error) : undefined
      }

      let v = start
      for (const op of Array.from(ops)) {
        op.v = v++
      }

      return typeof callback === 'function' ? callback(null, ops) : undefined
    })
  }

  // Load the named document into the cache. This function is re-entrant.
  //
  // The callback is called with (error, doc)
  const load = function (docName, callback) {
    if (docs[docName]) {
      // The document is already loaded. Return immediately.
      __guardMethod__(options.stats, 'cacheHit', o => o.cacheHit('getSnapshot'))
      return callback(null, docs[docName])
    }

    // We're a memory store. If we don't have it, nobody does.
    if (!db) {
      return callback('Document does not exist')
    }

    const callbacks = awaitingGetSnapshot[docName]

    // The document is being loaded already. Add ourselves as a callback.
    if (callbacks) {
      return callbacks.push(callback)
    }

    __guardMethod__(options.stats, 'cacheMiss', o1 =>
      o1.cacheMiss('getSnapshot')
    )

    // The document isn't loaded and isn't being loaded. Load it.
    awaitingGetSnapshot[docName] = [callback]
    return db.getSnapshot(docName, function (error, data, dbMeta) {
      if (error) {
        return add(docName, error)
      }

      const type = types[data.type]
      if (!type) {
        console.warn(`Type '${data.type}' missing`)
        return callback('Type not found')
      }
      data.type = type

      const committedVersion = data.v

      // The server can close without saving the most recent document snapshot.
      // In this case, there are extra ops which need to be applied before
      // returning the snapshot.
      return getOpsInternal(docName, data.v, null, function (error, ops) {
        if (error) {
          return callback(error)
        }

        if (ops.length > 0) {
          console.log(`Catchup ${docName} ${data.v} -> ${data.v + ops.length}`)

          try {
            for (const op of Array.from(ops)) {
              data.snapshot = type.apply(data.snapshot, op.op)
              data.v++
            }
          } catch (e) {
            // This should never happen - it indicates that whats in the
            // database is invalid.
            console.error(`Op data invalid for ${docName}: ${e.stack}`)
            return callback('Op data invalid')
          }
        }

        model.emit('load', docName, data)
        return add(docName, error, data, committedVersion, ops, dbMeta)
      })
    })
  }

  // This makes sure the cache contains a document. If the doc cache doesn't contain
  // a document, it is loaded from the database and stored.
  //
  // Documents are stored so long as either:
  // - They have been accessed within the past #{PERIOD}
  // - At least one client has the document open
  var refreshReapingTimeout = function (docName) {
    const doc = docs[docName]
    if (!doc) {
      return
    }

    // I want to let the clients list be updated before this is called.
    return process.nextTick(function () {
      // This is an awkward way to find out the number of clients on a document. If this
      // causes performance issues, add a numClients field to the document.
      //
      // The first check is because its possible that between refreshReapingTimeout being called and this
      // event being fired, someone called delete() on the document and hence the doc is something else now.
      if (
        doc === docs[docName] &&
        doc.eventEmitter.listeners('op').length === 0 &&
        (db || options.forceReaping) &&
        doc.opQueue.busy === false
      ) {
        let reapTimer
        clearTimeout(doc.reapTimer)
        return (doc.reapTimer = reapTimer =
          setTimeout(
            () =>
              tryWriteSnapshot(docName, function () {
                // If the reaping timeout has been refreshed while we're writing the snapshot, or if we're
                // in the middle of applying an operation, don't reap.
                if (
                  docs[docName].reapTimer === reapTimer &&
                  doc.opQueue.busy === false
                ) {
                  return delete docs[docName]
                }
              }),
            options.reapTime
          ))
      }
    })
  }

  var tryWriteSnapshot = function (docName, callback) {
    if (!db) {
      return typeof callback === 'function' ? callback() : undefined
    }

    const doc = docs[docName]

    // The doc is closed
    if (!doc) {
      return typeof callback === 'function' ? callback() : undefined
    }

    // The document is already saved.
    if (doc.committedVersion === doc.v) {
      return typeof callback === 'function' ? callback() : undefined
    }

    if (doc.snapshotWriteLock) {
      return typeof callback === 'function'
        ? callback('Another snapshot write is in progress')
        : undefined
    }

    doc.snapshotWriteLock = true

    __guardMethod__(options.stats, 'writeSnapshot', o => o.writeSnapshot())

    const writeSnapshot =
      (db != null ? db.writeSnapshot : undefined) ||
      ((docName, docData, dbMeta, callback) => callback())

    const data = {
      v: doc.v,
      meta: doc.meta,
      snapshot: doc.snapshot,
      // The database doesn't know about object types.
      type: doc.type.name,
    }

    // Commit snapshot.
    return writeSnapshot(docName, data, doc.dbMeta, function (error, dbMeta) {
      doc.snapshotWriteLock = false

      // We have to use data.v here because the version in the doc could
      // have been updated between the call to writeSnapshot() and now.
      doc.committedVersion = data.v
      doc.dbMeta = dbMeta

      return typeof callback === 'function' ? callback(error) : undefined
    })
  }

  // *** Model interface methods

  // Create a new document.
  //
  // data should be {snapshot, type, [meta]}. The version of a new document is 0.
  this.create = function (docName, type, meta, callback) {
    if (typeof meta === 'function') {
      ;[meta, callback] = Array.from([{}, meta])
    }

    if (docName.match(/\//)) {
      return typeof callback === 'function'
        ? callback('Invalid document name')
        : undefined
    }
    if (docs[docName]) {
      return typeof callback === 'function'
        ? callback('Document already exists')
        : undefined
    }

    if (typeof type === 'string') {
      type = types[type]
    }
    if (!type) {
      return typeof callback === 'function'
        ? callback('Type not found')
        : undefined
    }

    const data = {
      snapshot: type.create(),
      type: type.name,
      meta: meta || {},
      v: 0,
    }

    const done = function (error, dbMeta) {
      // dbMeta can be used to cache extra state needed by the database to access the document, like an ID or something.
      if (error) {
        return typeof callback === 'function' ? callback(error) : undefined
      }

      // From here on we'll store the object version of the type name.
      data.type = type
      add(docName, null, data, 0, [], dbMeta)
      model.emit('create', docName, data)
      return typeof callback === 'function' ? callback() : undefined
    }

    if (db) {
      return db.create(docName, data, done)
    } else {
      return done()
    }
  }

  // Perminantly deletes the specified document.
  // If listeners are attached, they are removed.
  //
  // The callback is called with (error) if there was an error. If error is null / undefined, the
  // document was deleted.
  //
  // WARNING: This isn't well supported throughout the code. (Eg, streaming clients aren't told about the
  // deletion. Subsequent op submissions will fail).
  this.delete = function (docName, callback) {
    const doc = docs[docName]

    if (doc) {
      clearTimeout(doc.reapTimer)
      delete docs[docName]
    }

    const done = function (error) {
      if (!error) {
        model.emit('delete', docName)
      }
      return typeof callback === 'function' ? callback(error) : undefined
    }

    if (db) {
      return db.delete(docName, doc != null ? doc.dbMeta : undefined, done)
    } else {
      return done(!doc ? 'Document does not exist' : undefined)
    }
  }

  // This gets all operations from [start...end]. (That is, its not inclusive.)
  //
  // end can be null. This means 'get me all ops from start'.
  //
  // Each op returned is in the form {op:o, meta:m, v:version}.
  //
  // Callback is called with (error, [ops])
  //
  // If the document does not exist, getOps doesn't necessarily return an error. This is because
  // its awkward to figure out whether or not the document exists for things
  // like the redis database backend. I guess its a bit gross having this inconsistant
  // with the other DB calls, but its certainly convenient.
  //
  // Use getVersion() to determine if a document actually exists, if thats what you're
  // after.
  this.getOps = getOps = function (docName, start, end, callback) {
    // getOps will only use the op cache if its there. It won't fill the op cache in.
    if (!(start >= 0)) {
      throw new Error('start must be 0+')
    }

    if (typeof end === 'function') {
      ;[end, callback] = Array.from([null, end])
    }

    const ops = docs[docName] != null ? docs[docName].ops : undefined

    if (ops) {
      const version = docs[docName].v

      // Ops contains an array of ops. The last op in the list is the last op applied
      if (end == null) {
        end = version
      }
      start = Math.min(start, end)

      if (start === end) {
        return callback(null, [])
      }

      // Base is the version number of the oldest op we have cached
      const base = version - ops.length

      // If the database is null, we'll trim to the ops we do have and hope thats enough.
      if (start >= base || db === null) {
        refreshReapingTimeout(docName)
        if (options.stats != null) {
          options.stats.cacheHit('getOps')
        }

        return callback(null, ops.slice(start - base, end - base))
      }
    }

    if (options.stats != null) {
      options.stats.cacheMiss('getOps')
    }

    return getOpsInternal(docName, start, end, callback)
  }

  // Gets the snapshot data for the specified document.
  // getSnapshot(docName, callback)
  // Callback is called with (error, {v: <version>, type: <type>, snapshot: <snapshot>, meta: <meta>})
  this.getSnapshot = (docName, callback) =>
    load(docName, (error, doc) =>
      callback(
        error,
        doc
          ? { v: doc.v, type: doc.type, snapshot: doc.snapshot, meta: doc.meta }
          : undefined
      )
    )

  // Gets the latest version # of the document.
  // getVersion(docName, callback)
  // callback is called with (error, version).
  this.getVersion = (docName, callback) =>
    load(docName, (error, doc) =>
      callback(error, doc != null ? doc.v : undefined)
    )

  // Apply an op to the specified document.
  // The callback is passed (error, applied version #)
  // opData = {op:op, v:v, meta:metadata}
  //
  // Ops are queued before being applied so that the following code applies op C before op B:
  // model.applyOp 'doc', OPA, -> model.applyOp 'doc', OPB
  // model.applyOp 'doc', OPC
  this.applyOp = (
    docName,
    opData,
    callback // All the logic for this is in makeOpQueue, above.
  ) =>
    load(docName, function (error, doc) {
      if (error) {
        return callback(error)
      }

      return process.nextTick(() =>
        doc.opQueue(opData, function (error, newVersion) {
          refreshReapingTimeout(docName)
          return typeof callback === 'function'
            ? callback(error, newVersion)
            : undefined
        })
      )
    })

  // TODO: store (some) metadata in DB
  // TODO: op and meta should be combineable in the op that gets sent
  this.applyMetaOp = function (docName, metaOpData, callback) {
    const { path, value } = metaOpData.meta

    if (!isArray(path)) {
      return typeof callback === 'function'
        ? callback('path should be an array')
        : undefined
    }

    return load(docName, function (error, doc) {
      if (error != null) {
        return typeof callback === 'function' ? callback(error) : undefined
      } else {
        let applied = false
        switch (path[0]) {
          case 'shout':
            doc.eventEmitter.emit('op', metaOpData)
            applied = true
            break
        }

        if (applied) {
          model.emit('applyMetaOp', docName, path, value)
        }
        return typeof callback === 'function'
          ? callback(null, doc.v)
          : undefined
      }
    })
  }

  // Listen to all ops from the specified version. If version is in the past, all
  // ops since that version are sent immediately to the listener.
  //
  // The callback is called once the listener is attached, but before any ops have been passed
  // to the listener.
  //
  // This will _not_ edit the document metadata.
  //
  // If there are any listeners, we don't purge the document from the cache. But be aware, this behaviour
  // might change in a future version.
  //
  // version is the document version at which the document is opened. It can be left out if you want to open
  // the document at the most recent version.
  //
  // listener is called with (opData) each time an op is applied.
  //
  // callback(error, openedVersion)
  this.listen = function (docName, version, listener, callback) {
    if (typeof version === 'function') {
      ;[version, listener, callback] = Array.from([null, version, listener])
    }

    return load(docName, function (error, doc) {
      if (error) {
        return typeof callback === 'function' ? callback(error) : undefined
      }

      clearTimeout(doc.reapTimer)

      if (version != null) {
        return getOps(docName, version, null, function (error, data) {
          if (error) {
            return typeof callback === 'function' ? callback(error) : undefined
          }

          doc.eventEmitter.on('op', listener)
          if (typeof callback === 'function') {
            callback(null, version)
          }
          return (() => {
            const result = []
            for (const op of Array.from(data)) {
              var needle
              listener(op)

              // The listener may well remove itself during the catchup phase. If this happens, break early.
              // This is done in a quite inefficient way. (O(n) where n = #listeners on doc)
              if (
                ((needle = listener),
                !Array.from(doc.eventEmitter.listeners('op')).includes(needle))
              ) {
                break
              } else {
                result.push(undefined)
              }
            }
            return result
          })()
        })
      } else {
        // Version is null / undefined. Just add the listener.
        doc.eventEmitter.on('op', listener)
        return typeof callback === 'function'
          ? callback(null, doc.v)
          : undefined
      }
    })
  }

  // Remove a listener for a particular document.
  //
  // removeListener(docName, listener)
  //
  // This is synchronous.
  this.removeListener = function (docName, listener) {
    // The document should already be loaded.
    const doc = docs[docName]
    if (!doc) {
      throw new Error('removeListener called but document not loaded')
    }

    doc.eventEmitter.removeListener('op', listener)
    return refreshReapingTimeout(docName)
  }

  // Flush saves all snapshot data to the database. I'm not sure whether or not this is actually needed -
  // sharejs will happily replay uncommitted ops when documents are re-opened anyway.
  this.flush = function (callback) {
    if (!db) {
      return typeof callback === 'function' ? callback() : undefined
    }

    let pendingWrites = 0

    for (const docName in docs) {
      const doc = docs[docName]
      if (doc.committedVersion < doc.v) {
        pendingWrites++
        // I'm hoping writeSnapshot will always happen in another thread.
        tryWriteSnapshot(docName, () =>
          process.nextTick(function () {
            pendingWrites--
            if (pendingWrites === 0) {
              return typeof callback === 'function' ? callback() : undefined
            }
          })
        )
      }
    }

    // If nothing was queued, terminate immediately.
    if (pendingWrites === 0) {
      return typeof callback === 'function' ? callback() : undefined
    }
  }

  // Close the database connection. This is needed so nodejs can shut down cleanly.
  this.closeDb = function () {
    __guardMethod__(db, 'close', o => o.close())
    return (db = null)
  }
}

// Model inherits from EventEmitter.
Model.prototype = new EventEmitter()

function __guardMethod__(obj, methodName, transform) {
  if (
    typeof obj !== 'undefined' &&
    obj !== null &&
    typeof obj[methodName] === 'function'
  ) {
    return transform(obj, methodName)
  } else {
    return undefined
  }
}
